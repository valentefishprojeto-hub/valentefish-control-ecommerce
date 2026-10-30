import assert from 'node:assert/strict';
import test from 'node:test';
import {adminLoginRequired,adminOnly,profileRole} from './auth.js';
import router from '../index.js';

function reply(){
  return {statusCode:200,headers:{},body:null,
    setHeader(key,value){this.headers[key]=value},
    status(code){this.statusCode=code;return this},
    json(data){this.body=data;return this}};
}

const handler=async(req,res)=>res.status(200).json({ok:true,user:req.user.id});
const handler2=async(_req,res)=>res.status(200).json({ok:true});
const as=user=>async(_req,{required})=>{
  if(!user&&required) throw Object.assign(new Error('Faça login para continuar'),{status:401});
  return user;
};

test('rotas do ERP exigem login de administrador', async()=>{
  let res=reply();
  await adminOnly(handler,{authenticate:as(null),env:{ADMIN_LOGIN:'on'}})({headers:{}},res);
  assert.equal(res.statusCode,401);

  res=reply();
  await adminOnly(handler,{authenticate:as({id:'u1',user_metadata:{role:'admin'}}),env:{ADMIN_LOGIN:'on'}})({headers:{}},res);
  assert.equal(res.statusCode,403,'user_metadata não concede acesso');

  res=reply();
  await adminOnly(handler,{authenticate:as({id:'u1',app_metadata:{role:'admin'}}),env:{ADMIN_LOGIN:'on'}})({headers:{}},res);
  assert.deepEqual([res.statusCode,res.body],[200,{ok:true,user:'u1'}]);

  res=reply();
  await adminOnly(handler,{authenticate:as({id:'u2'}),env:{ADMIN_LOGIN:'on',IG_PUBLISH_ADMIN_IDS:'u1, u2'}})({headers:{}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.headers['Cache-Control'],'no-store');
});

test('profiles.role = admin libera o ERP; cliente não', async()=>{
  let res=reply();
  await adminOnly(handler,{authenticate:as({id:'u3'}),env:{ADMIN_LOGIN:'on'},roleOf:async id=>id==='u3'?'admin':null})({headers:{}},res);
  assert.equal(res.statusCode,200);
  res=reply();
  await adminOnly(handler,{authenticate:as({id:'u4'}),env:{ADMIN_LOGIN:'on'},roleOf:async()=>'cliente'})({headers:{}},res);
  assert.equal(res.statusCode,403);
});

test('migração: só a conta admin vira admin e cliente não consegue se promover', async t=>{
  const {testDatabase}=await import('./instagram/test-db.js');
  const {sql,pg,close}=await testDatabase();t.after(close);
  const [admin]=await sql`insert into auth.users(id,email,email_confirmed_at) values (gen_random_uuid(),'admin@valentefish.com',now()) returning id`;
  const [client]=await sql`insert into auth.users(id,email) values (gen_random_uuid(),'cliente@x.com') returning id`;
  // reaplica o trecho final da migração agora que a conta existe
  await sql`insert into public.profiles (id, role) select u.id, 'admin' from auth.users u where lower(u.email) = 'admin@valentefish.com' and u.email_confirmed_at is not null on conflict (id) do update set role = 'admin'`;
  assert.equal(await profileRole(admin.id,{sql}),'admin');
  assert.equal(await profileRole(client.id,{sql}),'cliente');
  await pg.exec('set role authenticated');
  await assert.rejects(pg.query(`update public.profiles set role='admin' where id='${client.id}'`),/permission denied/);
  await assert.rejects(pg.query(`insert into public.profiles(id,role) values (gen_random_uuid(),'admin')`),/permission denied/);
  await pg.exec('reset role');
  assert.equal(await profileRole(client.id,{sql}),'cliente');
});

test('admin sem login por padrão; ADMIN_LOGIN=on volta a exigir conta admin', async()=>{
  const res=reply();
  await adminOnly(handler2,{authenticate:as(null),env:{}})({headers:{}},res);
  assert.equal(res.statusCode,200);
  assert.equal(adminLoginRequired({ADMIN_LOGIN:' ON '}),true);
  assert.equal(adminLoginRequired({}),false);
});

test('o roteador bloqueia /api/erp/* sem token antes de tocar no banco (com ADMIN_LOGIN=on)', async t=>{
  const previous=process.env.ADMIN_LOGIN;process.env.ADMIN_LOGIN='on';
  t.after(()=>{if(previous===undefined) delete process.env.ADMIN_LOGIN; else process.env.ADMIN_LOGIN=previous;});
  for(const route of ['erp/dashboard','erp/products','erp/categories','erp/stock','erp/customers','erp/sales','erp/finance','erp/commerce','erp/upload']){
    const res=reply();
    await router({method:'GET',headers:{},query:{route},url:`/api/${route}`},res);
    assert.equal(res.statusCode,401,route);
  }
});
