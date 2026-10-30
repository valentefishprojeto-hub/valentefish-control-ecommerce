-- Papel do usuário no próprio profile: 'cliente' (padrão) ou 'admin' (acesso ao ERP).
alter table public.profiles
  add column if not exists role text not null default 'cliente' check (role in ('cliente','admin'));

-- O site grava o próprio profile (upsert de nome/telefone/avatar). Sem restringir as colunas,
-- qualquer cliente poderia se promover a admin; então role só muda por SQL/servidor.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, full_name, phone, avatar_url) on public.profiles to authenticated;
grant update (id, full_name, phone, avatar_url) on public.profiles to authenticated;

-- Segunda barreira: mesmo que alguém conceda a coluna no futuro, cliente logado não troca o role.
create or replace function private.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.role := 'cliente';
    else
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before insert or update on public.profiles
for each row execute function private.protect_profile_role();

-- Conta de administração da loja.
insert into public.profiles (id, role)
select u.id, 'admin' from auth.users u where lower(u.email) = 'admin@valentefish.com'
on conflict (id) do update set role = 'admin';
