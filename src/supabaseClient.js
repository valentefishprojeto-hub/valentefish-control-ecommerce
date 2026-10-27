import {createClient} from '@supabase/supabase-js';

let client;
let runtimeConfig={url:'',key:''};

export function supabasePublicConfig(){
  return {
    url:import.meta.env.VITE_SUPABASE_URL||runtimeConfig.url||'',
    key:import.meta.env.VITE_SUPABASE_ANON_KEY||runtimeConfig.key||''
  };
}

// Sem VITE_* no build, busca a URL e a chave pública expostas pelo servidor em /api/config.
export async function loadSupabaseConfig(){
  const {url,key}=supabasePublicConfig();
  if(url&&key) return;
  try{
    const response=await fetch('/api/config');
    if(!response.ok) return;
    const data=await response.json();
    runtimeConfig={url:data?.supabase?.url||'',key:data?.supabase?.key||''};
  }catch{}
}

export function getSupabase(){
  if(client) return client;
  const {url,key}=supabasePublicConfig();
  if(!url||!key) throw new Error('Autenticação ainda não configurada');
  client=createClient(url,key,{
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true,
      flowType:'pkce'
    }
  });
  return client;
}
