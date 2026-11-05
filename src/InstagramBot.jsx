import React,{useEffect,useMemo,useState} from 'react';
import {AtSign,MessageCircle,Pause,Play,RefreshCw,Search} from 'lucide-react';
import {api} from './commerce';
import './instagram-bot.css';

const endpoint='/api/instagram/inbox';
const when=value=>value?new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}):'—';
const nameOf=conversation=>conversation.username?`@${conversation.username.replace(/^@/,'')}`:`ID ${conversation.igsid}`;
const statusOf=(conversation,enabled)=>conversation.status==='closed'?'Encerrada':conversation.status==='human'?'Equipe assumiu':enabled?'Bot ativo':'Bot desligado';
const toolNames={buscar_produtos:'Busca de produtos',detalhes_produto:'Detalhes do produto',listar_categorias:'Categorias',cotar_frete:'Cotação de frete',consultar_pedido:'Consulta de pedido',encaminhar_humano:'Encaminhamento',info_loja:'Informações da loja'};

export default function InstagramBot({notify}){
  const [conversations,setConversations]=useState([]);
  const [selected,setSelected]=useState(null);
  const [detail,setDetail]=useState(null);
  const [bot,setBot]=useState(null);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [loading,setLoading]=useState(true);
  const [loadingDetail,setLoadingDetail]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const refresh=async(id=selected)=>{
    setError('');
    try{
      const list=await api(endpoint);
      setConversations(list.conversations||[]);setBot(list.bot);
      if(id){
        const next=await api(`${endpoint}?id=${encodeURIComponent(id)}`);
        setDetail(next);setSelected(id);
      }
    }catch(failure){setError(failure.message||'Não foi possível carregar as conversas.');}
    finally{setLoading(false);setLoadingDetail(false);}
  };
  useEffect(()=>{refresh(null);},[]);
  const open=async id=>{
    setSelected(id);setDetail(null);setLoadingDetail(true);setError('');
    try{setDetail(await api(`${endpoint}?id=${encodeURIComponent(id)}`));}
    catch(failure){setError(failure.message||'Não foi possível abrir a conversa.');}
    finally{setLoadingDetail(false);}
  };
  const changeStatus=async action=>{
    if(!selected) return;
    setBusy(true);
    try{
      await api(endpoint,{method:'POST',body:{id:selected,action}});
      await refresh(selected);
      notify(action==='pause'?'Bot pausado nesta conversa.':'Bot liberado nesta conversa.');
    }catch(failure){setError(failure.message||'Não foi possível alterar a conversa.');}
    finally{setBusy(false);}
  };
  const switchBot=async enabled=>{
    setBusy(true);setError('');
    try{
      const result=await api(endpoint,{method:'POST',body:{action:'bot_state',enabled}});
      setBot(result.bot);
      notify(enabled?'Bot ligado. Somente mensagens novas receberão resposta.':'Bot desligado. As mensagens continuarão no histórico.');
    }catch(failure){setError(failure.message||'Não foi possível alterar o estado do bot.');}
    finally{setBusy(false);}
  };
  const visible=useMemo(()=>conversations.filter(item=>{
    const query=search.trim().toLocaleLowerCase('pt-BR');
    const matches=!query||[item.username,item.igsid,item.last_text].some(value=>String(value||'').toLocaleLowerCase('pt-BR').includes(query));
    return matches&&(filter==='all'||filter==='human'&&item.status==='human'||filter==='bot'&&item.status==='bot');
  }),[conversations,search,filter]);
  const conversation=detail?.conversation;
  return <section className="ig-inbox">
    <div className="ig-inbox-intro card">
      <div><span className="ig-inbox-kicker"><MessageCircle size={16}/> ATENDIMENTO</span><h2>Conversas do bot</h2><p>Mensagens recebidas, respostas automáticas e encaminhamentos do Direct.</p></div>
      <div className="ig-inbox-actions"><span className={`ig-inbox-state ${bot?.enabled?'on':'off'}`}>{!bot?'Carregando estado…':bot.enabled?'Bot ligado':bot.serverEnabled?'Bot desligado':'Desligado no servidor'}</span><button type="button" className="ig-inbox-toggle" disabled={loading||busy||!bot?.available||!bot.serverEnabled} onClick={()=>switchBot(!bot.enabled)}>{bot?.enabled?<><Pause size={16}/> Desligar bot</>:<><Play size={16}/> Ligar bot</>}</button><button type="button" className="erp-ghost" onClick={()=>refresh()} disabled={loading||busy}><RefreshCw size={16}/> Atualizar</button></div>
    </div>
    <p className="ig-inbox-switch-help">Com o bot desligado, as mensagens continuam no histórico, sem resposta automática. Ao ligar novamente, ele responde apenas às mensagens enviadas depois da ativação.{bot&&!bot.available?' Aplique a migration do interruptor para habilitar este controle.':''}{bot&&!bot.serverEnabled?' IG_BOT_ENABLED está desligado no servidor.':''}</p>
    {error&&<p className="ig-inbox-error" role="alert">{error}</p>}
    <div className="ig-inbox-layout">
      <div className="ig-inbox-list card">
        <div className="ig-inbox-list-head"><h3>Caixa de entrada</h3><small>Até 50 conversas recentes</small></div>
        <label className="ig-inbox-search"><Search size={16}/><input type="search" placeholder="Buscar por usuário, ID ou mensagem" value={search} onChange={event=>setSearch(event.target.value)}/></label>
        <div className="ig-inbox-filters" aria-label="Filtrar conversas">{[['all','Todas'],['human','Equipe'],['bot','Bot']].map(([key,label])=><button type="button" key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div>
        {loading?<p className="ig-inbox-empty">Carregando conversas…</p>:visible.length?visible.map(item=><button type="button" key={item.id} className={`ig-inbox-person ${selected===item.id?'selected':''}`} onClick={()=>open(item.id)} aria-current={selected===item.id?'true':undefined}>
          <span className="ig-inbox-avatar"><AtSign size={20}/></span><span className="ig-inbox-person-main"><span><b>{nameOf(item)}</b><time>{when(item.last_message_at)}</time></span><small>{statusOf(item,bot?.enabled)}{item.last_text?` · ${item.last_text}`:''}</small></span>
        </button>):<p className="ig-inbox-empty">{search||filter!=='all'?'Nenhuma conversa encontrada.':'Nenhuma mensagem registrada ainda. As conversas aparecem após o webhook receber mensagens.'}</p>}
      </div>
      <div className="ig-inbox-thread card">
        {loadingDetail?<p className="ig-inbox-empty">Carregando histórico…</p>:conversation?<>
          <header className="ig-inbox-thread-head"><div><h3>{nameOf(conversation)}</h3><small>{statusOf(conversation,bot?.enabled)}{conversation.paused_until?` · pausa até ${when(conversation.paused_until)}`:''}</small></div><button type="button" className="erp-ghost" disabled={busy} onClick={()=>changeStatus(conversation.status==='bot'?'pause':'resume')}>{conversation.status==='bot'?<><Pause size={15}/> Pausar bot</>:<><Play size={15}/> Retomar bot</>}</button></header>
          {conversation.handoff_reason&&<div className="ig-inbox-handoff">Motivo da pausa ou encaminhamento: {conversation.handoff_reason.replaceAll('_',' ')}</div>}
          {detail.handoffs?.filter(item=>!item.resolved_at).map(item=><div key={item.id} className="ig-inbox-handoff"><b>Encaminhado para a equipe</b><span>{item.summary}</span><small>{when(item.created_at)}</small></div>)}
          <div className="ig-inbox-messages">{detail.messages?.length?detail.messages.map(message=><article key={message.id} className={`ig-inbox-message ${message.author}`}><div><b>{message.author==='customer'?'Cliente':message.author==='human'?'Equipe':'Bot'}</b><time>{when(message.created_at)}</time></div><p>{message.text||((message.attachments||[]).length?'Anexo recebido':'Mensagem sem texto')}</p>{message.author==='bot'&&(message.tool_calls||[]).filter(call=>toolNames[call.name]).length>0&&<small>Consultas: {message.tool_calls.filter(call=>toolNames[call.name]).map(call=>toolNames[call.name]).join(', ')}</small>}</article>):<p className="ig-inbox-empty">Ainda não há mensagens nesta conversa.</p>}</div>
          <p className="ig-inbox-footnote">Para responder pessoalmente, abra esta conversa no app do Instagram. O histórico exibe as últimas 100 mensagens registradas.</p>
        </>:<div className="ig-inbox-placeholder"><MessageCircle size={34}/><h3>Selecione uma conversa</h3><p>Veja quem escreveu, o que o bot respondeu e quando a equipe assumiu.</p></div>}
      </div>
    </div>
  </section>;
}
