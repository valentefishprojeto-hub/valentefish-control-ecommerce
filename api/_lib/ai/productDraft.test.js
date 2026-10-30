import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRequest,draftProduct,DEFAULT_MODEL} from './productDraft.js';
import {testDatabase} from '../instagram/test-db.js';

const catalog={
  categories:[{id:'c1',slug:'peixes',name:'Peixes',description:''},{id:'c2',slug:'corais',name:'Corais',description:'Corais de recife'}],
  products:[{name:'Peixe-palhaço Ocellaris',description:'Clássico do aquário marinho...',badge:'Quarentenado',categoria:'peixes'}]
};
const reply=(json,extra={})=>({model:DEFAULT_MODEL,status:'completed',output_text:JSON.stringify(json),output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(json)}]}],...extra});
const fakeClient=response=>{const calls=[];return {calls,responses:{create:async params=>{calls.push(params);return typeof response==='function'?response(params):response;}}};};

test('rascunho: manda fotos + catálogo e devolve campos do formulário',async()=>{
  const client=fakeClient(reply({nome:'Tang Amarelo',categoria:'peixes',descricao:'Zebrasoma flavescens...',selo:'Quarentenado',confianca:'alta',observacoes:''}));
  const draft=await draftProduct({images:['https://x.supabase.co/a.jpg','http://inseguro/b.jpg','https://x.supabase.co/c.jpg'],notes:'chegou hoje',client,catalog});
  assert.deepEqual({name:draft.name,categoryId:draft.categoryId,badge:draft.badge,confidence:draft.confidence},{name:'Tang Amarelo',categoryId:'c1',badge:'Quarentenado',confidence:'alta'});
  const params=client.calls[0];
  assert.equal(params.model,DEFAULT_MODEL);
  const content=params.input[0].content;
  assert.deepEqual(content.filter(b=>b.type==='input_image').map(b=>b.image_url),['https://x.supabase.co/a.jpg','https://x.supabase.co/c.jpg'],'só URLs https');
  assert.match(content.at(-1).text,/chegou hoje/);
  assert.match(params.instructions,/Peixe-palhaço Ocellaris/,'usa o catálogo como exemplo de estilo');
  assert.equal(params.text.format.strict,true);
  assert.deepEqual(params.text.format.schema.properties.categoria.enum,['peixes','corais']);
});

test('rascunho: modelo e persona vêm de variáveis próprias',()=>{
  const req=buildRequest({images:['https://a/b.jpg'],catalog,env:{AI_PRODUCT_MODEL:'gpt-5',AI_PRODUCT_PERSONA:'Persona da loja'}});
  assert.equal(req.model,'gpt-5');
  assert.match(req.instructions,/^Persona da loja/);
});

test('rascunho: erros claros para foto ausente, chave ausente, recusa, corte e JSON quebrado',async()=>{
  await assert.rejects(draftProduct({images:[],client:fakeClient({}),catalog}),/pelo menos uma foto/);
  await assert.rejects(draftProduct({images:['https://a/b.jpg'],env:{},catalog}),/OPENAI_API_KEY/);
  await assert.rejects(draftProduct({images:['https://a/b.jpg'],client:fakeClient({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'não'}]}]}),catalog}),/não conseguiu processar/);
  await assert.rejects(draftProduct({images:['https://a/b.jpg'],client:fakeClient({status:'incomplete',output:[]}),catalog}),/incompleta/);
  await assert.rejects(draftProduct({images:['https://a/b.jpg'],client:fakeClient({status:'completed',output_text:'{quebrado',output:[]}),catalog}),/formato inesperado/);
});

test('rascunho: lê categorias e exemplos do banco real',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const client=fakeClient(params=>reply({nome:'X',categoria:params.text.format.schema.properties.categoria.enum[0],descricao:'d',selo:'',confianca:'media',observacoes:'conferir espécie'}));
  const draft=await draftProduct({images:['https://a/b.jpg'],sql,client});
  assert.ok(draft.categoryId,'categoria do banco');
  assert.equal(draft.notes,'conferir espécie');
});
