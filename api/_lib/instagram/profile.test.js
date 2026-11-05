import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupUsername} from './profile.js';

test('consulta perfil do remetente sem expor token na URL',async()=>{
  const env={IG_ACCESS_TOKEN:'secret',META_GRAPH_VERSION:'v26.0'};
  let requested=0;
  const username=await lookupUsername('12345',{env,fetch:async(url,options)=>{
    requested++;
    assert.equal(url,'https://graph.instagram.com/v26.0/12345?fields=username');
    assert.equal(options.headers.authorization,'Bearer secret');
    return new Response(JSON.stringify({username:'aquarista.rj'}),{status:200});
  }});
  assert.equal(username,'aquarista.rj');assert.equal(requested,1);
});

test('perfil ausente ou identificador inválido usa fallback seguro',async()=>{
  const env={IG_ACCESS_TOKEN:'secret',META_GRAPH_VERSION:'v26.0'};
  assert.equal(await lookupUsername('../me',{env,fetch:()=>{throw new Error('não deve chamar');}}),null);
  assert.equal(await lookupUsername('123',{env,fetch:async()=>new Response('{}',{status:403})}),null);
});
