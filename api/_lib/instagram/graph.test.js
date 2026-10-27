import test from 'node:test';
import assert from 'node:assert/strict';
import {createGraph} from './graph.js';
test('Graph usa endpoint configurado, retry 429/5xx e nunca em 400',async()=>{
  let calls=0;const delays=[];
  const graph=createGraph({env:{IG_ACCESS_TOKEN:'test',META_GRAPH_VERSION:'v26.0'},sleep:async ms=>delays.push(ms),fetch:async(url,options)=>{
    assert.equal(url,'https://graph.instagram.com/v26.0/me/messages');
    assert.equal(JSON.parse(options.body).recipient.id,'cliente');
    calls++;return new Response(JSON.stringify(calls===3?{message_id:'mid'}:{}),{status:calls===1?429:calls===2?503:200});
  }});
  assert.equal((await graph.sendText('cliente','Olá')).message_id,'mid');assert.equal(delays.length,2);
  let badCalls=0;
  const bad=createGraph({env:{IG_ACCESS_TOKEN:'test',META_GRAPH_VERSION:'v26.0'},fetch:async()=>{badCalls++;return new Response('{}',{status:400});}});
  await assert.rejects(()=>bad.sendText('cliente','Oi'));assert.equal(badCalls,1);
});
test('dry run não usa rede, não loga destinatário nem token',async()=>{
  const logs=[];const graph=createGraph({env:{IG_DRY_RUN:'true'},log:x=>logs.push(x),fetch:()=>{throw new Error('rede');}});
  const result=await graph.sendText('cliente-secreto','Olá');
  assert.ok(result.message_id.startsWith('dry-'));assert.equal(JSON.stringify(logs).includes('cliente-secreto'),false);
});

test('Unified Login envia por graph.facebook.com usando o ID da conta', async()=>{
  const {messagesEndpoint}=await import('./graph.js');
  assert.equal(messagesEndpoint({META_GRAPH_VERSION:'v23.0'}),'https://graph.instagram.com/v23.0/me/messages');
  assert.equal(messagesEndpoint({META_GRAPH_VERSION:'v23.0',IG_API_HOST:'graph.facebook.com',IG_BUSINESS_ID:'17841400000000000'}),'https://graph.facebook.com/v23.0/17841400000000000/messages');
  assert.throws(()=>messagesEndpoint({META_GRAPH_VERSION:'v23.0',IG_API_HOST:'graph.facebook.com'}),/não configurado/);
  assert.equal(messagesEndpoint({META_GRAPH_VERSION:'v23.0',IG_API_HOST:'evil.example.com'}),'https://graph.instagram.com/v23.0/me/messages');
});
