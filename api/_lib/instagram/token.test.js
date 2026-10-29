import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './test-db.js';
import {accessToken,clearTokenCache,ensureFreshToken,envHash} from './token.js';
import {runMaintenance} from './maintenance.js';

const DAY=24*3600*1000;
function meta(calls,{fail=false}={}){
  return async url=>{
    const href=String(url);calls.push(href);
    if(href.includes('refresh_access_token')){
      if(fail) return new Response('{}',{status:400});
      return new Response(JSON.stringify({access_token:`IG-renovado-${calls.length}`,token_type:'bearer',expires_in:60*24*3600}));
    }
    return new Response(JSON.stringify({user_id:'1'}),{status:fail?400:200});
  };
}

test('token: começa da Vercel, renova perto do vencimento e reinicia quando a variável muda',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const env={IG_ACCESS_TOKEN:'IG-da-vercel',IG_BUSINESS_ID:'178',META_GRAPH_VERSION:'v23.0'};
  const calls=[];

  // Sem linha no banco: usa a variável da Vercel
  clearTokenCache();
  assert.equal(await accessToken(env,{sql}),'IG-da-vercel');

  // Primeira execução: renova a partir da variável e guarda
  const first=await ensureFreshToken({sql,env,fetch:meta(calls)});
  assert.equal(first.action,'iniciado');
  assert.match(calls[0],/grant_type=ig_refresh_token/);
  assert.match(calls[0],/access_token=IG-da-vercel/);
  const [row]=await sql`select * from ig_credentials`;
  assert.equal(row.env_hash,envHash('IG-da-vercel'));
  clearTokenCache();
  assert.match(await accessToken(env,{sql}),/^IG-renovado-/);

  // Longe do vencimento: não chama a Meta
  const before=calls.length;
  assert.equal((await ensureFreshToken({sql,env,fetch:meta(calls)})).action,'valido');
  assert.equal(calls.length,before);

  // Faltando menos de 15 dias: renova usando o token guardado
  const later=new Date(Date.now()+50*DAY);
  const renewed=await ensureFreshToken({sql,env,fetch:meta(calls),now:later});
  assert.equal(renewed.action,'renovado');
  assert.match(calls.at(-1),/access_token=IG-renovado-/);

  // Troca de conta na Vercel: ignora o guardado e recomeça do token novo
  const novaConta={...env,IG_ACCESS_TOKEN:'IG-valentefish',IG_BUSINESS_ID:'999'};
  clearTokenCache();
  assert.equal(await accessToken(novaConta,{sql}),'IG-valentefish','nunca usa o token da conta antiga');
  assert.equal((await ensureFreshToken({sql,env:novaConta,fetch:meta(calls)})).action,'iniciado');
  assert.match(calls.at(-1),/access_token=IG-valentefish/);

  // Token guardado vencido: volta para a variável
  await sql`update ig_credentials set expires_at=now()-interval '1 day'`;
  clearTokenCache();
  assert.equal(await accessToken(novaConta,{sql}),'IG-valentefish');
});

test('token: banco indisponível nunca derruba o bot',async()=>{
  clearTokenCache();
  const broken=()=>{throw new Error('sem banco');};
  assert.equal(await accessToken({IG_ACCESS_TOKEN:'IG-fallback'},{sql:broken}),'IG-fallback');
});

test('manutenção: renova, confere a API e apaga conversas com mais de 180 dias',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const env={IG_ACCESS_TOKEN:'IG-da-vercel',IG_BUSINESS_ID:'178',META_GRAPH_VERSION:'v23.0'};
  const [old]=await sql`insert into ig_conversations(igsid) values ('antigo') returning id`;
  const [recent]=await sql`insert into ig_conversations(igsid) values ('recente') returning id`;
  await sql`insert into ig_messages(conversation_id,mid,direction,author,text,created_at) values (${old.id},'m-old','in','customer','oi',now()-interval '200 days')`;
  await sql`insert into ig_messages(conversation_id,mid,direction,author,text) values (${recent.id},'m-new','in','customer','oi')`;
  // O trigger de updated_at sempre grava now(); desligado só para simular uma conversa antiga.
  await sql`alter table ig_conversations disable trigger ig_conversations_set_updated_at`;
  await sql`update ig_conversations set updated_at=now()-interval '200 days' where id=${old.id}`;
  await sql`alter table ig_conversations enable trigger ig_conversations_set_updated_at`;

  clearTokenCache();
  const result=await runMaintenance({sql,env,fetch:meta([])});
  assert.equal(result.token.acao,'iniciado');
  assert.equal(result.api.ok,true);
  assert.deepEqual(result.limpeza,{mensagens:1,encaminhamentos:0,conversas:1});
  assert.equal((await sql`select count(*)::int n from ig_messages`)[0].n,1);
  assert.equal(JSON.stringify(result).includes('IG-'),false,'resultado não expõe token');

  // Meta recusando: a manutenção não quebra e registra a falha
  clearTokenCache();
  const failed=await runMaintenance({sql,env:{...env,IG_ACCESS_TOKEN:'IG-outro'},fetch:meta([],{fail:true})});
  assert.equal(failed.token.acao,'falhou');
  assert.equal(failed.api.ok,false);
});
