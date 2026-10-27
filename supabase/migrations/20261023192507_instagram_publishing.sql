create table public.ig_publish_settings (
  id integer primary key check(id=1), enabled boolean not null default false,
  last_runner_at timestamptz, updated_at timestamptz not null default now()
);
insert into public.ig_publish_settings(id) values(1);
create table public.ig_publish_templates (
  id uuid primary key default gen_random_uuid(), name text not null,
  config jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.ig_publish_templates(name,config) values
('Destaque marinho','{"layout":"classic","background":"#062d36","accent":"#60dfc8","foreground":"#ffffff","title":"Destaque da loja","footer":"Conheça na loja online • @valentefish","caption":"{nome} na Valente Fish. {preco}\nConheça: {link}\n#ValenteFish #AquarismoMarinho","showPrice":true,"logoUrl":"/valente-fish-logo.png","photoPosition":"top"}'),
('Seleção de corais','{"layout":"editorial","background":"#f4efe6","accent":"#ca744f","foreground":"#173e45","title":"Uma seleção especial","footer":"Valente Fish • Aquarismo marinho","caption":"Conheça {nome}.\n{link}\n#ValenteFish #Corais","showPrice":false,"logoUrl":"/valente-fish-logo.png","photoPosition":"top"}'),
('Vitrine tropical','{"layout":"bold","background":"#152937","accent":"#ffcf67","foreground":"#ffffff","title":"Seu próximo destaque","footer":"Confira os detalhes na loja online","caption":"{nome} • {categoria}\n{preco}\n{link}\n#ValenteFish","showPrice":true,"logoUrl":"/valente-fish-logo.png","photoPosition":"bottom"}');
create table public.ig_publish_schedules (
  id uuid primary key default gen_random_uuid(), name text not null,
  template_id uuid not null references public.ig_publish_templates(id),
  format text not null check(format in ('feed','story')), category text,
  days integer[] not null, hours text[] not null,
  repeat_days integer not null default 7 check(repeat_days between 1 and 90),
  enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ig_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.ig_publish_schedules(id),
  product_id uuid references public.products(id) on delete set null,
  scheduled_at timestamptz not null, format text not null check(format in ('feed','story')),
  template_config jsonb not null, schedule_fingerprint text not null,
  status text not null default 'queued' check(status in ('queued','rendering','processing','publishing','published','failed','uncertain','skipped')),
  claim_token uuid, lease_until timestamptz,
  fingerprint text, caption text, asset_url text, container_id text, media_id text,
  error_message text, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(schedule_id,scheduled_at)
);
create index ig_publish_jobs_queue_idx on public.ig_publish_jobs(status,scheduled_at);
create index ig_publish_jobs_product_idx on public.ig_publish_jobs(product_id,scheduled_at desc);
create trigger ig_publish_settings_updated before update on public.ig_publish_settings for each row execute function private.set_updated_at();
create trigger ig_publish_templates_updated before update on public.ig_publish_templates for each row execute function private.set_updated_at();
create trigger ig_publish_schedules_updated before update on public.ig_publish_schedules for each row execute function private.set_updated_at();
create trigger ig_publish_jobs_updated before update on public.ig_publish_jobs for each row execute function private.set_updated_at();
alter table public.ig_publish_settings enable row level security;
alter table public.ig_publish_templates enable row level security;
alter table public.ig_publish_schedules enable row level security;
alter table public.ig_publish_jobs enable row level security;
revoke all on public.ig_publish_settings,public.ig_publish_templates,public.ig_publish_schedules,public.ig_publish_jobs from public,anon,authenticated;
grant all on public.ig_publish_settings,public.ig_publish_templates,public.ig_publish_schedules,public.ig_publish_jobs to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values ('instagram-publishing','instagram-publishing',true,8388608)
on conflict(id) do nothing;
-- No public upload policy: only server service-role writes generated assets.
