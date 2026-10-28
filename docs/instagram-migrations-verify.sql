-- Conferência SOMENTE LEITURA das migrations do Instagram.
-- Rode no Supabase > SQL Editor. Não cria, altera nem apaga nada.
-- Esperado: todas as linhas com ok = true.

with expected(table_name, columns) as (values
  ('ig_conversations', 11), ('ig_messages', 9), ('ig_handoffs', 6),
  ('ig_publish_settings', 4), ('ig_publish_templates', 5),
  ('ig_publish_schedules', 11), ('ig_publish_jobs', 19)
)
select 'tabela ' || e.table_name as check,
       coalesce(c.n, 0) || ' colunas (esperado ' || e.columns || ')' as detalhe,
       coalesce(c.n, 0) = e.columns as ok
from expected e
left join (
  select table_name, count(*)::int n from information_schema.columns
  where table_schema = 'public' group by table_name
) c using (table_name)

union all
select 'RLS ativo em ' || relname, relrowsecurity::text, relrowsecurity
from pg_class where relnamespace = 'public'::regnamespace and relname like 'ig\_%' and relkind = 'r'

union all
select 'anon/authenticated sem acesso às tabelas ig_*',
       count(*) || ' permissões encontradas', count(*) = 0
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'ig\_%' and grantee in ('anon', 'authenticated', 'PUBLIC')

union all
select 'service_role com acesso',
       count(distinct table_name) || ' de 7 tabelas', count(distinct table_name) = 7
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'ig\_%' and grantee = 'service_role'

union all
select 'linha de configuração (ig_publish_settings id=1)',
       count(*)::text, count(*) = 1
from public.ig_publish_settings where id = 1

union all
select 'modelos iniciais', count(*) || ' modelos', count(*) >= 3
from public.ig_publish_templates

union all
select 'triggers updated_at', count(*) || ' de 5', count(*) = 5
from pg_trigger where not tgisinternal and tgname in (
  'ig_conversations_set_updated_at', 'ig_publish_settings_updated', 'ig_publish_templates_updated',
  'ig_publish_schedules_updated', 'ig_publish_jobs_updated')

union all
select 'bucket instagram-publishing', coalesce(max(public::text), 'ausente'), count(*) = 1
from storage.buckets where id = 'instagram-publishing';
