import {db} from '../db.js';
import {normalize,formatPrice,trackedLink} from './text.js';
import {infoLoja,handoffMessage} from './knowledge.js';
import {quoteShipping} from './shipping.js';

export const pauseHours=env=>Math.min(168,Math.max(1,Number(env.IG_HUMAN_PAUSE_HOURS)||12));
const statuses={pending_payment:'aguardando pagamento',pending:'pendente',authorized:'autorizado',paid:'pago',processing:'em processamento',shipped:'enviado',delivered:'entregue',cancelled:'cancelado',refunded:'reembolsado',partially_refunded:'reembolso parcial',failed:'não aprovado',unfulfilled:'aguardando preparação',preparing:'em preparação',returned:'devolvido',label_created:'etiqueta emitida',posted:'postado',in_transit:'em transporte',out_for_delivery:'saiu para entrega',exception:'ocorrência na entrega'};
const statusLabel=value=>statuses[value]||'a confirmar com a equipe';
function product(p,detail=false){
  const available=p.active&&p.stock_quantity>0;
  return {slug:p.slug,nome:p.name,categoria:p.category_name||p.category,preco:formatPrice(p.price_cents),disponibilidade:!available?'não disponível no momento':p.stock_quantity<=2?'últimas unidades':'disponível',badge:p.badge,link:trackedLink(`/produto/${encodeURIComponent(p.slug)}`),
    ...(!available?{orcamento:trackedLink('/orcamento'),orientacao:'Podemos consultar um especialista sobre disponibilidade.'}:{}),
    ...(detail?{descricao:p.description,...(p.compare_at_price_cents?{de:formatPrice(p.compare_at_price_cents),por:formatPrice(p.price_cents)}:{})}:{})};
}

export function createTools({sql=db(),conversation,env=process.env,fetch:request=fetch,signal}={}){
  const tools={
    async buscar_produtos({termo='',categoria=null}={}){
      if(typeof termo!=='string'||termo.length>150||categoria&&typeof categoria!=='string') return {erro:'Busca inválida'};
      // JS normalization is the fallback when unaccent is not installed. Paginate
      // candidates so accented matches beyond the first SQL LIMIT are not lost.
      const needle=normalize(termo.trim());
      const pattern='%'+termo.trim().replace(/[\\%_]/g,'\\$&')+'%';
      let offset=0;const found=[];
      while(found.length<5){
        signal?.throwIfAborted();
        const rows=await sql`select p.id,p.slug,p.name,p.description,p.category,p.price_cents,p.stock_quantity,p.active,p.badge,c.name as category_name
          from public.products p left join public.categories c on c.id=p.category_id
          where p.active=true and (${categoria}::text is null or coalesce(c.slug,p.category)=${categoria})
          order by (p.name ilike ${pattern} or p.description ilike ${pattern}) desc,p.name,p.id limit 100 offset ${offset}`;
        for(const row of rows){if(normalize(row.name+' '+row.description).includes(needle)) found.push(product(row));if(found.length===5) break;}
        if(rows.length<100) break;offset+=100;
      }
      return found;
    },
    async detalhes_produto({slug}={}){
      if(typeof slug!=='string'||slug.length>200) return {erro:'Produto inválido'};
      const [row]=await sql`select p.slug,p.name,p.description,p.category,p.price_cents,p.compare_at_price_cents,p.stock_quantity,p.active,p.badge from public.products p where slug=${slug} limit 1`;
      return row?product(row,true):null;
    },
    async listar_categorias(){return (await sql`select name,slug from public.categories where active=true order by sort_order,name`).map(x=>({nome:x.name,link:trackedLink(`/c/${encodeURIComponent(x.slug)}`)}));},
    // Pronta entrega: só produtos ativos com estoque, destaques primeiro.
    async produtos_por_categoria({categoria,limite=3,inicio=0}={}){
      if(typeof categoria!=='string'||!/^[a-z0-9-]{1,40}$/.test(categoria)) return [];
      const n=Math.min(5,Math.max(1,Math.trunc(Number(limite))||3));
      const skip=Math.min(500,Math.max(0,Math.trunc(Number(inicio))||0));
      const rows=await sql`select p.slug,p.name,p.description,p.category,p.price_cents,p.stock_quantity,p.active,p.badge,c.name as category_name
        from public.products p left join public.categories c on c.id=p.category_id
        where p.active=true and p.stock_quantity>0 and coalesce(c.slug,p.category)=${categoria}
        order by p.featured desc,p.featured_rank,p.name,p.slug limit ${n} offset ${skip}`;
      return rows.map(row=>product(row));
    },
    async categorias_com_estoque(){
      return (await sql`select c.slug,c.name,count(p.id)::int as total from public.categories c
        join public.products p on coalesce(p.category_id,(select id from public.categories where slug=p.category))=c.id and p.active=true and p.stock_quantity>0
        where c.active=true group by c.slug,c.name,c.sort_order order by c.sort_order,c.name`)
        .map(x=>({slug:x.slug,nome:x.name,total:x.total,link:trackedLink(`/c/${encodeURIComponent(x.slug)}`)}));
    },
    cotar_frete:args=>quoteShipping(args,{sql,env,fetch:request,signal}),
    async consultar_pedido({numero,email}={}){
      // Atomic counter: even simultaneous calls cannot pass the hourly limit.
      const [counter]=await sql`update public.ig_conversations set
        order_lookup_attempts=case when order_lookup_window_start is null or order_lookup_window_start<=now()-interval '1 hour' then 1 else order_lookup_attempts+1 end,
        order_lookup_window_start=case when order_lookup_window_start is null or order_lookup_window_start<=now()-interval '1 hour' then now() else order_lookup_window_start end
        where id=${conversation.id} returning order_lookup_attempts`;
      if(!counter||counter.order_lookup_attempts>5) return tools.encaminhar_humano({motivo:'limite_consulta_pedido',resumo:'Limite de tentativas de consulta atingido.'});
      if(!/^\d{1,18}$/.test(String(numero||''))||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)) return {encontrado:false};
      const [row]=await sql`select o.status,o.payment_status,o.fulfillment_status,o.shipping_service,s.tracking_code,s.tracking_url,
        e.status as event_status,e.happened_at as event_at
        from public.orders o left join public.shipments s on s.order_id=o.id
        left join lateral (select status,happened_at from public.shipment_events where shipment_id=s.id order by happened_at desc limit 1) e on true
        where o.number=${String(numero)}::bigint and lower(o.customer_email)=lower(${email.trim()}) limit 1`;
      if(!row) return {encontrado:false};
      let tracking=null;try{if(row.tracking_url) tracking=trackedLink(row.tracking_url);}catch{}
      return {status:statusLabel(row.status),payment_status:statusLabel(row.payment_status),fulfillment_status:statusLabel(row.fulfillment_status),shipping_service:row.shipping_service,tracking_code:row.tracking_code,tracking_url:tracking,ultimo_evento:row.event_status?{status:statusLabel(row.event_status),data:row.event_at}:null};
    },
    async encaminhar_humano({motivo='atendimento',resumo='Atendimento solicitado.'}={}){
      // Keep only a bounded operational reason, never arbitrary customer/LLM PII.
      const reason=String(motivo).replace(/[^a-zA-Z_ -]/g,'').slice(0,80)||'atendimento';
      await sql.begin(async tx=>{
        const [updated]=await tx`update public.ig_conversations set status='human',paused_until=now()+(${pauseHours(env)}*interval '1 hour'),handoff_reason=${reason}
          where id=${conversation.id} and status<>'closed' and coalesce(handoff_reason,'')<>'humano_no_instagram' and coalesce(handoff_reason,'') not like 'echo:%' returning id`;
        if(!updated) return;
        await tx`insert into public.ig_handoffs(conversation_id,reason,summary) values (${conversation.id},${reason},${'Cliente precisa de atendimento da equipe. Motivo: '+reason}) on conflict (conversation_id) where resolved_at is null do nothing`;
      });
      return {handoff:true,mensagem:handoffMessage()};
    },
    async info_loja({topico}={}){return infoLoja(topico);}
  };
  return tools;
}

const string={type:'string'};
const definition=(name,description,properties={},required=[])=>({name,description,input_schema:{type:'object',properties,required,additionalProperties:false}});
export const toolDefinitions=[
  definition('buscar_produtos','Consulta catálogo e preço/estoque atuais. Busca por nome ou descrição, até 5 produtos.',{termo:string,categoria:{type:'string',enum:['peixes','corais','racoes','filtragem','tratamentos']}}),
  definition('detalhes_produto','Consulta um produto pelo slug.',{slug:string},['slug']),
  definition('listar_categorias','Lista categorias disponíveis.'),
  definition('cotar_frete','Cotação sem carrinho com CEP e produtos.',{cep:string,itens:{type:'array',minItems:1,maxItems:20,items:{type:'object',properties:{slug:string,quantidade:{type:'integer',minimum:1,maximum:99}},required:['slug','quantidade'],additionalProperties:false}}},['cep','itens']),
  definition('consultar_pedido','Exige número E e-mail fornecidos pelo cliente. Não tente adivinhar.',{numero:string,email:string},['numero','email']),
  definition('encaminhar_humano','Encerra atendimento automático e chama especialista. Não inclua dados pessoais no motivo/resumo.',{motivo:string,resumo:string},['motivo','resumo']),
  definition('info_loja','Consulta FAQ. Informação null exige atendimento humano.',{topico:string},['topico'])
];
