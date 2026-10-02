const CART_KEY='vf-cart';
const SESSION_KEY='vf-session';
const ORDERS_KEY='vf-orders';

export function priceValue(price){
  if(typeof price==='number') return price;
  const digits=String(price||'').replace(/\D/g,'');
  return Number(digits||0)/100;
}

export function formatPrice(value){
  return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

export function loadCart(){
  try{
    const items=JSON.parse(localStorage.getItem(CART_KEY)||'[]');
    return Array.isArray(items)?items:[];
  }catch{
    return [];
  }
}

export function saveCart(items){
  localStorage.setItem(CART_KEY,JSON.stringify(items));
  return items;
}

export function cartCount(items){
  return items.reduce((total,item)=>total+Number(item.quantity||0),0);
}

export function cartSubtotal(items){
  return items.reduce((total,item)=>total+priceValue(item.price)*Number(item.quantity||0),0);
}

export function upsertCartItem(items,product,quantity=1){
  const slug=product.slug||product.name;
  const amount=Math.max(1,Number(quantity)||1);
  const existing=items.find(item=>item.slug===slug);
  if(existing){
    return items.map(item=>item.slug===slug?{...item,quantity:item.quantity+amount}:item);
  }
  return [...items,{
    slug,
    name:product.name,
    price:product.price,
    image:product.image,
    category:product.category,
    quantity:amount
  }];
}

export function setCartQuantity(items,slug,quantity){
  if(quantity<1) return items.filter(item=>item.slug!==slug);
  return items.map(item=>item.slug===slug?{...item,quantity}:item);
}

export function loadSession(){
  try{
    return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
  }catch{
    return null;
  }
}

export function saveSession(session){
  if(!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  return session;
}

export function loadOrders(){
  try{
    const orders=JSON.parse(localStorage.getItem(ORDERS_KEY)||'[]');
    return Array.isArray(orders)?orders:[];
  }catch{
    return [];
  }
}

export function saveOrder(order){
  const orders=[order,...loadOrders()];
  localStorage.setItem(ORDERS_KEY,JSON.stringify(orders));
  return orders;
}

export async function api(path,options={}){
  const headers={'content-type':'application/json',...options.headers};
  try{
    const {getSupabase}=await import('./supabaseClient');
    const {data}=await getSupabase().auth.getSession();
    if(data.session?.access_token) headers.authorization=`Bearer ${data.session.access_token}`;
  }catch{}
  const response=await fetch(path,{credentials:'include',...options,headers,body:options.body?JSON.stringify(options.body):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw Object.assign(new Error(data.error||'Não foi possível concluir a operação'),{status:response.status,data});
  return data;
}

export async function lookupCep(postalCode){
  const cep=String(postalCode||'').replace(/\D/g,'');
  if(cep.length!==8) throw new Error('CEP inválido');
  const response=await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data=await response.json();
  if(data.erro) throw new Error('CEP não encontrado');
  return {street:data.logradouro||'',district:data.bairro||'',city:data.localidade||'',state:data.uf||''};
}

export const fallbackQuotes=[
  {id:'standard',serviceName:'Econômico',companyName:'Correios',priceCents:2990,deliveryMinDays:5,deliveryMaxDays:8},
  {id:'express',serviceName:'Expresso',companyName:'Transportadora',priceCents:4990,deliveryMinDays:2,deliveryMaxDays:4},
  {id:'pickup',serviceName:'Retirar na loja',companyName:'Valente Fish',priceCents:0,deliveryMinDays:0,deliveryMaxDays:1}
];
