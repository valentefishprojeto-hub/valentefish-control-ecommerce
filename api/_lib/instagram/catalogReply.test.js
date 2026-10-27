import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './test-db.js';
import {createTools} from './tools.js';
import {catalogReply,keywords} from './catalogReply.js';

test('modo sem IA responde preço com link a partir do catálogo',async t=>{
  process.env.APP_URL='https://loja.test';
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const [conversation]=await sql`insert into ig_conversations(igsid) values ('sem-ia') returning *`;
  const tools=createTools({sql,conversation,env:{}});

  assert.deepEqual(keywords('Oi, quanto custa o Yellow Tang?'),['yellow','tang']);

  const hit=await catalogReply('Oi, quanto custa o yellow tang?',tools);
  assert.match(hit.text,/Yellow Tang/i);
  assert.match(hit.text,/R\$ 849,00/);
  assert.match(hit.text,/https:\/\/loja\.test\/produto\/yellow-tang\?utm_source=instagram/);

  const miss=await catalogReply('vocês têm tubarão baleia?',tools);
  assert.match(miss.text,/Não encontrei/);
  assert.match(miss.text,/https:\/\/loja\.test\/\?utm_source=instagram/);
  assert.match(miss.text,/orcamento/);
});
