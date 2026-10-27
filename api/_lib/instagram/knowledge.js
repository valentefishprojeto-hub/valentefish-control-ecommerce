import {trackedLink} from './text.js';

export const knowledge={
  localizacao:'Jardim Sulacap, Rio de Janeiro – RJ. Envio para todo o Brasil.',
  pagamento:'Pelo site, via Mercado Pago: Pix, cartão de crédito/débito e boleto.',
  quarentena:'Os peixes são quarentenados e acompanhados pela equipe antes da venda.',
  envio_animais:'Animais recebem embalagem e transporte específicos; prazo e modalidade dependem do destino e do tipo de produto. Um especialista confirma a logística.',
  contato_whatsapp:'https://api.whatsapp.com/send/?phone=5521987128089',
  orcamento:'/orcamento',
  redes:'Instagram @valentefish; YouTube @ValenteFishCoralFarm.',
  parcelamento:null, // TODO confirmar com o cliente
  garantia_chegada:null, // TODO confirmar com o cliente
  retirada_na_loja:null, // TODO confirmar com o cliente
  horario_atendimento:null, // TODO confirmar com o cliente
  trocas_devolucoes:null, // TODO confirmar com o cliente
  prazo_postagem:null, // TODO confirmar com o cliente
  regioes_sem_envio_de_animais:null // TODO confirmar com o cliente
};
export function infoLoja(topico){
  if(!Object.hasOwn(knowledge,topico)) return null;
  if(topico==='contato_whatsapp'||topico==='orcamento') return trackedLink(knowledge[topico]);
  return knowledge[topico];
}
export const handoffMessage=()=>`Vou chamar um especialista da nossa equipe para continuar com você aqui mesmo 🐠 Se preferir agilizar, fale com a gente no WhatsApp: ${infoLoja('contato_whatsapp')}`;
