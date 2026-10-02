import {currentUser} from '../_lib/auth.js';
import {cartPayload,findCart} from '../_lib/cart.js';
import {db} from '../_lib/db.js';
import {body,fail,method} from '../_lib/http.js';

export default async function handler(req,res){
  if(!method(req,res,['GET','POST','PATCH','DELETE'])) return;
  try{
    const sql=db();
    const user=await currentUser(req);
    const cart=await findCart(req,res,user);

    if(req.method==='POST'){
      const input=body(req);
      const quantity=Math.max(1,Math.min(99,Number(input.quantity)||1));
      const products=input.productId
        ? await sql`select id, stock_quantity from public.products where id=${input.productId} and active=true limit 1`
        : await sql`select id, stock_quantity from public.products where slug=${input.slug||''} and active=true limit 1`;
      const product=products[0];
      if(!product) return res.status(404).json({error:'Produto indisponível'});
      const existing=await sql`select quantity from public.cart_items where cart_id=${cart.id} and product_id=${product.id}`;
      const nextQuantity=(existing[0]?.quantity||0)+quantity;
      if(nextQuantity>product.stock_quantity) return res.status(409).json({error:'Quantidade maior que o estoque disponível'});
      await sql`
        insert into public.cart_items (cart_id,product_id,quantity)
        values (${cart.id},${product.id},${quantity})
        on conflict (cart_id,product_id)
        do update set quantity=public.cart_items.quantity+excluded.quantity, updated_at=timezone('utc',now())
      `;
    }

    if(req.method==='PATCH'){
      const input=body(req);
      const quantity=Number(input.quantity);
      if(!input.itemId||!Number.isInteger(quantity)||quantity<1||quantity>99) return res.status(422).json({error:'Quantidade inválida'});
      const updated=await sql`
        update public.cart_items ci
        set quantity=${quantity}, updated_at=timezone('utc',now())
        from public.products p
        where ci.id=${input.itemId} and ci.cart_id=${cart.id} and p.id=ci.product_id and p.stock_quantity>=${quantity}
        returning ci.id
      `;
      if(!updated[0]) return res.status(409).json({error:'Item indisponível ou sem estoque suficiente'});
    }

    if(req.method==='DELETE'){
      const itemId=req.query.itemId||body(req).itemId;
      if(!itemId) return res.status(422).json({error:'Item não informado'});
      await sql`delete from public.cart_items where id=${itemId} and cart_id=${cart.id}`;
    }

    res.status(200).json({cart:await cartPayload(cart)});
  }catch(error){
    fail(res,error,error.status||500);
  }
}
