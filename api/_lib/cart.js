import {db} from './db.js';
import {ensureGuestToken} from './http.js';

export async function findCart(req,res,user,{create=true}={}){
  const sql=db();
  const guestToken=user?null:ensureGuestToken(req,res);
  const rows=user
    ? await sql`select * from public.carts where user_id=${user.id} and status='active' order by created_at desc limit 1`
    : await sql`select * from public.carts where guest_token=${guestToken} and status='active' order by created_at desc limit 1`;
  if(rows[0]||!create) return rows[0]||null;
  const [created]=user
    ? await sql`insert into public.carts (user_id) values (${user.id}) returning *`
    : await sql`insert into public.carts (guest_token) values (${guestToken}) returning *`;
  return created;
}

export async function cartPayload(cart){
  if(!cart) return {id:null,items:[],subtotalCents:0,itemCount:0};
  const sql=db();
  const items=await sql`
    select ci.id, ci.quantity, p.id as product_id, p.slug, p.name, p.price_cents,
           p.image_url, p.stock_quantity, p.active
    from public.cart_items ci
    join public.products p on p.id=ci.product_id
    where ci.cart_id=${cart.id}
    order by ci.created_at
  `;
  return {
    id:cart.id,
    items:items.map(item=>({
      id:item.id,
      productId:item.product_id,
      slug:item.slug,
      name:item.name,
      image:item.image_url,
      priceCents:item.price_cents,
      quantity:item.quantity,
      stockQuantity:item.stock_quantity,
      available:item.active&&item.stock_quantity>=item.quantity,
      totalCents:item.price_cents*item.quantity
    })),
    subtotalCents:items.reduce((total,item)=>total+item.price_cents*item.quantity,0),
    itemCount:items.reduce((total,item)=>total+item.quantity,0)
  };
}
