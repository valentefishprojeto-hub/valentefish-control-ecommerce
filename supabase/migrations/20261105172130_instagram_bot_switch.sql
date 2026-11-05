-- Interruptor global do atendimento automático. O horário de ativação impede
-- que eventos recebidos durante a pausa respondam quando o bot voltar.
create table public.ig_bot_settings (
  id integer primary key check (id = 1),
  enabled boolean not null default true,
  enabled_at timestamptz not null default '1970-01-01T00:00:00Z',
  updated_at timestamptz not null default now()
);
create trigger ig_bot_settings_updated before update on public.ig_bot_settings
  for each row execute function private.set_updated_at();
alter table public.ig_bot_settings enable row level security;
revoke all on public.ig_bot_settings from public,anon,authenticated;
grant all on public.ig_bot_settings to service_role;
insert into public.ig_bot_settings(id,enabled) values (1,true);
