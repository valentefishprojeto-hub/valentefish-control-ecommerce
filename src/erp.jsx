import React,{useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,AtSign,Boxes,Globe,LayoutDashboard,Package,Plus,Search,ShoppingBag,Store,Trash2,Users,Wallet,X} from 'lucide-react';
import {api,formatPrice} from './commerce';
import {FEATURED_LIMIT,moneyInput} from './catalog';

const groups=[
  ['Operação',[
    ['painel','Painel',LayoutDashboard,'Visão da loja física e da vitrine'],
    ['produtos','Produtos',Package,'Cadastro publicado no e-commerce'],
    ['categorias','Categorias',Boxes,'Menu Categorias da loja'],
    ['estoque','Estoque',Store,'Entradas, saídas e ajustes']
  ]],
  ['Loja física',[
    ['vendas','Vendas',ShoppingBag,'PDV com baixa de estoque'],
    ['clientes','Clientes',Users,'Cadastro e histórico'],
    ['financeiro','Financeiro',Wallet,'Receitas e despesas']
  ]],
  ['Digital',[
    ['ecommerce','E-commerce',Globe,'Buscas, carrinhos, origem e comportamento']
  ]]
];
const pages=groups.flatMap(([,items])=>items);
const pageFromPath=path=>{
  const part=path.replace(/^\/admin\/?/,'').split('/')[0]||'painel';
  return pages.some(([id])=>id===part)?part:'painel';
};
const sourceLabel={instagram:'Instagram',whatsapp:'WhatsApp',facebook:'Facebook',google:'Google',tiktok:'TikTok',youtube:'YouTube',referral:'Indicação',direct:'Acesso direto'};
const eventLabel={page_view:'Navegou',search:'Buscou',add_to_cart:'Adicionou ao carrinho',cart_view:'Abriu o carrinho',checkout:'Foi ao checkout',cart_snapshot:'Carrinho atualizado'};

function Field({label,children}){return <label className="erp-field">{label}{children}</label>}
function Status({tone='ok',children}){return <span className={`erp-status ${tone}`}>{children}</span>}
function Empty({title,text}){return <div className="erp-empty-card"><b>{title}</b><p>{text}</p></div>}

function Modal({open,title,onClose,children,wide}){
  useEffect(()=>{if(!open)return;const onKey=event=>{if(event.key==='Escape')onClose()};window.addEventListener('keydown',onKey);document.body.style.overflow='hidden';return()=>{window.removeEventListener('keydown',onKey);document.body.style.overflow=''}},[open,onClose]);
  if(!open) return null;
  return createPortal(<div className="erp-modal">
    <button className="erp-modal-backdrop" onClick={onClose} aria-label="Fechar"/>
    <section className={`erp-drawer${wide?' wide':''}`}>
      <header><div><span className="eyebrow">CADASTRO</span><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
      <div className="erp-drawer-body">{children}</div>
    </section>
  </div>,document.body);
}

function Toolbar({search,onSearch,placeholder,filters,filter,onFilter,action}){
  return <div className="erp-toolbar">
    <label className="erp-search"><Search size={16}/><input value={search} onChange={event=>onSearch(event.target.value)} placeholder={placeholder}/></label>
    {filters&&<div className="erp-filters">{filters.map(([id,label])=><button key={id} type="button" className={filter===id?'active':''} onClick={()=>onFilter(id)}>{label}</button>)}</div>}
    {action}
  </div>;
}

function ProductForm({categories,initial,busy,onSubmit}){
  const [form,setForm]=useState(()=>({
    name:initial?.name||'',sku:initial?.sku||'',categoryId:initial?.categoryId||categories[0]?.id||'',
    price:initial?moneyInput(initial.priceCents):'',stockQuantity:initial?.stockQuantity??0,
    imageUrl:initial?.imageUrl||'',badge:initial?.badge||'',description:initial?.description||'',
    featured:Boolean(initial?.featured),active:initial?.active!==false
  }));
  const update=event=>{
    const {name,type,checked,value}=event.target;
    setForm(current=>({...current,[name]:type==='checkbox'?checked:value}));
  };
  return <form className="erp-form" onSubmit={event=>{event.preventDefault();onSubmit({...form,...(initial?{id:initial.id}:{})})}}>
    <div className="erp-form-grid">
      <Field label="Nome"><input name="name" value={form.name} onChange={update} required/></Field>
      <Field label="SKU"><input name="sku" value={form.sku} onChange={update} placeholder="VF-PEI-010"/></Field>
      <Field label="Categoria"><select name="categoryId" value={form.categoryId} onChange={update} required>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
      <Field label="Preço"><input name="price" value={form.price} onChange={update} placeholder="289,00" required/></Field>
      <Field label="Estoque inicial"><input name="stockQuantity" type="number" min="0" value={form.stockQuantity} onChange={update}/></Field>
      <Field label="Selo"><input name="badge" value={form.badge} onChange={update} placeholder="Quarentenado"/></Field>
      <Field label="Imagem"><input name="imageUrl" value={form.imageUrl} onChange={update} placeholder="/store/produto.png"/></Field>
      <Field label="Descrição"><textarea name="description" rows="4" value={form.description} onChange={update}/></Field>
    </div>
    <div className="erp-checks">
      <label><input name="featured" type="checkbox" checked={form.featured} onChange={update}/> Destaque na home (máx. {FEATURED_LIMIT})</label>
      <label><input name="active" type="checkbox" checked={form.active} onChange={update}/> Visível no e-commerce</label>
    </div>
    <div className="erp-actions"><button type="submit" disabled={busy}>{busy?'Salvando...':initial?'Salvar alterações':'Publicar na loja'}</button></div>
  </form>;
}

export function ErpApp({notify}){
  const [page,setPage]=useState(()=>pageFromPath(window.location.pathname));
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('todos');
  const [modal,setModal]=useState(null);
  const [dashboard,setDashboard]=useState(null);
  const [commerce,setCommerce]=useState(null);
  const [products,setProducts]=useState([]);
  const [categories,setCategories]=useState([]);
  const [stock,setStock]=useState({products:[],movements:[]});
  const [customers,setCustomers]=useState([]);
  const [sales,setSales]=useState([]);
  const [finance,setFinance]=useState({entries:[],summary:{}});
  const [editing,setEditing]=useState(null);
  const [categoryForm,setCategoryForm]=useState({name:'',description:''});
  const [customerForm,setCustomerForm]=useState({name:'',phone:'',email:'',notes:''});
  const [stockForm,setStockForm]=useState({productId:'',kind:'entrada',quantity:1,reason:''});
  const [saleForm,setSaleForm]=useState({customerId:'',customerName:'',paymentMethod:'pix',discount:'',items:[{productId:'',quantity:1}]});
  const [financeForm,setFinanceForm]=useState({kind:'despesa',category:'operacao',description:'',amount:''});

  const go=next=>{
    const path=next==='painel'?'/admin':`/admin/${next}`;
    if(window.location.pathname!==path) window.history.pushState({},'',path);
    setPage(next);setSearch('');setFilter('todos');setModal(null);setEditing(null);
  };

  useEffect(()=>{
    const onPop=()=>setPage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[]);

  const loadAll=async()=>{
    try{
      const [dash,productData,categoryData,stockData,customerData,saleData,financeData,commerceData]=await Promise.all([
        api('/api/erp/dashboard'),api('/api/erp/products'),api('/api/erp/categories'),api('/api/erp/stock'),
        api('/api/erp/customers'),api('/api/erp/sales'),api('/api/erp/finance'),api('/api/erp/commerce').catch(()=>({}))
      ]);
      setDashboard(dash);setProducts(productData.products||[]);setCategories(categoryData.categories||[]);
      setStock(stockData);setCustomers(customerData.customers||[]);setSales(saleData.sales||[]);setFinance(financeData);setCommerce(commerceData);
    }catch(error){
      notify(error.message||'Não foi possível carregar o ERP');
    }
  };
  useEffect(()=>{loadAll()},[]);

  const run=async(task,ok)=>{
    setBusy(true);
    try{
      await task();
      await loadAll();
      setModal(null);setEditing(null);
      if(ok) notify(ok);
    }catch(error){
      notify(error.message||'Não foi possível salvar');
    }finally{
      setBusy(false);
    }
  };

  const current=pages.find(([id])=>id===page);
  const featuredCount=products.filter(item=>item.featured&&item.active).length;
  const match=value=>String(value||'').toLowerCase().includes(search.toLowerCase());
  const visibleProducts=products.filter(item=>{
    const text=match(item.name)||match(item.sku)||match(item.categoryName);
    const vis=filter==='todos'||(filter==='destaque'&&item.featured)||(filter==='categoria'&&item.active&&!item.featured)||(filter==='oculto'&&!item.active)||(filter==='baixo'&&item.stockQuantity<=2);
    return text&&vis;
  });
  const visibleCategories=categories.filter(item=>match(item.name)||match(item.slug));
  const visibleStock=stock.products.filter(item=>{
    const text=match(item.name)||match(item.sku);
    return text&&(filter==='todos'||(filter==='baixo'&&item.stock_quantity<=2));
  });
  const visibleSales=sales.filter(item=>match(item.customer_name)||match(item.number)||match(item.payment_method));
  const visibleCustomers=customers.filter(item=>match(item.full_name)||match(item.phone)||match(item.email));
  const visibleFinance=finance.entries.filter(item=>{
    const text=match(item.description)||match(item.category);
    return text&&(filter==='todos'||item.kind===filter);
  });
  const saleTotal=useMemo(()=>saleForm.items.reduce((sum,line)=>{
    const product=products.find(item=>item.id===line.productId);
    return sum+(product?(product.priceCents||0)*Number(line.quantity||0):0);
  },0),[saleForm.items,products]);
  const commerceSources=commerce?.sources||[];
  const sourceTotal=commerceSources.reduce((sum,item)=>sum+item.visitors,0)||1;

  return <div className="app erp-app">
    <aside>
      <div className="brand"><img src="/valente-fish-logo.png" alt="Valente Fish"/></div>
      <nav>
        {groups.map(([label,items])=><div className="erp-nav-group" key={label}>
          <small>{label}</small>
          {items.map(([id,name,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>go(id)}><Icon size={18}/>{name}</button>)}
        </div>)}
      </nav>
      <footer><i/>ERP + e-commerce<small>Dados da loja física e da vitrine</small></footer>
    </aside>
    <main>
      <header className="erp-topbar">
        <div><span className="eyebrow">{groups.find(([,items])=>items.some(([id])=>id===page))?.[0]}</span><h1>{current[1]}</h1><p>{current[3]}</p></div>
        <div className="erp-top-actions">
          <button type="button" className="erp-ghost" onClick={loadAll}>Atualizar</button>
          <a className="sync" href="/" target="_blank" rel="noreferrer">Abrir loja <ArrowUpRight size={16}/></a>
        </div>
      </header>

      {page==='painel'&&dashboard&&<>
        <div className="erp-kpis">
          <article><small>Vendas do mês</small><strong>{formatPrice((dashboard.metrics.month_sales_cents||0)/100)}</strong><span>Hoje {formatPrice((dashboard.metrics.today_sales_cents||0)/100)}</span></article>
          <article><small>Produtos ativos</small><strong>{dashboard.metrics.products}</strong><span>{dashboard.metrics.featured} em destaque</span></article>
          <article><small>Estoque baixo</small><strong>{dashboard.metrics.low_stock}</strong><span>Reposição imediata</span></article>
          <article><small>Visitantes 30 dias</small><strong>{commerce?.metrics?.visitors||0}</strong><span>{commerce?.metrics?.add_to_carts||0} add to cart</span></article>
        </div>
        <div className="erp-split">
          <section className="card"><div className="erp-card-head"><h2>Últimas vendas</h2><button type="button" className="text-link" onClick={()=>go('vendas')}>Ver todas</button></div>{dashboard.recentSales?.length?dashboard.recentSales.map(sale=><div className="erp-row" key={sale.id}><div><b>#{sale.number} • {sale.customer_name}</b><small>{new Date(sale.sold_at).toLocaleString('pt-BR')}</small></div><strong>{formatPrice(sale.total_cents/100)}</strong></div>):<Empty title="Sem vendas ainda" text="Feche a primeira venda no PDV."/>}</section>
          <section className="card"><div className="erp-card-head"><h2>Origem da loja</h2><button type="button" className="text-link" onClick={()=>go('ecommerce')}>E-commerce</button></div>{commerceSources.length?commerceSources.map(item=><div className="erp-source" key={item.source}><div><b>{sourceLabel[item.source]||item.source}</b><small>{item.visitors} visitantes</small></div><i style={{width:`${Math.max(8,(item.visitors/sourceTotal)*100)}%`}}/></div>):<Empty title="Aguardando tráfego" text="As visitas da loja aparecem aqui."/>}</section>
        </div>
      </>}

      {page==='produtos'&&<section className="card">
        <Toolbar search={search} onSearch={setSearch} placeholder="Buscar produto, SKU ou categoria" filter={filter} onFilter={setFilter} filters={[['todos','Todos'],['destaque','Destaque'],['categoria','Só categoria'],['baixo','Estoque baixo'],['oculto','Ocultos']]} action={<button type="button" onClick={()=>{setEditing(null);setModal('produto')}}><Plus size={16}/> Novo produto</button>}/>
        <p className="erp-meta">{visibleProducts.length} produtos • {featuredCount}/{FEATURED_LIMIT} destaques</p>
        <table className="erp-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Vitrine</th><th></th></tr></thead>
          <tbody>{visibleProducts.map(item=><tr key={item.id}>
            <td className="erp-product-cell">{item.imageUrl&&<img src={item.imageUrl} alt=""/>}<div><b>{item.name}</b><small>{item.sku||item.slug}</small></div></td>
            <td>{item.categoryName}</td>
            <td>{formatPrice((item.priceCents||0)/100)}</td>
            <td><Status tone={item.stockQuantity<=2?'warn':'ok'}>{item.stockQuantity} un.</Status></td>
            <td><Status tone={item.featured?'info':item.active?'ok':'muted'}>{item.featured?'Destaque':item.active?'Categoria':'Oculto'}</Status></td>
            <td className="erp-row-actions"><button type="button" className="erp-ghost" onClick={()=>{setEditing(item);setModal('produto')}}>Editar</button><button type="button" className="erp-danger" onClick={()=>run(()=>api('/api/erp/products',{method:'DELETE',body:{id:item.id}}),'Produto ocultado')}><Trash2 size={14}/></button></td>
          </tr>)}</tbody>
        </table>
        {!visibleProducts.length&&<Empty title="Nenhum produto neste filtro" text="Ajuste a busca ou cadastre um item."/>}
      </section>}

      {page==='categorias'&&<section className="card">
        <Toolbar search={search} onSearch={setSearch} placeholder="Buscar categoria" action={<button type="button" onClick={()=>setModal('categoria')}><Plus size={16}/> Nova categoria</button>}/>
        <table className="erp-table"><thead><tr><th>Categoria</th><th>No menu</th><th>Produtos</th><th></th></tr></thead>
          <tbody>{visibleCategories.map(category=><tr key={category.id}>
            <td><b>{category.name}</b><small>{category.description||`/${category.slug}`}</small></td>
            <td>/{category.slug}</td>
            <td>{category.product_count}</td>
            <td className="erp-row-actions"><button type="button" className="erp-danger" onClick={()=>run(()=>api('/api/erp/categories',{method:'DELETE',body:{id:category.id}}),'Categoria removida')}><Trash2 size={14}/></button></td>
          </tr>)}</tbody>
        </table>
      </section>}

      {page==='estoque'&&<section className="card">
        <Toolbar search={search} onSearch={setSearch} placeholder="Buscar no estoque" filter={filter} onFilter={setFilter} filters={[['todos','Todos'],['baixo','Crítico']]} action={<button type="button" onClick={()=>setModal('estoque')}><Plus size={16}/> Lançar movimento</button>}/>
        <table className="erp-table"><thead><tr><th>Produto</th><th>Atual</th></tr></thead>
          <tbody>{visibleStock.map(item=><tr key={item.id}><td><b>{item.name}</b><small>{item.sku||item.category}</small></td><td><Status tone={item.stock_quantity<=2?'warn':'ok'}>{item.stock_quantity}</Status></td></tr>)}</tbody>
        </table>
        <h2 className="erp-sub">Movimentações</h2>
        <table className="erp-table"><thead><tr><th>Quando</th><th>Produto</th><th>Tipo</th><th>Qtd</th></tr></thead>
          <tbody>{stock.movements.map(item=><tr key={item.id}><td>{new Date(item.created_at).toLocaleString('pt-BR')}</td><td>{item.product_name}</td><td>{item.kind}</td><td>{item.quantity}</td></tr>)}</tbody>
        </table>
      </section>}

      {page==='vendas'&&<section className="card">
        <Toolbar search={search} onSearch={setSearch} placeholder="Buscar venda, cliente ou pagamento" action={<button type="button" onClick={()=>setModal('venda')}><Plus size={16}/> Nova venda</button>}/>
        <table className="erp-table"><thead><tr><th>Venda</th><th>Cliente</th><th>Pagamento</th><th>Total</th></tr></thead>
          <tbody>{visibleSales.map(sale=><tr key={sale.id}><td><b>#{sale.number}</b><small>{new Date(sale.sold_at).toLocaleString('pt-BR')}</small></td><td>{sale.customer_name}</td><td>{sale.payment_method}</td><td>{formatPrice(sale.total_cents/100)}</td></tr>)}</tbody>
        </table>
        {!visibleSales.length&&<Empty title="Nenhuma venda encontrada" text="Registre uma venda de balcão."/>}
      </section>}

      {page==='clientes'&&<section className="card">
        <Toolbar search={search} onSearch={setSearch} placeholder="Buscar nome, WhatsApp ou e-mail" action={<button type="button" onClick={()=>setModal('cliente')}><Plus size={16}/> Novo cliente</button>}/>
        <table className="erp-table"><thead><tr><th>Cliente</th><th>Contato</th><th>Compras</th><th></th></tr></thead>
          <tbody>{visibleCustomers.map(customer=><tr key={customer.id}>
            <td><b>{customer.full_name}</b><small>{customer.notes||'Loja física'}</small></td>
            <td>{customer.phone||customer.email||'—'}</td>
            <td>{customer.sale_count} • {formatPrice((customer.total_spent_cents||0)/100)}</td>
            <td className="erp-row-actions"><button type="button" className="erp-danger" onClick={()=>run(()=>api('/api/erp/customers',{method:'DELETE',body:{id:customer.id}}),'Cliente removido')}><Trash2 size={14}/></button></td>
          </tr>)}</tbody>
        </table>
      </section>}

      {page==='financeiro'&&<>
        <div className="erp-kpis">
          <article><small>Receitas do mês</small><strong>{formatPrice((finance.summary.month_income_cents||0)/100)}</strong><span>Inclui vendas</span></article>
          <article><small>Despesas do mês</small><strong>{formatPrice((finance.summary.month_expense_cents||0)/100)}</strong><span>Lançamentos manuais</span></article>
          <article><small>Saldo</small><strong>{formatPrice(((finance.summary.month_income_cents||0)-(finance.summary.month_expense_cents||0))/100)}</strong><span>Mês corrente</span></article>
        </div>
        <section className="card">
          <Toolbar search={search} onSearch={setSearch} placeholder="Buscar lançamento" filter={filter} onFilter={setFilter} filters={[['todos','Todos'],['receita','Receitas'],['despesa','Despesas']]} action={<button type="button" onClick={()=>setModal('financeiro')}><Plus size={16}/> Novo lançamento</button>}/>
          <table className="erp-table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead>
            <tbody>{visibleFinance.map(entry=><tr key={entry.id}><td>{new Date(entry.created_at).toLocaleDateString('pt-BR')}</td><td><Status tone={entry.kind==='receita'?'ok':'warn'}>{entry.kind}</Status></td><td>{entry.description}<small>{entry.category}</small></td><td>{formatPrice(entry.amount_cents/100)}</td></tr>)}</tbody>
          </table>
        </section>
      </>}

      {page==='ecommerce'&&<div className="erp-commerce">
        <div className="erp-kpis">
          <article><small>Visitantes</small><strong>{commerce?.metrics?.visitors||0}</strong><span>Últimos 30 dias</span></article>
          <article><small>Buscas</small><strong>{commerce?.metrics?.searches||0}</strong><span>Termos digitados na loja</span></article>
          <article><small>Add to cart</small><strong>{commerce?.metrics?.add_to_carts||0}</strong><span>Itens colocados no carrinho</span></article>
          <article><small>Checkout</small><strong>{commerce?.metrics?.checkouts||0}</strong><span>Inícios de compra</span></article>
        </div>
        <div className="erp-split">
          <section className="card">
            <h2>De onde vieram</h2>
            <p className="erp-meta">Instagram, WhatsApp e outros canais da loja.</p>
            {commerceSources.length?commerceSources.map(item=><div className="erp-source" key={item.source}><div><b>{item.source==='instagram'?<><AtSign size={14}/> Instagram</>:item.source==='whatsapp'?'WhatsApp':sourceLabel[item.source]||item.source}</b><small>{item.visitors} visitantes • {Math.round((item.visitors/sourceTotal)*100)}%</small></div><i style={{width:`${Math.max(8,(item.visitors/sourceTotal)*100)}%`}}/></div>):<Empty title="Sem origem ainda" text="Links com ?utm_source=instagram ou whatsapp passam a aparecer aqui."/>}
          </section>
          <section className="card">
            <h2>O que as pessoas buscam</h2>
            {commerce?.searches?.length?commerce.searches.map(item=><div className="erp-row" key={item.query}><b>{item.query}</b><Status tone="info">{item.count}x</Status></div>):<Empty title="Nenhuma busca" text="As pesquisas da barra da loja entram nesta lista."/>}
          </section>
        </div>
        <div className="erp-split">
          <section className="card">
            <h2>Carrinhos abertos</h2>
            {commerce?.carts?.length?commerce.carts.map(cart=><div className="erp-cart" key={cart.visitor_id}>
              <div><b>{sourceLabel[cart.source]||cart.source}</b><small>{new Date(cart.created_at).toLocaleString('pt-BR')} • {cart.last_path}</small></div>
              <ul>{(cart.payload?.items||[]).map(item=><li key={item.name}>{item.quantity}× {item.name}</li>)}</ul>
            </div>):<Empty title="Nenhum carrinho ativo" text="Quando alguém adiciona um produto, o carrinho aparece aqui."/>}
          </section>
          <section className="card">
            <h2>Mais colocados no carrinho</h2>
            {commerce?.products?.length?commerce.products.map(item=><div className="erp-row" key={item.product_name}><b>{item.product_name}</b><span>{item.count}</span></div>):<Empty title="Sem itens ainda" text="O comportamento de carrinho da loja entra nesta aba."/>}
          </section>
        </div>
        <section className="card">
          <h2>Comportamento recente</h2>
          <table className="erp-table"><thead><tr><th>Quando</th><th>Ação</th><th>Detalhe</th><th>Origem</th></tr></thead>
            <tbody>{(commerce?.activity||[]).map(item=><tr key={item.id}>
              <td>{new Date(item.created_at).toLocaleString('pt-BR')}</td>
              <td>{eventLabel[item.event_type]||item.event_type}</td>
              <td>{item.query||item.product_name||item.path||'—'}</td>
              <td>{sourceLabel[item.source]||item.source}</td>
            </tr>)}</tbody>
          </table>
        </section>
      </div>}
    </main>
    <div className="mobileNav erp-mobile-nav">{pages.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>go(id)}><Icon size={18}/><small>{label}</small></button>)}</div>

    <Modal open={modal==='produto'} title={editing?'Editar produto':'Novo produto'} onClose={()=>setModal(null)}>
      <ProductForm categories={categories} initial={editing} busy={busy} onSubmit={form=>run(()=>api('/api/erp/products',{method:form.id?'PATCH':'POST',body:form}),form.id?'Produto atualizado':'Produto publicado na loja')}/>
    </Modal>
    <Modal open={modal==='categoria'} title="Nova categoria" onClose={()=>setModal(null)}>
      <form className="erp-form" onSubmit={event=>{event.preventDefault();run(async()=>{await api('/api/erp/categories',{method:'POST',body:categoryForm});setCategoryForm({name:'',description:''})},'Categoria no menu da loja')}}>
        <Field label="Nome"><input value={categoryForm.name} onChange={event=>setCategoryForm(current=>({...current,name:event.target.value}))} required/></Field>
        <Field label="Descrição"><input value={categoryForm.description} onChange={event=>setCategoryForm(current=>({...current,description:event.target.value}))}/></Field>
        <div className="erp-actions"><button type="submit" disabled={busy}>Criar categoria</button></div>
      </form>
    </Modal>
    <Modal open={modal==='estoque'} title="Movimentar estoque" onClose={()=>setModal(null)}>
      <form className="erp-form" onSubmit={event=>{event.preventDefault();run(async()=>{await api('/api/erp/stock',{method:'POST',body:stockForm});setStockForm(current=>({...current,quantity:1,reason:''}))},'Estoque atualizado')}}>
        <Field label="Produto"><select value={stockForm.productId} onChange={event=>setStockForm(current=>({...current,productId:event.target.value}))} required><option value="">Selecione</option>{stock.products.map(item=><option key={item.id} value={item.id}>{item.name} ({item.stock_quantity})</option>)}</select></Field>
        <Field label="Tipo"><select value={stockForm.kind} onChange={event=>setStockForm(current=>({...current,kind:event.target.value}))}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Ajuste para</option></select></Field>
        <Field label="Quantidade"><input type="number" min="1" value={stockForm.quantity} onChange={event=>setStockForm(current=>({...current,quantity:event.target.value}))}/></Field>
        <Field label="Motivo"><input value={stockForm.reason} onChange={event=>setStockForm(current=>({...current,reason:event.target.value}))} placeholder="Compra, perda, contagem..."/></Field>
        <div className="erp-actions"><button type="submit" disabled={busy}>Lançar</button></div>
      </form>
    </Modal>
    <Modal open={modal==='venda'} title="Nova venda" onClose={()=>setModal(null)} wide>
      <form className="erp-form" onSubmit={event=>{event.preventDefault();run(async()=>{await api('/api/erp/sales',{method:'POST',body:saleForm});setSaleForm({customerId:'',customerName:'',paymentMethod:'pix',discount:'',items:[{productId:'',quantity:1}]})},'Venda registrada')}}>
        <div className="erp-form-grid">
          <Field label="Cliente"><select value={saleForm.customerId} onChange={event=>setSaleForm(current=>({...current,customerId:event.target.value}))}><option value="">Cliente avulso</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.full_name}</option>)}</select></Field>
          <Field label="Nome no cupom"><input value={saleForm.customerName} onChange={event=>setSaleForm(current=>({...current,customerName:event.target.value}))} placeholder="Cliente balcão"/></Field>
          <Field label="Pagamento"><select value={saleForm.paymentMethod} onChange={event=>setSaleForm(current=>({...current,paymentMethod:event.target.value}))}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option></select></Field>
          <Field label="Desconto"><input value={saleForm.discount} onChange={event=>setSaleForm(current=>({...current,discount:event.target.value}))} placeholder="0,00"/></Field>
        </div>
        {saleForm.items.map((line,index)=><div className="erp-sale-line" key={index}>
          <select value={line.productId} onChange={event=>setSaleForm(current=>({...current,items:current.items.map((item,i)=>i===index?{...item,productId:event.target.value}:item)}))} required>
            <option value="">Produto</option>
            {products.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.name} • {formatPrice((item.priceCents||0)/100)}</option>)}
          </select>
          <input type="number" min="1" value={line.quantity} onChange={event=>setSaleForm(current=>({...current,items:current.items.map((item,i)=>i===index?{...item,quantity:event.target.value}:item)}))}/>
          <button type="button" className="erp-ghost" onClick={()=>setSaleForm(current=>({...current,items:current.items.filter((_,i)=>i!==index).concat(current.items.length===1?[{productId:'',quantity:1}]:[])}))}>Remover</button>
        </div>)}
        <div className="erp-actions">
          <button type="button" className="erp-ghost" onClick={()=>setSaleForm(current=>({...current,items:[...current.items,{productId:'',quantity:1}]}))}>Mais item</button>
          <strong>Total {formatPrice(Math.max(0,saleTotal-(Number(String(saleForm.discount).replace(',','.'))||0)*100)/100)}</strong>
          <button type="submit" disabled={busy}>Fechar venda</button>
        </div>
      </form>
    </Modal>
    <Modal open={modal==='cliente'} title="Novo cliente" onClose={()=>setModal(null)}>
      <form className="erp-form" onSubmit={event=>{event.preventDefault();run(async()=>{await api('/api/erp/customers',{method:'POST',body:customerForm});setCustomerForm({name:'',phone:'',email:'',notes:''})},'Cliente cadastrado')}}>
        <Field label="Nome"><input value={customerForm.name} onChange={event=>setCustomerForm(current=>({...current,name:event.target.value}))} required/></Field>
        <Field label="WhatsApp"><input value={customerForm.phone} onChange={event=>setCustomerForm(current=>({...current,phone:event.target.value}))}/></Field>
        <Field label="E-mail"><input value={customerForm.email} onChange={event=>setCustomerForm(current=>({...current,email:event.target.value}))}/></Field>
        <Field label="Observação"><input value={customerForm.notes} onChange={event=>setCustomerForm(current=>({...current,notes:event.target.value}))}/></Field>
        <div className="erp-actions"><button type="submit" disabled={busy}>Cadastrar</button></div>
      </form>
    </Modal>
    <Modal open={modal==='financeiro'} title="Novo lançamento" onClose={()=>setModal(null)}>
      <form className="erp-form" onSubmit={event=>{event.preventDefault();run(async()=>{await api('/api/erp/finance',{method:'POST',body:financeForm});setFinanceForm(current=>({...current,description:'',amount:''}))},'Lançamento salvo')}}>
        <Field label="Tipo"><select value={financeForm.kind} onChange={event=>setFinanceForm(current=>({...current,kind:event.target.value}))}><option value="despesa">Despesa</option><option value="receita">Receita</option></select></Field>
        <Field label="Categoria"><input value={financeForm.category} onChange={event=>setFinanceForm(current=>({...current,category:event.target.value}))}/></Field>
        <Field label="Descrição"><input value={financeForm.description} onChange={event=>setFinanceForm(current=>({...current,description:event.target.value}))} required/></Field>
        <Field label="Valor"><input value={financeForm.amount} onChange={event=>setFinanceForm(current=>({...current,amount:event.target.value}))} placeholder="150,00" required/></Field>
        <div className="erp-actions"><button type="submit" disabled={busy}>Lançar</button></div>
      </form>
    </Modal>
  </div>;
}
