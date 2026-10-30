import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';

// Real embedded Postgres, no remote credentials; adapters only bind template values.
export async function testDatabase(){
  const pg=new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb,phone text);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    create table storage.objects(id uuid,bucket_id text);`);
  const dir=new URL('../../../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()){
    const source=await readFile(new URL(name,dir),'utf8');
    await pg.exec(source.replace('create extension if not exists pgcrypto;',''));
  }
  function adapter(client){
    const sql=async(strings,...values)=>{
      const query=strings.reduce((text,part,i)=>text+(i?'$'+i:'')+part,'');
      return (await client.query(query,values)).rows;
    };
    sql.json=value=>JSON.stringify(value);
    sql.begin=fn=>client.transaction(tx=>fn(adapter(tx)));
    return sql;
  }
  return {sql:adapter(pg),pg,close:()=>pg.close()};
}
