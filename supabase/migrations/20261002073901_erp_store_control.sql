create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.categories (slug, name, description, sort_order)
values
  ('peixes','Peixes','Animais selecionados e quarentenados.',1),
  ('corais','Corais','Corais escolhidos por coloração e saúde.',2),
  ('racoes','Rações','Nutrição para a rotina do aquário.',3),
  ('filtragem','Filtragem','Equipamentos para qualidade da água.',4),
  ('tratamentos','Tratamentos','Soluções para manutenção do aquário.',5)
on conflict (slug) do update set
  name=excluded.name,
  description=excluded.description,
  sort_order=excluded.sort_order;

alter table public.products drop constraint if exists products_category_check;
alter table public.products add column if not exists category_id uuid references public.categories(id);
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists featured_rank integer not null default 0;

update public.products p
set category_id=c.id
from public.categories c
where p.category_id is null and c.slug=p.category;

update public.products
set featured=true
where featured=false and active=true;

create table if not exists public.store_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  customer_id uuid references public.store_customers(id) on delete set null,
  customer_name text not null,
  channel text not null default 'loja' check (channel in ('loja','site')),
  status text not null default 'paid' check (status in ('open','paid','cancelled')),
  payment_method text not null default 'pix' check (payment_method in ('dinheiro','pix','cartao','transferencia','outros')),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  notes text,
  sold_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('entrada','saida','ajuste','venda')),
  quantity integer not null,
  reason text,
  sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('receita','despesa')),
  category text not null default 'geral',
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  sale_id uuid references public.sales(id) on delete set null,
  due_on date,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists categories_active_sort_idx on public.categories(active, sort_order, name);
create index if not exists products_featured_idx on public.products(featured, active);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists store_customers_name_idx on public.store_customers(full_name);
create index if not exists sales_sold_at_idx on public.sales(sold_at desc);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id, created_at desc);
create index if not exists finance_entries_kind_idx on public.finance_entries(kind, created_at desc);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories for each row execute function private.set_updated_at();
drop trigger if exists store_customers_set_updated_at on public.store_customers;
create trigger store_customers_set_updated_at before update on public.store_customers for each row execute function private.set_updated_at();
drop trigger if exists sales_set_updated_at on public.sales;
create trigger sales_set_updated_at before update on public.sales for each row execute function private.set_updated_at();
drop trigger if exists finance_entries_set_updated_at on public.finance_entries;
create trigger finance_entries_set_updated_at before update on public.finance_entries for each row execute function private.set_updated_at();

create or replace function private.enforce_featured_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.featured and new.active then
    if (
      select count(*) from public.products
      where featured=true and active=true and id is distinct from new.id
    ) >= 40 then
      raise exception 'A vitrine comporta no máximo 40 produtos em destaque';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_featured_limit on public.products;
create trigger products_featured_limit
before insert or update of featured, active on public.products
for each row execute function private.enforce_featured_limit();

alter table public.categories enable row level security;
alter table public.store_customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.finance_entries enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select to anon, authenticated using (active);

grant select on public.categories to anon, authenticated;
grant all on public.categories, public.store_customers, public.sales, public.sale_items, public.stock_movements, public.finance_entries to service_role;
grant usage, select on all sequences in schema public to service_role;
