create table if not exists public.store_visitors (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'direct',
  referrer text,
  last_path text,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.store_visitors(id) on delete cascade,
  event_type text not null check (event_type in ('page_view','search','add_to_cart','cart_view','checkout','cart_snapshot')),
  path text,
  query text,
  product_name text,
  source text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists store_visitors_source_idx on public.store_visitors(source, last_seen_at desc);
create index if not exists store_events_type_idx on public.store_events(event_type, created_at desc);
create index if not exists store_events_visitor_idx on public.store_events(visitor_id, created_at desc);
create index if not exists store_events_query_idx on public.store_events(query) where query is not null;

alter table public.store_visitors enable row level security;
alter table public.store_events enable row level security;
grant all on public.store_visitors, public.store_events to service_role;
