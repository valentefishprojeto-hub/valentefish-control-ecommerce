import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './test-db.js';
import {createInboxHandler} from '../../_routes/instagram/inbox.js';

function response(){return {code:0,value:null,headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(value){this.value=value;return this;}};}

test('caixa do bot exige administrador e mostra apenas histórico da conversa escolhida',async t=>{
  const database=await testDatabase();t.after(()=>database.close());
  const {sql}=database;
  const [first]=await sql`insert into public.ig_conversations(igsid,username) values ('cliente-1','aquarista_rj') returning *`;
  const [second]=await sql`insert into public.ig_conversations(igsid) values ('cliente-2') returning *`;
  await sql`insert into public.ig_messages(conversation_id,mid,direction,author,text) values (${first.id},'in-1','in','customer','Olá'),(${first.id},'out-1','out','bot','Como posso ajudar?'),(${second.id},'in-2','in','customer','Mensagem privada')`;
  await sql`update public.ig_messages set created_at=created_at+interval '1 second' where mid='out-1'`;
  const handler=createInboxHandler({sql,authenticate:async req=>req.user||null,roleOf:async()=>null,env:{IG_BOT_ENABLED:'true'}});
  const denied=response();await handler({method:'GET',headers:{},query:{},user:{id:'x'}},denied);
  assert.equal(denied.code,403);
  const user={id:'admin',app_metadata:{role:'admin'}};
  const listed=response();await handler({method:'GET',headers:{},query:{},user},listed);
  assert.equal(listed.code,200);assert.equal(listed.value.conversations.length,2);assert.equal(listed.value.botEnabled,true);
  const detail=response();await handler({method:'GET',headers:{},query:{id:first.id},user},detail);
  assert.equal(detail.code,200);assert.deepEqual(detail.value.messages.map(x=>x.text),['Olá','Como posso ajudar?']);
  assert.equal(JSON.stringify(detail.value).includes('Mensagem privada'),false);
  const invalid=response();await handler({method:'GET',headers:{},query:{id:'bad'},user},invalid);
  assert.equal(invalid.code,422);
});

test('administrador pausa e retoma só a conversa selecionada',async t=>{
  const database=await testDatabase();t.after(()=>database.close());
  const {sql}=database;
  const [first]=await sql`insert into public.ig_conversations(igsid) values ('cliente-1') returning *`;
  const [second]=await sql`insert into public.ig_conversations(igsid) values ('cliente-2') returning *`;
  const handler=createInboxHandler({sql,authenticate:async req=>req.user,roleOf:async()=>null,env:{IG_HUMAN_PAUSE_HOURS:'12'}});
  const user={id:'admin',app_metadata:{role:'admin'}};
  const pause=response();await handler({method:'POST',headers:{},query:{},body:{id:first.id,action:'pause'},user},pause);
  assert.equal(pause.code,200);assert.equal(pause.value.conversation.status,'human');
  assert.ok(new Date(pause.value.conversation.paused_until)>new Date());
  assert.equal((await sql`select status from public.ig_conversations where id=${second.id}`)[0].status,'bot');
  const resume=response();await handler({method:'POST',headers:{},query:{},body:{id:first.id,action:'resume'},user},resume);
  assert.equal(resume.code,200);assert.equal(resume.value.conversation.status,'bot');assert.equal(resume.value.conversation.paused_until,null);
  const bad=response();await handler({method:'POST',headers:{},query:{},body:{id:first.id,action:'delete'},user},bad);
  assert.equal(bad.code,422);
});

test('busca e guarda o nome de usuário quando a Meta o fornece',async t=>{
  const database=await testDatabase();t.after(()=>database.close());
  const {sql}=database;
  const [conversation]=await sql`insert into public.ig_conversations(igsid) values ('123456') returning *`;
  let calls=0;
  const handler=createInboxHandler({sql,authenticate:async req=>req.user,roleOf:async()=>null,resolveUsername:async()=>{calls++;return 'cliente_rj';}});
  const req={method:'GET',headers:{},query:{id:conversation.id},user:{id:'admin',app_metadata:{role:'admin'}}};
  const first=response();await handler(req,first);
  const second=response();await handler(req,second);
  assert.equal(first.value.conversation.username,'cliente_rj');
  assert.equal(second.value.conversation.username,'cliente_rj');
  assert.equal(calls,1);
});

test('interruptor geral só aceita administrador e respeita bloqueio do servidor',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const env={IG_BOT_ENABLED:'true'};
  const handler=createInboxHandler({sql,env,authenticate:async req=>req.user||null,roleOf:async()=>null});
  const user={id:'admin',app_metadata:{role:'admin'}};
  const request=(enabled,account=user)=>({method:'POST',headers:{},query:{},body:{action:'bot_state',enabled},user:account});
  const denied=response();await handler(request(false,{id:'cliente'}),denied);assert.equal(denied.code,403);
  const off=response();await handler(request(false),off);assert.equal(off.code,200);assert.equal(off.value.bot.enabled,false);
  const listed=response();await handler({method:'GET',headers:{},query:{},user},listed);assert.equal(listed.value.bot.enabled,false);
  const bad=response();await handler(request('true'),bad);assert.equal(bad.code,422);
  env.IG_BOT_ENABLED='false';
  const blocked=response();await handler(request(true),blocked);assert.equal(blocked.code,409);
  env.IG_BOT_ENABLED='true';
  const on=response();await handler(request(true),on);assert.equal(on.code,200);assert.equal(on.value.bot.enabled,true);
});
