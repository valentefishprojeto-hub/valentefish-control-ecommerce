create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Principal',
  recipient_name text not null,
  phone text,
  postal_code text not null,
  street text not null,
  number text not null,
  complement text,
  district text not null,
  city text not null,
  state text not null check (char_length(state) = 2),
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null check (category in ('peixes','corais','racoes','filtragem','tratamentos')),
  price_cents integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents >= price_cents),
  image_url text,
  badge text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  weight_grams integer not null default 500 check (weight_grams > 0),
  width_cm numeric(8,2) not null default 15 check (width_cm > 0),
  height_cm numeric(8,2) not null default 15 check (height_cm > 0),
  length_cm numeric(8,2) not null default 15 check (length_cm > 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  guest_token uuid unique,
  status text not null default 'active' check (status in ('active','converted','abandoned')),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (user_id is not null or guest_token is not null)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 99),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cart_id, product_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  user_id uuid references public.profiles(id) on delete set null,
  customer_email text not null,
  customer_name text not null,
  customer_phone text,
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','processing','shipped','delivered','cancelled','refunded')),
  payment_status text not null default 'pending' check (payment_status in ('pending','authorized','paid','failed','cancelled','refunded','partially_refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled','preparing','shipped','delivered','returned')),
  currency text not null default 'BRL' check (currency = 'BRL'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  shipping_address jsonb not null,
  billing_address jsonb,
  shipping_service text,
  shipping_service_id text,
  shipping_deadline_days integer,
  notes text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  product_name text not null,
  product_image_url text,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  total_cents integer not null check (total_cents >= 0),
  product_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'mercado_pago' check (provider = 'mercado_pago'),
  provider_payment_id text unique,
  provider_preference_id text,
  method text check (method in ('pix','credit_card','debit_card','boleto','unknown')),
  status text not null default 'pending',
  amount_cents integer not null check (amount_cents >= 0),
  installments integer,
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_expires_at timestamptz,
  raw_status jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid references public.carts(id) on delete cascade,
  postal_code text not null,
  provider text not null default 'melhor_envio',
  service_id text not null,
  service_name text not null,
  company_name text,
  price_cents integer not null check (price_cents >= 0),
  delivery_min_days integer not null check (delivery_min_days >= 0),
  delivery_max_days integer not null check (delivery_max_days >= delivery_min_days),
  quote_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null default 'melhor_envio',
  provider_shipment_id text unique,
  service_name text,
  tracking_code text,
  tracking_url text,
  label_url text,
  status text not null default 'pending' check (status in ('pending','label_created','posted','in_transit','out_for_delivery','delivered','exception','returned','cancelled')),
  estimated_delivery_at timestamptz,
  posted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  event_code text,
  status text not null,
  description text not null,
  location text,
  happened_at timestamptz not null,
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('mercado_pago','melhor_envio')),
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_event_id)
);

create index addresses_user_id_idx on public.addresses(user_id);
create unique index addresses_one_default_per_user_idx on public.addresses(user_id) where is_default;
create index products_category_active_idx on public.products(category, active);
create index carts_user_status_idx on public.carts(user_id, status);
create index cart_items_cart_id_idx on public.cart_items(cart_id);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_status_idx on public.orders(status);
create index order_items_order_id_idx on public.order_items(order_id);
create index payments_order_id_idx on public.payments(order_id);
create index shipping_quotes_cart_id_idx on public.shipping_quotes(cart_id);
create index shipment_events_shipment_time_idx on public.shipment_events(shipment_id, happened_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger addresses_set_updated_at before update on public.addresses for each row execute function private.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function private.set_updated_at();
create trigger carts_set_updated_at before update on public.carts for each row execute function private.set_updated_at();
create trigger cart_items_set_updated_at before update on public.cart_items for each row execute function private.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function private.set_updated_at();
create trigger shipments_set_updated_at before update on public.shipments for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.shipping_quotes enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.webhook_events enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "addresses_select_own" on public.addresses for select to authenticated using ((select auth.uid()) = user_id);
create policy "addresses_insert_own" on public.addresses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "addresses_update_own" on public.addresses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "addresses_delete_own" on public.addresses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "products_public_read" on public.products for select to anon, authenticated using (active);

create policy "carts_select_own" on public.carts for select to authenticated using ((select auth.uid()) = user_id);
create policy "carts_insert_own" on public.carts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "carts_update_own" on public.carts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "carts_delete_own" on public.carts for delete to authenticated using ((select auth.uid()) = user_id);

create policy "cart_items_select_own" on public.cart_items for select to authenticated using (
  exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = (select auth.uid()))
);
create policy "cart_items_insert_own" on public.cart_items for insert to authenticated with check (
  exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = (select auth.uid()))
);
create policy "cart_items_update_own" on public.cart_items for update to authenticated using (
  exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = (select auth.uid()))
);
create policy "cart_items_delete_own" on public.cart_items for delete to authenticated using (
  exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = (select auth.uid()))
);

create policy "orders_select_own" on public.orders for select to authenticated using ((select auth.uid()) = user_id);
create policy "order_items_select_own" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = (select auth.uid()))
);
create policy "payments_select_own" on public.payments for select to authenticated using (
  exists (select 1 from public.orders where orders.id = payments.order_id and orders.user_id = (select auth.uid()))
);
create policy "shipping_quotes_select_own" on public.shipping_quotes for select to authenticated using (
  exists (select 1 from public.carts where carts.id = shipping_quotes.cart_id and carts.user_id = (select auth.uid()))
);
create policy "shipments_select_own" on public.shipments for select to authenticated using (
  exists (select 1 from public.orders where orders.id = shipments.order_id and orders.user_id = (select auth.uid()))
);
create policy "shipment_events_select_own" on public.shipment_events for select to authenticated using (
  exists (
    select 1
    from public.shipments
    join public.orders on orders.id = shipments.order_id
    where shipments.id = shipment_events.shipment_id
      and orders.user_id = (select auth.uid())
  )
);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.products to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses, public.carts, public.cart_items to authenticated;
grant select on public.orders, public.order_items, public.payments, public.shipping_quotes, public.shipments, public.shipment_events to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into public.products (sku, slug, name, description, category, price_cents, image_url, badge, stock_quantity, weight_grams)
values
  ('VF-PEI-001','peixe-palhaco-premium','Peixe-palhaço Premium','Animal selecionado, quarentenado e acompanhado pela equipe Valente Fish.','peixes',28900,'/store/product-fish-clown.png','Quarentenado',8,700),
  ('VF-PEI-002','yellow-tang','Yellow Tang','Exemplar selecionado e preparado para uma adaptação segura ao novo aquário.','peixes',84900,'/store/product-fish-yellow.png','Quarentenado',4,900),
  ('VF-COR-001','coral-hammer-green','Coral Hammer Green','Coral selecionado por coloração, saúde e estrutura.','corais',37900,'/store/product-coral.png','Cultivo selecionado',6,600),
  ('VF-TRA-001','flatworm-rx-blue-vet','Flatworm Rx Blue Vet','Tratamento especializado para manutenção do aquário.','tratamentos',24990,'/store/product-flatworm.webp',null,12,300),
  ('VF-TRA-002','green-cyano-rx-blue-life','Green Cyano Rx Blue Life','Solução especializada para controle de cianobactérias.','tratamentos',21990,'/store/product-green-cyano.webp','Novidade',10,300),
  ('VF-TRA-003','red-cyano-rx-blue-life','Red Cyano Rx Blue Life','Solução especializada para manutenção do aquário.','tratamentos',21990,'/store/product-red-cyano.webp',null,10,300),
  ('VF-RAC-001','alga-nori-green-140g','Alga Nori Green 140g','Alimentação complementar para peixes marinhos.','racoes',7490,'/store/product-nori.webp',null,18,250),
  ('VF-RAC-002','vitalis-marine-grazer-240g','Vitalis Marine Grazer 240g','Nutrição completa de alta qualidade para peixes marinhos.','racoes',16490,'/store/product-vitalis-240.webp','Recomendado',16,350),
  ('VF-RAC-003','vitalis-marine-grazer-120g','Vitalis Marine Grazer 120g','Nutrição completa para a rotina alimentar do aquário.','racoes',9990,'/store/product-vitalis-120.webp',null,20,230),
  ('VF-FIL-001','carcaca-slim-para-filtro','Carcaça Slim para Filtro','Componente para sistemas de filtragem e tratamento de água.','filtragem',12990,'/store/product-filter.jpg',null,9,1600),
  ('VF-FIL-002','osmose-reversa-4-estagios','Osmose Reversa 4 Estágios','Sistema de osmose reversa para água de alta pureza.','filtragem',124990,'/store/product-osmosis.jpg','Envio nacional',5,6500)
on conflict (slug) do update set
  sku = excluded.sku,
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  price_cents = excluded.price_cents,
  image_url = excluded.image_url,
  badge = excluded.badge,
  stock_quantity = excluded.stock_quantity,
  weight_grams = excluded.weight_grams,
  updated_at = timezone('utc', now());
