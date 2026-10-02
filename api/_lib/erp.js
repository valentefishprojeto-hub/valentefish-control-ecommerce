import {moneyToCents} from './db.js';

export const FEATURED_LIMIT=40;

export function slugify(value){
  return String(value||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/(^-|-$)/g,'')
    .slice(0,80);
}

export function parseMoney(value){
  if(typeof value==='number') return moneyToCents(value);
  const normalized=String(value||'').replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,'');
  return moneyToCents(Number(normalized||0));
}

export function uniqueSlug(base,used){
  const root=slugify(base)||'item';
  let slug=root;
  let index=2;
  while(used.has(slug)){
    slug=`${root}-${index}`;
    index+=1;
  }
  return slug;
}

export function normalizeMedia(row={}){
  const items=Array.isArray(row.media)?row.media.filter(item=>item?.url):[];
  if(!items.length&&row.image_url) items.push({url:row.image_url,kind:'image',name:'capa'});
  return items;
}

export function coverUrl(row={}){
  const media=normalizeMedia(row);
  return media.find(item=>item.kind!=='video')?.url||media[0]?.url||row.image_url||'';
}

export function mapProduct(row){
  const media=normalizeMedia(row);
  return {
    id:row.id,
    sku:row.sku,
    slug:row.slug,
    name:row.name,
    description:row.description||'',
    category:row.category,
    categoryId:row.category_id,
    categoryName:row.category_name||row.category,
    categorySlug:row.category_slug||row.category,
    priceCents:row.price_cents,
    imageUrl:coverUrl(row),
    media,
    badge:row.badge,
    stockQuantity:row.stock_quantity,
    featured:Boolean(row.featured),
    featuredRank:row.featured_rank||0,
    active:row.active!==false,
    createdAt:row.created_at,
    updatedAt:row.updated_at
  };
}

export const productSelect=`
  p.id, p.sku, p.slug, p.name, p.description, p.category, p.category_id, p.price_cents,
  p.image_url, p.badge, p.stock_quantity, p.featured, p.featured_rank, p.active,
  p.created_at, p.updated_at, c.name as category_name, c.slug as category_slug
`;
