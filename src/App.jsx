import React,{useEffect,useRef,useState} from 'react';
import {LayoutDashboard,MessageCircle,AtSign,Boxes,ShoppingBag,ClipboardCheck,RefreshCw,Camera,Check,ArrowRight,Search,ShoppingCart,User,Truck,ShieldCheck,BadgeCheck,Star,ArrowLeft,Heart,Play,MessageSquareText} from 'lucide-react';

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
    const onPointerMove=event=>{if(event.pointerType==='touch')return;pointer.targetX=event.clientX;pointer.targetY=event.clientY;pointer.active=true;pointer.alpha=Math.min(1,pointer.alpha+.25);if(Math.hypot(event.clientX-lastX,event.clientY-lastY)>24){trails.push({x:event.clientX,y:event.clientY,r:2+Math.random()*4,vx:(Math.random()-.5)*.5,vy:-.5-Math.random(),alpha:.42});lastX=event.clientX;lastY=event.clientY}};
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
const reels=[
  ['UTlY6Hq3ulQ','Conheça a maior variedade do RJ'],
  ['A4bbAsxyzX0',"Valente's Reef"],
  ['2W5VO4qih94','Favia Prisma Dragon'],
  ['97flI2idI4E','Novidades no aquário']
];
const storeMenu=[['home','Início','/'],['produtos','Produtos','/produtos'],['peixes','Peixes','/peixes'],['corais','Corais','/corais'],['racoes','Rações','/racoes'],['filtragem','Filtragem','/filtragem'],['tratamentos','Tratamentos','/tratamentos'],['orcamento','Orçamento','/orcamento']];
const storePageFromPath=()=>storeMenu.find(([, ,path])=>path===window.location.pathname)?.[0]||'home';
const pageCategories={peixes:'Peixes',corais:'Corais',racoes:'Rações',filtragem:'Filtragem',tratamentos:'Tratamentos'};

function Shop({notify,go}){
  const [query,setQuery]=useState('');
  const [storePage,setStorePage]=useState(storePageFromPath);
  const [cart,setCart]=useState(0);
  const [diving,setDiving]=useState(false);
  const category=pageCategories[storePage]||'Todos';
  const products=storeProducts.filter(item=>(category==='Todos'||item.category===category)&&item.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(()=>{const onPopState=()=>{setStorePage(storePageFromPath());window.scrollTo(0,0)};window.addEventListener('popstate',onPopState);return()=>window.removeEventListener('popstate',onPopState)},[]);
  const navigateStore=page=>{if(page===storePage||diving)return;const path=storeMenu.find(([id])=>id===page)?.[2]||'/';setDiving(true);setTimeout(()=>{if(window.location.pathname!==path)window.history.pushState({},'',path);setStorePage(page);window.scrollTo(0,0);setTimeout(()=>setDiving(false),260)},220)};
  const addToCart=name=>{setCart(value=>value+1);notify(`${name} adicionado ao carrinho`)};
  return <div className="storefront">
    <AquariumEffects/>
    <div className="ocean-atmosphere" aria-hidden="true"><i/><i/><i/></div>
    <div className={`dive-transition ${diving?'active':''}`} aria-hidden="true"><span/><i/><i/><i/></div>
    <div className="store-announcement">Envio especializado para todo o Brasil <span>•</span> Atendimento por aquaristas</div>
    <header className="store-header">
      <button className="store-back" onClick={()=>go('overview')} title="Voltar ao ecossistema"><ArrowLeft size={18}/></button>
      <button className="store-logo-button" onClick={()=>navigateStore('home')} aria-label="Ir para o início"><img src="/valente-fish-logo.png" alt="Valente Fish" className="store-logo"/></button>
      <div className="store-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')navigateStore('produtos')}} placeholder="Busque peixes, corais, rações e equipamentos..." aria-label="Buscar produtos"/></div>
      <div className="store-actions"><button><User size={20}/><span>Minha conta</span></button><button className="cart-button"><ShoppingCart size={21}/><span>Carrinho</span>{cart>0&&<b>{cart}</b>}</button></div>
    </header>
    <nav className="store-nav" aria-label="Menu da loja">{storeMenu.map(([id,label])=><button key={id} className={storePage===id?'active':''} onClick={()=>navigateStore(id)}>{label}</button>)}</nav>

    {storePage==='home'&&<><section className="store-hero">
      <div className="water-rays" aria-hidden="true"><i/><i/><i/><i/></div>
      <div className="water-caustics" aria-hidden="true"/>
      <div className="hero-copy">
        <span className="eyebrow">A VIDA MARINHA MAIS PERTO DE VOCÊ</span>
        <h1>Seu aquário merece o extraordinário.</h1>
        <p>Peixes selecionados, corais especiais e os melhores produtos com procedência, cuidado e suporte de verdade.</p>
        <div className="hero-buttons"><button onClick={()=>navigateStore('produtos')}>Explorar produtos <ArrowRight size={18}/></button><button className="hero-secondary" onClick={()=>navigateStore('orcamento')}>Falar com especialista</button></div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <img className="hero-coral" src="/store/hero-coral.png" alt=""/>
        <img className="hero-yellow" src="/store/hero-fish-yellow.png" alt=""/>
        <img className="hero-clown" src="/store/hero-fish-clown.png" alt=""/>
      </div>
      <div className="hero-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    </section>

    <section className="store-trust">
      <div><BadgeCheck/><span><b>Animais quarentenados</b><small>Saúde e procedência</small></span></div>
      <div><Truck/><span><b>Envio para todo o Brasil</b><small>Transporte especializado</small></span></div>
      <div><ShieldCheck/><span><b>Garantia de chegada</b><small>Compra segura</small></span></div>
      <div><MessageSquareText/><span><b>Suporte especializado</b><small>Antes e depois da compra</small></span></div>
    </section>

    <section className="store-section category-section">
      <div className="section-heading"><div><span className="eyebrow">ENCONTRE O QUE PRECISA</span><h2>Explore por categoria</h2></div><button onClick={()=>navigateStore('produtos')}>Ver catálogo completo <ArrowRight size={17}/></button></div>
      <div className="category-grid">
        {[['peixes','Peixes','🐠','Animais selecionados'],['corais','Corais','🪸','Cores que transformam'],['racoes','Rações','◉','Nutrição de qualidade'],['filtragem','Filtragem','≋','Água limpa e saudável']].map(([page,name,icon,text])=><button key={name} onClick={()=>navigateStore(page)}><span>{icon}</span><div><b>{name}</b><small>{text}</small></div><ArrowRight size={18}/></button>)}
      </div>
    </section>

    <section className="reef-stories">
      <div className="store-section">
        <div className="section-heading light"><div><span className="eyebrow">DIRETO DOS NOSSOS AQUÁRIOS</span><h2>Veja a Valente Fish de perto</h2></div><a href="https://www.instagram.com/valentefish/" target="_blank" rel="noreferrer"><AtSign size={18}/> Seguir no Instagram</a></div>
        <div className="reels-grid">{reels.map(([id,title])=><a key={id} href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer" className="reel-card"><img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt=""/><span className="reel-play"><Play fill="currentColor"/></span><b>{title}</b></a>)}</div>
      </div>
    </section>
    </>}

    {storePage!=='orcamento'&&<section key={storePage} className={storePage==='home'?'store-section products-section':'store-page-hero'} id="produtos">
      <div className="section-heading"><div><span className="eyebrow">CATÁLOGO VALENTE FISH</span><h2>{storePage==='home'?'Produtos em destaque':category==='Todos'?'Todos os produtos':category}</h2>{storePage!=='home'&&<p>Seleção Valente Fish com estoque integrado e atendimento especializado.</p>}</div><span className="stock-live"><i/> Estoque sincronizado</span></div>
      {products.length?<div className="store-products">{products.map(item=><article className="store-product" key={item.name}>{item.tag&&<span className="product-tag">{item.tag}</span>}<button className="favorite" aria-label={`Favoritar ${item.name}`}><Heart size={18}/></button><div className="store-product-image"><img src={item.image} alt={item.name} loading="lazy"/></div><div className="store-product-body"><small>{item.category}</small><h3>{item.name}</h3><div className="rating"><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><span>5.0</span></div><strong>{item.price}</strong><span className="installment">ou 3x sem juros</span><button onClick={()=>addToCart(item.name)}><ShoppingCart size={17}/> Adicionar ao carrinho</button></div></article>)}</div>:<div className="empty-products"><Search size={30}/><h3>Nenhum produto encontrado</h3><p>Tente buscar por outro termo ou categoria.</p><button onClick={()=>{setQuery('');navigateStore('produtos')}}>Limpar filtros</button></div>}
    </section>}

    {storePage==='home'&&<><section className="special-order">
      <iframe src="https://www.youtube.com/embed/843Rpqza_6o?autoplay=1&mute=1&controls=0&loop=1&playlist=843Rpqza_6o&modestbranding=1&playsinline=1" title="Vida marinha" loading="lazy" allow="autoplay; encrypted-media" tabIndex="-1" aria-hidden="true"/>
      <div className="special-overlay"/>
      <div className="special-copy"><span className="eyebrow">NÃO ENCONTROU O QUE PROCURAVA?</span><h2>Deseja algum animal ou produto específico?</h2><p>Nossa equipe encontra a melhor opção para o seu aquário.</p><button onClick={()=>navigateStore('orcamento')}>Solicitar orçamento <ArrowRight size={18}/></button></div>
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
