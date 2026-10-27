import assert from 'node:assert/strict';
import test from 'node:test';
import {adminOnly} from './auth.js';
import router from '../index.js';

function reply(){
  return {statusCode:200,headers:{},body:null,
    setHeader(key,value){this.headers[key]=value},
    status(code){this.statusCode=code;return this},
    json(data){this.body=data;return this}};
}

const handler=async(req,res)=>res.status(200).json({ok:true,user:req.user.id});
const as=user=>async(_req,{required})=>{
  if(!user&&required) throw Object.assign(new Error('Faça login para continuar'),{status:401});
  return user;
};

test('rotas do ERP exigem login de administrador', async()=>{
  let res=reply();
  await adminOnly(handler,{authenticate:as(null),env:{}})({headers:{}},res);
  assert.equal(res.statusCode,401);

  res=reply();
  await adminOnly(handler,{authenticate:as({id:'u1',user_metadata:{role:'admin'}}),env:{}})({headers:{}},res);
  assert.equal(res.statusCode,403,'user_metadata não concede acesso');

  res=reply();
  await adminOnly(handler,{authenticate:as({id:'u1',app_metadata:{role:'admin'}}),env:{}})({headers:{}},res);
  assert.deepEqual([res.statusCode,res.body],[200,{ok:true,user:'u1'}]);

  res=reply();
  await adminOnly(handler,{authenticate:as({id:'u2'}),env:{IG_PUBLISH_ADMIN_IDS:'u1, u2'}})({headers:{}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.headers['Cache-Control'],'no-store');
});

test('o roteador bloqueia /api/erp/* sem token antes de tocar no banco', async()=>{
  for(const route of ['erp/dashboard','erp/products','erp/categories','erp/stock','erp/customers','erp/sales','erp/finance','erp/commerce','erp/upload']){
    const res=reply();
    await router({method:'GET',headers:{},query:{route},url:`/api/${route}`},res);
    assert.equal(res.statusCode,401,route);
  }
});
