-- E-gate v2.0 upgrade
-- Run in Supabase → SQL Editor → New query → Run
-- Safe to run on existing databases (uses IF NOT EXISTS / OR REPLACE)

-- 1) Step funnel tracking
create table if not exists public.step_events (
  id text primary key,
  gate_id text not null references public.gates(id) on delete cascade,
  step_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists step_events_gate_step_idx
  on public.step_events (gate_id, step_id);

-- 2) Referral system
create table if not exists public.referrals (
  id text primary key,
  gate_id text not null references public.gates(id) on delete cascade,
  referral_code text not null unique,
  referrer_submission_id text references public.submissions(id) on delete set null,
  used_count integer not null default 0,
  reward_token text,
  created_at timestamptz not null default now()
);
create index if not exists referrals_code_idx on public.referrals (referral_code);
create index if not exists referrals_gate_idx  on public.referrals (gate_id, referrer_submission_id);

-- 3) Add ref_code to submissions (which referral link brought them here)
alter table public.submissions add column if not exists ref_code text;

-- 4) Atomic step event increment for referrals
create or replace function increment_referral_used(code_arg text)
returns void language sql security definer as $$
  update public.referrals set used_count = used_count + 1 where referral_code = code_arg;
$$;

-- 5) Disable RLS for new tables
alter table public.step_events disable row level security;
alter table public.referrals   disable row level security;
