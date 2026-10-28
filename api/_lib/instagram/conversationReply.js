import {normalize,trackedLink} from './text.js';
import {infoLoja,knowledge} from './knowledge.js';
import {catalogReply,keywords} from './catalogReply.js';

// Atendimento sem IA: intenções por palavras-chave, com memória curta da última pergunta do bot.
// Toda resposta de preço/estoque vem do catálogo na hora; nada é inventado.

export const CATEGORIES=[
  ['peixes',/\b(peixes?|palhac[oa]s?|ocellaris|tangs?|cirurgia[oa]|gob(y|i)s?|blenn(y|ies)|donzelas?|anjos?|bodiao|mandarim)\b/],
  ['corais',/\b(corais|coral|sps|lps|softs?|zoas?|zoanthus|acroporas?|hammers?|euphyllias?|montiporas?|anemonas?|frags?)\b/],
  ['racoes',/\b(rac(ao|oes)|alimentos?|comidas?|nori|artemias?|misis|mysis)\b/],
  ['filtragem',/\b(filtros?|filtragem|skimmers?|osmose|carcacas?|refil|refis|midias?)\b/],
  ['tratamentos',/\b(tratamentos?|remedios?|medicamentos?|cyano|flatworm|antiparasit\w*)\b/],
  ['equipamentos',/\b(equipamentos?|bombas?|iluminacao|luminarias?|leds?|termostatos?|aquecedor(es)?|acessorios?)\b/]
];

const NUMBER_WORDS={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10};
const GREETING=/^(oi+e?|ola+|ole|opa|eai|e ai|eae|eaii|salve|hey|hello|hi|bom dia|boa tarde|boa noite|boa|fala|alo)\b[\s,!.]*/;
const WELLBEING=/\b(tudo bem|tudo bom|tudo certo|td bem|td bom|tudo blz|como vai|como voce esta|como vc esta|como vcs estao|como voces estao|beleza\?|blz\?|suave\?|de boa\?)/;
const STOCK=/(pronta entrega|pronto entrega|a pronta|disponive(l|is)|em estoque|no estoque|o que (voces |vcs )?tem|o que tem|quais (sao )?(os |as )?(itens|produtos|opcoes)|catalogo|lista de|novidades?|chegou (algo|coisa)|chegaram|o que chegou|mostra (o que|os|as)|ver (os |as )?(itens|produtos))/;
const LIST_VERB=/\b(manda|mande|me manda|mostra|mostre|me mostra|envia|envie|lista|listar|ver|quero ver|tem|teria|tens|vende|vendem)\b/;
const PRICE=/\b(preco|precos|quanto|valor|valores|custa|custam|sai por|ta quanto|esta quanto)\b/;
const SHIPPING=/\b(frete|fretes|envio|envios|enviam|envia pra|envia para|entregam|entrega (pra|para|em)|mandam (pra|para)|sedex|correios|transportadora|prazo de entrega|chega em|cep)\b/;
const PAYMENT=/\b(pagamento|pagar|pago|pix|cartao|boleto|parcela\w*|parcelado|credito|debito|mercado pago)\b/;
const LOCATION=/\b(onde (fica|voces ficam|vcs ficam|e a loja)|endereco|localizacao|loja fisica|retirar|retirada|buscar na loja|visitar|ir ai|ir na loja)\b/;
const HOURS=/\b(horario|horarios|que horas|abre|abrem|fecha|fecham|aberto|aberta|funcionamento)\b/;
const ORDER=/\b(meu pedido|pedido|rastreio|rastrear|rastreamento|codigo de rastreio|comprei|minha compra|minha encomenda)\b/;
const QUARANTINE=/\b(quarentena|quarentenad[oa]s?)\b/;
const THANKS=/\b(obrigad[oa]|obg|brigad[oa]|valeu|vlw|agradeco|grat[oa])\b/;
const BYE=/\b(tchau|ate mais|ate logo|ate amanha|falou|flw|abracos?)\b/;
const ACK=/^(ok+|okay|beleza|blz|show|massa|top|certo|entendi|ta bom|tabom|ta|perfeito|otimo|legal|joia|combinado|fechado|sim|uhum|aham|isso|👍|👌|🙏)[\s!.]*$/u;
const NO=/^(nao|n|nada)?( ?(so isso|e so isso|era so isso|obrigad[oa]|por enquanto nao|agora nao))?$/;
// Palavras genéricas que não identificam um produto específico.
const GENERIC=new Set(('pronta entrega pronto disponivel disponiveis estoque itens item produtos opcoes catalogo lista novidade novidades '+
  'manda mande mostra mostre envia envie listar quero ver tem teria tens vende vendem algum alguns alguma algumas mais outros outras '+
  'tipos tipo chegou chegaram').split(' '));

function greetingFor(now=new Date()){
  const hour=Number(new Intl.DateTimeFormat('pt-BR',{hour:'numeric',hour12:false,timeZone:'America/Sao_Paulo'}).format(now));
  return hour>=5&&hour<12?'Bom dia':hour>=12&&hour<18?'Boa tarde':'Boa noite';
}

export function detectCategory(value){
  return CATEGORIES.find(([,pattern])=>pattern.test(value))?.[0]||null;
}

export function detectQuantity(value){
  const digits=value.match(/\b(\d{1,2})\b/);
  if(digits) return Number(digits[1]);
  const word=value.split(/\s+/).find(w=>Object.hasOwn(NUMBER_WORDS,w));
  return word?NUMBER_WORDS[word]:null;
}

// Só os nomes genéricos de categoria; espécies e modelos (hammer, ocellaris, skimmer) seguem como busca de produto.
const CATEGORY_NOUN=/^(peixes?|corais|coral|rac(ao|oes)|alimentos?|comidas?|filtros?|filtragem|tratamentos?|remedios?|medicamentos?|equipamentos?|acessorios?|marinhos?|aquario|aquarios)$/;
// Termos que apontam para um produto específico (ex.: "hammer"), sem palavras de categoria ou genéricas.
function specificTerms(text){
  return keywords(text).filter(word=>!GENERIC.has(word)&&!CATEGORY_NOUN.test(word)&&!/^\d+$/.test(word)&&!Object.hasOwn(NUMBER_WORDS,word));
}

async function listCategory(tools,slug,quantity){
  const limit=Math.min(5,Math.max(1,quantity||3));
  const items=await tools.produtos_por_categoria({categoria:slug,limite:limit});
  const all=trackedLink(`/c/${encodeURIComponent(slug)}`);
  const name=(await tools.categorias_com_estoque()).find(x=>x.slug===slug)?.nome||slug;
  if(!items.length){
    return {text:`No momento não temos ${name.toLowerCase()} a pronta entrega 😕 Você pode acompanhar as novidades aqui: ${all}\nSe procura algo específico, faça seu orçamento: ${infoLoja('orcamento')}`,state:'aguardando_interesse'};
  }
  const lines=items.map(item=>`• ${item.nome}: ${item.preco}${item.disponibilidade==='últimas unidades'?' (últimas unidades)':''}\n${item.link}`);
  const shortfall=quantity&&items.length<quantity?`\nNo momento temos ${items.length} ${items.length===1?'opção':'opções'} a pronta entrega.`:'';
  return {text:`${name} a pronta entrega:\n${lines.join('\n')}${shortfall}\nVer todos: ${all}\nQuer saber mais sobre algum deles?`,state:'mostrou_categoria'};
}

async function stockMenu(tools){
  const categories=await tools.categorias_com_estoque();
  if(!categories.length) return {text:`No momento estamos repondo o estoque. Veja a loja: ${trackedLink('/')}`,state:null};
  const list=categories.map(x=>`• ${x.nome}`).join('\n');
  return {text:`Temos itens a pronta entrega em:\n${list}\nQuais são os itens do seu interesse?`,state:'aguardando_interesse'};
}

function helpMenu(){
  return 'Posso te ajudar com:\n• itens a pronta entrega\n• preço de um produto\n• frete e formas de pagamento\n• status do seu pedido\n• falar com alguém da equipe\nÉ só me dizer!';
}

async function orderLookup(text,tools){
  const email=text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0];
  const number=normalize(text).replace(email?normalize(email):'','').match(/\b(\d{1,18})\b/)?.[1];
  if(!email||!number){
    return {text:email?'Obrigado! Agora me envia o número do pedido.':number?'Certo! Agora me envia o e-mail usado na compra.':'Para consultar seu pedido, me envia o número do pedido e o e-mail usado na compra.',state:'aguardando_pedido'};
  }
  const result=await tools.consultar_pedido({numero:number,email});
  if(result?.handoff) return {text:result.mensagem,handoff:true};
  if(!result?.encontrado&&!result?.status) return {text:'Não encontrei um pedido com esses dados. Confere o número e o e-mail da compra? Se preferir, chamo alguém da equipe: é só escrever "atendente".',state:'aguardando_pedido'};
  const tracking=result.tracking_code?`\nCódigo de rastreio: ${result.tracking_code}${result.tracking_url?`\n${result.tracking_url}`:''}`:'';
  return {text:`Seu pedido está: ${result.status}. Pagamento: ${result.payment_status}.${tracking}`,state:null};
}

// state: última pergunta do bot nesta conversa (ou null). firstContact: primeira resposta do bot.
export async function conversationReply(text,{tools,state=null,firstContact=false,now=new Date()}={}){
  const value=normalize(text).trim().replace(/\s+/g,' ');
  let rest=value;
  let opening='';

  const greeted=GREETING.test(rest);
  if(greeted) rest=rest.replace(GREETING,'').trim();
  const asked=WELLBEING.test(rest);
  if(asked) rest=rest.replace(WELLBEING,'').replace(/^[\s,?!.e]+|[\s,?!.]+$/g,'').trim();
  if(greeted||asked){
    opening=firstContact
      ?`${greetingFor(now)}! 👋 Sou o assistente virtual da Valente Fish.${asked?' Tudo ótimo por aqui, obrigado por perguntar!':''}`
      :asked?'Tudo ótimo por aqui, obrigado por perguntar!':'Oi de novo! 😊';
  }
  const withOpening=result=>({...result,text:opening?`${opening} ${result.text}`:result.text,intro:firstContact&&Boolean(opening)});

  // Só saudação, sem pedido junto.
  if(!rest||/^[\s?!.,]*$/.test(rest)){
    return withOpening({text:firstContact?'Posso te mostrar os itens a pronta entrega, passar preços, frete e formas de pagamento, ou chamar alguém da equipe. Do que você precisa?':'Em que posso te ajudar?',state:'aguardando_interesse'});
  }

  if(THANKS.test(rest)||BYE.test(rest)){
    return withOpening({text:BYE.test(rest)?'Até mais! Quando precisar, é só chamar 🐠':'Por nada! Se precisar de mais alguma coisa, estou por aqui 🐠',state:null});
  }
  const bare=rest.replace(/[,.!?;]+/g,' ').replace(/\s+/g,' ').trim();
  if(bare&&NO.test(bare)&&state){
    return withOpening({text:'Combinado! Quando precisar, é só chamar 🐠',state:null});
  }
  if(ACK.test(bare)){
    return withOpening({text:state==='mostrou_categoria'?'Fechado! Quer ver outra categoria ou o preço de algum produto?':'Fechado! Posso ajudar com mais alguma coisa?',state:'aguardando_interesse'});
  }

  if(state==='aguardando_pedido'&&(/@/.test(rest)||/\b\d{1,18}\b/.test(rest))) return withOpening(await orderLookup(text,tools));
  if(ORDER.test(rest)) return withOpening(await orderLookup(text,tools));

  const category=detectCategory(rest);
  const quantity=detectQuantity(rest);
  const specific=specificTerms(rest);

  // Perguntas de informação vencem a busca de produto, exceto quando o cliente pergunta preço de algo.
  const info=SHIPPING.test(rest)?{text:`Enviamos para todo o Brasil 🚚 O valor do frete aparece no carrinho ao informar seu CEP: ${trackedLink('/carrinho')}\nPara animais, a embalagem e o transporte são especiais, e nossa equipe confirma a logística com você.`,state:'aguardando_interesse'}
    :PAYMENT.test(rest)?{text:`${knowledge.pagamento} O pagamento é feito com segurança no site, na finalização da compra.`,state:'aguardando_interesse'}
    :LOCATION.test(rest)?{text:`Ficamos no ${knowledge.localizacao} Para visitas ou retirada, combine antes com a equipe pelo WhatsApp: ${infoLoja('contato_whatsapp')}`,state:null}
    :HOURS.test(rest)?{text:`Para confirmar o horário de atendimento, fale com a equipe pelo WhatsApp: ${infoLoja('contato_whatsapp')}\nPor aqui eu respondo a qualquer hora sobre produtos, preços e frete.`,state:null}
    :QUARANTINE.test(rest)?{text:`${knowledge.quarentena} Quer ver os peixes a pronta entrega?`,state:'aguardando_interesse'}
    :null;

  // Produto específico (ex.: "quanto custa o coral hammer?").
  if(specific.length&&(PRICE.test(rest)||!info)&&(PRICE.test(rest)||!STOCK.test(rest))){
    const found=await catalogReply(specific.join(' '),tools);
    if(!/^Não encontrei/.test(found.text)) return withOpening({...found,text:`${found.text}\nQuer ver outras opções a pronta entrega?`,state:'aguardando_interesse'});
    // "Não encontrei" só quando o cliente procurava algo; texto sem sentido cai no menu de ajuda.
    if(!category&&!info&&!STOCK.test(rest)&&(PRICE.test(rest)||LIST_VERB.test(rest))) return withOpening({...found,state:'aguardando_interesse'});
  }
  if(info) return withOpening(info);

  // Categoria: "corais", "manda 3 corais pronta entrega", "tem peixes?", ou resposta a "quais itens?".
  if(category) return withOpening(await listCategory(tools,category,quantity));
  if(STOCK.test(rest)) return withOpening(await stockMenu(tools));

  return withOpening({text:state==='aguardando_interesse'?`Não entendi muito bem 😅 ${(await stockMenu(tools)).text}`:`Não entendi muito bem 😅 ${helpMenu()}`,state:'aguardando_interesse'});
}
