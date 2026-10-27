create table public.ig_conversations (
  id uuid primary key default gen_random_uuid(),
  igsid text not null unique,
  username text,
  status text not null default 'bot' check (status in ('bot','human','closed')),
  paused_until timestamptz,
  last_customer_message_at timestamptz,
  handoff_reason text,
  order_lookup_attempts integer not null default 0 check (order_lookup_attempts >= 0),
  order_lookup_window_start timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ig_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ig_conversations(id) on delete cascade,
  mid text not null unique,
  direction text not null check (direction in ('in','out')),
  author text not null check (author in ('customer','bot','human')),
  text text,
  attachments jsonb not null default '[]'::jsonb,
  tool_calls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index ig_messages_conversation_time_idx on public.ig_messages(conversation_id,created_at desc);
create index ig_messages_retention_idx on public.ig_messages(created_at);
create table public.ig_handoffs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ig_conversations(id) on delete cascade,
  reason text not null,
  summary text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index ig_handoffs_one_open_idx on public.ig_handoffs(conversation_id) where resolved_at is null;
create trigger ig_conversations_set_updated_at before update on public.ig_conversations
  for each row execute function private.set_updated_at();
alter table public.ig_conversations enable row level security;
alter table public.ig_messages enable row level security;
alter table public.ig_handoffs enable row level security;
revoke all on public.ig_conversations,public.ig_messages,public.ig_handoffs from public,anon,authenticated;
grant all on public.ig_conversations,public.ig_messages,public.ig_handoffs to service_role;
