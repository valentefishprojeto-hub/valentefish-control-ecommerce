import postgres from 'postgres';

let client;

export function db(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  if(!client){
    client=postgres(process.env.DATABASE_URL,{
      ssl:'require',
      max:3,
      idle_timeout:20,
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
