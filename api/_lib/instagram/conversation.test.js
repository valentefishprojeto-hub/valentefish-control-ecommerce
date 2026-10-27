import test from 'node:test';
import assert from 'node:assert/strict';
import {storyReply,smallTalk} from './conversation.js';
import {createHandler} from './handler.js';
import {testDatabase} from './test-db.js';

test('bate-papo não inventa preço, estoque ou permissões de publicação',()=>{
  for(const text of ['Muito obrigado!','Tudo bem?','Quero comprar','Tchau']) assert.ok(smallTalk(text));
  for(const text of ['Quero comprar yellow tang','publique um post','quanto custa?']) assert.equal(smallTalk(text),null);
  assert.match(storyReply('Quanto custa esse?'),/nome do produto/);
  assert.match(storyReply('🔥'),/Obrigado pela reação/);
  assert.doesNotMatch(storyReply('Quanto custa esse?'),/R\$|disponível/);
});

test('Story pede contexto, depois consulta agente; saúde e humano têm prioridade',async t=>{
  process.env.APP_URL='https://loja.test';
  const database=await testDatabase();t.after(()=>database.close());
  const sent=[];let calls=0;
  const handle=createHandler({sql:database.sql,env:{IG_BUSINESS_ID:'loja',IG_BOT_ENABLED:'true'},graph:{sendText:async(_,text)=>{sent.push(text);return {message_id:'out-'+sent.length};}},agent:async({text})=>{calls++;assert.equal(text,'Yellow Tang');return {text:'Consulta recebida.'};}});
  const event=(id,text,story=true,customer='cliente')=>({sender:{id:customer},recipient:{id:'loja'},timestamp:Date.now(),message:{mid:id,text,...(story?{reply_to:{story:{id:'story-test',url:'https://private.test/secret'}}}:{})}});
  await handle(event('s1','Quanto custa esse?'));assert.match(sent.at(-1),/nome do produto/);assert.equal(calls,0);
  await handle(event('s2','Yellow Tang',false));assert.equal(calls,1);
  await handle(event('s3','🔥',true,'reacao'));assert.match(sent.at(-1),/Obrigado pela reação/);
  await handle(event('s4','Quero falar com atendente',true,'humano'));assert.match(sent.at(-1),/especialista/);
  await handle(event('s5','Meu peixe está doente',true,'saude'));assert.match(sent.at(-1),/especialista/);
  assert.equal(calls,1);
  assert.equal(JSON.stringify(await database.sql`select attachments from ig_messages`).includes('private.test'),false);
});
