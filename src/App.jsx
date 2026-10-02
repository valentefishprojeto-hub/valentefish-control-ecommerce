import React,{useEffect,useRef,useState} from 'react';
import {LayoutDashboard,MessageCircle,AtSign,Boxes,ShoppingBag,ClipboardCheck,RefreshCw,Camera,Check,ArrowRight,Search,ShoppingCart,User,Truck,ShieldCheck,BadgeCheck,Star,ArrowLeft,Heart,MessageSquareText} from 'lucide-react';

const views={
 overview:['Visão geral','Operação, atendimento e vendas em uma única estrutura.'],
 automation:['Automação Instagram','Do comentário “valor” à página exata do produto.'],
 inbox:['ChatBô & Inbox','Instagram, Facebook e WhatsApp em uma única caixa de entrada.'],
 erp:['ERP & Estoque','A fonte oficial de produtos, disponibilidade e vendas.'],
 shop:['Novo e-commerce','Catálogo carregado diretamente do ERP de controle.'],
 plan:['Planejamento','Arquitetura, módulos e fases de implementação.']
};
const nav=[['overview','Visão geral',LayoutDashboard],['automation','Automação Instagram',AtSign],['inbox','ChatBô & Inbox',MessageCircle],['erp','ERP & Estoque',Boxes],['shop','E-commerce',ShoppingBag],['plan','Plano do projeto',ClipboardCheck]];

function Card({title,children,className=''}){return <section className={`card ${className}`}><h2>{title}</h2>{children}</section>}
function Metric({label,value,detail}){return <div className="metric"><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>}
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

function Overview({go}){return <><div className="metrics"><Metric label="Vendas no mês" value="R$ 48.760" detail="↑ 18,4% vs. mês anterior"/><Metric label="Leads via automação" value="386" detail="142 chegaram do Instagram"/><Metric label="Produtos ativos" value="248" detail="96% sincronizados"/><Metric label="Atendimentos ChatBô" value="1.284" detail="78% resolvidos automaticamente"/></div><div className="split"><Card title="Fluxo integrado de venda"><div className="flow"><Flow icon="📱" title="Comenta VALOR" text="Instagram ou Facebook"/><ArrowRight/><Flow icon="💬" title="Recebe a DM" text="Produto, preço e link"/><ArrowRight/><Flow icon="🛒" title="Compra no site" text="Pix, cartão ou boleto"/></div><div className="flow second"><Flow icon="📷" title="Cadastro no ERP" text="Foto + identificação por IA"/><ArrowRight/><Flow icon="🔄" title="Sincronização" text="Estoque e catálogo central"/><ArrowRight/><Flow icon="📣" title="Publicação" text="Site e redes sociais"/></div></Card><Card title="Atividade em tempo real"><Activity icon="💬" title="Nova DM disparada" text="@marina comentou “valor” no post."/><Activity icon="🛒" title="Pedido #1842 confirmado" text="Pagamento via Pix • R$ 289,00."/><Activity icon="📦" title="Estoque sincronizado" text="1 unidade reservada no M-04."/><Activity icon="✨" title="Produto identificado" text="Zebrasoma flavescens • 94%."/></Card></div><button className="floating" onClick={()=>go('automation')}>Testar o fluxo “valor”</button></>}
function Flow({icon,title,text}){return <div className="flowBox"><b className="emoji">{icon}</b><strong>{title}</strong><small>{text}</small></div>}
function Activity({icon,title,text}){return <div className="activity"><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></div>}

function Automation({go}){return <><div className="automation"><Card title="1. Publicação monitorada"><div className="post"><small>VALENTE FISH</small><b>Peixe-palhaço Premium</b><strong>Comente VALOR para receber</strong></div><div className="comment"><b>@marina_souza</b> valor</div></Card><ArrowRight className="arrow"/><Card title="2. Regra da automação"><Rule label="Quando o comentário contiver" value="valor • preço • quero" accent/><Rule label="Responder no comentário" value="Te enviei as informações no direct 🐠"/><Rule label="Depois" value="Enviar DM e criar lead no ChatBô"/></Card><ArrowRight className="arrow"/><Card title="3. Mensagem no Direct"><div className="dm">Olá, Marina! Este é o peixe que você viu no post.<div className="mini"><span>🐠</span><div><b>Peixe-palhaço</b><strong>R$ 289,00</strong><small>3 unidades disponíveis</small></div></div><button onClick={()=>go('shop')}>Ver produto e comprar</button></div></Card></div><Card title="Recursos previstos" className="topgap"><div className="chips">{['Palavras-chave por publicação','Resposta pública configurável','DM com produto correto','Captura do lead','Tag de interesse','Follow-up automático','Transferência humana','Métricas de conversão'].map(x=><span key={x}>✓ {x}</span>)}</div></Card></>}
function Rule({label,value,accent}) {return <label className="rule"><small>{label}</small><div className={accent?'accent':''}>{value}</div></label>}

function Inbox({notify}){return <div className="split"><Card title="Caixa de entrada unificada"><Activity icon="IG" title="Marina Souza • Instagram" text="Esse peixe pode ficar com coral? • agora"/><Activity icon="WA" title="Lucas Prado • WhatsApp" text="Meu pagamento já foi confirmado? • 2 min"/><Activity icon="FB" title="Carla Mendes • Facebook" text="Vocês entregam para Curitiba? • 7 min"/></Card><Card title="Conversa — Marina"><div className="bubble">Sim, o Peixe-palhaço é compatível com diversos corais. Qual o tamanho do seu aquário?</div><div className="bubble client">Tenho um aquário marinho de 200 litros.</div><div className="bubble">Ótimo! Esse exemplar é adequado. Posso enviar o link ou chamar um especialista.</div><div className="buttons"><button onClick={()=>notify('Link do produto enviado')}>Enviar produto</button><button className="secondary" onClick={()=>notify('Conversa transferida para João')}>Transferir para humano</button></div></Card></div>}

function ERP({notify}){return <div className="erp"><Card title="Catálogo e estoque central"><table><thead><tr><th>Produto</th><th>Local</th><th>Estoque</th><th>Canais</th></tr></thead><tbody>{[['Peixe-palhaço Premium','M-04','3 unidades','4/4'],['Yellow Tang','M-02','1 unidade','4/4'],['Coral Hammer Green','C-11','7 unidades','4/4'],['Discus Red Melon','D-03','5 unidades','4/4']].map((r,i)=><tr key={r[0]}><td><b>{r[0]}</b><small>VF-{String(i+18).padStart(4,'0')}</small></td><td>{r[1]}</td><td><span className={i===1?'pill warn':'pill'}>{r[2]}</span></td><td>{r[3]}</td></tr>)}</tbody></table></Card><Card title="Cadastro assistido por IA"><div className="capture"><Camera size={34}/><b>Foto capturada pelo celular</b><p>A IA compara a foto com a base aprovada.</p><div className="result"><span className="pill">94% de confiança</span><h3>Yellow Tang</h3><i>Zebrasoma flavescens</i><small>Peixe marinho • 8 cm • semi-agressivo</small><button onClick={()=>notify('Produto aprovado e publicado')}>Aprovar e publicar</button></div></div></Card></div>}

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
const storeMenu=[['home','Início','/'],['produtos','Produtos','/produtos'],['peixes','Peixes','/peixes'],['corais','Corais','/corais'],['racoes','Rações','/racoes'],['filtragem','Filtragem','/filtragem'],['tratamentos','Tratamentos','/tratamentos'],['orcamento','Orçamento','/orcamento']];
const productSlug=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const storePageFromPath=path=>path.startsWith('/produto/')?'produto':storeMenu.find(([, ,menuPath])=>menuPath===path)?.[0]||'home';
const pageCategories={peixes:'Peixes',corais:'Corais',racoes:'Rações',filtragem:'Filtragem',tratamentos:'Tratamentos'};
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
    filtragem:<><rect x="13" y="7" width="22" height="34" rx="6"/><path d="M13 15h22M13 34h22M19 20c3-3 7 3 10 0M19 26c3-3 7 3 10 0"/><path d="M8 13c-4 3-4 8 0 11M40 30c4 3 4 8 0 11"/></>
  };
  return <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{drawings[type]}</svg>;
}

function Shop({notify,go}){
  const [query,setQuery]=useState('');
  const [routePath,setRoutePath]=useState(window.location.pathname);
  const [cart,setCart]=useState(0);
  const [quantity,setQuantity]=useState(1);
  const storePage=storePageFromPath(routePath);
  const category=pageCategories[storePage]||'Todos';
  const products=storeProducts.filter(item=>(category==='Todos'||item.category===category)&&item.name.toLowerCase().includes(query.toLowerCase()));
  const featuredProducts=[storeProducts[0],storeProducts[1],storeProducts[2],storeProducts[7]];
  const selectedProduct=storePage==='produto'?storeProducts.find(item=>productSlug(item.name)===routePath.split('/').pop()):null;
  const selectedInfo=selectedProduct?categoryInfo[selectedProduct.category]:null;
  const relatedProducts=selectedProduct?storeProducts.filter(item=>item!==selectedProduct&&item.category===selectedProduct.category).slice(0,3):[];
  useEffect(()=>{const onPopState=()=>{setRoutePath(window.location.pathname);window.scrollTo(0,0)};window.addEventListener('popstate',onPopState);return()=>window.removeEventListener('popstate',onPopState)},[]);
  const navigateTo=path=>{if(path===routePath)return;if(window.location.pathname!==path)window.history.pushState({},'',path);setRoutePath(path);window.scrollTo(0,0)};
  const navigateStore=page=>navigateTo(storeMenu.find(([id])=>id===page)?.[2]||'/');
  const openProduct=item=>{const path=`/produto/${productSlug(item.name)}`;setQuantity(1);if(window.location.pathname!==path)window.history.pushState({},'',path);setRoutePath(path);window.scrollTo(0,0)};
  const addToCart=(name,amount=1)=>{setCart(value=>value+amount);notify(`${amount>1?`${amount} itens`:'Produto'} adicionado ao carrinho`)};
  return <div className="storefront">
    {storePage==='home'&&<CinematicIntro/>}
    <AquariumEffects/>
    <div className="ocean-atmosphere" aria-hidden="true"><i/><i/><i/></div>
    <div className="store-announcement">Envio especializado para todo o Brasil <span>•</span> Atendimento por aquaristas</div>
    <header className="store-header">
      <button className="store-back" onClick={()=>go('overview')} title="Voltar ao ecossistema"><ArrowLeft size={18}/></button>
      <button className="store-logo-button" onClick={()=>navigateStore('home')} aria-label="Ir para o início"><img src="/valente-fish-logo.png" alt="Valente Fish" className="store-logo"/></button>
      <div className="store-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')navigateStore('produtos')}} placeholder="Busque peixes, corais, rações e equipamentos..." aria-label="Buscar produtos"/></div>
      <div className="store-actions"><button><User size={20}/><span>Minha conta</span></button><button className="cart-button"><ShoppingCart size={21}/><span>Carrinho</span>{cart>0&&<b>{cart}</b>}</button></div>
    </header>
    <nav className="store-nav" aria-label="Menu da loja">{storeMenu.map(([id,label])=><button key={id} className={storePage===id||(storePage==='produto'&&id==='produtos')?'active':''} onClick={()=>navigateStore(id)}>{label}</button>)}</nav>

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
      <div className="store-products">{featuredProducts.map(item=><article className="store-product" key={item.name}>{item.tag&&<span className="product-tag">{item.tag}</span>}<button className="favorite" aria-label={`Favoritar ${item.name}`}><Heart size={18}/></button><div className="store-product-image"><button className="product-open-image" onClick={()=>openProduct(item)} aria-label={`Ver detalhes de ${item.name}`}><img src={item.image} alt={item.name} loading="lazy"/></button></div><div className="store-product-body"><small>{item.category}</small><h3><button className="product-name-button" onClick={()=>openProduct(item)}>{item.name}</button></h3><div className="rating"><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><span>5.0</span></div><strong>{item.price}</strong><span className="installment">ou 3x sem juros</span><button onClick={()=>addToCart(item.name)}><ShoppingCart size={17}/> Adicionar ao carrinho</button></div></article>)}</div>
      <button className="conversion-catalog-cta" onClick={()=>navigateStore('produtos')}>Explorar catálogo completo <ArrowRight size={18}/></button>
    </section>

    <section className="store-section category-section">
      <div className="section-heading"><div><span className="eyebrow">ENCONTRE O QUE PRECISA</span><h2>Explore por categoria</h2></div><button onClick={()=>navigateStore('produtos')}>Ver catálogo completo <ArrowRight size={17}/></button></div>
      <div className="category-grid">
        {[['peixes','Peixes','Animais selecionados'],['corais','Corais','Cores que transformam'],['racoes','Rações','Nutrição de qualidade'],['filtragem','Filtragem','Água limpa e saudável']].map(([page,name,text])=><button key={name} className={`category-card category-${page}`} onClick={()=>navigateStore(page)}><span className="category-icon"><CategoryGlyph type={page}/></span><div><b>{name}</b><small>{text}</small></div><ArrowRight size={18}/></button>)}
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

    {storePage!=='home'&&storePage!=='orcamento'&&storePage!=='produto'&&<section key={storePage} className="store-page-hero" id="produtos">
      <div className="section-heading"><div><span className="eyebrow">CATÁLOGO VALENTE FISH</span><h2>{category==='Todos'?'Todos os produtos':category}</h2><p>Seleção Valente Fish com estoque integrado e atendimento especializado.</p></div><span className="stock-live"><i/> Estoque sincronizado</span></div>
      {products.length?<div className="store-products">{products.map(item=><article className="store-product" key={item.name}>{item.tag&&<span className="product-tag">{item.tag}</span>}<button className="favorite" aria-label={`Favoritar ${item.name}`}><Heart size={18}/></button><div className="store-product-image"><button className="product-open-image" onClick={()=>openProduct(item)} aria-label={`Ver detalhes de ${item.name}`}><img src={item.image} alt={item.name} loading="lazy"/></button></div><div className="store-product-body"><small>{item.category}</small><h3><button className="product-name-button" onClick={()=>openProduct(item)}>{item.name}</button></h3><div className="rating"><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><span>5.0</span></div><strong>{item.price}</strong><span className="installment">ou 3x sem juros</span><button onClick={()=>addToCart(item.name)}><ShoppingCart size={17}/> Adicionar ao carrinho</button></div></article>)}</div>:<div className="empty-products"><Search size={30}/><h3>Nenhum produto encontrado</h3><p>Tente buscar por outro termo ou categoria.</p><button onClick={()=>{setQuery('');navigateStore('produtos')}}>Limpar filtros</button></div>}
    </section>}

    {storePage==='produto'&&selectedProduct&&<main key={routePath} className="product-detail-page">
      <div className="product-breadcrumb"><button onClick={()=>navigateStore('home')}>Início</button><span>/</span><button onClick={()=>navigateStore(Object.keys(pageCategories).find(key=>pageCategories[key]===selectedProduct.category)||'produtos')}>{selectedProduct.category}</button><span>/</span><b>{selectedProduct.name}</b></div>
      <section className="product-detail-main">
        <div className="product-detail-gallery"><span className="product-detail-tag">{selectedProduct.tag||'Valente Fish'}</span><button className="product-detail-favorite" aria-label={`Favoritar ${selectedProduct.name}`}><Heart/></button><div className="product-detail-glow"/><img src={selectedProduct.image} alt={selectedProduct.name}/><small>Imagem ilustrativa. Consulte a disponibilidade do lote.</small></div>
        <div className="product-detail-info"><span className="eyebrow">{selectedProduct.category}</span><h1>{selectedProduct.name}</h1><div className="product-detail-rating"><div className="rating">{[1,2,3,4,5].map(n=><Star key={n} size={17} fill="currentColor"/>)}</div><span>5.0 • Produto selecionado</span></div><span className="product-availability"><i/> Disponível em estoque</span><p className="product-description">{selectedInfo.description}</p><div className="product-detail-price"><strong>{selectedProduct.price}</strong><span>ou em até 3x sem juros</span></div><div className="product-purchase"><div className="quantity-control"><button onClick={()=>setQuantity(value=>Math.max(1,value-1))} aria-label="Diminuir quantidade">−</button><b>{quantity}</b><button onClick={()=>setQuantity(value=>value+1)} aria-label="Aumentar quantidade">+</button></div><button className="product-add-button" onClick={()=>addToCart(selectedProduct.name,quantity)}><ShoppingCart size={19}/> Adicionar ao carrinho</button></div><a className="product-help" href="https://api.whatsapp.com/send/?phone=5521987128089" target="_blank" rel="noreferrer"><MessageCircle size={18}/> Tirar dúvidas com um especialista</a><div className="product-detail-trust"><span><ShieldCheck/> Compra segura</span><span><Truck/> Envio especializado</span><span><BadgeCheck/> Procedência garantida</span></div></div>
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

    {storePage==='orcamento'&&<section key={storePage} className="budget-page"><div className="budget-jelly" aria-hidden="true">◯</div><div className="budget-copy"><span className="eyebrow">ATENDIMENTO PERSONALIZADO</span><h1>Encontre o animal ou produto ideal.</h1><p>Conte o que você procura e um especialista da Valente Fish entrará em contato para orientar e preparar seu orçamento.</p><div className="budget-benefits"><span><BadgeCheck/> Orientação de aquaristas</span><span><ShieldCheck/> Animais com procedência</span><span><Truck/> Envio especializado</span></div></div><form className="budget-form" onSubmit={e=>{e.preventDefault();notify('Solicitação enviada com sucesso')}}><h2>Solicitar orçamento</h2><label>Nome<input required placeholder="Seu nome"/></label><label>WhatsApp<input required type="tel" placeholder="(21) 99999-9999"/></label><label>O que você procura?<select required defaultValue=""><option value="" disabled>Selecione uma categoria</option><option>Peixe</option><option>Coral</option><option>Ração</option><option>Equipamento</option><option>Outro produto</option></select></label><label>Detalhes<textarea rows="4" placeholder="Espécie, marca, tamanho ou qualquer informação importante"/></label><button type="submit">Enviar solicitação <ArrowRight size={18}/></button><a href="https://api.whatsapp.com/send/?phone=5521987128089" target="_blank" rel="noreferrer">Prefiro falar agora pelo WhatsApp</a></form></section>}

    <footer className="store-footer"><div><img src="/valente-fish-logo.png" alt="Valente Fish"/><p>Referência em aquarismo marinho, animais selecionados e atendimento especializado.</p></div><div><b>Loja</b><button onClick={()=>navigateStore('produtos')}>Produtos</button><button onClick={()=>navigateStore('peixes')}>Peixes</button><button onClick={()=>navigateStore('corais')}>Corais</button></div><div><b>Atendimento</b><button onClick={()=>navigateStore('orcamento')}>Solicitar orçamento</button><span>Jardim Sulacap — RJ</span><span>Envio para todo o Brasil</span></div><div><b>Redes sociais</b><a href="https://www.instagram.com/valentefish/"><AtSign size={17}/> @valentefish</a><button onClick={()=>go('overview')}>Acessar painel do ecossistema</button></div></footer>
    <a className="store-whatsapp" href="https://api.whatsapp.com/send/?phone=5521987128089" target="_blank" rel="noreferrer" aria-label="Falar pelo WhatsApp">WA</a>
  </div>
}

function Plan(){const phases=[['01','Fundação e regras do negócio','Produtos, espécies, lotes, aquários, usuários, catálogo central e integrações.'],['02','ERP mobile e desktop','Cadastro por foto, IA, estoque, vendas, clientes e rastreabilidade.'],['03','Novo e-commerce integrado','Catálogo automático, carrinho, checkout, pagamentos, frete e baixa de estoque.'],['04','ChatBô e automações sociais','Atendimento omnichannel, gatilhos, DM, links, qualificação e transferência humana.'],['05','Publicação e inteligência','Publicações aprovadas e indicadores de campanhas, conversões e vendas.']];return <><div className="architecture">{[['Aquisição',['Instagram e Facebook','Comentários e Direct','WhatsApp']],['Atendimento',['ChatBô omnichannel','Automação tipo ManyChat','Atendimento humano']],['Operação',['ERP mobile + desktop','IA para identificação','Estoque, vendas e clientes']],['Venda e mídia',['Novo e-commerce','Instagram + Facebook','Telegram']]].map(([t,itens],i)=><Card key={t} title={`${i+1}. ${t}`}>{itens.map(x=><div className="archItem" key={x}>{x}</div>)}</Card>)}</div><Card title="Fases de implementação" className="topgap">{phases.map(([n,t,d])=><div className="phase" key={n}><strong>FASE {n}</strong><div><h3>{t}</h3><p>{d}</p></div></div>)}</Card></>}

export default function App(){const [view,setView]=useState(()=>window.location.pathname.startsWith('/admin')?'overview':'shop');const [toast,setToast]=useState('');useEffect(()=>{const onPopState=()=>setView(window.location.pathname.startsWith('/admin')?'overview':'shop');window.addEventListener('popstate',onPopState);return()=>window.removeEventListener('popstate',onPopState)},[]);const go=next=>{const path=next==='shop'?'/':'/admin';if(window.location.pathname!==path)window.history.pushState({},'',path);setView(next)};const notify=m=>{setToast(m);setTimeout(()=>setToast(''),2400)};if(view==='shop')return <div className="store-shell"><Shop go={go} notify={notify}/><Toast message={toast}/></div>;const Content={overview:Overview,automation:Automation,inbox:Inbox,erp:ERP,plan:Plan}[view];return <div className="app"><aside><div className="brand"><img src="/valente-fish-logo.png" alt="Valente Fish"/></div><nav>{nav.map(([id,label,Icon])=><button key={id} className={view===id?'active':''} onClick={()=>go(id)}><Icon size={18}/>{label}</button>)}</nav><footer><i/>Todos os sistemas conectados<small>Protótipo comercial v1.0</small></footer></aside><main><header><div><h1>{views[view][0]}</h1><p>{views[view][1]}</p></div><button className="sync" onClick={()=>notify('Dados sincronizados')}><RefreshCw size={16}/> Sincronizar</button></header><Content go={go} notify={notify}/></main><div className="mobileNav">{nav.slice(0,5).map(([id,label,Icon])=><button key={id} className={view===id?'active':''} onClick={()=>go(id)}><Icon size={20}/><small>{label.split(' ')[0]}</small></button>)}</div><Toast message={toast}/></div>}
