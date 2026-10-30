import OpenAI from 'openai';
import {db} from '../db.js';

// Gera um rascunho de produto a partir das fotos, seguindo o estilo do catálogo atual.
// Só preenche o formulário do admin: quem publica é a pessoa, depois de revisar.
export const DEFAULT_MODEL='gpt-4.1-mini';
const MAX_IMAGES=5;
const CATALOG_SAMPLE=40;

// Persona padrão; poderá ser sobrescrita fora do código (env AI_PRODUCT_PERSONA).
const PERSONA=`Você cadastra produtos na Valente Fish, loja de aquarismo marinho no Rio de Janeiro (peixes, corais, invertebrados, rações, filtragem, tratamentos e equipamentos).
Escreva em português do Brasil, no mesmo tom e formato das descrições do catálogo que você recebe.
Para animais, identifique a espécie pelas fotos e inclua nome popular e científico, tamanho adulto, temperamento, compatibilidade com recifes e cuidados básicos (alimentação, iluminação e fluxo para corais).
Para equipamentos e insumos, descreva para que serve, como usar e o que vem na embalagem, só com o que dá para ver nas fotos ou nas observações.
Nunca invente preço, estoque, garantia, marca ou especificação técnica que não esteja visível ou informada. Se não tiver certeza da espécie ou do modelo, diga isso em "observacoes" e use um nome genérico.`;

const SCHEMA_BASE={
  type:'object',
  additionalProperties:false,
  required:['nome','categoria','descricao','selo','confianca','observacoes'],
  properties:{
    nome:{type:'string',description:'Nome do produto como aparece na loja, no padrão dos nomes do catálogo'},
    categoria:{type:'string',description:'Slug da categoria mais adequada'},
    descricao:{type:'string',description:'Descrição completa para a página do produto'},
    selo:{type:'string',description:'Selo curto (ex.: "Quarentenado", "Novidade") ou vazio'},
    confianca:{type:'string',enum:['alta','media','baixa'],description:'Confiança na identificação do produto'},
    observacoes:{type:'string',description:'Avisos para quem vai revisar (dúvidas, o que conferir); vazio se nada'}
  }
};

export function draftSchema(categorySlugs){
  return {...SCHEMA_BASE,properties:{...SCHEMA_BASE.properties,categoria:{...SCHEMA_BASE.properties.categoria,enum:categorySlugs}}};
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

export function buildRequest({images,notes,catalog,env=process.env}){
  return {
    model:env.AI_PRODUCT_MODEL||DEFAULT_MODEL,
    max_output_tokens:16000,
    instructions:`${env.AI_PRODUCT_PERSONA||PERSONA}\n\n${catalogText(catalog)}`,
    input:[{role:'user',content:[
      ...images.map(url=>({type:'input_image',image_url:url,detail:'high'})),
      {type:'input_text',text:`Crie o cadastro do produto das fotos acima.${notes?`\nObservações de quem está cadastrando: ${notes}`:''}`}
    ]}],
    text:{format:{type:'json_schema',name:'produto',strict:true,schema:draftSchema(catalog.categories.map(c=>c.slug))}}
  };
}

const fail=(message,status)=>Object.assign(new Error(message),{status});

export async function draftProduct({images,notes='',sql,env=process.env,client,catalog}={}){
  const urls=(Array.isArray(images)?images:[]).filter(u=>typeof u==='string'&&/^https:\/\//.test(u)).slice(0,MAX_IMAGES);
  if(!urls.length) throw fail('Envie pelo menos uma foto do produto',422);
  if(!client&&!env.OPENAI_API_KEY) throw fail('IA não configurada: falta OPENAI_API_KEY na Vercel',503);
  const data=catalog||await loadCatalog(sql);
  if(!data.categories.length) throw fail('Cadastre ao menos uma categoria antes',422);
  const openai=client||new OpenAI({apiKey:env.OPENAI_API_KEY,timeout:100000,maxRetries:1});
  const response=await openai.responses.create(buildRequest({images:urls,notes:String(notes).slice(0,1000),catalog:data,env}));
  const parts=(response.output||[]).flatMap(item=>item.content||[]);
  if(parts.some(part=>part.type==='refusal')) throw fail('A IA não conseguiu processar essas fotos. Tente outras imagens.',422);
  if(response.status==='incomplete') throw fail('A resposta da IA ficou incompleta. Tente de novo.',502);
  let draft;
  try{draft=JSON.parse(response.output_text??parts.filter(p=>p.type==='output_text').map(p=>p.text).join(''));}
  catch{throw fail('A IA devolveu um formato inesperado. Tente de novo.',502);}
  const category=data.categories.find(c=>c.slug===draft.categoria)||null;
  return {
    name:String(draft.nome||'').trim(),
    categoryId:category?.id||null,
    categorySlug:category?.slug||null,
    description:String(draft.descricao||'').trim(),
    badge:String(draft.selo||'').trim(),
    confidence:draft.confianca,
    notes:String(draft.observacoes||'').trim(),
    model:response.model
  };
}
