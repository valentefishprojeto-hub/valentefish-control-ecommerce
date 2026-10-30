import postgres from 'postgres';

let client;

// Na Vercel cada instância abre as próprias conexões. O pooler do Supabase em modo sessão (5432)
// reserva uma vaga por conexão (limite 15) e esgota quando o admin carrega várias telas ao mesmo tempo;
// o modo transação (6543) compartilha as vagas e é o indicado para serverless.
export function poolerUrl(url){
  try{
    const parsed=new URL(url);
    if(parsed.hostname.endsWith('.pooler.supabase.com')&&parsed.port==='5432'){parsed.port='6543';return parsed.toString();}
  }catch{}
  return url;
}

export function db(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  if(!client){
    client=postgres(poolerUrl(process.env.DATABASE_URL),{
      ssl:'require',
      max:2,
      idle_timeout:5,
      connect_timeout:10,
      prepare:false
    });
  }
  return client;
}

export function moneyToCents(value){
  return Math.round(Number(value)*100);
}

export function centsToMoney(value){
  return Number((Number(value)/100).toFixed(2));
}
