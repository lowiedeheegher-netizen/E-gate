-- E-gate v4.0 upgrade
-- Run AFTER all previous SQL files

-- 1) Password reset tokens
create table if not exists public.password_reset_tokens (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.password_reset_tokens disable row level security;

-- 2) Email verification tokens
create table if not exists public.email_verification_tokens (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.email_verification_tokens disable row level security;

-- 3) Email verified flag + plan on users
alter table public.users add column if not exists email_verified boolean not null default false;
alter table public.users add column if not exists plan text not null default 'free';

-- 4) Geo + referrer on submissions
alter table public.submissions add column if not exists country_code text;
alter table public.submissions add column if not exists referrer text;

-- 5) Platform stats function (for landing page)
create or replace function platform_stats()
returns table(total_gates bigint, total_downloads bigint, total_artists bigint)
language sql security definer as $$
  select
    (select count(*) from public.gates where is_active=true)::bigint,
    (select count(*) from public.submissions)::bigint,
    (select count(*) from public.users)::bigint;
$$;

-- 6) Geo breakdown per artist
create or replace function geo_breakdown(artist_id_arg text)
returns table(country_code text, cnt bigint)
language sql security definer as $$
  select s.country_code, count(*)::bigint as cnt
  from public.submissions s
  join public.gates g on g.id = s.gate_id
  where g.artist_id = artist_id_arg and s.country_code is not null
  group by s.country_code order by cnt desc limit 20;
$$;

-- 7) Referrer breakdown per artist
create or replace function referrer_breakdown(artist_id_arg text)
returns table(referrer text, cnt bigint)
language sql security definer as $$
  select
    case
      when s.referrer ilike '%soundcloud%' then 'SoundCloud'
      when s.referrer ilike '%instagram%' then 'Instagram'
      when s.referrer ilike '%facebook%' then 'Facebook'
      when s.referrer ilike '%twitter%' or s.referrer ilike '%x.com%' then 'Twitter/X'
      when s.referrer ilike '%tiktok%' then 'TikTok'
      when s.referrer ilike '%youtube%' then 'YouTube'
      when s.referrer is null or s.referrer = '' then 'Direct'
      else 'Overig'
    end as referrer,
    count(*)::bigint as cnt
  from public.submissions s
  join public.gates g on g.id = s.gate_id
  where g.artist_id = artist_id_arg
  group by 1 order by cnt desc;
$$;
