import {normalize,trackedLink} from './text.js';
import {infoLoja} from './knowledge.js';

// Modo sem IA: responde perguntas de preço/produto direto pelo catálogo, sempre com link.
const stopwords=new Set(('a o os as um uma uns umas de do da dos das no na nos nas em e ou que qual quais quanto quanta quantos '+
  'quantas custa custam custo preco precos valor valores vcs voce voces tem tens tinha vende vendem vendendo ai ainda esse essa '+
  'este esta isso aquele aquela quero queria gostaria comprar compra saber me mim meu minha pra para por favor oi ola bom boa dia '+
  'tarde noite tudo bem obrigado obrigada com sem mais muito pouco disponivel disponiveis estoque loja produto produtos sobre '+
  'algum alguma ver tipo como onde sim nao ja hoje').split(' '));

export function keywords(text=''){
  const words=normalize(text).replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(word=>word.length>=3&&!stopwords.has(word));
  return [...new Set(words)].slice(0,4);
}

export async function catalogReply(text,tools){
  const terms=keywords(text);
  const found=new Map();
  for(const term of terms){
    for(const item of await tools.buscar_produtos({termo:term})){
      const entry=found.get(item.link)||{item,hits:0};
      entry.hits+=1;found.set(item.link,entry);
    }
  }
  const store=trackedLink('/');
  if(!found.size){
    return {text:`Não encontrei esse item no catálogo online. Veja todos os produtos aqui: ${store}\nSe for um pedido especial, faça seu orçamento: ${infoLoja('orcamento')}`};
  }
  const best=[...found.values()].sort((a,b)=>b.hits-a.hits).slice(0,3).map(({item})=>item);
  const lines=best.map(item=>`• ${item.nome}: ${item.preco} (${item.disponibilidade})\n${item.link}`);
  return {text:(best.length===1?'Encontrei:\n':'Encontrei estas opções:\n')+lines.join('\n')};
}
