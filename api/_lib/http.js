import crypto from 'node:crypto';

export function method(req,res,allowed){
  if(allowed.includes(req.method)) return true;
  res.setHeader('Allow',allowed.join(', '));
  res.status(405).json({error:'Método não permitido'});
  return false;
}

export function body(req){
  if(!req.body) return {};
  if(typeof req.body==='string'){
    try{return JSON.parse(req.body)}catch{return {}}
  }
  return req.body;
}

export function cookies(req){
  return Object.fromEntries((req.headers.cookie||'').split(';').map(value=>value.trim()).filter(Boolean).map(value=>{
    const index=value.indexOf('=');
    return [decodeURIComponent(value.slice(0,index)),decodeURIComponent(value.slice(index+1))];
  }));
}

export function ensureGuestToken(req,res){
  const existing=cookies(req).vf_guest;
  if(existing&&/^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const token=crypto.randomUUID();
  res.setHeader('Set-Cookie',`vf_guest=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.VERCEL_ENV==='production'?'; Secure':''}`);
  return token;
}

export function appUrl(req){
  if(process.env.APP_URL) return process.env.APP_URL.replace(/\/$/,'');
  const protocol=(req.headers['x-forwarded-proto']||'https').split(',')[0];
  const host=req.headers['x-forwarded-host']||req.headers.host;
  return `${protocol}://${host}`;
}

export function fail(res,error,status=500){
  const message=error instanceof Error?error.message:String(error);
  const nextStatus=/máximo 40|vitrine|estoque insuficiente|Categoria não|Produto não/i.test(message)?409:status;
  console.error(error);
  res.status(nextStatus).json({error:message||'Não foi possível concluir a operação'});
}
