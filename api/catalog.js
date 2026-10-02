import {db} from './_lib/db.js';
import {FEATURED_LIMIT,mapProduct} from './_lib/erp.js';
import {fail,method} from './_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET'])) return;
  try{
    const sql=db();
    const [categories,products]=await Promise.all([
      sql`select id, slug, name, description, sort_order from public.categories where active=true order by sort_order, name`,
      sql`
        select p.*, c.name as category_name, c.slug as category_slug
        from public.products p
        left join public.categories c on c.id=p.category_id
        where p.active=true
        order by p.featured desc, p.featured_rank, p.name
      `
    ]);
    res.setHeader('Cache-Control','s-maxage=30, stale-while-revalidate=120');
    res.status(200).json({
      featuredLimit:FEATURED_LIMIT,
      categories,
      products:products.map(mapProduct)
    });
  }catch(error){
    fail(res,error);
  }
}
