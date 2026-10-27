// Only names and states leave this module. Never return environment values.
const present=value=>typeof value==='string'&&!!value.trim()&&!/^(changeme|replace_me|<.*>)$/i.test(value.trim());
const url=(value,protocols)=>{try{const parsed=new URL(value);return protocols.includes(parsed.protocol)&&!!parsed.hostname&&!parsed.username&&!parsed.password;}catch{return false;}};
export function inspectConfig(env=process.env,{scope='dm'}={}){
  if(!['dm','publishing'].includes(scope)) throw new Error('Escopo inválido: use dm ou publishing');
  const checks=[];
  function check(name,validate=present,required=true){
    const value=env[name];
    checks.push({name,required,status:!present(value)?'ausente':validate(value)?'configurado':'inválido'});
  }
  check('DATABASE_URL',v=>{try{return ['postgres:','postgresql:'].includes(new URL(v).protocol);}catch{return false;}});
  check('APP_URL',v=>url(v,['https:']));
  check('IG_BUSINESS_ID',v=>/^\d+$/.test(v));
  check('IG_ACCESS_TOKEN');check('META_GRAPH_VERSION',v=>/^v\d+\.\d+$/.test(v));
  if(scope==='dm'){
    check('META_APP_SECRET');check('META_VERIFY_TOKEN');check('ANTHROPIC_API_KEY',present,false);check('ANTHROPIC_MODEL',present,false);
    check('IG_BOT_ENABLED',v=>['true','false'].includes(v));
    check('IG_HUMAN_PAUSE_HOURS',v=>Number.isFinite(Number(v))&&Number(v)>0,false);
    check('MELHOR_ENVIO_TOKEN',present,false);check('STORE_POSTAL_CODE',v=>/^\d{8}$/.test(v),false);
  }else{
    check(env.SUPABASE_URL?'SUPABASE_URL':'NEXT_PUBLIC_SUPABASE_URL',v=>url(v,['https:']));
    check(env.SUPABASE_SERVICE_ROLE_KEY?'SUPABASE_SERVICE_ROLE_KEY':'SUPABASE_SECRET_KEY');
    check('CRON_SECRET');check('IG_PUBLISH_ENABLED',v=>['true','false'].includes(v));
  }
  check('IG_API_HOST',v=>['graph.instagram.com','graph.facebook.com'].includes(v),false);
  check('IG_DRY_RUN',v=>['true','false'].includes(v),false);
  const errors=checks.filter(x=>(x.required&&x.status==='ausente')||x.status==='inválido').map(x=>x.name);
  if(env.VERCEL_ENV==='production'&&env.IG_DRY_RUN==='true') errors.push('IG_DRY_RUN não permitido em produção');
  return {scope,configured:errors.length===0,connectionVerified:false,enabled:env[scope==='dm'?'IG_BOT_ENABLED':'IG_PUBLISH_ENABLED']==='true',checks,errors};
}
