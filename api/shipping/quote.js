import {currentUser} from '../_lib/auth.js';
import {findCart} from '../_lib/cart.js';
import {centsToMoney,db,moneyToCents} from '../_lib/db.js';
import {body,fail,method} from '../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['POST'])) return;
  try{
    if(!process.env.MELHOR_ENVIO_TOKEN||!process.env.STORE_POSTAL_CODE){
      return res.status(503).json({error:'Integração de frete ainda não configurada'});
    }
    const input=body(req);
    const postalCode=String(input.postalCode||'').replace(/\D/g,'');
    if(postalCode.length!==8) return res.status(422).json({error:'CEP inválido'});

    const sql=db();
    const user=await currentUser(req);
    const cart=await findCart(req,res,user,{create:false});
    if(!cart) return res.status(422).json({error:'Carrinho vazio'});
    const items=await sql`
      select ci.quantity,p.id,p.price_cents,p.weight_grams,p.width_cm,p.height_cm,p.length_cm
      from public.cart_items ci
      join public.products p on p.id=ci.product_id
      where ci.cart_id=${cart.id} and p.active=true
    `;
    if(!items.length) return res.status(422).json({error:'Carrinho vazio'});

    const baseUrl=process.env.MELHOR_ENVIO_BASE_URL||'https://melhorenvio.com.br';
    const response=await fetch(`${baseUrl}/api/v2/me/shipment/calculate`,{
      method:'POST',
      headers:{
        accept:'application/json',
        'content-type':'application/json',
        authorization:`Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
        'user-agent':process.env.MELHOR_ENVIO_USER_AGENT||'Valente Fish (contato@valentefish.com.br)'
      },
      body:JSON.stringify({
        from:{postal_code:String(process.env.STORE_POSTAL_CODE).replace(/\D/g,'')},
        to:{postal_code:postalCode},
        products:items.map(item=>({
          id:item.id,
          width:Number(item.width_cm),
          height:Number(item.height_cm),
          length:Number(item.length_cm),
          weight:Number(item.weight_grams)/1000,
          insurance_value:centsToMoney(item.price_cents),
          quantity:item.quantity
        })),
        options:{receipt:false,own_hand:false}
      })
    });
    const payload=await response.json();
    if(!response.ok) return res.status(502).json({error:'Não foi possível calcular o frete',details:payload});

    const expiresAt=new Date(Date.now()+30*60*1000);
    const quotes=payload.filter(item=>!item.error&&item.price).map(item=>({
      serviceId:String(item.id),
      serviceName:item.name,
      companyName:item.company?.name||'Transportadora',
      priceCents:moneyToCents(item.custom_price||item.price),
      deliveryMinDays:Number(item.custom_delivery_range?.min||item.delivery_range?.min||item.custom_delivery_time||item.delivery_time||0),
      deliveryMaxDays:Number(item.custom_delivery_range?.max||item.delivery_range?.max||item.custom_delivery_time||item.delivery_time||0),
      raw:item
    }));
    await sql`delete from public.shipping_quotes where cart_id=${cart.id} or expires_at<timezone('utc',now())`;
    for(const quote of quotes){
      await sql`
        insert into public.shipping_quotes
          (cart_id,postal_code,service_id,service_name,company_name,price_cents,delivery_min_days,delivery_max_days,quote_payload,expires_at)
        values
          (${cart.id},${postalCode},${quote.serviceId},${quote.serviceName},${quote.companyName},${quote.priceCents},${quote.deliveryMinDays},${quote.deliveryMaxDays},${sql.json(quote.raw)},${expiresAt})
      `;
    }
    res.status(200).json({quotes:quotes.map(({raw,...quote})=>quote),expiresAt});
  }catch(error){
    fail(res,error,error.status||500);
  }
}
