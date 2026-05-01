alter table if exists public.share_links
  add column if not exists password_hash text;

create table if not exists public.share_sessions (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid references public.share_links(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_share_sessions_event_id
  on public.share_sessions(event_id);

create index if not exists idx_share_sessions_expires_at
  on public.share_sessions(expires_at);

create table if not exists public.share_otps (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.share_links(id) on delete cascade,
  email text,
  phone text,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint share_otps_contact_check check (email is not null or phone is not null)
);

create index if not exists idx_share_otps_link_email
  on public.share_otps(share_link_id, lower(email));

create index if not exists idx_share_otps_link_phone
  on public.share_otps(share_link_id, phone);

alter table public.share_sessions enable row level security;
alter table public.share_otps enable row level security;
