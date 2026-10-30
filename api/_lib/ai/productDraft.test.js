import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRequest,buildCheckRequest,draftProduct,DEFAULT_MODEL} from './productDraft.js';
import {testDatabase} from '../instagram/test-db.js';

const catalog={
  categories:[{id:'c1',slug:'peixes',name:'Peixes',description:''},{id:'c2',slug:'corais',name:'Corais',description:'Corais de recife'}],
  products:[{name:'Peixe-palhaço Ocellaris',description:'Clássico do aquário marinho...',badge:'Quarentenado',categoria:'peixes'}]
};
const reply=(json,extra={})=>({model:DEFAULT_MODEL,status:'completed',output_text:JSON.stringify(json),output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(json),annotations:extra.annotations||[]}]}],...extra});
const draftJson=(over={})=>({caracteristicas_observadas:'corpo oval amarelo',candidatos_descartados:'Centropyge: boca diferente',identificacao:'Zebrasoma flavescens',
  nome:'Tang Amarelo',categoria:'peixes',descricao:'Zebrasoma flavescens...',selo:'Quarentenado',confianca:'alta',observacoes:'',fontes:['https://www.fishbase.se/summary/6015'],...over});
const ok={compativel:true,divergencias:'',alternativa:''};
// Responde na ordem: 1ª chamada = rascunho, 2ª = conferência
const fakeClient=(...responses)=>{const calls=[];return {calls,responses:{create:async params=>{calls.push(params);const r=responses[calls.length-1];if(r instanceof Error) throw r;return typeof r==='function'?r(params):r;}}};};

test('rascunho: pesquisa na web, manda fotos + catálogo e confere numa segunda análise',async()=>{
  const client=fakeClient(reply(draftJson(),{annotations:[{type:'url_citation',url:'https://reeflifesurvey.com/x'}]}),reply(ok));
  const draft=await draftProduct({images:['https://x.supabase.co/a.jpg','http://inseguro/b.jpg','https://x.supabase.co/c.jpg'],notes:'chegou hoje',client,catalog});
  assert.deepEqual({name:draft.name,categoryId:draft.categoryId,confidence:draft.confidence,verified:draft.verified,identification:draft.identification},
    {name:'Tang Amarelo',categoryId:'c1',confidence:'alta',verified:true,identification:'Zebrasoma flavescens'});
  assert.deepEqual(draft.sources,['https://www.fishbase.se/summary/6015','https://reeflifesurvey.com/x'],'fontes do modelo + citações da busca');
  const [first,second]=client.calls;
  assert.deepEqual(first.tools,[{type:'web_search'}]);
  assert.deepEqual(first.input[0].content.filter(b=>b.type==='input_image').map(b=>b.image_url),['https://x.supabase.co/a.jpg','https://x.supabase.co/c.jpg'],'só URLs https');
  assert.match(first.input[0].content.at(-1).text,/chegou hoje/);
  assert.match(first.instructions,/Peixe-palhaço Ocellaris/,'usa o catálogo como exemplo de estilo');
  assert.match(first.instructions,/Pesquise cada candidato/);
  assert.deepEqual(first.text.format.schema.properties.categoria.enum,['peixes','corais']);
  assert.match(second.input[0].content.at(-1).text,/Zebrasoma flavescens/,'conferência recebe só a identificação');
  assert.equal(second.tools,undefined);
});

test('rascunho: conferência divergente derruba a confiança e explica o que conferir',async()=>{
  const client=fakeClient(reply(draftJson({identificacao:'Cantherhines macrocerus',nome:'Peixe-porco Maculado'})),
    reply({compativel:false,divergencias:'boca em bico e corpo verde-turquesa não batem com peixe-porco.',alternativa:'peixe-papagaio (Scaridae)'}));
  const draft=await draftProduct({images:['https://a/b.jpg'],client,catalog});
  assert.equal(draft.confidence,'baixa');
  assert.equal(draft.verified,false);
  assert.match(draft.notes,/divergências: boca em bico.*Pode ser: peixe-papagaio/);
});

test('rascunho: se a conferência falhar, segue com aviso e sem confiança alta',async()=>{
  const draft=await draftProduct({images:['https://a/b.jpg'],client:fakeClient(reply(draftJson()),new Error('timeout')),catalog});
  assert.equal(draft.confidence,'media');
  assert.equal(draft.verified,null);
  assert.match(draft.notes,/Não foi possível fazer a conferência/);
});

test('rascunho: modelo e persona vêm de variáveis próprias',()=>{
  const env={AI_PRODUCT_MODEL:'gpt-5',AI_PRODUCT_PERSONA:'Persona da loja'};
  const req=buildRequest({images:['https://a/b.jpg'],catalog,env});
  assert.equal(req.model,'gpt-5');
  assert.match(req.instructions,/^Persona da loja/);
  assert.match(req.instructions,/Como identificar/,'método de checagem continua mesmo com persona própria');
  assert.equal(buildCheckRequest({images:['https://a/b.jpg'],draft:draftJson(),env}).model,'gpt-5');
});

test('rascunho: erros claros para foto ausente, chave ausente, recusa, corte e JSON quebrado',async()=>{
  await assert.rejects(draftProduct({images:[],client:fakeClient(),catalog}),/pelo menos uma foto/);
  await assert.rejects(draftProduct({images:['https://a/b.jpg'],env:{},catalog}),/OPENAI_API_KEY/);
  await assert.rejects(draftProduct({images:['https://a/b.jpg'],client:fakeClient({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'não'}]}]}),catalog}),/não conseguiu processar/);
  await assert.rejects(draftProduct({images:['https://a/b.jpg'],client:fakeClient({status:'incomplete',output:[]}),catalog}),/incompleta/);
  await assert.rejects(draftProduct({images:['https://a/b.jpg'],client:fakeClient({status:'completed',output_text:'{quebrado',output:[]}),catalog}),/formato inesperado/);
});

test('rascunho: lê categorias e exemplos do banco real',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const client=fakeClient(params=>reply(draftJson({categoria:params.text.format.schema.properties.categoria.enum[0],observacoes:'conferir espécie'})),reply(ok));
  const draft=await draftProduct({images:['https://a/b.jpg'],sql,client});
  assert.ok(draft.categoryId,'categoria do banco');
  assert.equal(draft.notes,'conferir espécie');
});
