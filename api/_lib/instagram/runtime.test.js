import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';

test('webhook preserva raw body no runtime oficial @vercel/node com helpers', {timeout:30000},async t=>{
  const root=fileURLToPath(new URL('../../../',import.meta.url));
  const child=fork(fileURLToPath(new URL('../../../node_modules/@vercel/node/dist/dev-server.mjs',import.meta.url)),[],{
    cwd:root,windowsHide:true,silent:true,env:{...process.env,VERCEL_DEV_ENTRYPOINT:'api/index.js',META_APP_SECRET:'runtime-test',META_VERIFY_TOKEN:'verify',IG_BOT_ENABLED:'false'}
  });
  t.after(()=>{child.kill();});
  let errors='';child.stderr.on('data',x=>{errors+=x;});
  const address=await new Promise((resolve,reject)=>{
    child.once('message',resolve);child.once('exit',()=>reject(new Error('Runtime encerrou: '+errors)));
  });
  const port=address.port;
  assert.ok(port,JSON.stringify(address));
  const raw='{ "object": "instagram", "entry": [], "teste": "ração 🐠" }\n';
  const signature='sha256='+createHmac('sha256','runtime-test').update(raw).digest('hex');
  const result=await fetch(`http://127.0.0.1:${port}/api?route=webhooks/instagram`,{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':signature,'x-forwarded-host':'localhost'},body:raw,signal:AbortSignal.timeout(10000)});
  assert.equal(result.status,200,await result.text());
});
