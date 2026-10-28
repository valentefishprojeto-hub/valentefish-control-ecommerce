import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHmac} from 'node:crypto';
import {readRawBody,verifySignature} from './signature.js';
import {splitText,trackedLink} from './text.js';
import {createWebhook} from '../../_routes/webhooks/instagram.js';

const secret='segredo-apenas-teste';
const sign=raw=>'sha256='+createHmac('sha256',secret).update(raw).digest('hex');
function request(raw){
  const req=Readable.from([raw]);
  req.method='POST'; req.headers={'x-hub-signature-256':sign(raw)};
  Object.defineProperty(req,'body',{get(){throw new Error('Não acessar body');}});
  return req;
}
function response(){return {statusCode:0,status(n){this.statusCode=n;return this;},json(v){this.value=v;return this;},send(v){this.value=v;return this;},setHeader(){}};}

test('assinatura preserva bytes, espaços, acentos e não acessa getter body',async()=>{
  const raw=Buffer.from('{ "texto": "ração 🐠" }\n');
  assert.deepEqual(await readRawBody(request(raw)),raw);
  assert.equal(verifySignature(raw,sign(raw),secret),true);
  assert.equal(verifySignature(Buffer.from('{}'),sign(raw),secret),false);
  assert.equal(verifySignature(raw,'sha256=zz',secret),false);
});
test('body consumido e parseado sem bytes originais falha fechado',async()=>{
  const req=Readable.from([]); for await(const chunk of req) void chunk;
  req.body={texto:'oi'};
  await assert.rejects(()=>readRawBody(req),/crus/);
});
test('GET valida token e POST confirma antes de iniciar processamento',async()=>{
  const pending=[];let processed=false;
  const webhook=createWebhook({env:{META_APP_SECRET:secret,META_VERIFY_TOKEN:'verify'},waitUntil:p=>pending.push(p),processPayload:async()=>{processed=true;}});
  for(const [token,status] of [['verify',200],['errado',403]]){
    const res=response();await webhook({method:'GET',query:{'hub.mode':'subscribe','hub.verify_token':token,'hub.challenge':'42'}},res);
    assert.equal(res.statusCode,status); if(status===200) assert.equal(res.value,'42');
  }
  const raw=Buffer.from('{"object":"instagram","entry":[]}');
  const invalid=request(raw); invalid.headers['x-hub-signature-256']='sha256=00';
  const rejected=response();await webhook(invalid,rejected);assert.equal(rejected.statusCode,401);
  const accepted=response();const start=performance.now();
  accepted.send=function(v){assert.equal(processed,false);this.value=v;return this;};
  await webhook(request(raw),accepted);
  assert.equal(accepted.statusCode,200);assert.ok(performance.now()-start<1000);
  await Promise.all(pending); assert.equal(processed,true);
});
test('split UTF-8 preserva URLs e limita a três partes',()=>{
  const url=trackedLink('https://loja.test/produto/yellow-tang');
  const chunks=splitText(('Olá 🐠, tudo bem? '.repeat(80))+'\n\n'+url);
  assert.ok(chunks.length<=3);assert.ok(chunks.every(x=>Buffer.byteLength(x)<=1000));
  assert.ok(chunks.some(x=>x.includes(url)));
  assert.throws(()=>splitText('a'.repeat(4000)),/longa/);
  assert.throws(()=>splitText('https://loja.test/'+ 'a'.repeat(1100)),/longa/);
});

test('webhook aceita o Instagram app secret e ignora espaços colados no segredo',async()=>{
  const {webhookSecrets,verifyAnySignature}=await import('./signature.js');
  const raw=Buffer.from('{"object":"instagram","entry":[]}');
  const signed=secret=>'sha256='+createHmac('sha256',secret).update(raw).digest('hex');
  const secrets=webhookSecrets({META_APP_SECRET:'app-secret'+String.fromCharCode(10),INSTAGRAM_APP_SECRET:' ig-secret '});
  assert.deepEqual(secrets,['app-secret','ig-secret']);
  assert.equal(verifyAnySignature(raw,signed('app-secret'),secrets),true);
  assert.equal(verifyAnySignature(raw,signed('ig-secret'),secrets),true);
  assert.equal(verifyAnySignature(raw,signed('outro'),secrets),false);
  assert.deepEqual(webhookSecrets({}),[]);
});
