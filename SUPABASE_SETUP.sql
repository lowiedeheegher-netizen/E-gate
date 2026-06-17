-- E-gate Supabase setup
-- Run this once in Supabase → SQL Editor → New query → Run.

-- 1) Database tables
create table if not exists public.gates (
  id text primary key,
  artist_id text not null default 'admin',
  slug text not null unique,
  track_name text not null,
  artist_name text not null,
  track_file text,
  track_original_name text,
  cover_art text,
  config jsonb not null default '{}'::jsonb,
  view_count integer not null default 0,
  complete_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id text primary key,
  gate_id text not null references public.gates(id) on delete cascade,
  listener_name text,
  listener_email text,
  sc_username text,
  sc_comment text,
  ig_username text,
  spotify_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists gates_artist_created_idx on public.gates (artist_id, created_at desc);
create index if not exists submissions_gate_created_idx on public.submissions (gate_id, created_at desc);

-- 2) Storage bucket for tracks and cover art
-- The bucket is private. Your Render server reads/writes it using SUPABASE_SERVICE_ROLE_KEY.
insert into storage.buckets (id, name, public)
values ('egate', 'egate', false)
on conflict (id) do update set public = excluded.public;

-- 3) Optional: keep RLS disabled for this private server-side app.
-- The service_role key bypasses RLS anyway, and no Supabase key is exposed in the browser.
alter table public.gates disable row level security;
alter table public.submissions disable row level security;
