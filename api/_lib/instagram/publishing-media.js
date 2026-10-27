import sharp from 'sharp';
import {createClient} from '@supabase/supabase-js';
import {formats,captionFor,priceBRL} from '../../../shared/instagram-publishing.js';

const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function allowedAsset(value,env=process.env){
  if(!value) throw new Error('Imagem não cadastrada');
  const url=new URL(value,env.APP_URL);
  const allowed=[env.APP_URL,env.SUPABASE_URL,env.VITE_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_URL].filter(Boolean).map(x=>new URL(x).origin);
  if(url.protocol!=='https:'||url.username||url.password||!allowed.includes(url.origin)) throw new Error('Use imagens hospedadas na loja ou no Supabase da loja');
  return url.href;
}
export async function fetchImage(value,{env=process.env,fetch:request=fetch}={}){
  const response=await request(allowedAsset(value,env),{redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error('Não foi possível carregar a imagem');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>8*1024*1024) throw new Error('Imagem acima de 8 MB');chunks.push(chunk);}
  const data=Buffer.concat(chunks);const metadata=await sharp(data,{limitInputPixels:25000000}).metadata();
  if(!['jpeg','png','webp','avif'].includes(metadata.format)) throw new Error('Use uma foto JPG, PNG, WEBP ou AVIF');
  return data;
}
export function productPhoto(product){return (Array.isArray(product.media)?product.media.find(x=>x?.url&&x.kind!=='video')?.url:null)||product.image_url;}
function lines(value,width=28,max=3){
  const words=String(value).split(/\s+/);const rows=[''];
  for(const word of words){const i=rows.length-1;if(rows[i].length+word.length>width&&rows[i]) rows.push(word);else rows[i]+=(rows[i]?' ':'')+word;}
  return rows.slice(0,max).map((x,i)=>i===max-1&&rows.length>max?x.slice(0,-1)+'…':x);
}
export async function renderPublication(product,config,format,{env=process.env,fetch:request=fetch}={}){
  const {width,height}=formats[format]||{};if(!width) throw new Error('Formato inválido');
  const image=await fetchImage(productPhoto(product),{env,fetch:request});
  const margin=72,photoHeight=format==='story'?960:640,photoWidth=936;
  const photoTop=config.photoPosition==='bottom'?height-photoHeight-120:230;
  const textTop=config.photoPosition==='bottom'?250:photoTop+photoHeight+65;
  const title=captionFor(config.title,product,env.APP_URL);
  const footer=captionFor(config.footer,product,env.APP_URL);
  const overlays=[];
  const photo=await sharp(image).rotate().resize(photoWidth,photoHeight,{fit:'cover',position:'attention'}).jpeg({quality:90}).toBuffer();
  overlays.push({input:photo,left:margin,top:photoTop});
  const titleRows=lines(title,35,2),nameRows=lines(product.name,27,2);
  const nameTop=textTop+titleRows.length*40+24;
  const priceY=nameTop+nameRows.length*64+48;
  const bold=config.layout==='bold';
  const svg=`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${margin}" y="${photoTop-12}" width="${photoWidth}" height="8" fill="${config.accent}"/>
    ${titleRows.map((x,i)=>`<text x="72" y="${textTop+i*40}" fill="${config.accent}" font-family="sans-serif" font-size="30" font-weight="600">${xml(x)}</text>`).join('')}
    ${nameRows.map((x,i)=>`<text x="72" y="${nameTop+i*64}" fill="${config.foreground}" font-family="sans-serif" font-size="${bold?56:50}" font-weight="700">${xml(x)}</text>`).join('')}
    ${config.showPrice?`<text x="72" y="${priceY}" fill="${config.accent}" font-family="sans-serif" font-size="52" font-weight="700">${xml(priceBRL(product.price_cents))}</text>`:''}
    <text x="72" y="${height-55}" fill="${config.foreground}" font-family="sans-serif" font-size="23">${xml(footer.slice(0,72))}</text>
    <text x="1008" y="150" text-anchor="end" fill="${config.foreground}" font-family="sans-serif" font-size="25">@valentefish</text>
    </svg>`;
  overlays.push({input:Buffer.from(svg),left:0,top:0});
  if(config.logoUrl){
    const logo=await fetchImage(config.logoUrl,{env,fetch:request});
    overlays.push({input:await sharp(logo).resize(230,125,{fit:'contain',background:'#00000000'}).png().toBuffer(),left:72,top:55});
  }
  return sharp({create:{width,height,channels:3,background:config.background}}).composite(overlays).jpeg({quality:90,chromaSubsampling:'4:4:4'}).toBuffer();
}
export async function uploadPublication(buffer,id,env=process.env){
  const url=env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL;
  const key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;
  if(!url||!key) throw new Error('Armazenamento não configurado');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const path=`posts/${id}.jpg`;
  const {error}=await client.storage.from('instagram-publishing').upload(path,buffer,{contentType:'image/jpeg',upsert:true,cacheControl:'3600'});
  if(error) throw new Error('Não foi possível armazenar a peça');
  return client.storage.from('instagram-publishing').getPublicUrl(path).data.publicUrl;
}
