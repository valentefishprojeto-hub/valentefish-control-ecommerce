import {db} from '../../_lib/db.js';
import {FEATURED_LIMIT,mapProduct,parseMoney,uniqueSlug} from '../../_lib/erp.js';
import {body,fail,method} from '../../_lib/http.js';

async function loadCategory(sql,idOrSlug){
  if(!idOrSlug) return null;
  const value=String(idOrSlug);
  const [category]=/^[0-9a-f-]{36}$/i.test(value)
    ?await sql`select * from public.categories where id=${value}`
    :await sql`select * from public.categories where slug=${value}`;
  return category||null;
}

export default async function handler(req,res){
  if(!method(req,res,['GET','POST','PATCH','DELETE'])) return;
  try{
    const sql=db();
    if(req.method==='GET'){
      const products=await sql`
        select p.*, c.name as category_name, c.slug as category_slug
        from public.products p
        left join public.categories c on c.id=p.category_id
        order by p.active desc, p.name
      `;
      return res.status(200).json({products:products.map(mapProduct),featuredLimit:FEATURED_LIMIT});
    }

    const input=body(req);
    let category=null;
    if(req.method==='POST'||req.method==='PATCH'){
      category=await loadCategory(sql,input.categoryId||input.category);
      if(!category) return res.status(422).json({error:'Selecione uma categoria'});
      if(!input.name) return res.status(422).json({error:'Informe o nome do produto'});
    }

    if(req.method==='POST'){
      const used=new Set((await sql`select slug from public.products`).map(row=>row.slug));
      const slug=uniqueSlug(input.slug||input.name,used);
      const featured=Boolean(input.featured);
      if(featured){
        const [{count}]=await sql`select count(*)::int as count from public.products where featured=true and active=true`;
        if(count>=FEATURED_LIMIT) return res.status(409).json({error:`A vitrine já tem ${FEATURED_LIMIT} destaques`});
      }
      const [row]=await sql`
        insert into public.products (
          sku, slug, name, description, category, category_id, price_cents, image_url, badge,
          stock_quantity, featured, featured_rank, active
        ) values (
          ${input.sku||null},
          ${slug},
          ${String(input.name).trim()},
          ${input.description||''},
          ${category.slug},
          ${category.id},
          ${parseMoney(input.price??input.priceCents)},
          ${input.imageUrl||input.image_url||null},
          ${input.badge||null},
          ${Math.max(0,Number(input.stockQuantity??input.stock??0))},
          ${featured},
          ${Number(input.featuredRank||0)},
          ${input.active!==false}
        )
        returning id
      `;
      const [product]=await sql`select p.*, c.name as category_name, c.slug as category_slug from public.products p left join public.categories c on c.id=p.category_id where p.id=${row.id}`;
      return res.status(201).json({product:mapProduct(product)});
    }

    const id=input.id||req.query?.id;
    if(!id) return res.status(422).json({error:'Produto não informado'});

    if(req.method==='DELETE'){
      await sql`update public.products set active=false, featured=false where id=${id}`;
      return res.status(200).json({ok:true});
    }

    const current=(await sql`select * from public.products where id=${id}`)[0];
    if(!current) return res.status(404).json({error:'Produto não encontrado'});
    if(!category) category=await loadCategory(sql,current.category_id);
    const used=new Set((await sql`select slug from public.products where id<>${id}`).map(row=>row.slug));
    const slug=uniqueSlug(input.slug||input.name||current.slug,used);
    const featured=input.featured??current.featured;
    if(featured && !current.featured){
      const [{count}]=await sql`select count(*)::int as count from public.products where featured=true and active=true and id<>${id}`;
      if(count>=FEATURED_LIMIT) return res.status(409).json({error:`A vitrine já tem ${FEATURED_LIMIT} destaques`});
    }
    await sql`
      update public.products
      set sku=${input.sku??current.sku},
          slug=${slug},
          name=${String(input.name||current.name).trim()},
          description=${input.description??current.description},
          category=${category.slug},
          category_id=${category.id},
          price_cents=${input.price!=null||input.priceCents!=null?parseMoney(input.price??input.priceCents):current.price_cents},
          image_url=${input.imageUrl??input.image_url??current.image_url},
          badge=${input.badge??current.badge},
          stock_quantity=${input.stockQuantity!=null||input.stock!=null?Math.max(0,Number(input.stockQuantity??input.stock)):current.stock_quantity},
          featured=${Boolean(featured)},
          featured_rank=${input.featuredRank??current.featured_rank},
          active=${input.active??current.active}
      where id=${id}
    `;
    const [product]=await sql`select p.*, c.name as category_name, c.slug as category_slug from public.products p left join public.categories c on c.id=p.category_id where p.id=${id}`;
    return res.status(200).json({product:mapProduct(product)});
  }catch(error){
    fail(res,error);
  }
}
