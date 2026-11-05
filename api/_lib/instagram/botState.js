export async function readBotState(sql,env=process.env){
  const serverEnabled=env.IG_BOT_ENABLED==='true';
  try{
    const [row]=await sql`select enabled,enabled_at from public.ig_bot_settings where id=1`;
    // A linha única é criada pela migration. Sem ela, a configuração falha fechada.
    if(!row) return {available:false,serverEnabled,storedEnabled:false,enabled:false,enabledAt:null};
    return {available:true,serverEnabled,storedEnabled:row.enabled,enabled:serverEnabled&&row.enabled,enabledAt:row.enabled_at};
  }catch(error){
    // Deploy de código antes da migration: preserva o comportamento anterior;
    // o painel sinaliza que o novo interruptor ainda não está disponível.
    if(error.code==='42P01') return {available:false,serverEnabled,storedEnabled:null,enabled:serverEnabled,enabledAt:null};
    throw error;
  }
}

export async function canBotReply(sql,env,timestamp){
  if(env.IG_BOT_ENABLED!=='true') return false;
  const state=await readBotState(sql,env);
  if(!state.enabled) return false;
  if(!state.enabledAt) return true;
  return Number.isFinite(timestamp)&&timestamp>new Date(state.enabledAt).getTime();
}

export async function setBotEnabled(sql,enabled){
  if(typeof enabled!=='boolean') throw new TypeError('Estado do bot inválido');
  return sql.begin(async tx=>{
    const [current]=await tx`select id,enabled,enabled_at from public.ig_bot_settings where id=1 for update`;
    if(!current) throw new Error('Configuração do bot não encontrada');
    if(current.enabled===enabled) return current;
    const [updated]=await tx`update public.ig_bot_settings set enabled=${enabled},enabled_at=case when ${enabled} then clock_timestamp() else enabled_at end where id=1 returning id,enabled,enabled_at`;
    return updated;
  });
}
