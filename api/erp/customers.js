import {db} from '../_lib/db.js';
import {body,fail,method} from '../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET','POST','PATCH','DELETE'])) return;
  try{
    const sql=db();
    if(req.method==='GET'){
      const customers=await sql`
        select c.*, count(s.id)::int as sale_count, coalesce(sum(s.total_cents),0)::int as total_spent_cents
        from public.store_customers c
        left join public.sales s on s.customer_id=c.id and s.status='paid'
        group by c.id
        order by c.full_name
      `;
      return res.status(200).json({customers});
    }

    const input=body(req);
    if(req.method==='POST'){
      if(!input.name&&!input.fullName) return res.status(422).json({error:'Informe o nome do cliente'});
      const [customer]=await sql`
        insert into public.store_customers (full_name,email,phone,notes)
        values (${String(input.name||input.fullName).trim()},${input.email||null},${input.phone||null},${input.notes||null})
        returning *
      `;
      return res.status(201).json({customer});
    }

    const id=input.id||req.query?.id;
    if(!id) return res.status(422).json({error:'Cliente não informado'});

    if(req.method==='DELETE'){
      await sql`delete from public.store_customers where id=${id}`;
      return res.status(200).json({ok:true});
    }

    const [customer]=await sql`
      update public.store_customers
      set full_name=${String(input.name||input.fullName||'').trim()},
          email=${input.email||null},
          phone=${input.phone||null},
          notes=${input.notes||null}
      where id=${id}
      returning *
    `;
    if(!customer) return res.status(404).json({error:'Cliente não encontrado'});
    return res.status(200).json({customer});
  }catch(error){
    fail(res,error);
  }
}
