import {api,formatPrice} from './commerce';

export const FEATURED_LIMIT=40;

export const fallbackCategories=[
  {slug:'peixes',name:'Peixes',description:'Animais selecionados e quarentenados.'},
  {slug:'corais',name:'Corais',description:'Corais escolhidos por coloração e saúde.'},
  {slug:'racoes',name:'Rações',description:'Nutrição para a rotina do aquário.'},
  {slug:'filtragem',name:'Filtragem',description:'Equipamentos para qualidade da água.'},
  {slug:'tratamentos',name:'Tratamentos',description:'Soluções para manutenção do aquário.'}
];

export function mapStoreProduct(row){
  const cents=row.priceCents??row.price_cents;
  return {
    id:row.id,
    slug:row.slug,
    name:row.name,
    category:row.categoryName||row.category_name||row.category,
    categorySlug:row.categorySlug||row.category_slug||row.category,
    price:cents!=null?formatPrice(cents/100):row.price,
    priceCents:cents,
    image:row.imageUrl||row.image_url||row.image,
    tag:row.badge||row.tag||'',
    featured:Boolean(row.featured),
    description:row.description||'',
    stock:row.stockQuantity??row.stock_quantity??0
  };
}

export async function loadCatalog(){
  const data=await api('/api/catalog');
  return {
    products:(data.products||[]).map(mapStoreProduct),
    categories:data.categories||[]
  };
}

export function categoryPath(slug){
  return `/c/${slug}`;
}

export function moneyInput(cents){
  return ((Number(cents)||0)/100).toFixed(2).replace('.',',');
}
