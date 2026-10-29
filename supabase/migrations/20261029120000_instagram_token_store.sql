-- Token do Instagram renovado automaticamente (uma única linha, só o servidor acessa).
-- env_hash identifica de qual IG_ACCESS_TOKEN da Vercel ele veio: trocar a variável reinicia o ciclo.
create table public.ig_credentials (
  id integer primary key check (id = 1),
  access_token text not null,
  env_hash text not null,
  business_id text,
  expires_at timestamptz,
  refreshed_at timestamptz not null default now(),
  last_check_at timestamptz,
  last_check_ok boolean,
  updated_at timestamptz not null default now()
);
create trigger ig_credentials_updated before update on public.ig_credentials
  for each row execute function private.set_updated_at();
alter table public.ig_credentials enable row level security;
revoke all on public.ig_credentials from public,anon,authenticated;
grant all on public.ig_credentials to service_role;
