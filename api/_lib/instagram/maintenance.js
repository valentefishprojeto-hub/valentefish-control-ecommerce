import {db} from '../db.js';
import {ensureFreshToken,checkApi} from './token.js';

// Tarefa diária: renova o token, confere a API e apaga conversas além do prazo da política (180 dias).
// Cada etapa roda mesmo se a anterior falhar; o resultado traz só estados, nunca tokens ou textos.
export async function runMaintenance({sql=db(),env=process.env,fetch:request=fetch,now=new Date()}={}){
  const result={};
  try{
    const token=await ensureFreshToken({sql,env,fetch:request,now});
    result.token={acao:token.action,vence_em:token.expiresAt?new Date(token.expiresAt).toISOString().slice(0,10):null};
  }catch(error){
    result.token={acao:'falhou',erro:String(error?.message||error).slice(0,160)};
    console.error(`Instagram: renovação do token falhou (${result.token.erro}); gere um token novo se ele estiver perto de vencer`);
  }
  try{
    result.api=await checkApi({sql,env,fetch:request});
    if(result.api.ok===false) console.warn(`Instagram: a Graph API recusou o token (HTTP ${result.api.status||'sem resposta'}); confira o Alert Inbox do app na Meta`);
  }catch{
    result.api={ok:false,motivo:'erro'};
  }
  try{
    const [messages]=await sql`with gone as (delete from public.ig_messages where created_at < ${now}::timestamptz - interval '180 days' returning 1) select count(*)::int as n from gone`;
    const [handoffs]=await sql`with gone as (delete from public.ig_handoffs where created_at < ${now}::timestamptz - interval '180 days' returning 1) select count(*)::int as n from gone`;
    const [conversations]=await sql`with gone as (delete from public.ig_conversations c where c.updated_at < ${now}::timestamptz - interval '180 days'
      and not exists (select 1 from public.ig_messages m where m.conversation_id=c.id) returning 1) select count(*)::int as n from gone`;
    result.limpeza={mensagens:messages.n,encaminhamentos:handoffs.n,conversas:conversations.n};
  }catch{
    result.limpeza={erro:true};
  }
  return result;
}
