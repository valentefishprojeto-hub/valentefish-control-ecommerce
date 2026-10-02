import {db} from '../_lib/db.js';
import {fail,method} from '../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET'])) return;
  try{
    const sql=db();
    const [metrics]=await sql`
      select
        (select count(*)::int from public.products where active=true) as products,
        (select count(*)::int from public.products where active=true and featured=true) as featured,
        (select count(*)::int from public.products where active=true and stock_quantity<=2) as low_stock,
        (select count(*)::int from public.store_customers) as customers,
        (select coalesce(sum(total_cents),0)::int from public.sales where status='paid' and sold_at>=date_trunc('month', timezone('utc', now()))) as month_sales_cents,
        (select coalesce(sum(total_cents),0)::int from public.sales where status='paid' and sold_at>=timezone('utc', now())::date) as today_sales_cents,
        (select coalesce(sum(amount_cents),0)::int from public.finance_entries where kind='receita' and created_at>=date_trunc('month', timezone('utc', now()))) as month_income_cents,
        (select coalesce(sum(amount_cents),0)::int from public.finance_entries where kind='despesa' and created_at>=date_trunc('month', timezone('utc', now()))) as month_expense_cents
    `;
    const lowStock=await sql`
      select id, name, sku, stock_quantity, category
      from public.products
      where active=true and stock_quantity<=2
      order by stock_quantity, name
      limit 8
    `;
    const recentSales=await sql`
      select id, number, customer_name, total_cents, payment_method, sold_at
      from public.sales
      where status='paid'
      order by sold_at desc
      limit 6
    `;
    res.status(200).json({metrics,lowStock,recentSales});
  }catch(error){
    fail(res,error);
  }
}
