import {db} from '../../_lib/db.js';
import {body,fail,method} from '../../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET','POST'])) return;
  try{
    const sql=db();
    if(req.method==='GET'){
      const [products,movements]=await Promise.all([
        sql`select id, sku, name, category, stock_quantity, active from public.products order by stock_quantity, name`,
        sql`
          select m.id, m.kind, m.quantity, m.reason, m.created_at, p.name as product_name
          from public.stock_movements m
          join public.products p on p.id=m.product_id
          order by m.created_at desc
          limit 30
        `
      ]);
      return res.status(200).json({products,movements});
    }

    const input=body(req);
    const kind=input.kind;
    const amount=Math.abs(Number(input.quantity||0));
    if(!input.productId) return res.status(422).json({error:'Selecione o produto'});
    if(!['entrada','saida','ajuste'].includes(kind)) return res.status(422).json({error:'Tipo de movimento inválido'});
    if(!amount) return res.status(422).json({error:'Informe a quantidade'});

    const result=await sql.begin(async tx=>{
      const [product]=await tx`select * from public.products where id=${input.productId} for update`;
      if(!product) throw Object.assign(new Error('Produto não encontrado'),{status:404});
      const next=kind==='entrada'
        ?product.stock_quantity+amount
        :kind==='saida'
          ?product.stock_quantity-amount
          :amount;
      if(next<0) throw Object.assign(new Error('Estoque insuficiente para essa saída'),{status:409});
      await tx`update public.products set stock_quantity=${next} where id=${product.id}`;
      const signed=kind==='saida'?-amount:kind==='entrada'?amount:next-product.stock_quantity;
      const [movement]=await tx`
        insert into public.stock_movements (product_id,kind,quantity,reason)
        values (${product.id},${kind},${signed},${input.reason||null})
        returning *
      `;
      return {product:{...product,stock_quantity:next},movement};
    });
    return res.status(201).json(result);
  }catch(error){
    fail(res,error,error.status||500);
  }
}
