-- E-gate v3.0 — Multi-artist SaaS
-- Run AFTER SUPABASE_SETUP.sql + SUPABASE_UPDATE_V2.sql

-- 1) Artists table
create table if not exists public.users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  artist_name text not null,
  artist_slug text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'trial',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
create index if not exists users_email_idx on public.users (email);
create index if not exists users_slug_idx  on public.users (artist_slug);

-- 2) Payments log
create table if not exists public.payments (
  id text primary key,
  user_id text references public.users(id) on delete set null,
  stripe_invoice_id text,
  amount_cents integer not null,
  currency text not null default 'eur',
  status text not null,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_created_idx on public.payments (created_at desc);

-- 3) Top-level genre + sc_preview_url on gates (faster queries)
alter table public.gates add column if not exists genre text;
alter table public.gates add column if not exists sc_preview_url text;

-- 4) Disable RLS
alter table public.users    disable row level security;
alter table public.payments disable row level security;

-- 5) Top 100 chart (30 days)
create or replace function top_gates_30d(limit_arg integer default 100)
returns table(
  slug text, track_name text, artist_name text,
  cover_art text, genre text, sc_preview_url text, downloads_30d bigint
) language sql security definer as $$
  select g.slug, g.track_name, g.artist_name, g.cover_art, g.genre, g.sc_preview_url,
    count(s.id)::bigint as downloads_30d
  from public.gates g
  left join public.submissions s
    on s.gate_id = g.id and s.created_at >= now() - interval '30 days'
  where g.is_active = true
  group by g.slug, g.track_name, g.artist_name, g.cover_art, g.genre, g.sc_preview_url
  having count(s.id) > 0
  order by downloads_30d desc
  limit limit_arg;
$$;

-- 6) Similar gates for recommendations
create or replace function similar_gates(current_id text, genre_arg text, lim integer default 3)
returns table(slug text, track_name text, artist_name text, cover_art text, sc_preview_url text)
language sql security definer as $$
  (select g.slug, g.track_name, g.artist_name, g.cover_art, g.sc_preview_url
   from public.gates g
   where g.is_active = true and g.id != current_id and genre_arg is not null and g.genre = genre_arg
   order by g.complete_count desc limit lim)
  union all
  (select g.slug, g.track_name, g.artist_name, g.cover_art, g.sc_preview_url
   from public.gates g
   where g.is_active = true and g.id != current_id and (genre_arg is null or g.genre != genre_arg)
   order by g.complete_count desc limit lim)
  limit lim;
$$;
