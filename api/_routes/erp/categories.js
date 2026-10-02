import {db} from '../../_lib/db.js';
import {uniqueSlug} from '../../_lib/erp.js';
import {body,fail,method} from '../../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET','POST','PATCH','DELETE'])) return;
  try{
    const sql=db();
    if(req.method==='GET'){
      const categories=await sql`
        select c.*, count(p.id)::int as product_count
        from public.categories c
        left join public.products p on p.category_id=c.id and p.active=true
        group by c.id
        order by c.sort_order, c.name
      `;
      return res.status(200).json({categories});
    }

    const input=body(req);
    if(req.method==='POST'){
      if(!input.name) return res.status(422).json({error:'Informe o nome da categoria'});
      const used=new Set((await sql`select slug from public.categories`).map(row=>row.slug));
      const slug=uniqueSlug(input.slug||input.name,used);
      const [category]=await sql`
        insert into public.categories (slug,name,description,sort_order,active)
        values (${slug},${input.name.trim()},${input.description||''},${Number(input.sortOrder||99)},${input.active!==false})
        returning *
      `;
      return res.status(201).json({category});
    }

    const id=input.id||req.query?.id;
    if(!id) return res.status(422).json({error:'Categoria não informada'});

    if(req.method==='DELETE'){
      const [{count}]=await sql`select count(*)::int as count from public.products where category_id=${id}`;
      if(count>0) return res.status(409).json({error:'Mova ou desative os produtos desta categoria antes de excluir'});
      await sql`delete from public.categories where id=${id}`;
      return res.status(200).json({ok:true});
    }

    const current=(await sql`select * from public.categories where id=${id}`)[0];
    if(!current) return res.status(404).json({error:'Categoria não encontrada'});
    const nextName=String(input.name||current.name).trim();
    const used=new Set((await sql`select slug from public.categories where id<>${id}`).map(row=>row.slug));
    const slug=uniqueSlug(input.slug||nextName,used);
    const [category]=await sql`
      update public.categories
      set name=${nextName},
          slug=${slug},
          description=${input.description??current.description},
          sort_order=${input.sortOrder??current.sort_order},
          active=${input.active??current.active}
      where id=${id}
      returning *
    `;
    await sql`update public.products set category=${slug} where category_id=${id}`;
    return res.status(200).json({category});
  }catch(error){
    fail(res,error);
  }
}
