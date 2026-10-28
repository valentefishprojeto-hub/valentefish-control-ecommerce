import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './test-db.js';
import {createTools} from './tools.js';
import {conversationReply,detectCategory,detectQuantity} from './conversationReply.js';

const morning=new Date('2026-10-28T13:00:00Z'); // 10h em São Paulo

test('detecta categoria e quantidade em linguagem de cliente',()=>{
  for(const [text,slug] of [['manda 3 corais pronta entrega','corais'],['tem peixe palhaco?','peixes'],['racao pra peixe marinho','peixes'],
    ['quero ver as racoes','racoes'],['skimmer','filtragem'],['remedio pra cyano','tratamentos'],['bomba de circulacao','equipamentos'],['zoas','corais']]){
    assert.equal(detectCategory(text),slug,text);
  }
  assert.equal(detectQuantity('manda 3 corais'),3);
  assert.equal(detectQuantity('me mostra dois peixes'),2);
  assert.equal(detectQuantity('corais'),null);
});

test('conversa sem IA: saudações, pronta entrega, categorias, preço e dúvidas comuns',async t=>{
  process.env.APP_URL='https://loja.test';
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const [conversation]=await sql`insert into ig_conversations(igsid) values ('conversa') returning *`;
  const tools=createTools({sql,conversation,env:{}});
  const say=(text,options={})=>conversationReply(text,{tools,now:morning,...options});

  // Saudações
  for(const text of ['oi','Olá!','opa','eae','bom dia','Boa tarde']){
    const reply=await say(text,{firstContact:true});
    assert.match(reply.text,/^Bom dia! 👋 Sou o assistente virtual da Valente Fish\./,text);
    assert.match(reply.text,/pronta entrega/,text);
    assert.equal(reply.intro,true,text);
    assert.equal(reply.state,'aguardando_interesse',text);
  }
  for(const text of ['oi, tudo bem?','Olá, como vai?','tudo bem?','td bem?','oii tudo bom']){
    assert.match((await say(text,{firstContact:true})).text,/Tudo ótimo por aqui/,text);
  }
  assert.match((await say('oi')).text,/^Oi de novo! 😊 Em que posso te ajudar\?/);

  // Pronta entrega sem categoria pergunta o interesse
  for(const text of ['itens pronta entrega','o que vocês tem a pronta entrega?','quais os produtos disponíveis?','tem novidades?','catálogo']){
    const reply=await say(text);
    assert.match(reply.text,/Temos itens a pronta entrega em:/,text);
    assert.match(reply.text,/• Corais/,text);
    assert.match(reply.text,/Quais são os itens do seu interesse\?$/,text);
    assert.equal(reply.state,'aguardando_interesse',text);
  }

  // Resposta curta depois da pergunta
  const corais=await say('corais',{state:'aguardando_interesse'});
  assert.match(corais.text,/^Corais a pronta entrega:/);
  assert.match(corais.text,/Coral Hammer Green: R\$ 379,00/);
  assert.match(corais.text,/https:\/\/loja\.test\/produto\/coral-hammer-green\?utm_source=instagram/);
  assert.match(corais.text,/Ver todos: https:\/\/loja\.test\/c\/corais/);
  assert.equal(corais.state,'mostrou_categoria');

  // Quantidade pedida
  const tres=await say('manda 3 corais pronta entrega');
  assert.match(tres.text,/^Corais a pronta entrega:/);
  assert.match(tres.text,/No momento temos 1 opção a pronta entrega\./);
  const peixes=await say('me mostra 2 peixes');
  assert.equal((peixes.text.match(/^\d\. /gm)||[]).length,2);
  assert.match((await say('tem racao?')).text,/^Rações a pronta entrega:/);

  // Saudação + pedido na mesma mensagem
  const combo=await say('oi, tem corais?',{firstContact:true});
  assert.match(combo.text,/^Bom dia! 👋 Sou o assistente virtual da Valente Fish\. Corais a pronta entrega:/);

  // Produto específico com preço
  for(const text of ['quanto custa o coral hammer?','valor do yellow tang','yellow tang ta quanto?']){
    const reply=await say(text);
    assert.match(reply.text,/Encontrei/,text);
    assert.match(reply.text,/R\$/,text);
  }
  assert.match((await say('tem tubarão baleia?')).text,/Não encontrei/);

  // Dúvidas comuns
  assert.match((await say('vocês enviam pra SP?')).text,/Enviamos para todo o Brasil/);
  assert.match((await say('quanto fica o frete?')).text,/frete aparece no carrinho/);
  assert.match((await say('aceita pix?')).text,/Mercado Pago: Pix/);
  assert.match((await say('onde fica a loja?')).text,/Jardim Sulacap/);
  assert.match((await say('que horas vocês abrem?')).text,/WhatsApp/);
  assert.match((await say('os peixes passam por quarentena?')).text,/quarentenados/);

  // Pedido em duas etapas
  const pedido=await say('quero saber do meu pedido');
  assert.equal(pedido.state,'aguardando_pedido');
  assert.match(pedido.text,/número do pedido e o e-mail/);
  assert.match((await say('12345',{state:'aguardando_pedido'})).text,/e-mail usado na compra/);
  assert.match((await say('pedido 99999 email teste@exemplo.com',{state:'aguardando_pedido'})).text,/Não encontrei um pedido/);

  // Encerramentos e confirmações
  assert.match((await say('obrigado!')).text,/Por nada/);
  assert.match((await say('valeu, tchau')).text,/Até mais/);
  assert.match((await say('ok',{state:'mostrou_categoria'})).text,/outra categoria/);
  assert.match((await say('beleza')).text,/mais alguma coisa/);
  assert.match((await say('não, só isso',{state:'aguardando_interesse'})).text,/Combinado/);

  // Sem entender: menu de ajuda, nunca silêncio
  const lost=await say('asdfgh qwerty');
  assert.match(lost.text,/Não entendi muito bem/);
  assert.match(lost.text,/Não encontrei|Posso te ajudar com/);
});

test('categoria sem estoque avisa e oferece orçamento',async t=>{
  process.env.APP_URL='https://loja.test';
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const [conversation]=await sql`insert into ig_conversations(igsid) values ('sem-estoque') returning *`;
  await sql`update products set stock_quantity=0 where category='corais'`;
  const tools=createTools({sql,conversation,env:{}});
  const reply=await conversationReply('corais',{tools,state:'aguardando_interesse'});
  assert.match(reply.text,/não temos corais a pronta entrega/i);
  assert.match(reply.text,/orcamento/);
  const menu=await conversationReply('pronta entrega',{tools});
  assert.doesNotMatch(menu.text,/• Corais/);
});

test('handler sem IA lembra a última pergunta entre mensagens',async t=>{
  process.env.APP_URL='https://loja.test';
  const {createHandler}=await import('./handler.js');
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const sent=[];
  const env={IG_BUSINESS_ID:'loja',IG_BOT_ENABLED:'true'};
  const handle=createHandler({sql,env,graph:{sendText:async(_id,text)=>{sent.push(text);return {message_id:'bot-'+sent.length};}}});
  const event=(mid,text)=>({sender:{id:'cliente'},recipient:{id:'loja'},timestamp:Date.now(),message:{mid,text}});

  await handle(event('m1','oi, tudo bem?'));
  assert.match(sent[0],/Sou o assistente virtual da Valente Fish\. Tudo ótimo/);
  assert.doesNotMatch(sent[0],/Olá, sou o assistente virtual/,'não repete a apresentação');

  await handle(event('m2','itens pronta entrega'));
  assert.match(sent.at(-1),/Quais são os itens do seu interesse\?/);

  await handle(event('m3','corais'));
  assert.match(sent.at(-1),/^Corais a pronta entrega:/);
  assert.match(sent.at(-1),/Coral Hammer Green/);

  const [last]=await sql`select tool_calls from ig_messages where author='bot' order by created_at desc limit 1`;
  assert.deepEqual(last.tool_calls,[{name:'estado:mostrou_categoria'},{name:'contexto',categoria:'corais',produtos:[{slug:'coral-hammer-green',nome:'Coral Hammer Green'}],inicio:1}]);

  // A memória sobrevive entre mensagens: "quanto custa o primeiro?" usa a lista anterior.
  await handle(event('m4','quanto custa o primeiro?'));
  assert.match(sent.at(-1),/^Coral Hammer Green: R\$ 379,00/);
});

test('memória de contexto: "tem outros?", "o segundo", "quero esse"',async t=>{
  process.env.APP_URL='https://loja.test';
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const [conversation]=await sql`insert into ig_conversations(igsid) values ('memoria') returning *`;
  const tools=createTools({sql,conversation,env:{}});
  let state=null,context=null;
  const say=async text=>{const reply=await conversationReply(text,{tools,state,context});state=reply.state;context=reply.context;return reply.text;};

  const first=await say('manda 1 peixe');
  assert.match(first,/^Peixes a pronta entrega:\n1\. /);
  assert.equal(context.categoria,'peixes');assert.equal(context.produtos.length,1);
  const firstName=context.produtos[0].nome;

  const more=await say('tem outros?');
  assert.match(more,/^Mais peixes a pronta entrega:/);
  assert.doesNotMatch(more,new RegExp(firstName));
  const secondName=context.produtos[0].nome;

  assert.match(await say('tem mais?'),/Esses são todos os peixes a pronta entrega/);

  await say('me mostra 2 peixes');
  const detail=await say('quanto custa o segundo?');
  assert.ok(detail.startsWith(`${secondName}: R$`),detail);
  assert.match(detail,/Quer comprar ou ver outras opções\?/);
  assert.equal(state,'mostrou_produto');

  const buy=await say('quero esse');
  assert.match(buy,/Ótima escolha!/);assert.match(buy,/adicionar ao carrinho/);

  // Pergunta de frete no meio não apaga a memória
  await say('me mostra 2 peixes');
  await say('vocês enviam pra BH?');
  assert.match(await say('e o primeiro, quanto custa?'),/: R\$/);

  // "sim" depois de um produto leva para a compra
  await say('quanto custa o yellow tang?');
  assert.equal(state,'mostrou_produto');
  assert.match(await say('sim'),/Ótima escolha!/);
});

test('gatilho de atendente só com pedido explícito',async()=>{
  const {directAction}=await import('./agent.js');
  for(const text of ['quero falar com um atendente','falar com uma pessoa','tem algum humano ai?','quero falar com alguém da equipe','não quero falar com robô','chama o vendedor'])
    assert.equal(directAction(text)?.handoff,'solicitacao_cliente',text);
  for(const text of ['coral para aquário de 2 pessoas','quantas pessoas cuidam dos peixes?','oi tudo bem'])
    assert.equal(directAction(text)?.handoff,undefined,text);
});

test('durante a pausa o cliente recebe um único aviso, e nenhum depois que a equipe responde',async t=>{
  process.env.APP_URL='https://loja.test';
  const {createHandler}=await import('./handler.js');
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  const sent=[];
  const env={IG_BUSINESS_ID:'loja',IG_BOT_ENABLED:'true'};
  const handle=createHandler({sql,env,graph:{sendText:async(_id,text)=>{sent.push(text);return {message_id:'bot-'+sent.length};}}});
  const event=(mid,text,from='cliente')=>({sender:{id:from},recipient:{id:from==='loja'?'cliente':'loja'},timestamp:Date.now(),message:{mid,text,...(from==='loja'?{is_echo:true}:{})}});

  await handle(event('p1','quero falar com um atendente'));
  assert.match(sent.at(-1),/especialista/);
  await handle(event('p2','alô?'));
  assert.match(sent.at(-1),/Um atendente da nossa equipe já foi chamado/);
  const count=sent.length;
  await handle(event('p3','tem alguém aí?'));
  assert.equal(sent.length,count,'aviso só uma vez');
  await handle(event('h1','Oi! Aqui é a Ana da Valente Fish','loja'));
  await handle(event('p4','oi Ana'));
  assert.equal(sent.length,count,'nada depois que a equipe assumiu');
});
