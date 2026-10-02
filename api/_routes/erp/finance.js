import {db} from '../../_lib/db.js';
import {parseMoney} from '../../_lib/erp.js';
import {body,fail,method} from '../../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET','POST','DELETE'])) return;
  try{
    const sql=db();
    if(req.method==='GET'){
      const entries=await sql`select * from public.finance_entries order by created_at desc limit 120`;
      const [summary]=await sql`
        select
          coalesce(sum(amount_cents) filter (where kind='receita'),0)::int as income_cents,
          coalesce(sum(amount_cents) filter (where kind='despesa'),0)::int as expense_cents,
          coalesce(sum(amount_cents) filter (where kind='receita' and created_at>=date_trunc('month', timezone('utc', now()))),0)::int as month_income_cents,
          coalesce(sum(amount_cents) filter (where kind='despesa' and created_at>=date_trunc('month', timezone('utc', now()))),0)::int as month_expense_cents
        from public.finance_entries
      `;
      return res.status(200).json({entries,summary});
    }

    if(req.method==='DELETE'){
      const id=body(req).id||req.query?.id;
      if(!id) return res.status(422).json({error:'Lançamento não informado'});
      await sql`delete from public.finance_entries where id=${id} and sale_id is null`;
      return res.status(200).json({ok:true});
    }

    const input=body(req);
    const kind=input.kind==='despesa'?'despesa':'receita';
    const amount=parseMoney(input.amount||input.amountCents);
    if(!input.description) return res.status(422).json({error:'Informe a descrição'});
    if(amount<=0) return res.status(422).json({error:'Informe um valor válido'});
    const [entry]=await sql`
      insert into public.finance_entries (kind,category,description,amount_cents,due_on,paid_at)
      values (
        ${kind},
        ${input.category||'geral'},
        ${String(input.description).trim()},
        ${amount},
        ${input.dueOn||null},
        ${input.paid===false?null:new Date().toISOString()}
      )
      returning *
    `;
    return res.status(201).json({entry});
  }catch(error){
    fail(res,error);
  }
}
