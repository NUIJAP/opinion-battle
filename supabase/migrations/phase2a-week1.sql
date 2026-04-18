-- ============================================================
-- 立場BATTLE — Phase 2A Week 1 migration
-- Run AFTER schema.sql (Phase 1) + seed-themes.sql (Phase 1).
-- Adds: user_ranks, ai_levels, battle-level metadata.
-- No destructive operations — safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- AI levels: one row per character. Cached for fast reads.
-- ------------------------------------------------------------
create table if not exists public.ai_levels (
  id               int primary key check (id between 1 and 5),
  name_jp          varchar(50) not null,           -- 論理くん / データ部長 / ...
  emoji            varchar(8) not null,            -- 🌱 / 📖 / ...
  tagline          varchar(200) not null,          -- Short character blurb
  prompt_hint      text not null,                  -- Style instructions for Claude
  min_rp_recommended int not null default 0,       -- suggested RP tier
  created_at       timestamptz default now()
);

insert into public.ai_levels (id, name_jp, emoji, tagline, prompt_hint, min_rp_recommended) values
  (
    1,
    '論理くん',
    '🌱',
    '一般論とふわっとした主張で議論する初学者。まだデータも具体例も使えない。',
    '主張は一般論・抽象論のみ。具体的な統計・数字・固有名詞は使わない。140字以内のシンプルな意見を述べる。論理展開は1段階のみ(深掘りしない)。敬語で穏やか。',
    0
  ),
  (
    2,
    'データ部長',
    '📖',
    '統計を振りかざす中堅。ただし都合の良い数字だけを選んでいることに本人は気づいていない。',
    '必ず具体的な数字・統計・パーセンテージを1つ以上含める。サンプルサイズや前提条件には触れない。権威的な口調(「明らかに」「データが示している」)を使う。ただし議論の焦点は狭い。',
    500
  ),
  (
    3,
    '皮肉先生',
    '🎯',
    '相手の弱点を的確に突く論客。皮肉と論理を使い分けるが、冷静さは保つ。',
    '相手の主張の弱点・論理的矛盾・前提の怪しさを1点突く。皮肉めいた切り返し(「それは本気で言っているのか」等)を使うが、感情的にはならない。論理展開は2段階。',
    2000
  ),
  (
    4,
    '古典派学者',
    '🔥',
    '哲学・歴史を引用する強豪。100年単位の視点で現代の議論を再定義してくる。',
    '過去の思想家・哲学者・歴史的事例を1つ引用する(カント、ミル、ロールズ、ハイエク、トクヴィル、ハンナ・アーレント等のいずれか)。目先の議論を長期的・原理的な問題に引き戻す。論理展開は3段階。やや格調高い文体。',
    5000
  ),
  (
    5,
    '真理の番人',
    '👑',
    '究極の論客。相手の思考パターンを先読みして退路を塞ぐ。',
    'ユーザーが陥りがちな論理的罠を事前に塞ぐ。複数の論点を織り交ぜ、逃げ道を残さない構成で主張する。冷徹だが敬意を失わない。論理展開は多層的。文末で必ず「では、あなたはどう応える?」のような問いを置き相手に考えさせる。',
    15000
  )
on conflict (id) do update set
  name_jp = excluded.name_jp,
  emoji = excluded.emoji,
  tagline = excluded.tagline,
  prompt_hint = excluded.prompt_hint,
  min_rp_recommended = excluded.min_rp_recommended;

-- ------------------------------------------------------------
-- Anonymous users: Phase 1 had no auth, Phase 2A still keeps it
-- anonymous, but assigns each browser a persistent pseudo-id
-- so rank can accumulate. Full auth comes in Phase 2B/2C.
-- ------------------------------------------------------------
create table if not exists public.anon_users (
  id            uuid primary key default gen_random_uuid(),
  display_name  varchar(60),
  created_at    timestamptz default now(),
  last_seen     timestamptz default now()
);

-- ------------------------------------------------------------
-- User ranks (1 row per anon_user). RP only increases.
-- Loss does not decrease RP (Duolingo-style soft design).
-- ------------------------------------------------------------
create table if not exists public.user_ranks (
  user_id       uuid primary key references public.anon_users(id) on delete cascade,
  rp            int not null default 0,
  highest_ai_level_beaten int not null default 0, -- 0-5
  total_battles int not null default 0,
  total_wins    int not null default 0,
  streak_days   int not null default 0,
  last_battle_date date,
  updated_at    timestamptz default now()
);

create index if not exists idx_user_ranks_rp on public.user_ranks(rp desc);

-- ------------------------------------------------------------
-- Theme mastery (1 row per (user, theme)). Tracks per-theme
-- progress so a user can be a specialist in one area.
-- ------------------------------------------------------------
create table if not exists public.theme_mastery (
  user_id       uuid references public.anon_users(id) on delete cascade,
  theme_id      uuid references public.themes(id) on delete cascade,
  wins          int not null default 0,
  losses        int not null default 0,
  highest_ai_level_beaten int not null default 0,
  updated_at    timestamptz default now(),
  primary key (user_id, theme_id)
);

-- ------------------------------------------------------------
-- Extend battles table: which AI level was faced, RP awarded.
-- ALTER is additive + nullable so existing Phase 1 rows are fine.
-- ------------------------------------------------------------
alter table public.battles
  add column if not exists ai_level          int references public.ai_levels(id),
  add column if not exists rp_awarded        int default 0,
  add column if not exists anon_user_id      uuid references public.anon_users(id) on delete set null;

create index if not exists idx_battles_anon_user on public.battles(anon_user_id);
create index if not exists idx_battles_ai_level on public.battles(ai_level);

-- ------------------------------------------------------------
-- Daily matchups cache: each user gets 3 precomputed matchups
-- per day (one AI level per theme). Saves recomputing on every
-- home page load and keeps the "today's challenges" feel.
-- ------------------------------------------------------------
create table if not exists public.daily_matchups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.anon_users(id) on delete cascade,
  matchup_date  date not null default current_date,
  theme_id      uuid not null references public.themes(id) on delete cascade,
  ai_level      int not null references public.ai_levels(id),
  slot          int not null check (slot between 1 and 3),
  difficulty_tag varchar(10) not null check (difficulty_tag in ('below','equal','above')),
  completed     boolean default false,
  created_at    timestamptz default now(),
  unique (user_id, matchup_date, slot)
);

create index if not exists idx_daily_matchups_user_date
  on public.daily_matchups(user_id, matchup_date);

-- ------------------------------------------------------------
-- RLS: ai_levels is public-readable, everything else is service-role only.
-- ------------------------------------------------------------
alter table public.ai_levels       enable row level security;
alter table public.user_ranks      enable row level security;
alter table public.anon_users      enable row level security;
alter table public.theme_mastery   enable row level security;
alter table public.daily_matchups  enable row level security;

drop policy if exists "ai_levels_public_read" on public.ai_levels;
create policy "ai_levels_public_read"
  on public.ai_levels for select using (true);

drop policy if exists "user_ranks_public_read" on public.user_ranks;
create policy "user_ranks_public_read"
  on public.user_ranks for select using (true);

-- anon_users, theme_mastery, daily_matchups: service-role only (no policies = no anon access)
