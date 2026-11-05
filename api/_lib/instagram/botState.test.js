import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './test-db.js';
import {readBotState,setBotEnabled,canBotReply} from './botState.js';
import {createHandler} from './handler.js';

test('interruptor global preserva bloqueio do servidor e só reabre para mensagens novas',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const env={IG_BUSINESS_ID:'loja',IG_BOT_ENABLED:'true'};
  assert.equal((await readBotState(sql,env)).enabled,true);
  await setBotEnabled(sql,false);
  assert.equal((await readBotState(sql,env)).enabled,false);
  assert.equal(await canBotReply(sql,env,Date.now()),false);
  const switched=await setBotEnabled(sql,true);
  assert.equal(await canBotReply(sql,env,new Date(switched.enabled_at).getTime()-1),false);
  assert.equal(await canBotReply(sql,env,new Date(switched.enabled_at).getTime()+1000),true);
  env.IG_BOT_ENABLED='false';
  assert.equal((await readBotState(sql,env)).enabled,false);
});

test('bot desligado grava mensagens e não responde ao religar eventos antigos ou resposta em andamento',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const env={IG_BUSINESS_ID:'loja',IG_BOT_ENABLED:'true'};
  const sent=[];let release,started;
  const gate=new Promise(resolve=>{release=resolve;});
  const ready=new Promise(resolve=>{started=resolve;});
  const handle=createHandler({sql,env,graph:{sendText:async(_,text)=>{sent.push(text);return {message_id:'out-'+sent.length};}},agent:async()=>{started();await gate;return {text:'Resposta em andamento'};}});
  const event=(mid,timestamp=Date.now())=>({sender:{id:'cliente'},recipient:{id:'loja'},timestamp,message:{mid,text:'Olá'}});
  const processing=handle(event('in-flight'));
  await ready;
  await setBotEnabled(sql,false);
  release();await processing;
  assert.equal(sent.length,0);
  const old=event('during-off');
  const persisted=await handle(old,{persistOnly:true});
  assert.ok(persisted);
  const switched=await setBotEnabled(sql,true);
  await handle(old,{persisted});
  assert.equal(sent.length,0);
  await handle(event('new',new Date(switched.enabled_at).getTime()+1000));
  assert.equal(sent.length,1);
  assert.equal((await sql`select count(*)::int as count from public.ig_messages where direction='in'`)[0].count,3);
});
