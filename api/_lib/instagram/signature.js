import {createHmac,timingSafeEqual} from 'node:crypto';

export async function readRawBody(req){
  // Never read req.body: Vercel exposes a lazy JSON parser there.
  const unavailable=()=>Object.assign(new Error('Bytes crus indisponíveis; não é seguro reconstruir o body'),{status:400});
  if(Buffer.isBuffer(req.rawBody)){
    if(req.rawBody.length>1024*1024) throw Object.assign(new Error('Evento muito grande'),{status:413});
    return req.rawBody;
  }
  // Vercel restores data/end on a PassThrough but leaves readableEnded=true
  // on IncomingMessage. Its async iterator therefore cannot read the replay.
  if(req.readableEnded&&!Object.hasOwn(req,'read')) throw unavailable();
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0;
    const timer=setTimeout(()=>reject(unavailable()),3000);
    const fail=error=>{clearTimeout(timer);reject(error);};
    req.on('error',fail);
    req.on('aborted',()=>fail(unavailable()));
    req.on('data',chunk=>{
      const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;
      if(size>1024*1024){fail(Object.assign(new Error('Evento muito grande'),{status:413}));return;}
      chunks.push(bytes);
    });
    req.on('end',()=>{clearTimeout(timer);size?resolve(Buffer.concat(chunks)):reject(unavailable());});
  });
}

export function verifySignature(raw,signature,secret){
  if(!secret||typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected=createHmac('sha256',secret).update(raw).digest();
  return timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex'));
}

// Apps Meta com Instagram Login têm dois segredos (App secret e Instagram app secret)
// e a Meta assina com um deles conforme a configuração do webhook. Aceita qualquer um.
export function webhookSecrets(env=process.env){
  return [env.META_APP_SECRET,env.INSTAGRAM_APP_SECRET].map(value=>typeof value==='string'?value.trim():'').filter(Boolean);
}

export function verifyAnySignature(raw,signature,secrets){
  return secrets.some(secret=>verifySignature(raw,signature,secret));
}
