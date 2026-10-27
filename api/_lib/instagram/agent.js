import systemPrompt from './systemPrompt.js';
import {toolDefinitions} from './tools.js';
import {normalize} from './text.js';

function renderProduct(p){
  return `• ${p.nome}: ${p.de?`de ${p.de} por ${p.por}`:p.preco} — ${p.disponibilidade}\n${p.link}${p.orcamento?`\nPodemos consultar um especialista: ${p.orcamento}`:''}`;
}
function render(name,result){
  if(result?.erro) return result.erro+(result.aviso?' '+result.aviso:'');
  if(name==='buscar_produtos') return result.map(renderProduct).join('\n\n');
  if(name==='detalhes_produto') return renderProduct(result)+'\n'+String(result.descricao||'').slice(0,400);
  if(name==='listar_categorias') return result.map(p=>`• ${p.nome}: ${p.link}`).join('\n');
  if(name==='info_loja') return String(result);
  if(name==='cotar_frete') return (result.opcoes?result.opcoes.map(p=>`• ${p.transportadora} — ${p.servico}: ${p.preco}, ${p.prazo_dias_min} a ${p.prazo_dias_max} dias.`).join('\n'):result.mensagem+' '+result.link)+(result.aviso?'\n'+result.aviso:'');
  if(name==='consultar_pedido'){
    if(result.encontrado===false) return 'Não encontrei um pedido com esses dados. Confira o número e o e-mail usados na compra.';
    return `Pedido: ${result.status}. Pagamento: ${result.payment_status}. Entrega: ${result.fulfillment_status}.`+
      (result.shipping_service?`\nTransporte: ${result.shipping_service}.`:'')+
      (result.tracking_code?`\nRastreio: ${result.tracking_code}`:'')+
      (result.tracking_url?`\n${result.tracking_url}`:'')+
      (result.ultimo_evento?`\nÚltima atualização: ${result.ultimo_evento.status}.`:'');
  }
  return '';
}

function unverifiedReply(text,generated){
  const question=normalize(generated);
  const topic=normalize(text);
  if(generated.includes('?')){
    if(/\bcep\b/.test(question)) return 'Qual é o CEP de destino?';
    if(/e-?mail/.test(question)) return 'Qual é o e-mail usado na compra?';
    if(/numero.*pedido/.test(question)) return 'Qual é o número do pedido?';
    if(/qual.*(produto|especie)|produto.*procura/.test(question)) return 'Qual produto você procura?';
  }
  if(/^(oi|ola|bom dia|boa tarde|boa noite|obrigad)[\s!.,a-z]*$/.test(topic)) return 'Como posso ajudar você com a Valente Fish?';
  if(/aclimata/.test(topic)) return 'A aclimatação deve ser gradual, evitando mudanças bruscas nas condições da água. Um especialista pode orientar você conforme a espécie e o seu aquário.';
  if(/quarentena/.test(topic)) return 'A quarentena ajuda a observar os animais e reduzir o risco de introduzir doenças no aquário. Para um protocolo adequado ao seu caso, posso chamar um especialista.';
  if(/alimentacao|alimentar/.test(topic)) return 'A alimentação deve ser adequada à espécie, evitando sobras que prejudiquem a qualidade da água. Qual espécie você mantém?';
  if(/osmose/.test(topic)) return 'A água de osmose ajuda a controlar impurezas no preparo da água do aquário marinho. Para avaliar seu sistema, posso chamar um especialista.';
  if(/so (posso )?ajud|fora.*(loja|aquarismo)/.test(question)) return 'Eu ajudo com a Valente Fish e aquarismo; posso ajudar você com algo da loja?';
  return null;
}

export async function runAgent({text,history=[],tools,env=process.env,fetch:request=fetch,timeoutMs=20000}={}){
  const controller=new AbortController();
  let timer;
  const toolCalls=[];
  const handoff=async(reason)=>{
    const result=await tools.encaminhar_humano({motivo:reason,resumo:'Atendimento precisa ser continuado pela equipe.'});
    return {text:result.mensagem,handoff:true,toolCalls};
  };
  async function execute(){
    if(!env.ANTHROPIC_API_KEY||!env.ANTHROPIC_MODEL) throw new Error('Assistente não configurado');
    const evidence=[...history.filter(x=>x.author==='customer').map(x=>x.text||''),text].join('\n').toLowerCase();
    // Historical bot answers contain stale prices/order data; never feed those back.
    const messages=[{role:'user',content:JSON.stringify({mensagens_anteriores_do_cliente:history.filter(x=>x.author==='customer').slice(-10).map(x=>x.text),mensagem_atual:text})}];
    const results=[];
    for(let round=0;round<=4;round++){
      controller.signal.throwIfAborted();
      const response=await request('https://api.anthropic.com/v1/messages',{
        method:'POST',signal:controller.signal,headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
        body:JSON.stringify({model:env.ANTHROPIC_MODEL,max_tokens:700,system:systemPrompt,messages,tools:toolDefinitions,...(round===4?{tool_choice:{type:'none'}}:{})})
      });
      if(!response.ok) throw new Error('Assistente indisponível');
      const answer=await response.json();
      if(!Array.isArray(answer.content)) throw new Error('Resposta inválida');
      const calls=answer.content.filter(x=>x.type==='tool_use');
      if(!calls.length){
        if(answer.stop_reason!=='end_turn') throw new Error('Resposta incompleta');
        if(results.length) return {text:results.map(x=>render(x.name,x.result)).join('\n\n'),toolCalls};
        const generated=answer.content.filter(x=>x.type==='text').map(x=>x.text).join('\n');
        // No ungrounded free-form claims reach the customer. Only reviewed
        // clarification/general-care templates are allowed without tool evidence.
        const safe=unverifiedReply(text,generated);
        return safe?{text:safe,toolCalls}:handoff('resposta_sem_fonte');
      }
      if(round===4||calls.length>7) throw new Error('Limite de ferramentas');
      messages.push({role:'assistant',content:answer.content});
      const content=[];
      for(const call of calls){
        controller.signal.throwIfAborted();
        if(!Object.hasOwn(tools,call.name)||!call.input||typeof call.input!=='object') throw new Error('Ferramenta inválida');
        if(call.name==='consultar_pedido'){
          const email=String(call.input.email||'').toLowerCase();const number=String(call.input.numero||'');
          const emails=evidence.match(/[^\s"<>]+@[^\s"<>]+\.[^\s"<>]+/g)||[];
          if(!email||!emails.some(x=>x.replace(/[.,;!?]+$/,'')===email)||!/^\d+$/.test(number)||!evidence.match(/\b\d+\b/g)?.includes(number)){
            return {text:'Qual é o número do pedido? Depois vou precisar do e-mail usado na compra.',toolCalls};
          }
        }
        toolCalls.push({name:call.name}); // Never persist arguments (email, CEP) or results.
        const result=await tools[call.name](call.input);
        controller.signal.throwIfAborted();
        if(result?.handoff) return {text:result.mensagem,handoff:true,toolCalls};
        if(result===null||Array.isArray(result)&&result.length===0) return handoff('informacao_nao_confirmada');
        results.push({name:call.name,result});
        content.push({type:'tool_result',tool_use_id:call.id,content:JSON.stringify(result)});
      }
      messages.push({role:'user',content});
    }
  }
  try{
    return await Promise.race([execute(),new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller.abort();reject(new Error('Tempo esgotado'));},timeoutMs);
    })]);
  }catch{
    controller.abort();
    const result=await handoff('falha_assistente');
    return {...result,text:'Não consegui concluir sua consulta agora. '+result.text};
  }finally{clearTimeout(timer);}
}

export function directAction(text){
  const value=normalize(text);
  if(/\b(atendente|humano|pessoa)\b/.test(value)) return {handoff:'solicitacao_cliente'};
  if(/pontos? brancos?|doente|morr|morte|dosagem|como (usar|aplicar|dosar).*tratamento|quanto.*(remedio|medicamento)|praga/.test(value)) return {handoff:'saude_animal',prefix:'Para tratamentos, siga as orientações do fabricante. Não consigo avaliar a saúde do animal por aqui. '};
  if(/chegou mal|reembolso|devolu|reclama|irritad|troca|garantia|compativ|montagem|aquario completo|compra.*volume/.test(value)) return {handoff:'especialista'};
  if(/ignore.*(instruc|regr)|desconto.*50|50%.*desconto|revele.*(prompt|instruc)/.test(value)) return {text:'Não posso alterar as regras da loja nem oferecer descontos. Posso ajudar você a consultar os produtos disponíveis?'};
  return null;
}
