function supabaseConfig(){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key||key==='[SENSITIVE]') throw new Error('Supabase Auth não configurado');
  return {url,key};
}

export async function currentUser(req,{required=false}={}){
  const authorization=req.headers.authorization;
  if(!authorization?.startsWith('Bearer ')){
    if(required) throw Object.assign(new Error('Faça login para continuar'),{status:401});
    return null;
  }
  const {url,key}=supabaseConfig();
  const response=await fetch(`${url}/auth/v1/user`,{
    headers:{apikey:key,authorization}
  });
  if(!response.ok){
    if(required) throw Object.assign(new Error('Sessão inválida ou expirada'),{status:401});
    return null;
  }
  return response.json();
}
