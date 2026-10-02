alter table public.products
  add column if not exists media jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('product-media','product-media',true,52428800)
on conflict (id) do update set public=true, file_size_limit=52428800;

drop policy if exists product_media_select on storage.objects;
drop policy if exists product_media_insert on storage.objects;
drop policy if exists product_media_update on storage.objects;

create policy product_media_select on storage.objects
  for select to public
  using (bucket_id='product-media');

create policy product_media_insert on storage.objects
  for insert to public
  with check (bucket_id='product-media');

create policy product_media_update on storage.objects
  for update to public
  using (bucket_id='product-media')
  with check (bucket_id='product-media');
