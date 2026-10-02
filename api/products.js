import {db} from './_lib/db.js';
import {fail,method} from './_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET'])) return;
  try{
    const sql=db();
    const category=typeof req.query.category==='string'?req.query.category:null;
    const slug=typeof req.query.slug==='string'?req.query.slug:null;
    const search=typeof req.query.search==='string'?req.query.search.trim():null;
    const products=await sql`
      select id, sku, slug, name, description, category, price_cents, compare_at_price_cents,
             image_url, badge, stock_quantity, weight_grams, width_cm, height_cm, length_cm
      from public.products
      where active=true
        and (${category}::text is null or category=${category})
        and (${slug}::text is null or slug=${slug})
        and (${search}::text is null or name ilike ${search?`%${search}%`:null})
      order by category, name
    `;
    res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({products});
  }catch(error){
    fail(res,error);
  }
}
