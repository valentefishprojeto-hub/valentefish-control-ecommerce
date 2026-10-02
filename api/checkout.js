import {currentUser} from './_lib/auth.js';
import {findCart} from './_lib/cart.js';
import {centsToMoney,db} from './_lib/db.js';
import {appUrl,body,fail,method} from './_lib/http.js';

const requiredAddressFields=['postalCode','street','number','district','city','state'];

export default async function handler(req,res){
  if(!method(req,res,['POST'])) return;
  let orderId;
  try{
    if(!process.env.MERCADO_PAGO_ACCESS_TOKEN){
      return res.status(503).json({error:'Pagamento ainda não configurado'});
    }
    const input=body(req);
    const customer=input.customer||{};
    const address=input.address||{};
    if(!customer.name||!customer.email) return res.status(422).json({error:'Nome e e-mail são obrigatórios'});
    if(requiredAddressFields.some(field=>!address[field])) return res.status(422).json({error:'Preencha o endereço completo'});
    if(!input.shippingQuoteId) return res.status(422).json({error:'Selecione uma opção de entrega'});

    const sql=db();
    const user=await currentUser(req);
    const cart=await findCart(req,res,user,{create:false});
    if(!cart) return res.status(422).json({error:'Carrinho vazio'});

    const created=await sql.begin(async tx=>{
      const items=await tx`
        select ci.quantity,p.id,p.sku,p.slug,p.name,p.image_url,p.price_cents,p.stock_quantity
        from public.cart_items ci
        join public.products p on p.id=ci.product_id
        where ci.cart_id=${cart.id} and p.active=true
        for update of ci,p
      `;
      if(!items.length) throw Object.assign(new Error('Carrinho vazio'),{status:422});
      const unavailable=items.find(item=>item.quantity>item.stock_quantity);
      if(unavailable) throw Object.assign(new Error(`${unavailable.name} não possui estoque suficiente`),{status:409});
      const [quote]=await tx`
        select * from public.shipping_quotes
        where id=${input.shippingQuoteId} and cart_id=${cart.id} and expires_at>timezone('utc',now())
        limit 1
      `;
      if(!quote) throw Object.assign(new Error('Cotação de frete expirada. Calcule novamente.'),{status:409});
      const subtotal=items.reduce((total,item)=>total+item.price_cents*item.quantity,0);
      const total=subtotal+quote.price_cents;
      const [order]=await tx`
        insert into public.orders
          (user_id,customer_email,customer_name,customer_phone,subtotal_cents,shipping_cents,total_cents,
           shipping_address,shipping_service,shipping_service_id,shipping_deadline_days)
        values
          (${user?.id||null},${customer.email.toLowerCase()},${customer.name},${customer.phone||null},${subtotal},
           ${quote.price_cents},${total},${tx.json(address)},${quote.service_name},${quote.service_id},${quote.delivery_max_days})
        returning *
      `;
      for(const item of items){
        await tx`
          insert into public.order_items
            (order_id,product_id,sku,product_name,product_image_url,unit_price_cents,quantity,total_cents,product_snapshot)
          values
            (${order.id},${item.id},${item.sku},${item.name},${item.image_url},${item.price_cents},${item.quantity},
             ${item.price_cents*item.quantity},${tx.json({slug:item.slug})})
        `;
      }
      return {order,items,total};
    });
    orderId=created.order.id;

    const baseUrl=appUrl(req);
    const preferenceResponse=await fetch('https://api.mercadopago.com/checkout/preferences',{
      method:'POST',
      headers:{
        authorization:`Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'content-type':'application/json',
        'x-idempotency-key':created.order.id
      },
      body:JSON.stringify({
        external_reference:created.order.id,
        items:created.items.map(item=>({
          id:item.id,
          title:item.name,
          quantity:item.quantity,
          currency_id:'BRL',
          unit_price:centsToMoney(item.price_cents),
          picture_url:item.image_url?.startsWith('http')?item.image_url:`${baseUrl}${item.image_url}`
        })),
        payer:{name:customer.name,email:customer.email,phone:customer.phone?{number:customer.phone}:undefined},
        shipments:{cost:centsToMoney(created.order.shipping_cents)},
        back_urls:{
          success:`${baseUrl}/checkout/sucesso`,
          pending:`${baseUrl}/checkout/pendente`,
          failure:`${baseUrl}/checkout/falha`
        },
        auto_return:'approved',
        notification_url:`${baseUrl}/api/webhooks/mercado-pago?source_news=webhooks`,
        statement_descriptor:'VALENTE FISH',
        metadata:{order_id:created.order.id,order_number:String(created.order.number)}
      })
    });
    const preference=await preferenceResponse.json();
    if(!preferenceResponse.ok) throw new Error(preference.message||'Mercado Pago recusou a criação do checkout');

    await sql.begin(async tx=>{
      await tx`
        insert into public.payments (order_id,provider_preference_id,status,amount_cents)
        values (${created.order.id},${preference.id},'pending',${created.total})
      `;
      await tx`update public.carts set status='converted',updated_at=timezone('utc',now()) where id=${cart.id}`;
    });

    res.status(201).json({
      order:{id:created.order.id,number:created.order.number,totalCents:created.total},
      checkoutUrl:process.env.MERCADO_PAGO_SANDBOX==='true'?preference.sandbox_init_point:preference.init_point
    });
  }catch(error){
    if(orderId){
      try{await db()`update public.orders set status='cancelled',payment_status='failed',cancelled_at=timezone('utc',now()) where id=${orderId}`}catch{}
    }
    fail(res,error,error.status||500);
  }
}
