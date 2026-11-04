alter table public.animal_memory add column rj_names text[] not null default '{}';
alter table public.animal_memory add constraint animal_memory_rj_names_limit check (cardinality(rj_names) <= 20);
