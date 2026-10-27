import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectConfig} from './config.js';
const configured={DATABASE_URL:'postgres://user:secret@db.test/store',APP_URL:'https://loja.test',IG_BUSINESS_ID:'123',IG_ACCESS_TOKEN:'secret-token',META_GRAPH_VERSION:'v26.0',META_APP_SECRET:'secret-app',META_VERIFY_TOKEN:'secret-verify',ANTHROPIC_API_KEY:'secret-key',ANTHROPIC_MODEL:'chosen-model',IG_BOT_ENABLED:'false'};
test('diagnóstico distingue configuração, ativação e conexão sem revelar segredos',()=>{
  assert.equal(inspectConfig({}).configured,false);
  const report=inspectConfig(configured);
  assert.equal(report.configured,true);assert.equal(report.enabled,false);assert.equal(report.connectionVerified,false);
  for(const secret of ['secret-token','secret-app','secret-verify','secret-key','postgres://']) assert.equal(JSON.stringify(report).includes(secret),false);
});
test('diagnóstico rejeita formatos inválidos e dry-run em produção',()=>{
  for(const [key,value] of Object.entries({APP_URL:'http://localhost',IG_BUSINESS_ID:'@tironitech',META_GRAPH_VERSION:'latest',IG_BOT_ENABLED:'yes',IG_HUMAN_PAUSE_HOURS:'NaN'})) assert.equal(inspectConfig({...configured,[key]:value}).configured,false,key);
  assert.equal(inspectConfig({...configured,VERCEL_ENV:'production',IG_DRY_RUN:'true'}).configured,false);
  assert.throws(()=>inspectConfig({},{scope:'unknown'}));
});
test('publicação exige armazenamento, segredo e chave de ativação',()=>{
  assert.equal(inspectConfig(configured,{scope:'publishing'}).configured,false);
  assert.equal(inspectConfig({...configured,SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret-storage',CRON_SECRET:'secret-cron',IG_PUBLISH_ENABLED:'false'},{scope:'publishing'}).configured,true);
});
