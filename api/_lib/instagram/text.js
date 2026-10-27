import {centsToMoney} from '../db.js';
import {appUrl} from '../http.js';

export const formatPrice=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(centsToMoney(cents)).replace(/\u00a0/g,' ');
export const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function trackedLink(path){
  if(!/^https:\/\//i.test(path)&&!process.env.APP_URL) throw new Error('APP_URL não configurada');
  const url=new URL(path,/^https:\/\//i.test(path)?undefined:appUrl({headers:{}}));
  if(url.protocol!=='https:'||url.username||url.password) throw new Error('Link inválido');
  url.searchParams.set('utm_source','instagram');url.searchParams.set('utm_medium','dm');
  return url.href;
}
export function splitText(text,maxBytes=1000,maxParts=3){
  const parts=[];let part='';
  // URLs are indivisible. Prefer paragraph/sentence boundaries, then words.
  const tokens=String(text).trim().match(/https?:\/\/\S+|[^\s]+|\s+/gu)||[];
  for(const token of tokens){
    if(Buffer.byteLength(token)>maxBytes) throw new Error('Resposta longa demais');
    if(Buffer.byteLength(part+token)>maxBytes){
      const breaks=[...part.matchAll(/\n\s*\n|[.!?] +/g)];
      const last=breaks.at(-1);
      const cut=last&&last.index>part.length/2?last.index+last[0].length:part.length;
      parts.push(part.slice(0,cut).trim());part=part.slice(cut).trimStart();
      if(Buffer.byteLength(part+token)>maxBytes){parts.push(part.trim());part='';}
    }
    part+=token;
  }
  if(part.trim()) parts.push(part.trim());
  if(parts.length>maxParts) throw new Error('Resposta longa demais');
  return parts;
}
