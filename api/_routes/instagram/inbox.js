import {adminOnly} from '../../_lib/auth.js';
import {db} from '../../_lib/db.js';
import {body,method} from '../../_lib/http.js';
import {lookupUsername} from '../../_lib/instagram/profile.js';

const uuid=value=>typeof value==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);

export function createInboxHandler({sql:client,authenticate,roleOf,env=process.env,resolveUsername=lookupUsername}={}){
  const handler=async(req,res)=>{
    if(!method(req,res,['GET','POST'])) return;
    const sql=client||db();
    try{
      if(req.method==='GET'){
        const id=req.query?.id;
        if(id!==undefined){
          if(!uuid(id)) return res.status(422).json({error:'Conversa inválida'});
          let [conversation]=await sql`select id,igsid,username,status,paused_until,last_customer_message_at,handoff_reason,created_at,updated_at from public.ig_conversations where id=${id}`;
          if(!conversation) return res.status(404).json({error:'Conversa não encontrada'});
          if(!conversation.username){
            const username=await resolveUsername(conversation.igsid,{env,sql});
            if(username&&/^[a-zA-Z0-9._]{1,30}$/.test(username)){
              [conversation]=await sql`update public.ig_conversations set username=${username} where id=${id} and username is null returning id,igsid,username,status,paused_until,last_customer_message_at,handoff_reason,created_at,updated_at`;
              conversation||= (await sql`select id,igsid,username,status,paused_until,last_customer_message_at,handoff_reason,created_at,updated_at from public.ig_conversations where id=${id}`)[0];
            }
          }
          const [messages,handoffs]=await Promise.all([
            sql`select id,direction,author,text,attachments,tool_calls,created_at from public.ig_messages where conversation_id=${id} order by created_at desc,id desc limit 100`,
            sql`select id,reason,summary,resolved_at,created_at from public.ig_handoffs where conversation_id=${id} order by created_at desc limit 10`
          ]);
          return res.status(200).json({conversation,messages:messages.reverse(),handoffs,botEnabled:env.IG_BOT_ENABLED==='true'});
        }
        const conversations=await sql`select c.id,c.igsid,c.username,c.status,c.paused_until,c.last_customer_message_at,c.handoff_reason,
          last_message.text as last_text,last_message.author as last_author,last_message.created_at as last_message_at
          from public.ig_conversations c
          left join lateral (select text,author,created_at from public.ig_messages where conversation_id=c.id order by created_at desc,id desc limit 1) last_message on true
          order by coalesce(last_message.created_at,c.updated_at) desc,c.id desc limit 50`;
        return res.status(200).json({conversations,botEnabled:env.IG_BOT_ENABLED==='true'});
      }
      const input=body(req);
      if(!uuid(input.id)||!['pause','resume'].includes(input.action)) return res.status(422).json({error:'Ação ou conversa inválida'});
      const conversation=await sql.begin(async tx=>{
        const [current]=await tx`select id from public.ig_conversations where id=${input.id} for update`;
        if(!current) return null;
        if(input.action==='pause'){
          const hours=Math.min(168,Math.max(1,Number(env.IG_HUMAN_PAUSE_HOURS)||12));
          const [updated]=await tx`update public.ig_conversations set status='human',paused_until=now()+(${hours}*interval '1 hour'),handoff_reason='pausa_admin' where id=${input.id} returning id,igsid,username,status,paused_until,last_customer_message_at,handoff_reason,created_at,updated_at`;
          return updated;
        }
        const [updated]=await tx`update public.ig_conversations set status='bot',paused_until=null,handoff_reason=null where id=${input.id} returning id,igsid,username,status,paused_until,last_customer_message_at,handoff_reason,created_at,updated_at`;
        await tx`update public.ig_handoffs set resolved_at=now() where conversation_id=${input.id} and resolved_at is null`;
        return updated;
      });
      return res.status(conversation?200:404).json(conversation?{conversation}:{error:'Conversa não encontrada'});
    }catch{
      console.error('Instagram: não foi possível carregar a caixa de entrada');
      return res.status(503).json({error:'Não foi possível carregar as conversas do Instagram'});
    }
  };
  return adminOnly(handler,{...(authenticate?{authenticate}:{}),...(roleOf?{roleOf}:{}),env});
}

export default createInboxHandler();
