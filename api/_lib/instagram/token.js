import {createHash} from 'node:crypto';
import {db} from '../db.js';

// Tokens do Instagram Login valem ~60 dias e só podem ser renovados enquanto válidos.
// O banco guarda o token renovado; a variável da Vercel continua sendo a origem e o fallback.
const RENEW_BEFORE_MS=15*24*3600*1000;
const CACHE_MS=5*60*1000;
let cache=null;

export const envHash=token=>createHash('sha256').update(String(token||'')).digest('hex').slice(0,16);

function sameSource(row,env){
  return row&&row.env_hash===envHash(env.IG_ACCESS_TOKEN)&&(row.business_id||'')===(env.IG_BUSINESS_ID||'');
}

// Token para chamadas à Graph API. Nunca lança: qualquer problema com o banco usa a variável da Vercel.
export async function accessToken(env=process.env,{sql}={}){
  const fallback=env.IG_ACCESS_TOKEN||'';
  if(!fallback) return '';
  if(cache&&cache.hash===envHash(fallback)&&Date.now()-cache.at<CACHE_MS) return cache.token;
  try{
    const client=sql||db();
    const [row]=await client`select access_token,env_hash,business_id,expires_at from public.ig_credentials where id=1`;
    const valid=sameSource(row,env)&&(!row.expires_at||new Date(row.expires_at).getTime()>Date.now());
    const token=valid?row.access_token:fallback;
    cache={token,hash:envHash(fallback),at:Date.now()};
    return token;
  }catch{
    return fallback;
  }
}

export function clearTokenCache(){cache=null;}

async function refresh(token,{fetch:request=fetch}){
  const url=new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type','ig_refresh_token');
  url.searchParams.set('access_token',token);
  const response=await request(url,{signal:AbortSignal.timeout(10000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||typeof data.access_token!=='string'||!data.access_token) throw new Error(`Renovação recusada pela Meta (HTTP ${response.status})`);
  const seconds=Number(data.expires_in);
  return {token:data.access_token,expiresAt:Number.isFinite(seconds)&&seconds>0?new Date(Date.now()+seconds*1000):null};
}

// Renova quando faltar pouco para vencer, ou recomeça a partir da Vercel quando a variável mudou.
export async function ensureFreshToken({sql=db(),env=process.env,fetch:request=fetch,now=new Date()}={}){
  if(!env.IG_ACCESS_TOKEN) return {action:'sem_token'};
  // Token de usuário do sistema (graph.facebook.com) não expira e não usa esta renovação.
  if(env.IG_API_HOST==='graph.facebook.com') return {action:'nao_aplicavel'};
  const [row]=await sql`select access_token,env_hash,business_id,expires_at from public.ig_credentials where id=1`;
  const current=sameSource(row,env);
  const expiresAt=current&&row.expires_at?new Date(row.expires_at):null;
  if(current&&expiresAt&&expiresAt.getTime()-now.getTime()>RENEW_BEFORE_MS) return {action:'valido',expiresAt};
  const base=current&&expiresAt&&expiresAt>now?row.access_token:env.IG_ACCESS_TOKEN;
  const next=await refresh(base,{fetch:request});
  await sql`insert into public.ig_credentials(id,access_token,env_hash,business_id,expires_at,refreshed_at)
    values (1,${next.token},${envHash(env.IG_ACCESS_TOKEN)},${env.IG_BUSINESS_ID||null},${next.expiresAt},now())
    on conflict (id) do update set access_token=excluded.access_token,env_hash=excluded.env_hash,business_id=excluded.business_id,
      expires_at=excluded.expires_at,refreshed_at=excluded.refreshed_at`;
  clearTokenCache();
  return {action:current?'renovado':'iniciado',expiresAt:next.expiresAt};
}

// Confere se a Graph API aceita o token atual (detecta bloqueio do app ou token revogado).
export async function checkApi({sql=db(),env=process.env,fetch:request=fetch}={}){
  const token=await accessToken(env,{sql});
  if(!token||!/^v\d+\.\d+$/.test(env.META_GRAPH_VERSION||'')) return {ok:false,motivo:'instagram_nao_configurado'};
  if(env.IG_API_HOST==='graph.facebook.com') return {ok:null,motivo:'nao_aplicavel'};
  let ok=false,status=0;
  try{
    const response=await request(`https://graph.instagram.com/${env.META_GRAPH_VERSION}/me?fields=user_id`,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
    status=response.status;ok=response.ok;
  }catch{}
  await sql`update public.ig_credentials set last_check_at=now(),last_check_ok=${ok} where id=1`;
  return {ok,status};
}
