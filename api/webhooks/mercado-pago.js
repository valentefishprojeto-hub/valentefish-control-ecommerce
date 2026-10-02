import crypto from 'node:crypto';
import {db} from '../_lib/db.js';
import {body,fail,method} from '../_lib/http.js';

function validSignature(req,dataId){
  const secret=process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const header=req.headers['x-signature'];
  if(!secret||!header) return false;
  const values=Object.fromEntries(String(header).split(',').map(part=>part.trim().split('=')));
  if(!values.ts||!values.v1) return false;
  const timestamp=Number(values.ts);
  if(!Number.isFinite(timestamp)||Math.abs(Date.now()-timestamp)>10*60*1000) return false;
  const requestId=req.headers['x-request-id'];
  const manifest=`${dataId?`id:${String(dataId).toLowerCase()};`:''}${requestId?`request-id:${requestId};`:''}ts:${values.ts};`;
  const expected=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
  const expectedBuffer=Buffer.from(expected,'hex');
  const receivedBuffer=Buffer.from(values.v1,'hex');
  return expectedBuffer.length===receivedBuffer.length&&crypto.timingSafeEqual(expectedBuffer,receivedBuffer);
}

function localStatus(status){
  if(status==='approved') return 'paid';
  if(['rejected'].includes(status)) return 'failed';
  if(['cancelled'].includes(status)) return 'cancelled';
  if(['refunded','charged_back'].includes(status)) return 'refunded';
  if(status==='authorized') return 'authorized';
  return 'pending';
}

function paymentMethod(type){
  if(type==='credit_card') return 'credit_card';
  if(type==='debit_card') return 'debit_card';
  if(type==='ticket') return 'boleto';
  if(type==='bank_transfer') return 'pix';
  return 'unknown';
}

export default async function handler(req,res){
  if(!method(req,res,['POST'])) return;
  try{
    if(!process.env.MERCADO_PAGO_ACCESS_TOKEN||!process.env.MERCADO_PAGO_WEBHOOK_SECRET){
      return res.status(503).json({error:'Webhook Mercado Pago não configurado'});
    }
    const payload=body(req);
    const dataId=req.query['data.id']||payload.data?.id;
    if(!dataId||!validSignature(req,dataId)) return res.status(401).json({error:'Assinatura inválida'});

    const response=await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,{
      headers:{authorization:`Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`}
    });
    const payment=await response.json();
    if(!response.ok) return res.status(502).json({error:'Falha ao consultar pagamento'});
    const orderId=payment.external_reference||payment.metadata?.order_id;
    if(!orderId) return res.status(200).json({received:true});

    const sql=db();
    await sql.begin(async tx=>{
      await tx`
        insert into public.webhook_events (provider,provider_event_id,event_type,payload,processed_at)
        values ('mercado_pago',${String(payload.id||dataId)},${payload.action||payload.type||'payment'},${tx.json(payload)},timezone('utc',now()))
        on conflict (provider,provider_event_id) do update set payload=excluded.payload,processed_at=excluded.processed_at
      `;
      const [stored]=await tx`select * from public.payments where order_id=${orderId} for update`;
      const nextStatus=localStatus(payment.status);
      const wasPaid=stored?.status==='paid';
      if(stored){
        await tx`
          update public.payments
          set provider_payment_id=${String(payment.id)},method=${paymentMethod(payment.payment_type_id)},status=${nextStatus},
              installments=${payment.installments||null},raw_status=${tx.json(payment)},updated_at=timezone('utc',now())
          where id=${stored.id}
        `;
      }
      if(nextStatus==='paid'){
        await tx`
          update public.orders
          set status='paid',payment_status='paid',fulfillment_status='preparing',
              paid_at=coalesce(paid_at,timezone('utc',now())),updated_at=timezone('utc',now())
          where id=${orderId}
        `;
        if(!wasPaid){
          const items=await tx`select product_id,quantity from public.order_items where order_id=${orderId}`;
          for(const item of items){
            if(item.product_id) await tx`
              update public.products set stock_quantity=greatest(0,stock_quantity-${item.quantity}),updated_at=timezone('utc',now())
              where id=${item.product_id}
            `;
          }
          await tx`insert into public.shipments (order_id) values (${orderId}) on conflict (order_id) do nothing`;
        }
      }else{
        await tx`
          update public.orders
          set payment_status=${nextStatus},status=case when ${nextStatus} in ('failed','cancelled') then 'cancelled' else status end,
              updated_at=timezone('utc',now())
          where id=${orderId}
        `;
      }
    });
    res.status(200).json({received:true});
  }catch(error){
    fail(res,error);
  }
}
