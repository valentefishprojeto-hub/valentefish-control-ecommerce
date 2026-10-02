import {db} from '../../_lib/db.js';
import {fail,method} from '../../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET'])) return;
  try{
    const sql=db();
    const since=new Date(Date.now()-30*864e5).toISOString();
    const [metrics]=await sql`
      select
        (select count(*)::int from public.store_visitors where last_seen_at>=${since}) as visitors,
        (select count(*)::int from public.store_events where event_type='search' and created_at>=${since}) as searches,
        (select count(*)::int from public.store_events where event_type='page_view' and created_at>=${since}) as page_views,
        (select count(*)::int from public.store_events where event_type='add_to_cart' and created_at>=${since}) as add_to_carts,
        (select count(*)::int from public.store_events where event_type='checkout' and created_at>=${since}) as checkouts,
        (select count(*)::int from public.carts where status='active' and updated_at>=${since}) as db_carts
    `;
    const sources=await sql`
      select source, count(*)::int as visitors
      from public.store_visitors
      where last_seen_at>=${since}
      group by source
      order by visitors desc
    `;
    const searches=await sql`
      select lower(query) as query, count(*)::int as count
      from public.store_events
      where event_type='search' and query is not null and created_at>=${since}
      group by 1
      order by count desc
      limit 12
    `;
    const products=await sql`
      select product_name, count(*)::int as count
      from public.store_events
      where event_type='add_to_cart' and product_name is not null and created_at>=${since}
      group by product_name
      order by count desc
      limit 8
    `;
    const activity=await sql`
      select e.id, e.event_type, e.path, e.query, e.product_name, e.source, e.created_at, e.payload, v.source as visitor_source
      from public.store_events e
      join public.store_visitors v on v.id=e.visitor_id
      order by e.created_at desc
      limit 24
    `;
    const carts=await sql`
      select distinct on (e.visitor_id)
        e.visitor_id, e.payload, e.created_at, v.source, v.last_path
      from public.store_events e
      join public.store_visitors v on v.id=e.visitor_id
      where e.event_type='cart_snapshot' and e.created_at>=timezone('utc', now()) - interval '7 days'
      order by e.visitor_id, e.created_at desc
    `;
    res.status(200).json({metrics,sources,searches,products,activity,carts});
  }catch(error){
    fail(res,error);
  }
}
