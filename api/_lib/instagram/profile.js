import {graphHost} from './graph.js';
import {accessToken} from './token.js';

// Um IGSID representa a pessoa nesta conversa; o perfil pode não estar disponível pela API.
export async function lookupUsername(igsid,{env=process.env,sql,fetch:request=fetch}={}){
  if(!/^\d{1,30}$/.test(igsid||'')||!env.IG_ACCESS_TOKEN||!/^v\d+\.\d+$/.test(env.META_GRAPH_VERSION||'')) return null;
  try{
    const token=await accessToken(env,{sql});
    const url=`https://${graphHost(env)}/${env.META_GRAPH_VERSION}/${igsid}?fields=username`;
    const response=await request(url,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(2500)});
    if(!response.ok) return null;
    const {username}=await response.json();
    return typeof username==='string'&&/^[a-zA-Z0-9._]{1,30}$/.test(username)?username:null;
  }catch{return null;}
}
