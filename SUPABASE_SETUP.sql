-- E-gate Supabase setup
-- Run this once in Supabase → SQL Editor → New query → Run.
-- If upgrading from v1.0: run the ALTER TABLE lines at the bottom too.

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
  is_active boolean not null default true,
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
create index if not exists submissions_gate_email_idx on public.submissions (gate_id, listener_email);

-- 2) Storage bucket for tracks and cover art
insert into storage.buckets (id, name, public)
values ('egate', 'egate', false)
on conflict (id) do update set public = excluded.public;

-- 3) Atomic counter RPCs (no race conditions)
create or replace function increment_view(gate_id_arg text)
returns void language sql security definer as $$
  update public.gates set view_count = view_count + 1 where id = gate_id_arg;
$$;

create or replace function increment_complete(gate_id_arg text)
returns void language sql security definer as $$
  update public.gates set complete_count = complete_count + 1 where id = gate_id_arg;
$$;

-- 4) RLS disabled (service_role key used server-side only)
alter table public.gates disable row level security;
alter table public.submissions disable row level security;

-- ──────────────────────────────────────────────────────────────────
-- UPGRADE from v1.0 → v1.1 (run only if you had a previous install)
-- ──────────────────────────────────────────────────────────────────
-- alter table public.gates add column if not exists is_active boolean not null default true;
