export const formats={feed:{width:1080,height:1350,label:'Feed · 4:5'},story:{width:1080,height:1920,label:'Story · 9:16'}};
export const defaults={layout:'classic',background:'#062d36',accent:'#60dfc8',foreground:'#ffffff',title:'Destaque da loja',footer:'Conheça na loja online • @valentefish',caption:'{nome} na Valente Fish. {preco}\nConheça: {link}\n#ValenteFish #AquarismoMarinho',showPrice:true,logoUrl:'/valente-fish-logo.png',photoPosition:'top'};
export const priceBRL=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents)/100).replace(/\u00a0/g,' ');
const bad=message=>{throw Object.assign(new Error(message),{status:422});};
function text(value,max){if(typeof value!=='string'||value.length>max) bad('Texto inválido ou muito longo');return value.trim();}
function placeholders(value){if([...value.matchAll(/\{([^}]+)\}/g)].some(x=>!['nome','preco','categoria','link'].includes(x[1]))) bad('Use apenas {nome}, {preco}, {categoria} e {link}');return value;}
export function validateTemplate(input){
  const name=text(input.name,80);if(!name) bad('Informe o nome do modelo');
  const c={...defaults,...input.config};
  if(!['classic','editorial','bold'].includes(c.layout)||!['top','bottom'].includes(c.photoPosition)) bad('Layout inválido');
  for(const key of ['background','accent','foreground']) if(!/^#[0-9a-f]{6}$/i.test(c[key])) bad('Cor inválida');
  if(typeof c.showPrice!=='boolean') bad('Exibição de preço inválida');
  return {name,config:{layout:c.layout,background:c.background,accent:c.accent,foreground:c.foreground,photoPosition:c.photoPosition,showPrice:c.showPrice,
    title:placeholders(text(c.title,70)),footer:placeholders(text(c.footer,100)),caption:placeholders(text(c.caption,1500)),logoUrl:text(c.logoUrl,1000)}};
}
export function validateSchedule(input){
  const name=text(input.name,80);if(!name||!/^[a-f\d-]{36}$/i.test(input.template_id||'')) bad('Informe nome e modelo da programação');
  if(!Object.hasOwn(formats,input.format)) bad('Formato inválido');
  if(!Array.isArray(input.days)||!input.days.length||input.days.some(x=>!Number.isInteger(x)||x<0||x>6)) bad('Escolha os dias da semana');
  if(!Array.isArray(input.hours)||!input.hours.length||input.hours.length>6||input.hours.some(x=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(x))) bad('Informe de 1 a 6 horários válidos');
  const repeat=Number(input.repeat_days);if(!Number.isInteger(repeat)||repeat<1||repeat>90) bad('Intervalo de repetição deve ser de 1 a 90 dias');
  if(typeof input.enabled!=='boolean') bad('Estado da programação inválido');
  return {name,template_id:input.template_id,format:input.format,category:input.category?text(input.category,80):null,days:[...new Set(input.days)].sort(),hours:[...new Set(input.hours)].sort(),repeat_days:repeat,enabled:input.enabled};
}
export function slotsForDay(schedule,now=new Date()){
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const day=new Date(date+'T12:00:00-03:00').getUTCDay();
  if(!schedule.days.includes(day)) return [];
  return schedule.hours.map(hour=>new Date(`${date}T${hour}:00-03:00`));
}
export function captionFor(template,product,appUrl){
  const link=new URL('/produto/'+encodeURIComponent(product.slug),appUrl);
  link.searchParams.set('utm_source','instagram');link.searchParams.set('utm_medium','organic_social');
  const values={nome:product.name,preco:priceBRL(product.price_cents),categoria:product.category,link:link.href};
  return template.replace(/\{(nome|preco|categoria|link)\}/g,(_,key)=>values[key]);
}
