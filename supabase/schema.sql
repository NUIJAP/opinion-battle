-- ============================================================
-- 立場 BATTLE  — Supabase schema (Phase 1 MVP)
-- Run this in the Supabase SQL Editor.
-- Matches PROJECT_SPEC.md §6 with minor additions for Phase 1.
-- ============================================================

-- For Postgres UUID generation.
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- themes
-- ------------------------------------------------------------
create table if not exists public.themes (
  id            uuid primary key default gen_random_uuid(),
  title         varchar(200) not null,
  description   text,
  stance_a_name    varchar(100) not null,
  stance_b_name    varchar(100) not null,
  stance_a_summary varchar(500) not null,
  stance_b_summary varchar(500) not null,
  news_url      varchar(500),
  news_date     timestamptz,
  difficulty    int check (difficulty between 1 and 5) default 2,
  active        boolean default true,
  created_at    timestamptz default now()
);

create index if not exists idx_themes_active on public.themes(active);
create index if not exists idx_themes_created_at on public.themes(created_at desc);

-- ------------------------------------------------------------
-- users  (Phase 1: optional, used in Phase 2 when auth is added)
-- ------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         varchar(255) unique,
  name          varchar(100),
  total_score   int default 0,
  win_count     int default 0,
  loss_count    int default 0,
  battle_count  int default 0,
  streak_days   int default 0,
  last_played   timestamptz,
  pro_member    boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ------------------------------------------------------------
-- battles
-- ------------------------------------------------------------
create table if not exists public.battles (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references public.users(id) on delete set null,
  theme_id                  uuid references public.themes(id) on delete cascade,
  user_stance               varchar(100),
  final_user_hp             int,
  final_ai_hp               int,
  result                    varchar(10) check (result in ('win','loss','draw')),
  score                     int,
  rounds_won                int,
  battle_history            jsonb,
  player_count              int default 1,
  played_duration_seconds   int,
  created_at                timestamptz default now()
);

create index if not exists idx_battles_user_id on public.battles(user_id);
create index if not exists idx_battles_theme_id on public.battles(theme_id);
create index if not exists idx_battles_created_at on public.battles(created_at desc);

-- ------------------------------------------------------------
-- ai_patterns (Phase 3 learning loop — created now to avoid later migration)
-- ------------------------------------------------------------
create table if not exists public.ai_patterns (
  id                       uuid primary key default gen_random_uuid(),
  theme_id                 uuid references public.themes(id) on delete cascade,
  pattern_name             varchar(200),
  pattern_description      text,
  effectiveness_score      double precision,
  user_conviction_count    int default 0,
  example_statement        text,
  last_updated             timestamptz default now()
);

create index if not exists idx_ai_patterns_theme_id on public.ai_patterns(theme_id);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Phase 1 strategy:
--   - themes:        PUBLIC READ (anon can browse active themes)
--   - battles:       PUBLIC READ (leaderboards later), writes via service-role only
--   - users:         no anon access (auth in Phase 2)
--   - ai_patterns:   no anon access
-- The server-side API routes use SUPABASE_SERVICE_ROLE_KEY to bypass RLS.

alter table public.themes       enable row level security;
alter table public.battles      enable row level security;
alter table public.users        enable row level security;
alter table public.ai_patterns  enable row level security;

-- themes: anyone can read active themes
drop policy if exists "themes_public_read" on public.themes;
create policy "themes_public_read"
  on public.themes
  for select
  using (active = true);

-- battles: anyone can read (used for score aggregates)
drop policy if exists "battles_public_read" on public.battles;
create policy "battles_public_read"
  on public.battles
  for select
  using (true);

-- users / ai_patterns: service-role only (default — no policies = no anon access with RLS on)
