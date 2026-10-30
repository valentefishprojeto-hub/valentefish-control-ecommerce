import test from 'node:test';
import assert from 'node:assert/strict';
import {poolerUrl} from './db.js';

test('pooler do Supabase: modo sessão vira modo transação, o resto fica igual',()=>{
  assert.equal(poolerUrl('postgresql://u:p%40ss@aws-0-sa-east-1.pooler.supabase.com:5432/postgres'),'postgresql://u:p%40ss@aws-0-sa-east-1.pooler.supabase.com:6543/postgres');
  assert.equal(poolerUrl('postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'),'postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres');
  assert.equal(poolerUrl('postgresql://u:p@db.abc.supabase.co:5432/postgres'),'postgresql://u:p@db.abc.supabase.co:5432/postgres');
  assert.equal(poolerUrl('não é url'),'não é url');
});
