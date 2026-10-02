import {db} from '../_lib/db.js';
import {parseMoney} from '../_lib/erp.js';
import {body,fail,method} from '../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET','POST'])) return;
  try{
    const sql=db();
    if(req.method==='GET'){
      const sales=await sql`
        select s.*, coalesce(json_agg(json_build_object(
          'id',i.id,'productName',i.product_name,'quantity',i.quantity,'unitPriceCents',i.unit_price_cents,'totalCents',i.total_cents
        ) order by i.created_at) filter (where i.id is not null), '[]'::json) as items
        from public.sales s
        left join public.sale_items i on i.sale_id=s.id
        group by s.id
        order by s.sold_at desc
        limit 80
      `;
      return res.status(200).json({sales});
    }

    const input=body(req);
    const items=Array.isArray(input.items)?input.items.filter(item=>item.productId&&Number(item.quantity)>0):[];
    if(!items.length) return res.status(422).json({error:'Adicione ao menos um produto'});
    const paymentMethod=['dinheiro','pix','cartao','transferencia','outros'].includes(input.paymentMethod)?input.paymentMethod:'pix';

    const sale=await sql.begin(async tx=>{
      let customer=null;
      if(input.customerId){
        [customer]=await tx`select * from public.store_customers where id=${input.customerId}`;
      }
      const lines=[];
      for(const item of items){
        const [product]=await tx`select * from public.products where id=${item.productId} for update`;
        if(!product||!product.active) throw Object.assign(new Error('Produto indisponível'),{status:422});
        const quantity=Math.max(1,Number(item.quantity||1));
        if(product.stock_quantity<quantity) throw Object.assign(new Error(`${product.name} sem estoque suficiente`),{status:409});
        const unit=item.price!=null?parseMoney(item.price):product.price_cents;
        lines.push({product,quantity,unit,total:unit*quantity});
      }
      const subtotal=lines.reduce((sum,line)=>sum+line.total,0);
      const discount=Math.min(subtotal,parseMoney(input.discount||0));
      const total=subtotal-discount;
      const [created]=await tx`
        insert into public.sales (customer_id,customer_name,channel,status,payment_method,subtotal_cents,discount_cents,total_cents,notes)
        values (
          ${customer?.id||null},
          ${customer?.full_name||input.customerName||'Cliente balcão'},
          'loja',
          'paid',
          ${paymentMethod},
          ${subtotal},
          ${discount},
          ${total},
          ${input.notes||null}
        )
        returning *
      `;
      for(const line of lines){
        await tx`
          insert into public.sale_items (sale_id,product_id,product_name,unit_price_cents,quantity,total_cents)
          values (${created.id},${line.product.id},${line.product.name},${line.unit},${line.quantity},${line.total})
        `;
        await tx`update public.products set stock_quantity=${line.product.stock_quantity-line.quantity} where id=${line.product.id}`;
        await tx`
          insert into public.stock_movements (product_id,kind,quantity,reason,sale_id)
          values (${line.product.id},'venda',${-line.quantity},${`Venda #${created.number}`},${created.id})
        `;
      }
      if(total>0){
        await tx`
          insert into public.finance_entries (kind,category,description,amount_cents,sale_id,paid_at)
          values ('receita','vendas',${`Venda #${created.number} • ${created.customer_name}`},${total},${created.id},timezone('utc', now()))
        `;
      }
      return created;
    });
    return res.status(201).json({sale});
  }catch(error){
    fail(res,error,error.status||500);
  }
}
