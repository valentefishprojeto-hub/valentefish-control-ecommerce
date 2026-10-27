import {timingSafeEqual} from 'node:crypto';
import {currentUser} from '../../_lib/auth.js';
import {body,method} from '../../_lib/http.js';
import {db} from '../../_lib/db.js';
import {validateTemplate,validateSchedule,captionFor} from '../../../shared/instagram-publishing.js';
import {allowedAsset,renderPublication} from '../../_lib/instagram/publishing-media.js';
import {runPublishing} from '../../_lib/instagram/publishing.js';

const uuid=value=>typeof value==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);
export function isAdmin(user,env=process.env){return !!user&&(user.app_metadata?.role==='admin'||String(env.IG_PUBLISH_ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(user.id));}
export function cronAuthorized(req,env=process.env){
  const expected=env.CRON_SECRET?'Bearer '+env.CRON_SECRET:'';
  const actual=req.headers?.authorization;
  return !!expected&&typeof actual==='string'&&Buffer.byteLength(actual)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
}
export function readiness(env=process.env){return {
  meta:!!(env.IG_ACCESS_TOKEN&&env.IG_BUSINESS_ID&&env.META_GRAPH_VERSION),
  storage:!!((env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL)&&(env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY)),
  store:!!env.APP_URL,worker:!!env.CRON_SECRET,enabled:env.IG_PUBLISH_ENABLED==='true'
};}
export async function cron(req,res){
  if(!method(req,res,['GET','POST'])) return;
  if(!cronAuthorized(req)) return res.status(401).json({error:'Agendador não autorizado'});
  try{return res.status(200).json(await runPublishing());}
  catch{return res.status(503).json({error:'Não foi possível executar o agendador'});}
}
export function createMarketingHandler({sql:client,authenticate=currentUser,env=process.env,render=renderPublication}={}){return async function instagramMarketing(req,res){
  if(!method(req,res,['GET','POST'])) return;
  res.setHeader('Cache-Control','no-store');
  try{
    const user=await authenticate(req,{required:true});
    if(!isAdmin(user,env)) return res.status(403).json({error:'Esta área está disponível apenas para administradores autorizados'});
    const sql=client||db();
    if(req.method==='GET'){
      const [settings,templates,schedules,jobs,categories,products]=await Promise.all([
        sql`select * from public.ig_publish_settings where id=1`,
        sql`select * from public.ig_publish_templates order by created_at`,
        sql`select * from public.ig_publish_schedules order by created_at`,
        sql`select j.*,p.name as product_name,s.name as schedule_name from public.ig_publish_jobs j left join public.products p on p.id=j.product_id join public.ig_publish_schedules s on s.id=j.schedule_id order by j.scheduled_at desc limit 50`,
        sql`select slug,name from public.categories where active=true order by sort_order`,
        sql`select id,name,slug,image_url,price_cents from public.products where active=true and stock_quantity>0 order by name limit 100`
      ]);
      return res.status(200).json({settings:settings[0],templates,schedules,jobs,categories,products,readiness:readiness(env)});
    }
    const input=body(req);
    if(input.action==='template'){
      const value=validateTemplate(input);
      if(value.config.logoUrl) allowedAsset(value.config.logoUrl,env);
      let saved;
      if(input.id){
        if(!uuid(input.id)) return res.status(422).json({error:'Modelo inválido'});
        [saved]=await sql`update public.ig_publish_templates set name=${value.name},config=${sql.json(value.config)} where id=${input.id} returning id`;
      }else [saved]=await sql`insert into public.ig_publish_templates(name,config) values (${value.name},${sql.json(value.config)}) returning id`;
      return res.status(saved?200:404).json(saved?{ok:true,id:saved.id}:{error:'Modelo não encontrado'});
    }else if(input.action==='schedule'){
      const value=validateSchedule(input);
      if(input.id&&!uuid(input.id)) return res.status(422).json({error:'Programação inválida'});
      if(value.category){const [category]=await sql`select id from public.categories where slug=${value.category} and active=true`;if(!category) return res.status(422).json({error:'Categoria inválida'});}
      let saved;
      if(input.id) [saved]=await sql`update public.ig_publish_schedules set name=${value.name},template_id=${value.template_id},format=${value.format},category=${value.category},days=${value.days},hours=${value.hours},repeat_days=${value.repeat_days},enabled=${value.enabled} where id=${input.id} returning id`;
      else [saved]=await sql`insert into public.ig_publish_schedules(name,template_id,format,category,days,hours,repeat_days,enabled) values (${value.name},${value.template_id},${value.format},${value.category},${value.days},${value.hours},${value.repeat_days},${value.enabled}) returning id`;
      return res.status(saved?200:404).json(saved?{ok:true,id:saved.id}:{error:'Programação não encontrada'});
    }else if(input.action==='toggle'){
      if(typeof input.enabled!=='boolean') return res.status(422).json({error:'Estado inválido'});
      if(input.enabled&&!Object.values(readiness(env)).every(Boolean)) return res.status(409).json({error:'Conclua a configuração do Instagram, armazenamento e agendador no servidor antes de ativar'});
      await sql`update public.ig_publish_settings set enabled=${input.enabled} where id=1`;
    }else if(input.action==='preview'){
      if(!uuid(input.productId)||!['feed','story'].includes(input.format)) return res.status(422).json({error:'Selecione produto e formato'});
      const value=validateTemplate(input);
      const [product]=await sql`select * from public.products where id=${input.productId} and active=true and stock_quantity>0`;
      if(!product) return res.status(422).json({error:'Produto indisponível'});
      const image=await render(product,value.config,input.format,{env});
      return res.status(200).json({image:'data:image/jpeg;base64,'+image.toString('base64'),caption:captionFor(value.config.caption,product,env.APP_URL)});
    }else if(input.action==='run') return res.status(200).json(await runPublishing({sql,env}));
    else return res.status(422).json({error:'Operação inválida'});
    return res.status(200).json({ok:true});
  }catch(error){
    const status=error.status||500;
    return res.status(status).json({error:status<500?error.message:'Não foi possível concluir. Confira a migration e a configuração das integrações.'});
  }
};}
export default createMarketingHandler();
