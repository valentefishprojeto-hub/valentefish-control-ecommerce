import OpenAI from 'openai';
import {db} from '../db.js';

// Gera um rascunho de produto a partir das fotos, seguindo o estilo do catálogo atual.
// Duas etapas: (1) identifica pesquisando na web e escreve o cadastro; (2) uma análise
// independente confere se a foto bate com a espécie/modelo escolhido.
// Só preenche o formulário do admin: quem publica é a pessoa, depois de revisar.
export const DEFAULT_MODEL='gpt-4.1-mini';
const MAX_IMAGES=5;
const CATALOG_SAMPLE=40;

// Persona padrão; poderá ser sobrescrita fora do código (env AI_PRODUCT_PERSONA).
const PERSONA=`Você cadastra produtos na Valente Fish, loja de aquarismo marinho no Rio de Janeiro (peixes, corais, invertebrados, rações, filtragem, tratamentos e equipamentos).
Escreva em português do Brasil, no mesmo tom e formato das descrições do catálogo que você recebe.
Para animais, inclua nome popular e científico, tamanho adulto, temperamento, compatibilidade com recifes e cuidados básicos (alimentação, iluminação e fluxo para corais).
Para equipamentos e insumos, descreva para que serve, como usar e o que vem na embalagem, só com o que dá para ver nas fotos, nas observações ou em fontes confiáveis do fabricante.
Nunca invente preço, estoque, garantia ou especificação técnica. Se não tiver certeza da espécie ou do modelo, diga isso em "observacoes" e use um nome genérico.`;

// Método de identificação: fixo no código porque é o que garante a checagem, não o tom.
const METHOD=`Como identificar (siga na ordem, antes de escrever):
1. Descreva o que a foto mostra de fato: formato do corpo, boca (bico, lábios, focinho), nadadeiras, padrão e cores, tamanho aparente. Para corais: forma da colônia, pólipos, cores. Para equipamentos: marca, modelo e textos visíveis na embalagem.
2. Liste de 2 a 3 candidatos plausíveis (família, gênero, espécie ou modelo).
3. Pesquise cada candidato na web (FishBase, Reef Life Survey, WoRMS, LiveAquaria, site do fabricante) e compare os traços diagnósticos documentados com o que você descreveu no passo 1.
4. Escolha o candidato cujos traços batem com a foto. Se nenhum bater bem, desça para o nível que você consegue afirmar (ex.: "peixe-papagaio (Scaridae)") e use confiança baixa.
5. Use nos fatos da descrição (tamanho, temperamento, cuidados) só o que as fontes confirmam, e liste as URLs consultadas em "fontes".`;

const CATEGORY={type:'string',description:'Slug da categoria mais adequada'};
const DRAFT_SCHEMA={
  type:'object',
  additionalProperties:false,
  required:['caracteristicas_observadas','candidatos_descartados','identificacao','nome','categoria','descricao','selo','confianca','observacoes','fontes'],
  properties:{
    caracteristicas_observadas:{type:'string',description:'O que a foto mostra (passo 1)'},
    candidatos_descartados:{type:'string',description:'Outros candidatos e por que foram descartados'},
    identificacao:{type:'string',description:'Nome científico (animais) ou marca/modelo (produtos) escolhido, ou o nível taxonômico seguro'},
    nome:{type:'string',description:'Nome do produto como aparece na loja, no padrão dos nomes do catálogo'},
    categoria:CATEGORY,
    descricao:{type:'string',description:'Descrição completa para a página do produto'},
    selo:{type:'string',description:'Selo curto (ex.: "Quarentenado", "Novidade") ou vazio'},
    confianca:{type:'string',enum:['alta','media','baixa'],description:'Confiança na identificação'},
    observacoes:{type:'string',description:'Avisos para quem vai revisar (dúvidas, o que conferir); vazio se nada'},
    fontes:{type:'array',items:{type:'string'},description:'URLs consultadas'}
  }
};
const CHECK_SCHEMA={
  type:'object',
  additionalProperties:false,
  required:['compativel','divergencias','alternativa'],
  properties:{
    compativel:{type:'boolean',description:'A foto é compatível com a identificação proposta?'},
    divergencias:{type:'string',description:'Traços da foto que não batem com a identificação; vazio se nenhum'},
    alternativa:{type:'string',description:'Identificação mais provável, se divergente; vazio se compatível'}
  }
};

export function draftSchema(categorySlugs){
  return {...DRAFT_SCHEMA,properties:{...DRAFT_SCHEMA.properties,categoria:{...CATEGORY,enum:categorySlugs}}};
}

export async function loadCatalog(sql=db()){
  const categories=await sql`select id,slug,name,description from public.categories where active=true order by sort_order,name`;
  const products=await sql`
    select p.name,p.description,p.badge,coalesce(c.slug,p.category) as categoria
    from public.products p left join public.categories c on c.id=p.category_id
    where p.active=true and length(p.description)>0
    order by p.updated_at desc limit ${CATALOG_SAMPLE}`;
  return {categories,products};
}

function catalogText({categories,products}){
  const cats=categories.map(c=>`- ${c.slug}: ${c.name}${c.description?` — ${c.description}`:''}`).join('\n');
  const items=products.map(p=>`### ${p.name} [${p.categoria}]${p.badge?` (selo: ${p.badge})`:''}\n${String(p.description).slice(0,600)}`).join('\n\n');
  return `Categorias disponíveis:\n${cats}\n\nExemplos do catálogo atual (siga o estilo):\n\n${items||'(catálogo ainda sem descrições)'}`;
}

const imageParts=images=>images.map(url=>({type:'input_image',image_url:url,detail:'high'}));
const model=env=>env.AI_PRODUCT_MODEL||DEFAULT_MODEL;

export function buildRequest({images,notes,catalog,env=process.env}){
  return {
    model:model(env),
    max_output_tokens:16000,
    instructions:`${env.AI_PRODUCT_PERSONA||PERSONA}\n\n${METHOD}\n\n${catalogText(catalog)}`,
    tools:[{type:'web_search'}],
    input:[{role:'user',content:[
      ...imageParts(images),
      {type:'input_text',text:`Identifique e crie o cadastro do produto das fotos acima.${notes?`\nObservações de quem está cadastrando: ${notes}`:''}`}
    ]}],
    text:{format:{type:'json_schema',name:'produto',strict:true,schema:draftSchema(catalog.categories.map(c=>c.slug))}}
  };
}

// Segunda opinião sem o raciocínio da primeira: só a foto e a identificação proposta.
export function buildCheckRequest({images,draft,env=process.env}){
  return {
    model:model(env),
    max_output_tokens:4000,
    instructions:'Você é um revisor de identificação de animais marinhos e produtos de aquarismo. Compare traço a traço o que a foto mostra com as características conhecidas da identificação proposta (formato do corpo, boca, nadadeiras, padrão de cores, forma da colônia, marca/modelo). Seja cético: marque incompatível se houver qualquer traço diagnóstico que não bate.',
    input:[{role:'user',content:[
      ...imageParts(images),
      {type:'input_text',text:`Identificação proposta: ${draft.identificacao||draft.nome}\nNome na loja: ${draft.nome}\nA foto é compatível?`}
    ]}],
    text:{format:{type:'json_schema',name:'conferencia',strict:true,schema:CHECK_SCHEMA}}
  };
}

const fail=(message,status)=>Object.assign(new Error(message),{status});

function parse(response){
  const parts=(response.output||[]).flatMap(item=>item.content||[]);
  if(parts.some(part=>part.type==='refusal')) throw fail('A IA não conseguiu processar essas fotos. Tente outras imagens.',422);
  if(response.status==='incomplete') throw fail('A resposta da IA ficou incompleta. Tente de novo.',502);
  try{return JSON.parse(response.output_text??parts.filter(p=>p.type==='output_text').map(p=>p.text).join(''));}
  catch{throw fail('A IA devolveu um formato inesperado. Tente de novo.',502);}
}

// URLs que a busca realmente retornou (citações), somadas às que o modelo listou.
function citedUrls(response){
  return (response.output||[]).flatMap(item=>item.content||[]).flatMap(part=>part.annotations||[])
    .filter(a=>a.type==='url_citation'&&a.url).map(a=>a.url);
}

export async function draftProduct({images,notes='',sql,env=process.env,client,catalog}={}){
  const urls=(Array.isArray(images)?images:[]).filter(u=>typeof u==='string'&&/^https:\/\//.test(u)).slice(0,MAX_IMAGES);
  if(!urls.length) throw fail('Envie pelo menos uma foto do produto',422);
  if(!client&&!env.OPENAI_API_KEY) throw fail('IA não configurada: falta OPENAI_API_KEY na Vercel',503);
  const data=catalog||await loadCatalog(sql);
  if(!data.categories.length) throw fail('Cadastre ao menos uma categoria antes',422);
  // Duas chamadas em sequência dentro do limite de 120 s da função: sem retentativa automática.
  const openai=client||new OpenAI({apiKey:env.OPENAI_API_KEY,timeout:55000,maxRetries:0});

  const response=await openai.responses.create(buildRequest({images:urls,notes:String(notes).slice(0,1000),catalog:data,env}));
  const draft=parse(response);
  const sources=[...new Set([...(draft.fontes||[]),...citedUrls(response)].filter(u=>/^https?:\/\//.test(u)))].slice(0,8);

  let check=null;
  try{check=parse(await openai.responses.create(buildCheckRequest({images:urls,draft,env})));}
  catch{check=null;} // a conferência é complementar: se falhar, o rascunho segue marcado para revisão

  let confidence=draft.confianca;
  const notesOut=[String(draft.observacoes||'').trim()];
  if(check&&!check.compativel){
    confidence='baixa';
    notesOut.unshift(`A conferência independente encontrou divergências: ${check.divergencias}${check.alternativa?` Pode ser: ${check.alternativa}.`:''}`);
  }else if(!check){
    notesOut.unshift('Não foi possível fazer a conferência independente; revise a identificação.');
    if(confidence==='alta') confidence='media';
  }

  const category=data.categories.find(c=>c.slug===draft.categoria)||null;
  return {
    name:String(draft.nome||'').trim(),
    categoryId:category?.id||null,
    categorySlug:category?.slug||null,
    description:String(draft.descricao||'').trim(),
    badge:String(draft.selo||'').trim(),
    identification:String(draft.identificacao||'').trim(),
    observed:String(draft.caracteristicas_observadas||'').trim(),
    confidence,
    verified:check?check.compativel:null,
    notes:notesOut.filter(Boolean).join(' '),
    sources,
    model:response.model
  };
}
