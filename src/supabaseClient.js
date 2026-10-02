import {createClient} from '@supabase/supabase-js';

let client;

export function supabasePublicConfig(){
  return {
    url:import.meta.env.VITE_SUPABASE_URL||'',
    key:import.meta.env.VITE_SUPABASE_ANON_KEY||''
  };
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
