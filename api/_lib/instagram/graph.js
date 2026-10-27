import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';

export function createGraph({env=process.env,fetch:request=fetch,sleep:pause=sleep,log=console.log}={}){
  async function send(igsid,body){
    if(env.IG_DRY_RUN==='true'){
      // Only opt-in local simulation prints message text; never identifiers or credentials.
      if(env.VERCEL_ENV==='production') throw new Error('Dry run não permitido em produção');
      log({instagram_dry_run:true,...body});return {message_id:`dry-${randomUUID()}`};
    }
    if(!env.IG_ACCESS_TOKEN||!/^v\d+\.\d+$/.test(env.META_GRAPH_VERSION||'')) throw new Error('Instagram não configurado');
    for(let attempt=0;attempt<3;attempt++){
      const response=await request(`https://graph.instagram.com/${env.META_GRAPH_VERSION}/me/messages`,{
        method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${env.IG_ACCESS_TOKEN}`},
        body:JSON.stringify({recipient:{id:igsid},...body}),signal:AbortSignal.timeout(5000)
      });
      if(response.ok){const result=await response.json();if(body.message&&!result.message_id) throw new Error('Instagram não confirmou o envio');return result;}
      if((response.status===429||response.status>=500)&&attempt<2){
        const retryAfter=Number(response.headers.get('retry-after'))*1000;
        await pause(Math.min(2000,Math.max(retryAfter||0,250*2**attempt)));continue;
      }
      throw new Error('Não foi possível enviar a mensagem no Instagram');
    }
  }
  return {
    sendText:(id,text)=>{
      if(!text||Buffer.byteLength(text)>1000) throw new Error('Texto excede o limite do Instagram');
      return send(id,{message:{text}});
    },
    sendImage:(id,url)=>{
      if(!/^https:\/\//.test(url)) throw new Error('Imagem inválida');
      return send(id,{message:{attachment:{type:'image',payload:{url}}}});
    },
    markSeen:id=>send(id,{sender_action:'mark_seen'}),
    typing:(id,active=true)=>send(id,{sender_action:active?'typing_on':'typing_off'})
  };
}
export const {sendText,sendImage,markSeen,typing}=createGraph();
