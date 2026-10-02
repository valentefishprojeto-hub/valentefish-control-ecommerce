const VISITOR_KEY='vf-visitor';

export function detectSource(){
  const params=new URLSearchParams(window.location.search);
  const hint=`${params.get('utm_source')||''} ${params.get('source')||''} ${document.referrer||''}`.toLowerCase();
  if(/instagram|ig\.com/.test(hint)) return 'instagram';
  if(/whatsapp|wa\.me/.test(hint)) return 'whatsapp';
  if(/facebook|fb\.|meta/.test(hint)) return 'facebook';
  if(/google|gclid/.test(hint)) return 'google';
  if(/tiktok/.test(hint)) return 'tiktok';
  if(/youtube/.test(hint)) return 'youtube';
  const utm=(params.get('utm_source')||params.get('source')||'').toLowerCase();
  if(utm) return utm;
  if(document.referrer&&!document.referrer.includes(window.location.host)) return 'referral';
  return sessionStorage.getItem('vf-source')||'direct';
}

function visitorId(){
  let id=localStorage.getItem(VISITOR_KEY);
  if(!id){
    id=crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY,id);
  }
  return id;
}

export function track(eventType,details={}){
  const source=detectSource();
  sessionStorage.setItem('vf-source',source);
  const body={
    visitorId:visitorId(),
    eventType,
    source,
    referrer:document.referrer||'',
    path:window.location.pathname,
    ...details
  };
  fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(()=>{});
}

export function trackCart(items){
  track('cart_snapshot',{
    payload:{
      items:(items||[]).map(item=>({name:item.name,quantity:item.quantity,price:item.price})),
      count:(items||[]).reduce((sum,item)=>sum+Number(item.quantity||0),0)
    }
  });
}
