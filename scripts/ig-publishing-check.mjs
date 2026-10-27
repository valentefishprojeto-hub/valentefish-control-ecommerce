// Local UI integration check. Uses only an ephemeral database and no Meta token.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {testDatabase} from '../api/_lib/instagram/test-db.js';
import {createMarketingHandler} from '../api/_routes/marketing/instagram.js';
import {renderPublication} from '../api/_lib/instagram/publishing-media.js';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const database=await testDatabase();
const output=join(tmpdir(),'valentefish-instagram-check');await mkdir(output,{recursive:true});
const env={APP_URL:'https://loja.test'};
const localImage=async url=>new Response(await readFile(new URL('../public'+new URL(url).pathname,import.meta.url)));
const handler=createMarketingHandler({sql:database.sql,env,authenticate:async()=>({id:'test-admin',app_metadata:{role:'admin'}}),render:(product,config,format)=>renderPublication(product,config,format,{env,fetch:localImage})});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
    const request=route.request();
    if(new URL(request.url()).pathname==='/api/marketing/instagram'){
      const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.data=value;return this;}};
      await handler({method:request.method(),headers:request.headers(),body:request.postDataJSON()},res);
      return route.fulfill({status:res.statusCode,contentType:'application/json',body:JSON.stringify(res.data)});
    }
    return route.fulfill({contentType:'application/json',body:JSON.stringify({products:[],categories:[],movements:[],customers:[],sales:[],entries:[],summary:{},metrics:{}})});
  });
  await page.goto(process.env.IG_UI_URL||'http://127.0.0.1:5173/admin/instagram');
  await page.getByRole('heading',{name:'Seu catálogo vira conteúdo.'}).waitFor();
  await page.getByRole('button',{name:'Gerar prévia real',exact:true}).click();
  await page.getByAltText('Prévia exata da imagem gerada para publicação').waitFor();
  await page.screenshot({path:join(output,'models.png'),fullPage:true});
  const preview=await page.getByAltText('Prévia exata da imagem gerada para publicação').getAttribute('src');
  await writeFile(join(output,'post.jpg'),Buffer.from(preview.split(',')[1],'base64'));
  await page.getByRole('button',{name:'Novo modelo'}).click();
  await page.getByLabel('Nome do modelo',{exact:true}).fill('Modelo de teste');
  for(let i=0;i<2;i++){
    const saved=page.waitForResponse(r=>r.url().includes('/api/marketing/instagram')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Salvar modelo',exact:true}).click();await saved;
    await page.getByRole('button',{name:'Salvar modelo',exact:true}).waitFor({state:'visible'});
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('Salvar modelo'))?.disabled);
  }
  assert.equal((await database.sql`select * from ig_publish_templates where name='Modelo de teste'`).length,1);
  await page.getByRole('tab',{name:'Programação',exact:true}).click();
  for(let i=0;i<2;i++){
    const saved=page.waitForResponse(r=>r.url().includes('/api/marketing/instagram')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Salvar programação',exact:true}).click();await saved;
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('Salvar programação'))?.disabled);
  }
  assert.equal((await database.sql`select * from ig_publish_schedules`).length,1);
  await page.screenshot({path:join(output,'schedule.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('tab',{name:'Modelos',exact:true}).click();
  await page.screenshot({path:join(output,'mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Overflow horizontal no celular');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,output,checks:['preview JPEG','template save twice: one row','schedule save twice: one row','mobile no overflow','no React errors']}));
}finally{await browser.close();await database.close();}
