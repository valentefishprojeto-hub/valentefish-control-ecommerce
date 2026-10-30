import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './test-db.js';
import {validateTemplate,validateSchedule,slotsForDay,captionFor} from '../../../shared/instagram-publishing.js';
import {planJobs,runPublishing} from './publishing.js';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {renderPublication,allowedAsset} from './publishing-media.js';
import {defaults} from '../../../shared/instagram-publishing.js';
import {isAdmin,cronAuthorized,createMarketingHandler} from '../../_routes/marketing/instagram.js';

test('modelos e agenda validam campos e horário de Brasília',()=>{
  assert.throws(()=>validateTemplate({name:'X',config:{background:'url(x)'}}));
  assert.throws(()=>validateSchedule({name:'X',hours:['99:00']}));
  const slots=slotsForDay({days:[5],hours:['10:00']},new Date('2026-10-23T14:00:00Z'));
  assert.equal(slots[0].toISOString(),'2026-10-23T13:00:00.000Z');
  assert.equal(captionFor('{nome} — {preco}',{name:'Yellow Tang',price_cents:84900,slug:'yellow-tang'},'https://loja.test'),'Yellow Tang — R$ 849,00');
});

test('acesso só para administrador validado e agendador com segredo',async()=>{
  assert.equal(isAdmin({id:'user',user_metadata:{role:'admin'}}),false);
  assert.equal(isAdmin({id:'user',app_metadata:{role:'admin'}}),true);
  assert.equal(isAdmin({id:'user'},{IG_PUBLISH_ADMIN_IDS:'user'}),true);
  assert.equal(cronAuthorized({headers:{}},{}),false);
  assert.equal(cronAuthorized({headers:{authorization:'Bearer secret'}},{CRON_SECRET:'secret'}),true);
  assert.equal(cronAuthorized({headers:{authorization:'Bearer wrong'}},{CRON_SECRET:'secret'}),false);
  assert.throws(()=>allowedAsset('https://evil.test/x',{APP_URL:'https://loja.test'}));
  assert.throws(()=>allowedAsset('http://169.254.169.254/x',{APP_URL:'https://loja.test'}));
  const res={status(n){this.code=n;return this;},json(v){this.value=v;return this;},setHeader(){}};
  await createMarketingHandler({authenticate:async()=>({id:'customer'}),env:{ADMIN_LOGIN:'on'}})({method:'GET'},res);
  assert.equal(res.code,403);
});
test('renderiza JPEG real com foto local, logo, acentos e proporções corretas',async()=>{
  const request=async url=>new Response(await readFile(new URL('../../../public'+new URL(url).pathname,import.meta.url)));
  const product={id:'test',name:'Yellow Tang',slug:'yellow-tang',price_cents:84900,category:'peixes',image_url:'/store/product-fish-yellow.png'};
  for(const format of ['feed','story']){
    const image=await renderPublication(product,defaults,format,{env:{APP_URL:'https://loja.test'},fetch:request});
    const meta=await sharp(image).metadata();
    assert.equal(meta.format,'jpeg');assert.equal(meta.width,1080);assert.equal(meta.height,format==='feed'?1350:1920);
  }
});
test('alteração de preço e pausa impedem publicação; entrega incerta não é repetida',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  await sql`update ig_publish_settings set enabled=true where id=1`;
  const [template]=await sql`select * from ig_publish_templates limit 1`;
  await sql`insert into ig_publish_schedules(name,template_id,format,category,days,hours,enabled) values ('Manhã',${template.id},'story','peixes',${[5]},${['10:00']},true)`;
  const now=new Date('2026-10-23T13:01:00Z');
  let published=0;
  const options={sql,now,env:{IG_PUBLISH_ENABLED:'true',APP_URL:'https://loja.test'},render:async()=>Buffer.from('jpeg'),upload:async()=> 'https://loja.test/x.jpg'};
  await runPublishing({...options,provider:{create:async()=> 'c1',status:async()=>{await sql`update products set price_cents=price_cents+100`;return 'FINISHED';},publish:async()=>{published++;}}});
  assert.equal(published,0);assert.equal((await sql`select status from ig_publish_jobs`)[0].status,'skipped');
  await sql`delete from ig_publish_jobs`;
  await runPublishing({...options,provider:{create:async()=> 'c2',status:async()=> 'FINISHED',publish:async()=>{published++;throw new Error('timeout');}}});
  assert.equal((await sql`select status from ig_publish_jobs`)[0].status,'uncertain');
  await runPublishing({...options,provider:{publish:async()=>{published++;}}});assert.equal(published,1);
  await sql`delete from ig_publish_jobs`;await planJobs(sql,now);await sql`update ig_publish_settings set enabled=false where id=1`;
  await runPublishing({...options,provider:{publish:async()=>{published++;}}});assert.equal(published,1);
});
test('fila usa seed, não duplica slot, pausa e confirma publicação',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  await sql`update ig_publish_settings set enabled=true where id=1`;
  const [template]=await sql`select * from ig_publish_templates limit 1`;
  await sql`insert into ig_publish_schedules(name,template_id,format,category,days,hours,enabled) values ('Manhã',${template.id},'feed','peixes',${[5]},${['10:00']},true)`;
  const now=new Date('2026-10-23T13:01:00Z');
  await planJobs(sql,now);await planJobs(sql,now);
  assert.equal((await sql`select * from ig_publish_jobs`).length,1);
  let published=0;
  const provider={create:async()=> 'container',status:async()=> 'FINISHED',publish:async()=>{published++;return 'post';}};
  const env={IG_PUBLISH_ENABLED:'true',APP_URL:'https://loja.test'};
  const options={sql,env,now,provider,render:async()=>Buffer.from('jpeg'),upload:async()=> 'https://loja.test/render.jpg'};
  await runPublishing(options);await runPublishing(options);
  assert.equal(published,1);assert.equal((await sql`select status from ig_publish_jobs`)[0].status,'published');
});

test('agenda editada invalida fila e a janela inclui horários antes da meia-noite',async t=>{
  const database=await testDatabase();t.after(()=>database.close());const {sql}=database;
  await sql`update ig_publish_settings set enabled=true where id=1`;
  const [template]=await sql`select * from ig_publish_templates limit 1`;
  const [schedule]=await sql`insert into ig_publish_schedules(name,template_id,format,category,days,hours,enabled) values ('Noite',${template.id},'feed','peixes',${[5]},${['23:58']},true) returning id`;
  const now=new Date('2026-10-24T03:01:00Z');
  await planJobs(sql,now);
  assert.equal((await sql`select * from ig_publish_jobs`).length,1);
  await sql`update ig_publish_schedules set format='story',category='corais' where id=${schedule.id}`;
  let sent=0;
  await runPublishing({sql,now,env:{IG_PUBLISH_ENABLED:'true'},provider:{create:async()=>{sent++;}}});
  assert.equal(sent,0);assert.equal((await sql`select status from ig_publish_jobs`)[0].status,'skipped');
});
