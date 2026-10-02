import {getSupabase} from './supabaseClient';

export function mapUser(user,session){
  if(!user) return null;
  const metadata=user.user_metadata||{};
  return {
    id:user.id,
    name:metadata.full_name||metadata.name||user.email?.split('@')[0]||'Cliente',
    email:user.email||metadata.email||'',
    phone:metadata.phone||metadata.phone_number||user.phone||'',
    avatar:metadata.avatar_url||metadata.picture||'',
    provider:user.app_metadata?.provider||'email',
    accessToken:session?.access_token||null
  };
}

export async function currentSession(){
  const supabase=getSupabase();
  const {data,error}=await supabase.auth.getSession();
  if(error) throw error;
  return mapUser(data.session?.user,data.session);
}

export function onAuthChange(callback){
  const supabase=getSupabase();
  const {data}=supabase.auth.onAuthStateChange((_event,session)=>{
    callback(mapUser(session?.user,session));
  });
  return ()=>data.subscription.unsubscribe();
}

export async function registerAccount({name,email,password,phone}){
  const supabase=getSupabase();
  const {data,error}=await supabase.auth.signUp({
    email,
    password,
    options:{
      data:{full_name:name,name,phone},
      emailRedirectTo:`${window.location.origin}/conta`
    }
  });
  if(error) throw error;
  if(data.user) await syncProfile(data.user, {fullName:name,phone});
  return {session:mapUser(data.user,data.session),needsEmailConfirmation:!data.session};
}

export async function loginAccount({email,password}){
  const supabase=getSupabase();
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) throw error;
  return mapUser(data.user,data.session);
}

export async function loginWithGoogle(next='/conta'){
  const supabase=getSupabase();
  sessionStorage.setItem('vf-next',next);
  const {data,error}=await supabase.auth.signInWithOAuth({
    provider:'google',
    options:{
      redirectTo:`${window.location.origin}/conta`,
      queryParams:{access_type:'offline',prompt:'select_account'},
      scopes:'openid email profile',
      skipBrowserRedirect:true
    }
  });
  if(error) throw error;
  if(!data?.url) throw new Error('Não foi possível iniciar o login com Google.');
  const probe=await fetch(data.url,{redirect:'manual'}).catch(()=>null);
  if(probe){
    const body=await probe.clone().text().catch(()=> '');
    if(/provider is not enabled|unsupported provider/i.test(body)){
      throw new Error('O login com Google ainda precisa ser ativado no Supabase.');
    }
  }
  window.location.assign(data.url);
}

export async function logoutAccount(){
  const supabase=getSupabase();
  const {error}=await supabase.auth.signOut();
  if(error) throw error;
}

export async function syncProfile(user, {fullName,phone}={}){
  const supabase=getSupabase();
  const metadata=user.user_metadata||{};
  await supabase.from('profiles').upsert({
    id:user.id,
    full_name:fullName||metadata.full_name||metadata.name||null,
    phone:phone||metadata.phone||null,
    avatar_url:metadata.avatar_url||metadata.picture||null
  });
}

export async function loadProfile(){
  const supabase=getSupabase();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user) return null;
  const {data}=await supabase.from('profiles').select('full_name,phone,avatar_url').eq('id',auth.user.id).maybeSingle();
  const session=mapUser(auth.user,(await supabase.auth.getSession()).data.session);
  return {
    ...session,
    name:data?.full_name||session.name,
    phone:data?.phone||session.phone,
    avatar:data?.avatar_url||session.avatar
  };
}

export async function updateAccount({name,phone}){
  const supabase=getSupabase();
  const {data:auth,error:authError}=await supabase.auth.updateUser({data:{full_name:name,name,phone}});
  if(authError) throw authError;
  await syncProfile(auth.user,{fullName:name,phone});
  return loadProfile();
}

export function authMessage(error){
  const text=String(error?.message||error||'');
  if(/invalid login/i.test(text)) return 'E-mail ou senha inválidos.';
  if(/already registered|already been registered/i.test(text)) return 'Este e-mail já possui uma conta. Entre para continuar.';
  if(/provider is not enabled|unsupported provider/i.test(text)) return 'O login com Google ainda precisa ser ativado no Supabase.';
  if(/email not confirmed/i.test(text)) return 'Confirme seu e-mail para entrar.';
  if(/Autenticação ainda não configurada/i.test(text)) return 'Configure as variáveis públicas do Supabase para ativar o login.';
  return text||'Não foi possível concluir a autenticação.';
}
