-- Curadoria humana: o rascunho da IA não grava nesta tabela.
create table public.animal_memory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  scientific_name text not null check (length(trim(scientific_name)) between 3 and 180),
  popular_names text[] not null default '{}',
  confirmed_notes text not null default '',
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint animal_memory_names_limit check (cardinality(popular_names) <= 20)
);
create index animal_memory_scientific_idx on public.animal_memory (lower(scientific_name));
alter table public.animal_memory enable row level security;
revoke all on public.animal_memory from anon, authenticated;
grant all on public.animal_memory to service_role;
create trigger animal_memory_updated_at before update on public.animal_memory
  for each row execute function private.set_updated_at();
