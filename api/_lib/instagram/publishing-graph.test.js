import test from 'node:test';
import assert from 'node:assert/strict';
import {publishingGraph} from './publishing-graph.js';

test('Graph publica feed e Story com contratos distintos e token apenas no header',async()=>{
  const calls=[];
  const env={IG_ACCESS_TOKEN:'test-token',IG_BUSINESS_ID:'12345',META_GRAPH_VERSION:'v26.0'};
  const graph=publishingGraph({env,fetch:async(url,options)=>{
    calls.push({url,options});
    return Response.json(options.method==='GET'?{status_code:'FINISHED'}:{id:'67890'});
  }});
  assert.equal(await graph.create({asset_url:'https://loja.test/feed.jpg',caption:'Produto real',format:'feed'}),'67890');
  await graph.create({asset_url:'https://loja.test/story.jpg',caption:'Não enviar legenda',format:'story'});
  assert.equal(await graph.status('67890'),'FINISHED');
  assert.equal(await graph.publish('67890'),'67890');
  assert.deepEqual(JSON.parse(calls[0].options.body),{image_url:'https://loja.test/feed.jpg',caption:'Produto real'});
  assert.deepEqual(JSON.parse(calls[1].options.body),{image_url:'https://loja.test/story.jpg',media_type:'STORIES'});
  assert.equal(calls[2].options.method,'GET');
  assert.equal(calls[3].url,'https://graph.instagram.com/v26.0/12345/media_publish');
  assert.deepEqual(JSON.parse(calls[3].options.body),{creation_id:'67890'});
  for(const {url,options} of calls){assert.equal(url.includes('test-token'),false);assert.equal(options.headers.authorization,'Bearer test-token');}
});

test('publicação não repete POST após erro ou confirmação ausente',async()=>{
  const env={IG_ACCESS_TOKEN:'test-token',IG_BUSINESS_ID:'12345',META_GRAPH_VERSION:'v26.0'};
  for(const response of [()=>new Response('',{status:429}),()=>new Response('',{status:500}),()=>Response.json({}),()=>{throw new Error('network');}]){
    let calls=0;
    const graph=publishingGraph({env,fetch:async()=>{calls++;return response();}});
    await assert.rejects(()=>graph.publish('67890'));
    assert.equal(calls,1);
  }
});
