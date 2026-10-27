import {randomUUID,createHash} from 'node:crypto';
import {db} from '../db.js';
import {slotsForDay,captionFor} from '../../../shared/instagram-publishing.js';
import {renderPublication,uploadPublication,productPhoto} from './publishing-media.js';
import {publishingGraph} from './publishing-graph.js';

export const fingerprint=p=>createHash('sha256').update(JSON.stringify([p.id,p.name,p.slug,p.price_cents,p.category,productPhoto(p)])).digest('hex');
export async function planJobs(sql,now=new Date()){
  return sql.begin(async tx=>{
    const [settings]=await tx`select * from public.ig_publish_settings where id=1 for update`;
    if(!settings?.enabled) return 0;
    const schedules=await tx`select s.*,t.config,md5(concat_ws('|',s.template_id,s.format,s.category,s.days::text,s.hours::text,s.repeat_days,s.enabled)) as schedule_fingerprint from public.ig_publish_schedules s join public.ig_publish_templates t on t.id=s.template_id where s.enabled=true order by s.created_at`;
    let count=0;
    for(const schedule of schedules){
      for(const slot of [...slotsForDay(schedule,new Date(now.getTime()-86400000)),...slotsForDay(schedule,now)]){
        if(slot>now||now-slot>15*60000) continue;
        const [existing]=await tx`select id from public.ig_publish_jobs where schedule_id=${schedule.id} and scheduled_at=${slot}`;
        if(existing) continue;
        const [product]=await tx`select p.* from public.products p where p.active=true and p.stock_quantity>0
          and (${schedule.category}::text is null or p.category=${schedule.category})
          and (coalesce(p.image_url,'')<>'' or exists(select 1 from jsonb_array_elements(p.media) m where m->>'kind'='image' and m->>'url' is not null))
          and not exists(select 1 from public.ig_publish_jobs j where j.product_id=p.id and j.status not in ('failed','skipped') and j.scheduled_at>${slot}::timestamptz-(${schedule.repeat_days}*interval '1 day'))
          order by p.featured desc,p.updated_at desc,p.id limit 1`;
        await tx`insert into public.ig_publish_jobs(schedule_id,product_id,scheduled_at,format,template_config,schedule_fingerprint,status,error_message)
          values (${schedule.id},${product?.id||null},${slot},${schedule.format},${tx.json(schedule.config)},${schedule.schedule_fingerprint},${product?'queued':'skipped'},${product?null:'Nenhum produto elegível sem repetição'}) on conflict do nothing`;
        count++;
      }
    }
    return count;
  });
}
async function eligible(sql,job,env){
  if(env.IG_PUBLISH_ENABLED!=='true') return null;
  const [row]=await sql`select p.* from public.products p join public.ig_publish_schedules s on s.id=${job.schedule_id}
    join public.ig_publish_templates t on t.id=s.template_id
    join public.ig_publish_settings cfg on cfg.id=1 where p.id=${job.product_id} and p.active=true and p.stock_quantity>0 and s.enabled=true and cfg.enabled=true
    and md5(concat_ws('|',s.template_id,s.format,s.category,s.days::text,s.hours::text,s.repeat_days,s.enabled))=${job.schedule_fingerprint}
    and t.config=${sql.json(job.template_config)}::jsonb`;
  return row||null;
}
export async function runPublishing({sql=db(),env=process.env,now=new Date(),provider=publishingGraph({env}),render=renderPublication,upload=uploadPublication}={}){
  await sql`update public.ig_publish_settings set last_runner_at=${now} where id=1`;
  if(env.IG_PUBLISH_ENABLED!=='true') return {processed:0,paused:true};
  await planJobs(sql,now);
  // Recovery never retries a publication whose delivery might have succeeded.
  await sql`update public.ig_publish_jobs set status='uncertain',error_message='Execução interrompida durante publicação; confira o Instagram',lease_until=null where status='publishing' and lease_until<${now}`;
  await sql`update public.ig_publish_jobs set status='queued',claim_token=null,lease_until=null where status='rendering' and lease_until<${now}`;
  let processed=0;
  for(let i=0;i<3;i++){
    const token=randomUUID();
    const [job]=await sql`update public.ig_publish_jobs set claim_token=${token},lease_until=${new Date(now.getTime()+180000)},status=case when status='queued' then 'rendering' else status end
      where id=(select id from public.ig_publish_jobs where status in ('queued','processing') and scheduled_at<=${now} and (lease_until is null or lease_until<${now}) order by scheduled_at limit 1 for update skip locked) returning *`;
    if(!job) break;
    processed++;
    const finish=async(status,error=null)=>sql`update public.ig_publish_jobs set status=${status},error_message=${error},lease_until=null,claim_token=null where id=${job.id} and claim_token=${token}`;
    try{
      const product=await eligible(sql,job,env);
      if(!product){await finish('skipped','Publicação pausada ou produto indisponível');continue;}
      if(now-new Date(job.scheduled_at)>3600000){await finish('skipped','Horário expirado; a publicação não será acumulada');continue;}
      if(!job.container_id){
        const buffer=await render(product,job.template_config,job.format,{env});
        const asset=await upload(buffer,job.id,env);
        const caption=captionFor(job.template_config.caption,product,env.APP_URL);
        const current=await eligible(sql,job,env);
        if(!current||fingerprint(current)!==fingerprint(product)){await finish('skipped','Produto ou programação mudou durante a criação');continue;}
        const container=await provider.create({asset_url:asset,caption,format:job.format});
        job.container_id=container;job.fingerprint=fingerprint(product);
        await sql`update public.ig_publish_jobs set status='processing',asset_url=${asset},caption=${caption},container_id=${container},fingerprint=${job.fingerprint} where id=${job.id} and claim_token=${token}`;
      }
      const status=await provider.status(job.container_id);
      if(status==='IN_PROGRESS'){await sql`update public.ig_publish_jobs set lease_until=${new Date(now.getTime()+60000)},claim_token=null where id=${job.id} and claim_token=${token}`;continue;}
      if(status==='PUBLISHED'){await finish('uncertain','Container já publicado; confira o Instagram antes de qualquer ação');continue;}
      if(status!=='FINISHED'){await finish('failed','Instagram não processou a mídia: '+String(status).slice(0,30));continue;}
      const latest=await eligible(sql,job,env);
      if(!latest||fingerprint(latest)!==job.fingerprint){await finish('skipped','Preço, produto ou programação mudou antes de publicar');continue;}
      const [owned]=await sql`update public.ig_publish_jobs set status='publishing' where id=${job.id} and claim_token=${token} returning id`;
      if(!owned) continue;
      try{
        const mediaId=await provider.publish(job.container_id);
        await sql`update public.ig_publish_jobs set status='published',media_id=${mediaId},published_at=${new Date()},lease_until=null,claim_token=null where id=${job.id} and claim_token=${token}`;
      }catch{await finish('uncertain','Sem confirmação de entrega. Confira a conta; não haverá reenvio automático.');}
    }catch{await finish('failed','Não foi possível preparar a publicação. Verifique mídia e integrações.');}
  }
  return {processed};
}
