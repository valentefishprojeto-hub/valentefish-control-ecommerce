import {graphHost} from './graph.js';

export function publishingGraph({env=process.env,fetch:request=fetch}={}){
  const root=()=>{
    if(!env.IG_ACCESS_TOKEN||!/^\d+$/.test(env.IG_BUSINESS_ID||'')||!/^v\d+\.\d+$/.test(env.META_GRAPH_VERSION||'')) throw new Error('Publicação no Instagram não configurada');
    return `https://${graphHost(env)}/${env.META_GRAPH_VERSION}`;
  };
  async function call(path,input){
    const response=await request(root()+'/'+path,{method:input?'POST':'GET',headers:{authorization:`Bearer ${env.IG_ACCESS_TOKEN}`,...(input?{'content-type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{}),signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw new Error(`Instagram recusou a operação (HTTP ${response.status})`);
    return response.json();
  }
  // No automatic POST retries: a lost publish response is an uncertain delivery.
  return {
    async create({asset_url,caption,format}){const result=await call(`${env.IG_BUSINESS_ID}/media`,{image_url:asset_url,...(format==='story'?{media_type:'STORIES'}:{caption})});if(!result.id) throw new Error('Instagram não retornou o container');return String(result.id);},
    async status(id){const result=await call(`${encodeURIComponent(id)}?fields=status_code`);return result.status_code;},
    async publish(id){const result=await call(`${env.IG_BUSINESS_ID}/media_publish`,{creation_id:id});if(!result.id) throw new Error('Instagram não confirmou a publicação');return String(result.id);}
  };
}
