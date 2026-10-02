import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {MessageCircle,AtSign,Check,ArrowRight,Search,ShoppingCart,User,Truck,ShieldCheck,BadgeCheck,Star,ArrowLeft,Heart,MessageSquareText,LogOut,CreditCard,X,Menu,Trash2,MapPin,Package} from 'lucide-react';
import {api,cartCount,cartSubtotal,fallbackQuotes,formatPrice,loadCart,loadOrders,lookupCep,priceValue,saveCart,saveOrder,setCartQuantity,upsertCartItem} from './commerce';
import {authMessage,currentSession,loadProfile,loginAccount as signInAccount,loginWithGoogle,logoutAccount as signOutAccount,onAuthChange,registerAccount as signUpAccount,updateAccount} from './auth';
import {FEATURED_LIMIT,categoryPath,fallbackCategories,loadCatalog} from './catalog';
import {track,trackCart} from './track';
const ErpApp=React.lazy(()=>import('./erp').then(module=>({default:module.ErpApp})));

function Toast({message}){return message?<div className="toast"><Check size={17}/>{message}</div>:null}

function AquariumEffects(){
  const canvasRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current;
    const context=canvas.getContext('2d',{alpha:true});
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse=window.matchMedia('(pointer: coarse)').matches;
    let width=0,height=0,dpr=1,frame=0,lastX=0,lastY=0;
    const pointer={x:0,y:0,targetX:0,targetY:0,alpha:0,active:false};
    const bubbles=[];
    const trails=[];
    const bubbleCount=reduced?0:coarse?14:32;
    const makeBubble=(randomY=true)=>({x:Math.random()*width,y:randomY?Math.random()*height:height+20,r:1.5+Math.random()*5.5,speed:.22+Math.random()*.55,drift:Math.random()*Math.PI*2,alpha:.12+Math.random()*.28});
    const resize=()=>{width=window.innerWidth;height=window.innerHeight;dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;context.setTransform(dpr,0,0,dpr,0,0);if(!bubbles.length)for(let i=0;i<bubbleCount;i++)bubbles.push(makeBubble())};
    const addBurst=(x,y,count=7)=>{if(reduced)return;for(let i=0;i<count;i++)trails.push({x:x+(Math.random()-.5)*18,y:y+(Math.random()-.5)*12,r:2+Math.random()*7,vx:(Math.random()-.5)*1.2,vy:-.5-Math.random()*1.7,alpha:.55+Math.random()*.3})};
    const onPointerMove=event=>{if(event.pointerType==='touch')return;pointer.targetX=event.clientX;pointer.targetY=event.clientY;pointer.active=true;pointer.alpha=Math.min(1,pointer.alpha+.25);const root=canvas.closest('.storefront');root?.style.setProperty('--pointer-x',String(event.clientX/width-.5));root?.style.setProperty('--pointer-y',String(event.clientY/height-.5));if(Math.hypot(event.clientX-lastX,event.clientY-lastY)>24){trails.push({x:event.clientX,y:event.clientY,r:2+Math.random()*4,vx:(Math.random()-.5)*.5,vy:-.5-Math.random(),alpha:.42});lastX=event.clientX;lastY=event.clientY}};
    const onPointerLeave=()=>{pointer.active=false};
    const onPointerDown=event=>{pointer.targetX=event.clientX;pointer.targetY=event.clientY;pointer.x=event.clientX;pointer.y=event.clientY;pointer.alpha=event.pointerType==='touch' ? .65 : 1;addBurst(event.clientX,event.clientY,event.pointerType==='touch'?10:7)};
    const onScroll=()=>{const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);canvas.closest('.storefront')?.style.setProperty('--dive-depth',String(Math.min(1,scrollY/max)))};
    const ring=(x,y,r,alpha)=>{
      const gradient=context.createRadialGradient(x-r*.25,y-r*.3,r*.08,x,y,r);
      gradient.addColorStop(0,`rgba(255,255,255,${alpha*.28})`);
      gradient.addColorStop(.65,`rgba(129,226,244,${alpha*.05})`);
      gradient.addColorStop(1,`rgba(174,239,250,${alpha*.35})`);
      context.fillStyle=gradient;context.beginPath();context.arc(x,y,r,0,Math.PI*2);context.fill();
      context.strokeStyle=`rgba(220,249,255,${alpha*.5})`;context.lineWidth=1;context.stroke();
      context.fillStyle=`rgba(255,255,255,${alpha*.72})`;context.beginPath();context.arc(x-r*.3,y-r*.32,Math.max(1,r*.1),0,Math.PI*2);context.fill();
    };
    const draw=()=>{
      context.clearRect(0,0,width,height);
      if(!document.hidden){
        bubbles.forEach(b=>{b.y-=b.speed;b.drift+=.008;b.x+=Math.sin(b.drift)*.08;if(b.y<-15)Object.assign(b,makeBubble(false),{y:height+15});ring(b.x,b.y,b.r,b.alpha)});
        trails.forEach(t=>{t.x+=t.vx;t.y+=t.vy;t.alpha-=.009;t.r+=.015;ring(t.x,t.y,t.r,Math.max(0,t.alpha))});
        for(let i=trails.length-1;i>=0;i--)if(trails[i].alpha<=0)trails.splice(i,1);
        if(pointer.active){pointer.x+=(pointer.targetX-pointer.x)*.14;pointer.y+=(pointer.targetY-pointer.y)*.14;pointer.alpha=Math.min(1,pointer.alpha+.04)}else pointer.alpha=Math.max(0,pointer.alpha-.025);
        if(pointer.alpha>0&&!coarse)ring(pointer.x,pointer.y,22,pointer.alpha*.72);
      }
      frame=requestAnimationFrame(draw);
    };
    resize();onScroll();draw();
    window.addEventListener('resize',resize);window.addEventListener('pointermove',onPointerMove,{passive:true});window.addEventListener('pointerleave',onPointerLeave);window.addEventListener('pointerdown',onPointerDown,{passive:true});window.addEventListener('scroll',onScroll,{passive:true});
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',onPointerMove);window.removeEventListener('pointerleave',onPointerLeave);window.removeEventListener('pointerdown',onPointerDown);window.removeEventListener('scroll',onScroll)};
  },[]);
  return <canvas ref={canvasRef} className="aquarium-canvas" aria-hidden="true"/>;
}

function CinematicIntro(){
  const [visible,setVisible]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&sessionStorage.getItem('valente-intro-seen')!=='1');
  const [leaving,setLeaving]=useState(false);
  useEffect(()=>{if(!visible)return;const timer=setTimeout(()=>finish(),3300);return()=>clearTimeout(timer)},[visible]);
  const finish=()=>{setLeaving(true);sessionStorage.setItem('valente-intro-seen','1');setTimeout(()=>setVisible(false),650)};
  if(!visible)return null;
  return <div className={`cinematic-intro ${leaving?'leaving':''}`} aria-label="Apresentação Valente Fish">
    <div className="intro-surface"/>
    <div className="intro-rays"><i/><i/><i/></div>
    <div className="intro-school" aria-hidden="true">{Array.from({length:12},(_,index)=><i key={index}/>)}</div>
    <img className="intro-fish intro-fish-yellow" src="/store/product-fish-yellow.png" alt=""/>
    <img className="intro-fish intro-fish-clown" src="/store/product-fish-clown.png" alt=""/>
    <div className="intro-brand"><span>MERGULHE NO UNIVERSO</span><img src="/valente-fish-logo.png" alt="Valente Fish"/></div>
    <div className="intro-bubbles" aria-hidden="true">{Array.from({length:9},(_,index)=><i key={index}/>)}</div>
    <button onClick={finish}>Pular introdução</button>
  </div>
}


const storeProducts=[
  {name:'Peixe-palhaço Premium',category:'Peixes',price:'R$ 289,00',image:'/store/product-fish-clown.png',tag:'Quarentenado'},
  {name:'Yellow Tang',category:'Peixes',price:'R$ 849,00',image:'/store/product-fish-yellow.png',tag:'Quarentenado'},
  {name:'Coral Hammer Green',category:'Corais',price:'R$ 379,00',image:'/store/product-coral.png',tag:'Cultivo selecionado'},
  {name:'Flatworm Rx Blue Vet',category:'Tratamentos',price:'R$ 189,90',image:'/store/product-flatworm.webp',tag:'Mais vendido'},
  {name:'Green Cyano Rx Blue Life',category:'Tratamentos',price:'R$ 219,90',image:'/store/product-green-cyano.webp',tag:'Novidade'},
  {name:'Red Cyano Rx Blue Life',category:'Tratamentos',price:'R$ 219,90',image:'/store/product-red-cyano.webp'},
  {name:'Alga Nori Green 140g',category:'Rações',price:'R$ 74,90',image:'/store/product-nori.webp'},
  {name:'Vitalis Marine Grazer 240g',category:'Rações',price:'R$ 164,90',image:'/store/product-vitalis-240.webp',tag:'Recomendado'},
  {name:'Vitalis Marine Grazer 120g',category:'Rações',price:'R$ 99,90',image:'/store/product-vitalis-120.webp'},
  {name:'Carcaça Slim para Filtro',category:'Filtragem',price:'R$ 129,90',image:'/store/product-filter.jpg'},
  {name:'Osmose Reversa 4 Estágios',category:'Filtragem',price:'R$ 1.249,90',image:'/store/product-osmosis.jpg',tag:'Envio nacional'}
];
const valenteStories=[
  ['tzrZEFUF21Q','01','Anêmonas','Qual é a sua preferida?'],
  ['Ua5ZTRYOTUQ','02','Scolymia','Bleeding Apple'],
  ['R_0UQ2QAhfI','03','Mushroom','Bounce Frankenstein'],
  ['97flI2idI4E','04',"Valente's Reef",'Uma nova luz sobre o reef']
];
const storeMenu=[['home','Início','/'],['produtos','Produtos','/produtos'],['orcamento','Orçamento','/orcamento']];
const commerceRoutes={'/conta':'conta','/conta/entrar':'entrar','/conta/criar':'criar-conta','/carrinho':'carrinho','/checkout':'checkout','/checkout/sucesso':'sucesso','/checkout/pendente':'pendente','/checkout/falha':'falha'};
const productSlug=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const storePageFromPath=(path,categories=[])=>path.startsWith('/produto/')?'produto':path.startsWith('/c/')||categories.some(category=>`/${category.slug}`===path)?'categoria':commerceRoutes[path]||storeMenu.find(([, ,menuPath])=>menuPath===path)?.[0]||'home';
const activeCategoryFromPath=(path,categories=[])=>path.startsWith('/c/')?categories.find(category=>category.slug===path.slice(3)):categories.find(category=>`/${category.slug}`===path);
const categoryInfo={
  Peixes:{description:'Exemplar selecionado pela equipe Valente Fish, acompanhado de perto e preparado para uma adaptação segura ao novo aquário.',details:['Animal quarentenado','Alimentação acompanhada','Suporte para aclimatação','Foto ilustrativa do lote']},
  Corais:{description:'Coral selecionado por coloração, saúde e estrutura, mantido sob parâmetros controlados antes da disponibilização.',details:['Cultivo selecionado','Iluminação moderada','Fluxo moderado','Suporte pós-compra']},
  Rações:{description:'Nutrição de qualidade para uma rotina alimentar equilibrada, escolhida entre marcas reconhecidas no aquarismo.',details:['Produto original','Lote rastreável','Armazenamento adequado','Envio protegido']},
  Filtragem:{description:'Equipamento escolhido para apoiar a estabilidade e a qualidade da água do seu sistema.',details:['Produto original','Aplicação em aquários','Suporte especializado','Garantia do fabricante']},
  Tratamentos:{description:'Solução especializada para manutenção do aquário. A aplicação deve seguir as orientações do fabricante.',details:['Produto original','Lote rastreável','Instruções do fabricante','Suporte especializado']}
};

function CategoryGlyph({type}){
  const drawings={
    peixes:<><path d="M6 24c7-9 18-10 27-3 4 3 4 7 0 10-9 7-20 6-27-3l-4 5V19l4 5Z"/><path d="M18 17c-2-4 2-7 6-8M18 35c-2 4 2 7 6 8"/><circle cx="30" cy="24" r="1.7"/></>,
    corais:<><path d="M24 42V21m0 8-9-8v-8m9 10 9-8V8m-9 20 11 7v-8M24 20l-8-7V7"/><path d="M10 42h28"/><circle cx="15" cy="12" r="2"/><circle cx="33" cy="7" r="2"/><circle cx="36" cy="26" r="2"/></>,
    racoes:<><path d="M8 27h32l-4 12H12L8 27Z"/><path d="M13 27c2-5 20-5 22 0"/><circle cx="14" cy="13" r="2.4"/><circle cx="24" cy="9" r="2.4"/><circle cx="34" cy="15" r="2.4"/><circle cx="23" cy="18" r="2.4"/></>,
    filtragem:<><rect x="13" y="7" width="22" height="34" rx="6"/><path d="M13 15h22M13 34h22M19 20c3-3 7 3 10 0M19 26c3-3 7 3 10 0"/><path d="M8 13c-4 3-4 8 0 11M40 30c4 3 4 8 0 11"/></>,
    tratamentos:<><rect x="16" y="8" width="16" height="32" rx="8"/><path d="M20 18h8M24 14v16"/></>
  };
  return <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{drawings[type]||drawings.peixes}</svg>;
}

function ProductCard({item,onOpen,onAdd,onBuy}){
  return <article className="store-product">
    {item.tag&&<span className="product-tag">{item.tag}</span>}
    <button className="favorite" aria-label={`Favoritar ${item.name}`}><Heart size={18}/></button>
    <div className="store-product-image"><button className="product-open-image" onClick={()=>onOpen(item)} aria-label={`Ver detalhes de ${item.name}`}><img src={item.image} alt={item.name} loading="lazy"/></button></div>
    <div className="store-product-body">
      <small>{item.category}</small>
      <h3><button className="product-name-button" onClick={()=>onOpen(item)}>{item.name}</button></h3>
      <div className="rating">{[1,2,3,4,5].map(n=><Star key={n} size={14} fill="currentColor"/>)}<span>5.0</span></div>
      <strong>{item.price}</strong>
      <span className="installment">ou 3x sem juros</span>
      <div className="product-actions">
        <button className="product-buy-button" onClick={()=>onBuy(item)}>Comprar</button>
        <button className="product-cart-button" onClick={()=>onAdd(item)}><ShoppingCart size={16}/> Adicionar ao carrinho</button>
      </div>
    </div>
  </article>;
}

function QuantityStepper({value,onChange,label}){
  return <div className="quantity-control"><button type="button" onClick={()=>onChange(value-1)} aria-label={`Diminuir ${label||''}`}>−</button><b>{value}</b><button type="button" onClick={()=>onChange(value+1)} aria-label={`Aumentar ${label||''}`}>+</button></div>;
}

function CommerceTrust(){
  return <ul className="commerce-trust">
    <li><ShieldCheck size={16}/> Compra segura</li>
    <li><Truck size={16}/> Envio especializado</li>
    <li><BadgeCheck size={16}/> Procedência garantida</li>
  </ul>;
}

function SuggestRail({title,items,onOpen,onAdd}){
  if(!items?.length) return null;
  return <section className="suggest-rail">
    <div><span className="eyebrow">APROVEITE TAMBÉM</span><h2>{title}</h2></div>
    <div className="suggest-track">{items.map(item=><article key={item.name}>
      <button type="button" className="suggest-open" onClick={()=>onOpen(item)}>
        <img src={item.image} alt=""/>
        <small>{item.category}</small>
        <b>{item.name}</b>
        <strong>{item.price}</strong>
      </button>
      {onAdd&&<button type="button" className="suggest-add" onClick={()=>onAdd(item)}><ShoppingCart size={14}/> Adicionar</button>}
    </article>)}</div>
  </section>;
}

function CartPage({items,suggestions,onOpen,onAdd,onQuantity,onRemove,onCheckout,onContinue}){
  const units=cartCount(items);
  const skuCount=items.length;
  const subtotal=cartSubtotal(items);
  if(!items.length) return <section className="commerce-page cart-page">
    <div className="commerce-empty">
      <ShoppingCart size={36}/>
      <h1>Seu carrinho está vazio</h1>
      <p>Adicione um produto para revisar quantidades, ver o frete e fechar a compra.</p>
      <button type="button" onClick={onContinue}>Ver catálogo</button>
    </div>
    <SuggestRail title="Comece por estes destaques" items={suggestions} onOpen={onOpen} onAdd={onAdd}/>
  </section>;
  return <section className="commerce-page cart-page">
    <div className="commerce-heading">
      <div><span className="eyebrow">SEU PEDIDO</span><h1>Carrinho</h1></div>
      <p>{skuCount} {skuCount===1?'produto':'produtos'} • {units} {units===1?'unidade':'unidades'}</p>
    </div>
    <div className="cart-layout">
      <ul className="cart-list">{items.map(item=>{
        const line=priceValue(item.price)*item.quantity;
        return <li key={item.slug}>
          <button type="button" className="cart-item-image" onClick={()=>onOpen(item)} aria-label={`Ver ${item.name}`}>
            <img src={item.image} alt=""/>
          </button>
          <div className="cart-item-copy">
            <small>{item.category}</small>
            <button type="button" className="product-name-button" onClick={()=>onOpen(item)}>{item.name}</button>
            <span>{item.price} <i>a unidade</i></span>
            <span>ou 3x de {formatPrice(line/3)} sem juros</span>
          </div>
          <div className="cart-item-tools">
            <QuantityStepper value={item.quantity} onChange={next=>onQuantity(item.slug,next)} label={item.name}/>
            <em>{formatPrice(line)}</em>
            <button type="button" className="cart-remove" onClick={()=>onRemove(item.slug)} aria-label={`Remover ${item.name}`}><Trash2 size={15}/> Remover</button>
          </div>
        </li>;
      })}</ul>
      <aside className="cart-summary">
        <span className="eyebrow">RESUMO DO PEDIDO</span>
        <p><span>Produtos ({units})</span><b>{formatPrice(subtotal)}</b></p>
        <p><span>Frete</span><small>calculado no checkout</small></p>
        <strong><span>Total</span>{formatPrice(subtotal)}</strong>
        <small className="cart-summary-note">Em até 3x de {formatPrice(subtotal/3)} sem juros</small>
        <button type="button" className="product-buy-button" onClick={onCheckout}>Fechar compra <ArrowRight size={17}/></button>
        <button type="button" className="commerce-ghost" onClick={onContinue}>Continuar comprando</button>
        <CommerceTrust/>
      </aside>
    </div>
    <SuggestRail title="Quem comprou estes itens também levou" items={suggestions} onOpen={onOpen} onAdd={onAdd}/>
  </section>;
}

function CartDrawer({open,items,added,onClose,onQuantity,onRemove,onCart,onCheckout}){
  useEffect(()=>{if(!open)return;const onKey=event=>{if(event.key==='Escape')onClose()};window.addEventListener('keydown',onKey);document.body.style.overflow='hidden';document.body.classList.add('cart-open');return()=>{window.removeEventListener('keydown',onKey);document.body.style.overflow='';document.body.classList.remove('cart-open')}},[open,onClose]);
  const addedSlug=added?.product?productSlug(added.product.name):null;
  return createPortal(<div className={`cart-drawer-root${open?' open':''}`} aria-hidden={!open}>
    <button className="cart-drawer-backdrop" onClick={onClose} tabIndex={open?0:-1} aria-label="Fechar carrinho"/>
    <div className="cart-drawer" role="dialog" aria-modal="true" aria-label="Carrinho">
      <header className="cart-drawer-head">
        <div><small>Seu carrinho</small><h2>{cartCount(items)} {cartCount(items)===1?'item':'itens'}</h2></div>
        <button onClick={onClose} aria-label="Fechar"><X size={18}/></button>
      </header>
      {added&&<div className="cart-drawer-added" role="status"><Check size={16}/> <span><b>{added.product.name}</b> adicionado</span></div>}
      {items.length?<>
        <ul className="cart-drawer-list">{items.map(item=><li key={item.slug} className={item.slug===addedSlug?'just-added':''}>
          <img src={item.image} alt=""/>
          <div><b>{item.name}</b><small>{item.price} un.</small>
            <div className="cart-drawer-tools">
              <QuantityStepper value={item.quantity} onChange={next=>onQuantity(item.slug,next)} label={item.name}/>
              <button type="button" className="cart-remove" onClick={()=>onRemove(item.slug)} aria-label={`Remover ${item.name}`}><Trash2 size={14}/></button>
            </div>
          </div>
          <strong>{formatPrice(priceValue(item.price)*item.quantity)}</strong>
        </li>)}</ul>
        <div className="cart-drawer-foot">
          <p><span>Subtotal</span><b>{formatPrice(cartSubtotal(items))}</b></p>
          <small>Frete e prazo entram no checkout</small>
          <button type="button" className="product-buy-button" onClick={onCheckout}>Fechar compra <ArrowRight size={16}/></button>
          <button type="button" className="commerce-ghost" onClick={onCart}>Ver carrinho completo</button>
        </div>
      </>:<div className="cart-drawer-empty"><ShoppingCart size={28}/><p>Seu carrinho está vazio</p><button type="button" className="commerce-ghost" onClick={onClose}>Continuar comprando</button></div>}
    </div>
  </div>,document.body);
}

function GoogleIcon(){
  return <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.46.35 2.83.96 4.04l3.01-2.33Z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"/></svg>;
}

function AuthPage({mode,busy,error,next,onSubmit,onGoogle,onSwitch}){
  const [form,setForm]=useState({name:'',email:'',phone:'',password:''});
  const update=event=>setForm(current=>({...current,[event.target.name]:event.target.value}));
  const creating=mode==='criar-conta';
  const toCheckout=new URLSearchParams(window.location.search).get('next')?.includes('/checkout');
  return <section className="commerce-page auth-page">
    <form className="commerce-card account-form" onSubmit={event=>{event.preventDefault();onSubmit(form)}}>
      <span className="eyebrow">{creating?'NOVA CONTA':'ACESSE SUA CONTA'}</span>
      <h1>{toCheckout?(creating?'Crie sua conta para finalizar':'Entre para finalizar a compra'):creating?'Criar conta':'Entrar'}</h1>
      <p>{creating?'Use e-mail, telefone e senha para acompanhar pedidos.':'Entre com Google ou e-mail para continuar.'}</p>
      <button type="button" className="google-button" onClick={()=>onGoogle(next)} disabled={busy}><GoogleIcon/> Continuar com Google</button>
      <div className="auth-divider"><span>ou use e-mail</span></div>
      {creating&&<label>Nome<input name="name" value={form.name} onChange={update} required placeholder="Seu nome"/></label>}
      <label>E-mail<input name="email" type="email" value={form.email} onChange={update} required placeholder="voce@email.com"/></label>
      {creating&&<label>Telefone / WhatsApp<input name="phone" type="tel" value={form.phone} onChange={update} required placeholder="(21) 99999-9999"/></label>}
      <label>Senha<input name="password" type="password" value={form.password} onChange={update} required minLength={6} placeholder="Mínimo 6 caracteres"/></label>
      {error&&<small className="commerce-error">{error}</small>}
      <button type="submit" disabled={busy}>{busy?'Aguarde...':creating?'Criar conta':'Entrar e continuar'}</button>
      <small>{creating?'Já tem conta?':'Ainda não tem conta?'} <button type="button" className="text-link" onClick={onSwitch}>{creating?'Entrar':'Criar conta'}</button></small>
      <CommerceTrust/>
    </form>
  </section>;
}

function AccountPage({session,orders,busy,error,onSave,onLogout,onShop}){
  const [form,setForm]=useState({name:session?.name||'',phone:session?.phone||''});
  useEffect(()=>setForm({name:session?.name||'',phone:session?.phone||''}),[session]);
  const update=event=>setForm(current=>({...current,[event.target.name]:event.target.value}));
  return <section className="commerce-page account-page">
    <div className="commerce-heading">
      <div>
        <span className="eyebrow">MINHA CONTA</span>
        <h1>Olá, {session.name.split(' ')[0]}</h1>
        <p>Seus dados e o histórico de pedidos ficam salvos aqui.</p>
      </div>
      <button type="button" className="account-logout" onClick={onLogout}><LogOut size={16}/> Sair</button>
    </div>
    <div className="account-grid">
      <article className="commerce-card">
        <span className="eyebrow">DADOS DO CLIENTE</span>
        <div className="account-profile">{session.avatar&&<img className="account-avatar" src={session.avatar} alt=""/>}<p><b>{session.name}</b><small>{session.email}</small><small>{session.provider==='google'?'Conectado com Google':'Conta com e-mail'}</small></p></div>
        <form className="account-form" onSubmit={event=>{event.preventDefault();onSave(form)}}>
          <label>Nome<input name="name" value={form.name} onChange={update} required/></label>
          <label>E-mail<input value={session.email} readOnly/></label>
          <label>Telefone / WhatsApp<input name="phone" type="tel" value={form.phone} onChange={update} required placeholder="(21) 99999-9999"/></label>
          {error&&<small className="commerce-error">{error}</small>}
          <button type="submit" disabled={busy}>{busy?'Salvando...':'Salvar dados'}</button>
        </form>
      </article>
      <article className="commerce-card">
        <span className="eyebrow">MEUS PEDIDOS</span>
        {orders.length?orders.map(order=><div className="account-order" key={order.id}>
          <div className="account-order-thumbs">{(order.items||[]).slice(0,3).map(item=><img key={item.slug||item.name} src={item.image} alt=""/>)}</div>
          <div><b>Pedido {order.number}</b><small>{new Date(order.createdAt).toLocaleDateString('pt-BR')} • {order.items?.length||0} {(order.items?.length||0)===1?'item':'itens'} • {formatPrice(order.total)}</small></div>
          <em>{order.status}</em>
        </div>):<>
          <p className="commerce-muted">Nenhum pedido ainda. Quando você fechar uma compra, o status aparece aqui.</p>
          <div className="account-actions"><button type="button" onClick={onShop}>Continuar comprando</button></div>
        </>}
      </article>
    </div>
  </section>;
}

function CheckoutPage({items,session,busy,onSubmit,onCart}){
  const [form,setForm]=useState({name:session?.name||'',email:session?.email||'',phone:session?.phone||'',postalCode:'',street:'',number:'',complement:'',district:'',city:'',state:'',shippingId:'standard'});
  const [quotes,setQuotes]=useState(fallbackQuotes);
  const [cepError,setCepError]=useState('');
  useEffect(()=>{if(!session)return;setForm(current=>({...current,name:current.name||session.name,email:current.email||session.email,phone:current.phone||session.phone}))},[session]);
  const update=event=>setForm(current=>({...current,[event.target.name]:event.target.value}));
  const shipping=quotes.find(quote=>quote.id===form.shippingId)||quotes[0];
  const productsTotal=cartSubtotal(items);
  const total=productsTotal+(shipping?.priceCents||0)/100;
  const fillCep=async()=>{
    try{
      setCepError('');
      const address=await lookupCep(form.postalCode);
      setForm(current=>({...current,...address}));
      try{
        const payload=await api('/api/shipping/quote',{method:'POST',body:{postalCode:form.postalCode}});
        if(payload.quotes?.length){
          const next=payload.quotes.map(quote=>({...quote,id:quote.serviceId||quote.id}));
          setQuotes(next);
          setForm(current=>({...current,shippingId:next[0].id}));
        }
      }catch{
        setQuotes(fallbackQuotes);
      }
    }catch(error){
      setCepError(error.message);
    }
  };
  if(!items.length) return <section className="commerce-page"><div className="commerce-empty"><ShoppingCart size={32}/><h1>Nada para finalizar</h1><p>Adicione um produto ao carrinho para fechar a compra.</p><button type="button" onClick={onCart}>Voltar ao carrinho</button></div></section>;
  return <section className="commerce-page checkout-page">
    <div className="commerce-heading">
      <div><span className="eyebrow">CHECKOUT</span><h1>Fechar compra</h1></div>
      <ol className="checkout-steps"><li className="done">Carrinho</li><li className="active">Entrega</li><li>Pagamento</li></ol>
    </div>
    <form className="checkout-grid" onSubmit={event=>{event.preventDefault();onSubmit({...form,shipping})}}>
      <div className="commerce-card">
        <span className="eyebrow">1. SEUS DADOS</span>
        <div className="checkout-user"><b>{session.name}</b><small>{session.email}{session.phone?` • ${session.phone}`:''}</small></div>
        <label>Nome<input name="name" value={form.name} onChange={update} required/></label>
        <label>E-mail<input name="email" type="email" value={form.email} readOnly required/></label>
        <label>WhatsApp<input name="phone" type="tel" value={form.phone} onChange={update} required placeholder="(21) 99999-9999"/></label>
        <span className="eyebrow">2. ENTREGA</span>
        <div className="checkout-cep"><label>CEP<input name="postalCode" value={form.postalCode} onChange={event=>setForm(current=>({...current,postalCode:event.target.value.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d)/,'$1-$2')}))} required placeholder="00000-000" inputMode="numeric"/></label><button type="button" onClick={fillCep}><MapPin size={16}/> Buscar CEP</button></div>
        {cepError&&<small className="commerce-error">{cepError}</small>}
        <label>Rua<input name="street" value={form.street} onChange={update} required/></label>
        <div className="checkout-split"><label>Número<input name="number" value={form.number} onChange={update} required/></label><label>Complemento<input name="complement" value={form.complement} onChange={update}/></label></div>
        <label>Bairro<input name="district" value={form.district} onChange={update} required/></label>
        <div className="checkout-split"><label>Cidade<input name="city" value={form.city} onChange={update} required/></label><label>UF<input name="state" value={form.state} onChange={update} required maxLength={2}/></label></div>
        <span className="eyebrow">3. FRETE</span>
        <div className="shipping-options">{quotes.map(quote=><label key={quote.id} className={form.shippingId===quote.id?'active':''}><input type="radio" name="shippingId" value={quote.id} checked={form.shippingId===quote.id} onChange={update}/><span><b>{quote.serviceName}</b><small>{quote.companyName} • {quote.priceCents===0?'Retirada em Sulacap':`${quote.deliveryMinDays}-${quote.deliveryMaxDays} dias úteis`}</small></span><strong>{quote.priceCents?formatPrice(quote.priceCents/100):'Grátis'}</strong></label>)}</div>
      </div>
      <aside className="commerce-card cart-summary">
        <span className="eyebrow">SEU PEDIDO</span>
        <ul className="checkout-items">{items.map(item=><li key={item.slug}><img src={item.image} alt=""/><div><b>{item.name}</b><small>{item.quantity} un. • {item.price}</small></div><strong>{formatPrice(priceValue(item.price)*item.quantity)}</strong></li>)}</ul>
        <p><span>Produtos</span><b>{formatPrice(productsTotal)}</b></p>
        <p><span>Frete</span><b>{shipping?.priceCents?formatPrice(shipping.priceCents/100):'Grátis'}</b></p>
        <strong><span>Total</span>{formatPrice(total)}</strong>
        <button type="submit" disabled={busy}><CreditCard size={18}/>{busy?'Processando...':'Ir para pagamento'}</button>
        <button type="button" className="commerce-ghost" onClick={onCart}>Voltar ao carrinho</button>
        <CommerceTrust/>
      </aside>
    </form>
  </section>;
}

function CheckoutResult({status,onHome,onCart,onAccount}){
  const copy={
    sucesso:['Pedido recebido','Pagamento e entrega serão confirmados em seguida. Você já pode acompanhar o pedido na sua conta.'],
    pendente:['Pagamento pendente','Assim que o pagamento for confirmado, o pedido segue para separação e envio.'],
    falha:['Não foi possível concluir','Revise os dados ou tente novamente. Seu carrinho foi mantido.']
  }[status];
  return <section className="commerce-page checkout-result-page"><div className="commerce-empty">
    <Package size={36}/>
    <h1>{copy[0]}</h1>
    <p>{copy[1]}</p>
    <ol className="checkout-steps"><li className="done">Carrinho</li><li className="done">Entrega</li><li className={status==='falha'?'':'active'}>Pagamento</li></ol>
    <div className="account-actions"><button type="button" onClick={onHome}>Voltar à loja</button>{status==='falha'?<button type="button" className="commerce-ghost" onClick={onCart}>Voltar ao carrinho</button>:<button type="button" className="commerce-ghost" onClick={onAccount}>Acompanhar pedido</button>}</div>
  </div></section>;
}

function CategoryMenu({open,categories,onOpen,onClose}){
  if(!open) return null;
  return createPortal(<div className="category-menu">
    <button className="category-menu-backdrop" onClick={onClose} aria-label="Fechar categorias"/>
    <div className="category-menu-panel">
      <header>
        <div><span className="eyebrow">CATEGORIAS</span><h2>Comprar por categoria</h2></div>
        <button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button>
      </header>
      <nav>{categories.map(category=><button key={category.slug} type="button" onClick={()=>onOpen(category.slug)}><span className="category-icon"><CategoryGlyph type={category.slug}/></span><div><b>{category.name}</b><small>{category.description||'Seleção Valente Fish'}</small></div><ArrowRight size={16}/></button>)}</nav>
    </div>
  </div>,document.body);
}

function Shop({notify}){
  const [query,setQuery]=useState('');
  const [routePath,setRoutePath]=useState(window.location.pathname);
  const [catalogProducts,setCatalogProducts]=useState(storeProducts);
  const [catalogCategories,setCatalogCategories]=useState(fallbackCategories);
  const [categoryMenuOpen,setCategoryMenuOpen]=useState(false);
  const [cartItems,setCartItems]=useState(loadCart);
  const [session,setSession]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  const [authBusy,setAuthBusy]=useState(false);
  const [authError,setAuthError]=useState('');
  const [orders,setOrders]=useState(loadOrders);
  const [checkoutBusy,setCheckoutBusy]=useState(false);
  const [quantity,setQuantity]=useState(1);
  const [cartNotice,setCartNotice]=useState(null);
  const [miniCartOpen,setMiniCartOpen]=useState(false);
  const storePage=storePageFromPath(routePath,catalogCategories);
  const activeCategory=activeCategoryFromPath(routePath,catalogCategories);
  const category=activeCategory?.name||'Todos';
  const products=catalogProducts.filter(item=>{
    const matchesCategory=!activeCategory||item.categorySlug===activeCategory.slug||item.category===activeCategory.name;
    return matchesCategory&&item.name.toLowerCase().includes(query.toLowerCase());
  });
  const featuredProducts=(catalogProducts.some(item=>item.featured)?catalogProducts.filter(item=>item.featured):catalogProducts).slice(0,FEATURED_LIMIT);
  const selectedSlug=routePath.split('/').pop();
  const selectedProduct=storePage==='produto'?catalogProducts.find(item=>(item.slug||productSlug(item.name))===selectedSlug):null;
  const selectedInfo=selectedProduct?{
    description:selectedProduct.description||categoryInfo[selectedProduct.category]?.description||'Produto selecionado pela equipe Valente Fish.',
    details:categoryInfo[selectedProduct.category]?.details||['Produto original','Estoque da loja','Suporte especializado']
  }:null;
  const relatedProducts=selectedProduct?catalogProducts.filter(item=>item!==selectedProduct&&item.category===selectedProduct.category).slice(0,3):[];
  const nextPath=()=>new URLSearchParams(window.location.search).get('next')||sessionStorage.getItem('vf-next')||'/conta';
  useEffect(()=>{const onPopState=()=>{setRoutePath(window.location.pathname);window.scrollTo(0,0)};window.addEventListener('popstate',onPopState);return()=>window.removeEventListener('popstate',onPopState)},[]);
  useEffect(()=>{
    loadCatalog().then(data=>{
      if(data.products?.length) setCatalogProducts(data.products);
      if(data.categories?.length) setCatalogCategories(data.categories);
    }).catch(()=>{});
  },[]);
  useEffect(()=>{
    track('page_view');
    if(storePage==='carrinho') track('cart_view');
    if(storePage==='checkout') track('checkout');
  },[routePath]);
  useEffect(()=>{
    let stop=()=>{};
    currentSession().then(async user=>{
      setSession(user?await loadProfile().catch(()=>user):null);
      setAuthReady(true);
    }).catch(()=>setAuthReady(true));
    try{stop=onAuthChange(async user=>setSession(user?await loadProfile().catch(()=>user):null))}catch{setAuthReady(true)}
    return ()=>stop();
  },[]);
  useEffect(()=>{
    if(!authReady) return;
    const next=nextPath();
    if(!session&&storePage==='checkout') navigateTo(`/conta/entrar?next=/checkout`);
    if(!session&&storePage==='conta') navigateTo(`/conta/entrar?next=/conta`);
    if(session&&(storePage==='entrar'||storePage==='criar-conta')){
      sessionStorage.removeItem('vf-next');
      navigateTo(next.startsWith('/')?next:'/conta');
    }
  },[authReady,session,storePage]);
  const navigateTo=path=>{const [pathname]=path.split('?');if(pathname===routePath&&path===window.location.pathname+(window.location.search||''))return;if(window.location.pathname+window.location.search!==path)window.history.pushState({},'',path);setRoutePath(pathname);window.scrollTo(0,0)};
  const navigateStore=page=>navigateTo(storeMenu.find(([id])=>id===page)?.[2]||'/');
  const goStoreBack=()=>{
    if(['checkout','sucesso','pendente','falha'].includes(storePage)) return navigateTo('/carrinho');
    if(storePage==='produto') return navigateStore('produtos');
    if(['entrar','criar-conta','conta','categoria'].includes(storePage)) return navigateStore('home');
    navigateStore('home');
  };
  const openCategory=slug=>{setCategoryMenuOpen(false);navigateTo(categoryPath(slug))};
  const openProduct=item=>{const path=`/produto/${item.slug||productSlug(item.name)}`;setQuantity(1);if(window.location.pathname!==path)window.history.pushState({},'',path);setRoutePath(path);window.scrollTo(0,0)};
  const persistCart=items=>{setCartItems(saveCart(items));trackCart(items);return items};
  const addToCart=(product,amount=1,{open=true}={})=>{const items=persistCart(upsertCartItem(cartItems,{...product,slug:product.slug||productSlug(product.name)},amount));setCartNotice({product,amount});track('add_to_cart',{productName:product.name});if(open&&!['carrinho','checkout'].includes(storePage))setMiniCartOpen(true);return items};
  useEffect(()=>{if(!cartNotice||!miniCartOpen)return;const timer=setTimeout(()=>setCartNotice(null),6000);return()=>clearTimeout(timer)},[cartNotice,miniCartOpen]);
  useEffect(()=>{if(['carrinho','checkout'].includes(storePage))setMiniCartOpen(false)},[storePage]);
  const buyNow=(product,amount=1)=>{addToCart(product,amount,{open:false});navigateTo('/carrinho')};
  const changeQuantity=(slug,next)=>persistCart(setCartQuantity(cartItems,slug,next));
  const removeItem=slug=>persistCart(cartItems.filter(item=>item.slug!==slug));
  const finishAuth=async user=>{
    const profile=user?await loadProfile().catch(()=>user):null;
    setSession(profile);
    setAuthError('');
    const next=nextPath();
    sessionStorage.removeItem('vf-next');
    navigateTo(next.startsWith('/')?next:'/conta');
  };
  const handleAuthSubmit=async form=>{
    setAuthBusy(true);setAuthError('');
    try{
      if(storePage==='criar-conta'){
        const result=await signUpAccount(form);
        if(result.needsEmailConfirmation){
          notify('Conta criada. Confirme seu e-mail para entrar.');
          navigateTo('/conta/entrar');
          return;
        }
        await finishAuth(result.session);
        notify('Conta criada com sucesso');
        return;
      }
      await finishAuth(await signInAccount(form));
      notify('Login realizado');
    }catch(error){
      setAuthError(authMessage(error));
    }finally{
      setAuthBusy(false);
    }
  };
  const handleGoogle=async next=>{
    setAuthBusy(true);setAuthError('');
    try{
      sessionStorage.setItem('vf-next',next||nextPath());
      await loginWithGoogle(next||nextPath());
    }catch(error){
      setAuthError(authMessage(error));
      setAuthBusy(false);
    }
  };
  const handleLogout=async()=>{
    await signOutAccount().catch(()=>{});
    setSession(null);
    notify('Você saiu da conta');
    navigateTo('/conta/entrar');
  };
  const handleSaveAccount=async form=>{
    setAuthBusy(true);setAuthError('');
    try{
      setSession(await updateAccount(form));
      notify('Dados atualizados');
    }catch(error){
      setAuthError(authMessage(error));
    }finally{
      setAuthBusy(false);
    }
  };
  const submitCheckout=async form=>{
    if(!session){navigateTo('/conta/entrar?next=/checkout');return}
    setCheckoutBusy(true);
    try{
      await updateAccount({name:form.name,phone:form.phone}).catch(()=>{});
      const payload=await api('/api/checkout',{method:'POST',body:{
        customer:{name:form.name,email:form.email,phone:form.phone},
        address:{postalCode:form.postalCode,street:form.street,number:form.number,complement:form.complement,district:form.district,city:form.city,state:form.state},
        shippingQuoteId:form.shipping?.serviceId||form.shippingId
      }});
      persistCart([]);
      if(payload.checkoutUrl){window.location.href=payload.checkoutUrl;return}
      navigateTo('/checkout/sucesso');
    }catch{
      const order={
        id:crypto.randomUUID(),
        number:`VF${String(Date.now()).slice(-6)}`,
        items:cartItems,
        total:cartSubtotal(cartItems)+(form.shipping?.priceCents||0)/100,
        status:'Recebido',
        createdAt:new Date().toISOString()
      };
      setOrders(saveOrder(order));
      persistCart([]);
      notify('Pedido registrado. Pagamento online será conectado em seguida.');
      navigateTo('/checkout/sucesso');
    }finally{
      setCheckoutBusy(false);
    }
  };
  const cart=cartCount(cartItems);
  return <div className="storefront">
    {storePage==='home'&&<CinematicIntro/>}
    <AquariumEffects/>
    <div className="ocean-atmosphere" aria-hidden="true"><i/><i/><i/></div>
    <div className="store-announcement">Envio especializado para todo o Brasil <span>•</span> Atendimento por aquaristas</div>
    <header className="store-header">
      {storePage==='home'?<span className="store-back-spacer" aria-hidden="true"/>:<button className="store-back" onClick={goStoreBack} aria-label="Voltar"><ArrowLeft size={18}/></button>}
      <button className="store-logo-button" onClick={()=>navigateStore('home')} aria-label="Ir para o início"><img src="/valente-fish-logo.png" alt="Valente Fish" className="store-logo"/></button>
      <div className="store-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){if(query.trim())track('search',{query:query.trim()});navigateStore('produtos')}}} placeholder="Busque peixes, corais, rações e equipamentos..." aria-label="Buscar produtos"/></div>
      <div className="store-actions"><button className={['conta','entrar','criar-conta'].includes(storePage)?'active':''} onClick={()=>navigateTo(session?'/conta':'/conta/entrar')}><User size={20}/><span>{session?session.name.split(' ')[0]:'Entrar'}</span></button><button className={`cart-button${storePage==='carrinho'||miniCartOpen?' active':''}`} onClick={()=>setMiniCartOpen(true)}><ShoppingCart size={21}/><span>Carrinho</span>{cart>0&&<b>{cart}</b>}</button></div>
    </header>
    <nav className="store-nav" aria-label="Menu da loja">{storeMenu.map(([id,label])=><button key={id} className={storePage===id||(storePage==='produto'&&id==='produtos')?'active':''} onClick={()=>navigateStore(id)}>{label}</button>)}<button className={storePage==='categoria'||categoryMenuOpen?'active category-nav-button':''} onClick={()=>setCategoryMenuOpen(true)}><Menu size={16}/> Categorias</button></nav>
    <CategoryMenu open={categoryMenuOpen} categories={catalogCategories} onOpen={openCategory} onClose={()=>setCategoryMenuOpen(false)}/>

    {storePage==='home'&&<><section className="store-hero editorial-hero">
      <video className="editorial-hero-video" src="/store/clips/coral-hero.mp4" autoPlay muted loop playsInline preload="auto" aria-label="Corais coloridos com peixes tropicais"/>
      <div className="editorial-hero-veil"/>
      <div className="editorial-orbit editorial-orbit-one" aria-hidden="true"/>
      <div className="editorial-orbit editorial-orbit-two" aria-hidden="true"/>
      <div className="hero-copy editorial-copy">
        <span className="eyebrow">VALENTE FISH • CURADORIA VIVA</span>
        <h1>O oceano<br/>começa<br/><em>aqui.</em></h1>
        <p>Uma experiência criada para quem não quer apenas montar um aquário, mas construir um ecossistema extraordinário.</p>
        <div className="hero-buttons"><button onClick={()=>navigateStore('produtos')}>Descobrir coleção <ArrowRight size={18}/></button><button className="hero-secondary" onClick={()=>navigateStore('orcamento')}>Falar com curador</button></div>
      </div>
      <div className="editorial-hero-meta"><span>EDIÇÃO 01</span><b>VIDA<br/>EM MOVIMENTO</b><small>Cena oceânica<br/>Pexels</small></div>
      <div className="editorial-scroll"><i/>Role para mergulhar</div>
    </section>

    <section className="store-trust">
      <div><BadgeCheck/><span><b>Animais quarentenados</b><small>Saúde e procedência</small></span></div>
      <div><Truck/><span><b>Envio para todo o Brasil</b><small>Transporte especializado</small></span></div>
      <div><ShieldCheck/><span><b>Garantia de chegada</b><small>Compra segura</small></span></div>
      <div><MessageSquareText/><span><b>Suporte especializado</b><small>Antes e depois da compra</small></span></div>
    </section>

    <section className="store-section products-section conversion-products" id="produtos">
      <div className="section-heading"><div><span className="eyebrow">ESCOLHAS DA SEMANA</span><h2>Produtos em destaque</h2><p>Seleção pronta para você encontrar, escolher e comprar sem complicação.</p></div><button onClick={()=>navigateStore('produtos')}>Ver todos os produtos <ArrowRight size={17}/></button></div>
      <div className="store-products">{featuredProducts.map(item=><ProductCard key={item.name} item={item} onOpen={openProduct} onAdd={addToCart} onBuy={buyNow}/>)}</div>
      <button className="conversion-catalog-cta" onClick={()=>navigateStore('produtos')}>Explorar catálogo completo <ArrowRight size={18}/></button>
    </section>

    <section className="store-section category-section">
      <div className="section-heading"><div><span className="eyebrow">ENCONTRE O QUE PRECISA</span><h2>Explore por categoria</h2></div><button onClick={()=>navigateStore('produtos')}>Ver catálogo completo <ArrowRight size={17}/></button></div>
      <div className="category-grid">
        {catalogCategories.slice(0,4).map(item=><button key={item.slug} className={`category-card category-${item.slug}`} onClick={()=>openCategory(item.slug)}><span className="category-icon"><CategoryGlyph type={item.slug}/></span><div><b>{item.name}</b><small>{item.description||'Seleção Valente Fish'}</small></div><ArrowRight size={18}/></button>)}
      </div>
    </section>

    <section className="ocean-journal">
      <div className="journal-heading"><span>VALENTE JOURNAL / 01</span><h2>Nosso reef.<br/><em>Nossa história.</em></h2><div><p>Animais, corais e momentos registrados dentro da própria Valente Fish. Cada cena abre o Short original.</p><a href="https://www.youtube.com/@ValenteFishCoralFarm/shorts" target="_blank" rel="noreferrer"><AtSign size={17}/> Ver canal da Valente</a></div></div>
      <div className="journal-grid">{valenteStories.map(([id,index,label,title])=><a className="journal-clip" key={id} href={`https://www.youtube.com/shorts/${id}`} target="_blank" rel="noreferrer" aria-label={`Assistir ${title} no canal da Valente Fish`}><video src={`/store/clips/short-${id}.webm`} poster={`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`} autoPlay muted loop playsInline preload="metadata"/><div className="journal-clip-shade"/><span>{index}</span><div><small>{label}</small><h3>{title}</h3></div></a>)}</div>
      <small className="journal-credit">Clipes do canal oficial Valente Fish Coral Farm no YouTube.</small>
    </section>

    <section className="founder-story">
      <div className="founder-visual">
        <figure><img src="/store/brand/jr-valente-loja.png" alt="Jr. Valente na loja Valente Fish" loading="lazy"/><figcaption>Jr. Valente<br/>Fundador &amp; curador</figcaption></figure>
        <img className="founder-social-shot" src="/store/brand/jr-valente-social.png" alt="Jr. Valente apresentando um produto da marca" loading="lazy"/>
        <span className="founder-stamp">25+<br/>ANOS</span>
      </div>
      <div className="founder-copy">
        <span className="eyebrow">QUEM ESTÁ POR TRÁS DA VALENTE</span>
        <h2>Curadoria com<br/><em>rosto, história</em><br/>e presença.</h2>
        <p>Jr. Valente vive o aquarismo há mais de duas décadas. É essa experiência — compartilhada diariamente com a comunidade — que orienta cada animal, coral e produto selecionado.</p>
        <p className="founder-principle">Mais do que vender um aquário: acompanhar a construção de um ecossistema.</p>
        <a href="https://www.instagram.com/valentefish/" target="_blank" rel="noreferrer"><AtSign size={18}/> Acompanhar o Jr. e a Valente no Instagram <ArrowRight size={17}/></a>
      </div>
    </section>
    </>}

    {(storePage==='produtos'||storePage==='categoria')&&<section key={routePath} className="store-page-hero" id="produtos">
      <div className="section-heading"><div><span className="eyebrow">{storePage==='categoria'?'CATEGORIAS':'CATÁLOGO VALENTE FISH'}</span><h2>{category==='Todos'?'Todos os produtos':category}</h2><p>{activeCategory?.description||'Seleção Valente Fish com estoque integrado e atendimento especializado.'}</p></div><span className="stock-live"><i/> Estoque sincronizado</span></div>
      {products.length?<div className="store-products">{products.map(item=><ProductCard key={item.name} item={item} onOpen={openProduct} onAdd={addToCart} onBuy={buyNow}/>)}</div>:<div className="empty-products"><Search size={30}/><h3>Nenhum produto encontrado</h3><p>Tente buscar por outro termo ou categoria.</p><button onClick={()=>{setQuery('');navigateStore('produtos')}}>Limpar filtros</button></div>}
    </section>}

    {storePage==='produto'&&selectedProduct&&<main key={routePath} className="product-detail-page">
      <div className="product-breadcrumb"><button onClick={()=>navigateStore('home')}>Início</button><span>/</span><button onClick={()=>selectedProduct.categorySlug?openCategory(selectedProduct.categorySlug):navigateStore('produtos')}>{selectedProduct.category}</button><span>/</span><b>{selectedProduct.name}</b></div>
      <section className="product-detail-main">
        <div className="product-detail-gallery"><span className="product-detail-tag">{selectedProduct.tag||'Valente Fish'}</span><button className="product-detail-favorite" aria-label={`Favoritar ${selectedProduct.name}`}><Heart/></button><div className="product-detail-glow"/><img src={selectedProduct.image} alt={selectedProduct.name}/><small>Imagem ilustrativa. Consulte a disponibilidade do lote.</small></div>
        <div className="product-detail-info"><span className="eyebrow">{selectedProduct.category}</span><h1>{selectedProduct.name}</h1><div className="product-detail-rating"><div className="rating">{[1,2,3,4,5].map(n=><Star key={n} size={17} fill="currentColor"/>)}</div><span>5.0 • Produto selecionado</span></div><span className="product-availability"><i/> Disponível em estoque</span><p className="product-description">{selectedInfo.description}</p><div className="product-detail-price"><strong>{selectedProduct.price}</strong><span>ou em até 3x sem juros</span></div><div className="product-purchase"><div className="quantity-control"><button onClick={()=>setQuantity(value=>Math.max(1,value-1))} aria-label="Diminuir quantidade">−</button><b>{quantity}</b><button onClick={()=>setQuantity(value=>value+1)} aria-label="Aumentar quantidade">+</button></div><div className="product-actions"><button className="product-buy-button" onClick={()=>buyNow(selectedProduct,quantity)}>Comprar agora</button><button className="product-add-button" onClick={()=>addToCart(selectedProduct,quantity)}><ShoppingCart size={19}/> Adicionar ao carrinho</button></div></div><a className="product-help" href="https://api.whatsapp.com/send/?phone=5521987128089" target="_blank" rel="noreferrer"><MessageCircle size={18}/> Tirar dúvidas com um especialista</a><div className="product-detail-trust"><span><ShieldCheck/> Compra segura</span><span><Truck/> Envio especializado</span><span><BadgeCheck/> Procedência garantida</span></div></div>
      </section>
      <section className="product-detail-content"><article><span className="eyebrow">CONHEÇA O PRODUTO</span><h2>Descrição</h2><p>{selectedInfo.description}</p><p>Nossa equipe acompanha a seleção, conservação e preparação de cada item para oferecer mais segurança antes, durante e depois da compra.</p></article><article><span className="eyebrow">INFORMAÇÕES IMPORTANTES</span><h2>Detalhes</h2><ul>{selectedInfo.details.map(detail=><li key={detail}><Check size={17}/>{detail}</li>)}</ul></article><article><span className="eyebrow">DA VALENTE ATÉ VOCÊ</span><h2>Entrega e cuidados</h2><p>O prazo e a modalidade de envio são definidos conforme o destino e o tipo de produto. Animais recebem embalagem e transporte específicos.</p><button onClick={()=>navigateStore('orcamento')}>Consultar entrega <ArrowRight size={17}/></button></article></section>
      {relatedProducts.length>0&&<section className="related-products"><div className="section-heading"><div><span className="eyebrow">VOCÊ TAMBÉM PODE GOSTAR</span><h2>Produtos relacionados</h2></div></div><div>{relatedProducts.map(item=><button key={item.name} onClick={()=>openProduct(item)}><span><img src={item.image} alt=""/></span><small>{item.category}</small><b>{item.name}</b><strong>{item.price}</strong><i>Ver detalhes <ArrowRight size={15}/></i></button>)}</div></section>}
    </main>}
    {storePage==='produto'&&!selectedProduct&&<section className="product-not-found"><Search size={36}/><h1>Produto não encontrado</h1><p>Este produto pode ter sido removido ou está temporariamente indisponível.</p><button onClick={()=>navigateStore('produtos')}>Voltar ao catálogo</button></section>}

    {storePage==='home'&&<><section className="special-order">
      <video src="/store/clips/coral-cta.mp4" autoPlay muted loop playsInline preload="metadata" aria-label="Peixes coloridos sobre um recife de corais"/>
      <div className="special-overlay"/>
      <span className="special-index">PERSONAL<br/>CURATION<br/>— 01</span><div className="special-copy"><span className="eyebrow">CURADORIA PERSONALIZADA</span><h2>Procurando algo que ainda não encontrou?</h2><p>Conte sua ideia. Nossa equipe pesquisa espécies, produtos e soluções para transformar o seu projeto em realidade.</p><button onClick={()=>navigateStore('orcamento')}>Começar uma conversa <ArrowRight size={18}/></button></div>
    </section>

    <section className="store-section brands-section"><span className="eyebrow">PARCEIROS DE CONFIANÇA</span><h2>As melhores marcas do aquarismo</h2><div className="brand-track">{[1,2,3,5,7,8,9,11,12].map(n=><div key={n}><img src={`/store/brand-${n}.png`} alt={`Marca parceira ${n}`} loading="lazy"/></div>)}</div></section>

    <section className="store-section reviews-section"><div><span className="eyebrow">QUEM CONHECE, RECOMENDA</span><h2>Experiências de quem vive o aquarismo</h2></div><div className="reviews-grid">{[['Luiz Felipe','Atendimento excelente e animais muito bem cuidados. Chegaram perfeitos!'],['Marina Costa','Equipe entende muito e ajudou em toda a montagem do meu aquário.'],['Carlos Eduardo','Produtos de qualidade, envio cuidadoso e suporte rápido pelo WhatsApp.']].map(([name,text])=><article key={name}><div className="rating">{[1,2,3,4,5].map(n=><Star key={n} size={16} fill="currentColor"/>)}</div><p>“{text}”</p><b>{name}</b><small>Cliente verificado</small></article>)}</div></section></>}

    {storePage==='carrinho'&&<CartPage items={cartItems} suggestions={catalogProducts.filter(item=>!cartItems.some(cart=>(cart.slug||productSlug(cart.name))===(item.slug||productSlug(item.name)))).slice(0,4)} onOpen={openProduct} onAdd={addToCart} onQuantity={changeQuantity} onRemove={removeItem} onCheckout={()=>navigateTo(session?'/checkout':'/conta/entrar?next=/checkout')} onContinue={()=>navigateStore('produtos')}/>}
    {(storePage==='entrar'||storePage==='criar-conta'||(storePage==='conta'&&!session))&&<AuthPage mode={storePage==='criar-conta'?'criar-conta':'entrar'} busy={authBusy} error={authError} next={nextPath()} onSubmit={handleAuthSubmit} onGoogle={handleGoogle} onSwitch={()=>navigateTo((storePage==='criar-conta'?'/conta/entrar':'/conta/criar')+'?next='+encodeURIComponent(nextPath()))}/>}
    {storePage==='conta'&&session&&<AccountPage session={session} orders={orders} busy={authBusy} error={authError} onSave={handleSaveAccount} onLogout={handleLogout} onShop={()=>navigateStore('produtos')}/>}
    {storePage==='checkout'&&session&&<CheckoutPage items={cartItems} session={session} busy={checkoutBusy} onSubmit={submitCheckout} onCart={()=>navigateTo('/carrinho')}/>}
    {(storePage==='sucesso'||storePage==='pendente'||storePage==='falha')&&<CheckoutResult status={storePage} onHome={()=>navigateStore('home')} onCart={()=>navigateTo('/carrinho')} onAccount={()=>navigateTo('/conta')}/>}

    {storePage==='orcamento'&&<section key={storePage} className="budget-page"><div className="budget-jelly" aria-hidden="true">◯</div><div className="budget-copy"><span className="eyebrow">ATENDIMENTO PERSONALIZADO</span><h1>Encontre o animal ou produto ideal.</h1><p>Conte o que você procura e um especialista da Valente Fish entrará em contato para orientar e preparar seu orçamento.</p><div className="budget-benefits"><span><BadgeCheck/> Orientação de aquaristas</span><span><ShieldCheck/> Animais com procedência</span><span><Truck/> Envio especializado</span></div></div><form className="budget-form" onSubmit={e=>{e.preventDefault();notify('Solicitação enviada com sucesso')}}><h2>Solicitar orçamento</h2><label>Nome<input required placeholder="Seu nome"/></label><label>WhatsApp<input required type="tel" placeholder="(21) 99999-9999"/></label><label>O que você procura?<select required defaultValue=""><option value="" disabled>Selecione uma categoria</option><option>Peixe</option><option>Coral</option><option>Ração</option><option>Equipamento</option><option>Outro produto</option></select></label><label>Detalhes<textarea rows="4" placeholder="Espécie, marca, tamanho ou qualquer informação importante"/></label><button type="submit">Enviar solicitação <ArrowRight size={18}/></button><a href="https://api.whatsapp.com/send/?phone=5521987128089" target="_blank" rel="noreferrer">Prefiro falar agora pelo WhatsApp</a></form></section>}

    <footer className="store-footer"><div><img src="/valente-fish-logo.png" alt="Valente Fish"/><p>Referência em aquarismo marinho, animais selecionados e atendimento especializado.</p></div><div><b>Loja</b><button onClick={()=>navigateStore('produtos')}>Produtos</button><button onClick={()=>navigateTo('/carrinho')}>Carrinho</button><button onClick={()=>navigateTo('/conta')}>Minha conta</button></div><div><b>Atendimento</b><button onClick={()=>navigateStore('orcamento')}>Solicitar orçamento</button><span>Jardim Sulacap — RJ</span><span>Envio para todo o Brasil</span></div><div><b>Redes sociais</b><a href="https://www.instagram.com/valentefish/"><AtSign size={17}/> @valentefish</a></div></footer>
    <CartDrawer open={miniCartOpen} items={cartItems} added={cartNotice} onClose={()=>setMiniCartOpen(false)} onQuantity={changeQuantity} onRemove={removeItem} onCart={()=>{setMiniCartOpen(false);navigateTo('/carrinho')}} onCheckout={()=>{setMiniCartOpen(false);navigateTo(session?'/checkout':'/conta/entrar?next=/checkout')}}/>
    <a className="store-whatsapp" href="https://api.whatsapp.com/send/?phone=5521987128089" target="_blank" rel="noreferrer" aria-label="Falar pelo WhatsApp">WA</a>
  </div>
}

export default function App(){
  const [toast,setToast]=useState('');
  const [isAdmin,setIsAdmin]=useState(()=>window.location.pathname.startsWith('/admin'));
  useEffect(()=>{
    const onPop=()=>setIsAdmin(window.location.pathname.startsWith('/admin'));
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[]);
  const notify=m=>{setToast(m);setTimeout(()=>setToast(''),2400)};
  if(isAdmin) return <React.Suspense fallback={<div className="erp-boot">Carregando ERP...</div>}><ErpApp notify={notify}/><Toast message={toast}/></React.Suspense>;
  return <div className="store-shell"><Shop notify={notify}/><Toast message={toast}/></div>;
}
