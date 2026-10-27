import {centsToMoney,moneyToCents} from '../db.js';
import {formatPrice,trackedLink} from './text.js';
import {knowledge} from './knowledge.js';

export async function quoteShipping({cep,itens},{sql,env=process.env,fetch:request=fetch,signal}={}){
  const postalCode=String(cep||'').replace(/\D/g,'');
  if(!/^\d{5}-?\d{3}$/.test(String(cep||'').trim())) return {erro:'CEP inválido. Informe 8 dígitos.'};
  if(!Array.isArray(itens)||!itens.length||itens.length>20||itens.some(x=>!x||typeof x.slug!=='string'||!Number.isInteger(x.quantidade)||x.quantidade<1||x.quantidade>99)) return {erro:'Informe os produtos e quantidades de 1 a 99.'};
  const quantities=new Map();
  for(const item of itens) quantities.set(item.slug,(quantities.get(item.slug)||0)+item.quantidade);
  if([...quantities.values()].some(n=>n>99)) return {erro:'Quantidade inválida.'};
  const rows=await sql`select id,slug,category,active,stock_quantity,price_cents,weight_grams,width_cm,height_cm,length_cm from public.products where slug=any(${[...quantities.keys()]}::text[])`;
  const live=rows.some(x=>['peixes','corais'].includes(x.category));
  const aviso=live?knowledge.envio_animais:null;
  if(rows.length!==quantities.size||rows.some(x=>!x.active||x.stock_quantity<quantities.get(x.slug))) return {erro:'Um ou mais produtos não estão disponíveis para essa quantidade.',aviso};
  const fallback=()=>({mensagem:'O frete é calculado no checkout.',link:trackedLink('/carrinho'),aviso});
  if(!env.MELHOR_ENVIO_TOKEN||!env.STORE_POSTAL_CODE) return fallback();
  try{
    const response=await request(`${env.MELHOR_ENVIO_BASE_URL||'https://melhorenvio.com.br'}/api/v2/me/shipment/calculate`,{
      method:'POST',headers:{accept:'application/json','content-type':'application/json',authorization:`Bearer ${env.MELHOR_ENVIO_TOKEN}`,'user-agent':env.MELHOR_ENVIO_USER_AGENT||'Valente Fish (contato@valentefish.com.br)'},
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(6000)]):AbortSignal.timeout(6000),
      body:JSON.stringify({from:{postal_code:String(env.STORE_POSTAL_CODE).replace(/\D/g,'')},to:{postal_code:postalCode},products:rows.map(p=>({id:p.id,width:Number(p.width_cm),height:Number(p.height_cm),length:Number(p.length_cm),weight:Number(p.weight_grams)/1000,insurance_value:centsToMoney(p.price_cents),quantity:quantities.get(p.slug)})),options:{receipt:false,own_hand:false}})
    });
    if(!response.ok) return fallback();
    const payload=await response.json();
    if(!Array.isArray(payload)) return fallback();
    const opcoes=payload.filter(x=>!x.error&&x.price&&Number.isFinite(Number(x.custom_price||x.price))).slice(0,3).map(x=>({
      transportadora:x.company?.name||'Transportadora',servico:x.name,preco:formatPrice(moneyToCents(x.custom_price||x.price)),
      prazo_dias_min:Number(x.custom_delivery_range?.min||x.delivery_range?.min||x.custom_delivery_time||x.delivery_time||0),
      prazo_dias_max:Number(x.custom_delivery_range?.max||x.delivery_range?.max||x.custom_delivery_time||x.delivery_time||0)
    }));
    return opcoes.length?{opcoes,aviso}:fallback();
  }catch{return fallback();}
}
