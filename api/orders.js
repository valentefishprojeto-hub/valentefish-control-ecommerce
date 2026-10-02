import {currentUser} from './_lib/auth.js';
import {db} from './_lib/db.js';
import {fail,method} from './_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET'])) return;
  try{
    const user=await currentUser(req,{required:true});
    const sql=db();
    const orderId=typeof req.query.id==='string'?req.query.id:null;
    const orders=await sql`
      select o.*,s.status as shipment_status,s.tracking_code,s.tracking_url,s.estimated_delivery_at
      from public.orders o
      left join public.shipments s on s.order_id=o.id
      where o.user_id=${user.id}
        and (${orderId}::uuid is null or o.id=${orderId})
      order by o.created_at desc
      limit ${orderId?1:50}
    `;
    if(orderId&&!orders[0]) return res.status(404).json({error:'Pedido não encontrado'});
    if(orderId){
      const items=await sql`select * from public.order_items where order_id=${orderId} order by created_at`;
      const events=await sql`
        select se.status,se.description,se.location,se.happened_at
        from public.shipment_events se
        join public.shipments s on s.id=se.shipment_id
        where s.order_id=${orderId}
        order by se.happened_at desc
      `;
      return res.status(200).json({order:{...orders[0],items,events}});
    }
    res.status(200).json({orders});
  }catch(error){
    fail(res,error,error.status||500);
  }
}
