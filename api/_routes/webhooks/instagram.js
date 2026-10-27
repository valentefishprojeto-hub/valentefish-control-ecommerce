import {waitUntil} from '@vercel/functions';
import {fail,method} from '../../_lib/http.js';
import {readRawBody,verifySignature} from '../../_lib/instagram/signature.js';

export function createWebhook({env=process.env,waitUntil:background=waitUntil,processPayload}={}){
  return async function instagram(req,res){
    if(!method(req,res,['GET','POST'])) return;
    if(req.method==='GET'){
      const q=req.query||{};
      if(env.META_VERIFY_TOKEN&&q['hub.mode']==='subscribe'&&q['hub.verify_token']===env.META_VERIFY_TOKEN&&typeof q['hub.challenge']==='string'){
        return res.status(200).send(q['hub.challenge']);
      }
      return res.status(403).json({error:'Verificação não autorizada'});
    }
    if(!env.META_APP_SECRET) return res.status(503).json({error:'Webhook não configurado'});
    let payload;
    try{
      const raw=await readRawBody(req);
      if(!verifySignature(raw,req.headers['x-hub-signature-256'],env.META_APP_SECRET)) return res.status(401).json({error:'Assinatura inválida'});
      payload=JSON.parse(raw.toString('utf8'));
      if(payload?.object!=='instagram'||!Array.isArray(payload.entry)) return res.status(400).json({error:'Evento inválido'});
    }catch(error){
      // Do not log provider payloads or secrets through fail().
      return fail(res,new Error(error.status===413?'Evento muito grande':'Não foi possível ler os bytes crus do evento'),error.status||400);
    }
    res.status(200).send('EVENT_RECEIVED');
    background(new Promise(resolve=>setImmediate(resolve)).then(async()=>{
      const process=processPayload||(await import('../../_lib/instagram/handler.js')).processPayload;
      await process(payload);
    }).catch(()=>console.error('Falha no processamento do Instagram; verificar atendimento pendente')));
  };
}
export default createWebhook();
