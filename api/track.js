import {db} from './_lib/db.js';
import {body,fail,method} from './_lib/http.js';

const allowed=['page_view','search','add_to_cart','cart_view','checkout','cart_snapshot'];

function normalizeSource(value=''){
  const text=String(value).toLowerCase();
  if(/instagram|ig\.com/.test(text)) return 'instagram';
  if(/whatsapp|wa\.me/.test(text)) return 'whatsapp';
  if(/facebook|fb\.|meta/.test(text)) return 'facebook';
  if(/google|gclid/.test(text)) return 'google';
  if(/tiktok/.test(text)) return 'tiktok';
  if(/youtube/.test(text)) return 'youtube';
  if(text&&text!=='direct') return text.slice(0,40);
  return 'direct';
}

export default async function handler(req,res){
  if(!method(req,res,['POST'])) return;
  try{
    const input=body(req);
    const eventType=allowed.includes(input.eventType)?input.eventType:'page_view';
    const source=normalizeSource(input.source);
    const sql=db();
    const visitorId=/^[0-9a-f-]{36}$/i.test(input.visitorId)?input.visitorId:null;
    const visitor=await sql.begin(async tx=>{
      const [current]=await tx`
        insert into public.store_visitors (id,source,referrer,last_path)
        values (${visitorId||crypto.randomUUID()},${source},${input.referrer||null},${input.path||'/'})
        on conflict (id) do update set
          last_seen_at=timezone('utc', now()),
          last_path=coalesce(excluded.last_path, public.store_visitors.last_path),
          referrer=coalesce(excluded.referrer, public.store_visitors.referrer),
          source=case when public.store_visitors.source='direct' and excluded.source<>'direct' then excluded.source else public.store_visitors.source end
        returning *
      `;
      await tx`
        insert into public.store_events (visitor_id,event_type,path,query,product_name,source,payload)
        values (
          ${current.id},
          ${eventType},
          ${input.path||null},
          ${input.query?String(input.query).slice(0,120):null},
          ${input.productName||null},
          ${source},
          ${tx.json(input.payload||{})}
        )
      `;
      return current;
    });
    res.status(201).json({visitorId:visitor.id});
  }catch(error){
    fail(res,error);
  }
}
