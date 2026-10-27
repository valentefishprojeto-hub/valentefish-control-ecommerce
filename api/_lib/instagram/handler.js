import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {db} from '../db.js';
import {createGraph} from './graph.js';
import {createTools,pauseHours} from './tools.js';
import {runAgent,directAction} from './agent.js';
import {catalogReply} from './catalogReply.js';
import {splitText} from './text.js';
import {storyReply,smallTalk} from './conversation.js';

const active=conversation=>conversation.status==='bot'||conversation.status==='human'&&conversation.paused_until&&new Date(conversation.paused_until)<=new Date();
const inWindow=conversation=>{
  const time=new Date(conversation.last_customer_message_at).getTime();
  return Number.isFinite(time)&&time<=Date.now()&&Date.now()-time<24*3600000;
};

export function createHandler({sql,env=process.env,graph=createGraph({env}),agent=runAgent}={}){
  return async function handle(event,{persistOnly=false,persisted:preloaded}={}){
    sql ||= db();
    const message=event?.message;
    if(!message||typeof message.mid!=='string'||message.mid.length>500||message.is_deleted) return;
    const echo=message.is_echo===true||event.sender?.id===env.IG_BUSINESS_ID;
    if(!env.IG_BUSINESS_ID||(echo?event.sender?.id:event.recipient?.id)!==env.IG_BUSINESS_ID) return;
    const igsid=echo?event.recipient?.id:event.sender?.id;
    if(typeof igsid!=='string'||igsid.length>200||igsid===env.IG_BUSINESS_ID) return;
    const timestamp=Number(event.timestamp);
    if(!Number.isFinite(timestamp)||timestamp<=0||timestamp>Date.now()+300000) return;
    if(echo){
      let previous=null;
      const echoReason='echo:'+message.mid;
      // A delivery echo can arrive before the Graph response is persisted. Wait
      // only while an outbound send is in flight; never match human text by value.
      for(let attempt=0;attempt<100;attempt++){
        const [known]=await sql`select id from public.ig_messages where mid=${message.mid} and direction='out' and author='bot'`;
        if(known){
          if(previous) await sql`update public.ig_conversations set status=${previous.status},paused_until=${previous.paused_until},handoff_reason=${previous.handoff_reason}
            where id=${previous.id} and handoff_reason=${echoReason}`;
          return;
        }
        const [pending]=await sql`select m.id from public.ig_messages m join public.ig_conversations c on c.id=m.conversation_id
          where c.igsid=${igsid} and m.mid like 'pending:%' and m.created_at>now()-interval '25 seconds' limit 1`;
        if(!pending) break;
        if(!previous){
          previous=await sql.begin(async tx=>{
            const [row]=await tx`select * from public.ig_conversations where igsid=${igsid} for update`;
            await tx`update public.ig_conversations set status='human',paused_until=now()+(${pauseHours(env)}*interval '1 hour'),handoff_reason=${echoReason} where id=${row.id}`;
            return row;
          });
        }
        await sleep(200);
      }
      const [confirmed]=await sql`select id from public.ig_messages where mid=${message.mid} and author='bot' and direction='out'`;
      if(confirmed){
        if(previous) await sql`update public.ig_conversations set status=${previous.status},paused_until=${previous.paused_until},handoff_reason=${previous.handoff_reason} where id=${previous.id} and handoff_reason=${echoReason}`;
        return;
      }
    }
    const text=typeof message.text==='string'?message.text.slice(0,8000):'';
    const attachments=Array.isArray(message.attachments)?message.attachments.slice(0,10).map(x=>({type:String(x?.type||'unknown').slice(0,30)})):[];
    const persisted=preloaded||await sql.begin(async tx=>{
      const [conversation]=await tx`insert into public.ig_conversations(igsid) values (${igsid}) on conflict (igsid) do update set igsid=excluded.igsid returning *`;
      const [inserted]=await tx`insert into public.ig_messages(conversation_id,mid,direction,author,text,attachments)
        values (${conversation.id},${message.mid},${echo?'out':'in'},${echo?'human':'customer'},${text},${tx.json(attachments)}) on conflict (mid) do nothing returning id`;
      if(!inserted) return null;
      if(echo){
        await tx`update public.ig_conversations set status='human',paused_until=now()+(${pauseHours(env)}*interval '1 hour'),handoff_reason='humano_no_instagram' where id=${conversation.id}`;
      }else{
        const [updated]=await tx`update public.ig_conversations set last_customer_message_at=greatest(last_customer_message_at,${new Date(Math.min(timestamp,Date.now()))}) where id=${conversation.id} returning *`;
        return {conversation:updated,messageId:inserted.id};
      }
      return null;
    });
    if(persistOnly) return persisted;
    if(!persisted||echo||env.IG_BOT_ENABLED!=='true') return;
    const {conversation,messageId}=persisted;
    if(!active(conversation)||!inWindow(conversation)) return;
    // Expiry reopens timed handoffs; closed conversations need explicit resumption.
    if(conversation.status==='human'){
      await sql`update public.ig_conversations set status='bot',paused_until=null,handoff_reason=null where id=${conversation.id} and paused_until<=now()`;
      await sql`update public.ig_handoffs set resolved_at=now() where conversation_id=${conversation.id} and resolved_at is null`;
    }
    const tools=createTools({sql,conversation,env,signal:AbortSignal.timeout(20000)});
    let result;
    try{
      const action=directAction(text);
      if(action?.handoff||attachments.some(x=>x.type==='image')){
        const handoff=await tools.encaminhar_humano({motivo:action?.handoff||'avaliacao_imagem',resumo:'Cliente precisa de especialista.'});
        result={text:(action?.prefix||'')+handoff.mensagem,handoff:true};
      }else if(action?.text){result=action;}
      else if(message.reply_to?.story){result={text:storyReply(text)};}
      else if(!text||attachments.length){result={text:'Ainda não consigo avaliar esse conteúdo. Pode enviar sua dúvida por texto?'};}
      else if(smallTalk(text)){result={text:smallTalk(text)};}
      else if(agent===runAgent&&(!env.ANTHROPIC_API_KEY||!env.ANTHROPIC_MODEL)){result=await catalogReply(text,tools);}
      else{
        const history=await sql`select author,text from public.ig_messages where conversation_id=${conversation.id} and id<>${messageId} order by created_at desc limit 12`;
        result=await agent({text,history:history.reverse(),tools,env});
      }
      const [previous]=await sql`select id from public.ig_messages where conversation_id=${conversation.id} and author='bot' limit 1`;
      if(!previous) result.text='Olá, sou o assistente virtual da Valente Fish! '+result.text;
      let parts;
      try{parts=splitText(result.text);}catch{
        const handoff=await tools.encaminhar_humano({motivo:'resposta_extensa',resumo:'A consulta precisa de atendimento humano.'});
        result={text:handoff.mensagem,handoff:true};parts=splitText(result.text);
      }
      for(const part of parts){
        let [current]=await sql`select * from public.ig_conversations where id=${conversation.id}`;
        for(let attempt=0;current.handoff_reason?.startsWith('echo:')&&attempt<100;attempt++){
          await sleep(200);
          [current]=await sql`select * from public.ig_conversations where id=${conversation.id}`;
        }
        if(env.IG_BOT_ENABLED!=='true'||!inWindow(current)||current.status==='closed'||current.handoff_reason==='humano_no_instagram'||current.handoff_reason?.startsWith('echo:')||!result.handoff&&!active(current)) break;
        const pendingMid='pending:'+randomUUID();
        const [pending]=await sql`insert into public.ig_messages(conversation_id,mid,direction,author,text,tool_calls)
          values (${conversation.id},${pendingMid},'out','bot',${part},${sql.json(result.toolCalls||[])}) returning id`;
        try{
          const sent=await graph.sendText(igsid,part);
          await sql`update public.ig_messages set mid=${sent.message_id} where id=${pending.id}`;
        }catch{
          await sql`update public.ig_messages set mid=${'failed:'+randomUUID()},text=null where id=${pending.id}`;
          throw new Error('Falha no envio');
        }
      }
    }catch{
      await tools.encaminhar_humano({motivo:'falha_processamento',resumo:'Verificar conversa manualmente.'});
      console.error('Instagram: atendimento encaminhado após falha');
    }
  };
}

export async function processPayload(payload,options={}){
  const handle=createHandler(options);
  const pending=[];
  // Persist the whole delivery before starting any LLM; ACK/waitUntil itself
  // is best-effort, not a durable queue (see operational limits in README).
  for(const entry of payload.entry||[]){
    if(entry.id!== (options.env||process.env).IG_BUSINESS_ID) continue;
    for(const event of entry.messaging||[]){
      try{const persisted=await handle(event,{persistOnly:true});if(persisted) pending.push({event,persisted});}
      catch{console.error('Instagram: não foi possível persistir evento');}
    }
  }
  for(const {event,persisted} of pending) await handle(event,{persisted});
}
