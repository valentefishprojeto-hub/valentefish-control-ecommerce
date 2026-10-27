import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent} from './agent.js';
test('agente executa tool use com dados novos, nunca aceita preço inventado pelo modelo',async()=>{
  let requests=0,lookups=0;
  const result=await runAgent({text:'Quanto custa o yellow tang?',history:[],tools:{buscar_produtos:async()=>{lookups++;return [{nome:'Yellow Tang',preco:'R$ 849,00',disponibilidade:'disponível',link:'https://loja.test/produto/yellow-tang?utm_source=instagram&utm_medium=dm'}];}},env:{ANTHROPIC_API_KEY:'test',ANTHROPIC_MODEL:'test'},fetch:async()=>{
    requests++;return new Response(JSON.stringify(requests===1?{stop_reason:'tool_use',content:[{type:'tool_use',id:'t1',name:'buscar_produtos',input:{termo:'yellow tang'}}]}:{stop_reason:'end_turn',content:[{type:'text',text:'Custa R$ 1,00 com desconto de 50%'}]}));
  }});
  assert.equal(lookups,1);assert.match(result.text,/849,00/);assert.doesNotMatch(result.text,/50%|1,00/);
});

test('timeout encerra agente e FAQ não confirmado faz handoff',async()=>{
  let handoffs=0;
  const tools={info_loja:async()=>null,encaminhar_humano:async()=>{handoffs++;return {handoff:true,mensagem:'Equipe vai continuar.'};}};
  const env={ANTHROPIC_API_KEY:'test',ANTHROPIC_MODEL:'test'};
  const timeout=await runAgent({text:'oi',tools,env,timeoutMs:20,fetch:async()=>new Promise(()=>{})});
  assert.equal(timeout.handoff,true);assert.equal(handoffs,1);
  const faq=await runAgent({text:'parcelamento',tools,env,fetch:async()=>new Response(JSON.stringify({content:[{type:'tool_use',id:'faq',name:'info_loja',input:{topico:'parcelamento'}}],stop_reason:'tool_use'}))});
  assert.equal(faq.handoff,true);assert.equal(handoffs,2);
});
test('modelo não consegue inventar política comercial sem tools',async()=>{
  const result=await runAgent({text:'Entregam domingo?',tools:{encaminhar_humano:async()=>({handoff:true,mensagem:'Equipe vai confirmar.'})},env:{ANTHROPIC_API_KEY:'test',ANTHROPIC_MODEL:'test'},fetch:async()=>new Response(JSON.stringify({content:[{type:'text',text:'Sim, entregamos domingo. Qual é seu endereço?'}],stop_reason:'end_turn'}))});
  assert.equal(result.handoff,true);assert.doesNotMatch(result.text,/entregamos domingo/);
});
test('agente limita rodadas, dá handoff em erro e em FAQ null',async()=>{
  let calls=0,handoffs=0;
  const tools={buscar_produtos:async()=>[{nome:'Produto'}],encaminhar_humano:async()=>{handoffs++;return {handoff:true,mensagem:'Equipe vai continuar.'};}};
  const result=await runAgent({text:'produto',history:[],tools,env:{ANTHROPIC_API_KEY:'test',ANTHROPIC_MODEL:'test'},fetch:async()=>{
    calls++;return new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',id:'x'+calls,name:'buscar_produtos',input:{}}]}));
  }});
  assert.equal(calls,5);assert.equal(handoffs,1);assert.equal(result.handoff,true);
});
test('pedido exige credenciais presentes no texto real do cliente',async()=>{
  let lookups=0;
  const result=await runAgent({text:'Meu pedido?',history:[],tools:{consultar_pedido:async()=>{lookups++;},encaminhar_humano:async()=>({handoff:true,mensagem:'Equipe vai continuar.'})},env:{ANTHROPIC_API_KEY:'test',ANTHROPIC_MODEL:'test'},fetch:async()=>new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',id:'x',name:'consultar_pedido',input:{numero:'123',email:'adivinhado@test.com'}}]}))});
  assert.equal(lookups,0);assert.match(result.text,/número|e-mail/);
});
