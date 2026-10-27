import {normalize} from './text.js';

// A Story URL is not product evidence. Never fetch it or infer price from it.
export function storyReply(text=''){
  const value=normalize(text).trim();
  if(!value||/^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D!]+$/u.test(value)) return 'Obrigado pela reação! Quer saber mais sobre algum produto desse Story?';
  if(/preco|custa|valor|quanto|esse|essa|quero|comprar|tem/.test(value)) return 'Posso consultar o preço e a disponibilidade atuais. Qual é o nome do produto que apareceu no Story?';
  return 'Recebi sua resposta ao Story. Ainda não consigo identificar o conteúdo dele; pode me dizer o nome do produto ou descrever sua dúvida?';
}

export function smallTalk(text=''){
  const value=normalize(text).trim().replace(/[!.?]+$/,'');
  if(/^(obrigad[oa]|muito obrigad[oa]|valeu|agradeco)$/.test(value)) return 'Por nada! Se precisar de mais alguma informação da loja, estou por aqui.';
  if(/^(tudo bem|como vai|como voce esta)$/.test(value)) return 'Tudo certo por aqui! Você procura algum produto ou quer tirar uma dúvida sobre aquarismo?';
  if(/^(quero comprar|como compro|como comprar)$/.test(value)) return 'Posso ajudar você a encontrar o produto e consultar a disponibilidade. Qual produto você procura?';
  if(/^(tchau|ate mais|boa noite e obrigado)$/.test(value)) return 'Até mais! Quando precisar de ajuda com a Valente Fish, é só chamar.';
  return null;
}
