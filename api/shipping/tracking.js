import {currentUser} from '../_lib/auth.js';
import {db} from '../_lib/db.js';
import {body,fail,method} from '../_lib/http.js';

function shipmentStatus(status){
  const value=String(status||'').toLowerCase();
  if(value.includes('deliver')||value==='delivered') return 'delivered';
  if(value.includes('out_for_delivery')) return 'out_for_delivery';
  if(value.includes('post')) return 'posted';
  if(value.includes('transit')) return 'in_transit';
  if(value.includes('return')) return 'returned';
  if(value.includes('cancel')) return 'cancelled';
  if(value.includes('exception')||value.includes('problem')) return 'exception';
  return 'pending';
}

export default async function handler(req,res){
  if(!method(req,res,['POST'])) return;
  try{
    if(!process.env.MELHOR_ENVIO_TOKEN) return res.status(503).json({error:'Rastreamento ainda não configurado'});
    const user=await currentUser(req,{required:true});
    const input=body(req);
    if(!input.orderId) return res.status(422).json({error:'Pedido não informado'});
    const sql=db();
    const [shipment]=await sql`
      select s.*
      from public.shipments s
      join public.orders o on o.id=s.order_id
      where s.order_id=${input.orderId} and o.user_id=${user.id}
      limit 1
    `;
    if(!shipment) return res.status(404).json({error:'Entrega não encontrada'});
    if(!shipment.provider_shipment_id) return res.status(409).json({error:'A etiqueta de envio ainda não foi gerada'});

    const baseUrl=process.env.MELHOR_ENVIO_BASE_URL||'https://melhorenvio.com.br';
    const response=await fetch(`${baseUrl}/api/v2/me/shipment/tracking`,{
      method:'POST',
      headers:{
        accept:'application/json',
        'content-type':'application/json',
        authorization:`Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
        'user-agent':process.env.MELHOR_ENVIO_USER_AGENT||'Valente Fish (contato@valentefish.com.br)'
      },
      body:JSON.stringify({orders:[shipment.provider_shipment_id]})
    });
    const payload=await response.json();
    if(!response.ok) return res.status(502).json({error:'Não foi possível atualizar o rastreamento'});
    const tracking=payload[shipment.provider_shipment_id]||Object.values(payload)[0];
    const status=shipmentStatus(tracking?.status);
    const events=tracking?.tracking||tracking?.events||[];
    await sql.begin(async tx=>{
      await tx`
        update public.shipments
        set status=${status},tracking_code=coalesce(${tracking?.melhorenvio_tracking||tracking?.tracking_code||tracking?.tracking||null},tracking_code),
            delivered_at=case when ${status}='delivered' then coalesce(delivered_at,timezone('utc',now())) else delivered_at end,
            updated_at=timezone('utc',now())
        where id=${shipment.id}
      `;
      for(const event of Array.isArray(events)?events:[]){
        const happenedAt=event.date||event.created_at||event.happened_at;
        if(!happenedAt) continue;
        const exists=await tx`
          select 1 from public.shipment_events
          where shipment_id=${shipment.id} and status=${String(event.status||event.description||'update')} and happened_at=${new Date(happenedAt)}
          limit 1
        `;
        if(!exists[0]) await tx`
          insert into public.shipment_events (shipment_id,event_code,status,description,location,happened_at,raw_event)
          values (${shipment.id},${event.code||null},${String(event.status||'update')},${event.description||event.message||'Atualização da entrega'},
                  ${event.location||event.city||null},${new Date(happenedAt)},${tx.json(event)})
        `;
      }
    });
    res.status(200).json({status,trackingCode:tracking?.melhorenvio_tracking||shipment.tracking_code,events});
  }catch(error){
    fail(res,error,error.status||500);
  }
}
