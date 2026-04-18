-- ============================================================
-- 論獄 (RONGOKU) — Phase 2A Stage B migration
-- Run AFTER phase2a-stage-a.sql.
-- Adds:
--   - themes.topic_axes : 8-axis importance vector (jsonb 0-1 floats)
--   - ai_levels 8-axis stats (data/ethics/emotion/persuasion/flexibility/
--     aggression/calm/humor) with re-seed of all 10 獄吏
--   - user_stats : per-user 8-axis personality, accumulated over battles
-- All ALTERs additive + nullable. Idempotent.
-- TODO (future): stamina model + ad-recovery (Stage C)
-- ============================================================

-- ------------------------------------------------------------
-- 1) themes.topic_axes : how much each axis matters for that theme.
--    Used by the affinity algorithm (cosine similarity vs helper).
-- ------------------------------------------------------------
alter table public.themes
  add column if not exists topic_axes jsonb;

-- Seed importance vectors for the 3 fixed themes (matched by title,
-- which has the unique index from seed-themes.sql).
update public.themes set topic_axes = jsonb_build_object(
  'data', 0.9, 'ethics', 0.8, 'emotion', 0.4, 'persuasion', 0.7,
  'flexibility', 0.6, 'aggression', 0.5, 'calm', 0.7, 'humor', 0.2
) where title = 'AI規制は必要か？';

update public.themes set topic_axes = jsonb_build_object(
  'data', 0.7, 'ethics', 0.9, 'emotion', 0.8, 'persuasion', 0.6,
  'flexibility', 0.5, 'aggression', 0.6, 'calm', 0.5, 'humor', 0.3
) where title = 'SNS年齢制限は必要か？';

update public.themes set topic_axes = jsonb_build_object(
  'data', 0.6, 'ethics', 0.5, 'emotion', 0.4, 'persuasion', 0.8,
  'flexibility', 0.7, 'aggression', 0.4, 'calm', 0.6, 'humor', 0.4
) where title = 'リモートワークは義務化すべきか？';

-- ------------------------------------------------------------
-- 2) ai_levels : 8-axis stat columns. Existing 4-axis stats stay
--    so older code keeps reading; we add 8 new fields for Stage B.
-- ------------------------------------------------------------
alter table public.ai_levels
  add column if not exists ax_data        int,  -- データ力
  add column if not exists ax_ethics      int,  -- 倫理力
  add column if not exists ax_emotion     int,  -- 感情力
  add column if not exists ax_persuasion  int,  -- 説得力
  add column if not exists ax_flexibility int,  -- 柔軟性
  add column if not exists ax_aggression  int,  -- 攻撃性
  add column if not exists ax_calm        int,  -- 冷静さ
  add column if not exists ax_humor       int;  -- ユーモア

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name   = 'ai_levels'
       and constraint_name = 'ai_levels_8axis_range'
  ) then
    alter table public.ai_levels
      add constraint ai_levels_8axis_range check (
        (ax_data        is null or ax_data        between 1 and 5) and
        (ax_ethics      is null or ax_ethics      between 1 and 5) and
        (ax_emotion     is null or ax_emotion     between 1 and 5) and
        (ax_persuasion  is null or ax_persuasion  between 1 and 5) and
        (ax_flexibility is null or ax_flexibility between 1 and 5) and
        (ax_aggression  is null or ax_aggression  between 1 and 5) and
        (ax_calm        is null or ax_calm        between 1 and 5) and
        (ax_humor       is null or ax_humor       between 1 and 5)
      ) not valid;
  end if;
end$$;

-- Re-seed all 10 獄吏 with 8-axis values. Other Stage A fields kept intact.
update public.ai_levels set
  ax_data = 1, ax_ethics = 2, ax_emotion = 2, ax_persuasion = 1,
  ax_flexibility = 2, ax_aggression = 1, ax_calm = 2, ax_humor = 1
where id = 1; -- 囁

update public.ai_levels set
  ax_data = 1, ax_ethics = 1, ax_emotion = 1, ax_persuasion = 2,
  ax_flexibility = 3, ax_aggression = 1, ax_calm = 4, ax_humor = 3
where id = 2; -- 惰

update public.ai_levels set
  ax_data = 5, ax_ethics = 2, ax_emotion = 1, ax_persuasion = 4,
  ax_flexibility = 2, ax_aggression = 3, ax_calm = 4, ax_humor = 1
where id = 3; -- 量

update public.ai_levels set
  ax_data = 2, ax_ethics = 5, ax_emotion = 5, ax_persuasion = 3,
  ax_flexibility = 1, ax_aggression = 5, ax_calm = 1, ax_humor = 1
where id = 4; -- 憤

update public.ai_levels set
  ax_data = 3, ax_ethics = 2, ax_emotion = 2, ax_persuasion = 3,
  ax_flexibility = 4, ax_aggression = 4, ax_calm = 4, ax_humor = 5
where id = 5; -- 嘲

update public.ai_levels set
  ax_data = 3, ax_ethics = 1, ax_emotion = 2, ax_persuasion = 5,
  ax_flexibility = 5, ax_aggression = 3, ax_calm = 4, ax_humor = 3
where id = 6; -- 詭

update public.ai_levels set
  ax_data = 4, ax_ethics = 5, ax_emotion = 2, ax_persuasion = 4,
  ax_flexibility = 3, ax_aggression = 2, ax_calm = 5, ax_humor = 2
where id = 7; -- 識

update public.ai_levels set
  ax_data = 2, ax_ethics = 3, ax_emotion = 5, ax_persuasion = 4,
  ax_flexibility = 1, ax_aggression = 5, ax_calm = 1, ax_humor = 2
where id = 8; -- 狂

update public.ai_levels set
  ax_data = 5, ax_ethics = 4, ax_emotion = 3, ax_persuasion = 5,
  ax_flexibility = 4, ax_aggression = 4, ax_calm = 5, ax_humor = 2
where id = 9; -- 真

update public.ai_levels set
  ax_data = 4, ax_ethics = 4, ax_emotion = 1, ax_persuasion = 3,
  ax_flexibility = 1, ax_aggression = 5, ax_calm = 5, ax_humor = 1
where id = 10; -- 黙

-- ------------------------------------------------------------
-- 3) user_stats : per-user 8-axis personality.
--    Stored as running averages (real). `samples` counts how many
--    deltas have been folded in — used to gate "判定中" UI display
--    (currently <5 samples = 判定中).
-- ------------------------------------------------------------
create table if not exists public.user_stats (
  user_id        uuid primary key references public.anon_users(id) on delete cascade,
  ax_data        real not null default 0,
  ax_ethics      real not null default 0,
  ax_emotion     real not null default 0,
  ax_persuasion  real not null default 0,
  ax_flexibility real not null default 0,
  ax_aggression  real not null default 0,
  ax_calm        real not null default 0,
  ax_humor       real not null default 0,
  samples        int  not null default 0,
  updated_at     timestamptz default now()
);

alter table public.user_stats enable row level security;

drop policy if exists "user_stats_public_read" on public.user_stats;
create policy "user_stats_public_read"
  on public.user_stats for select using (true);

-- ------------------------------------------------------------
-- 4) battles : track which helpers were summoned + per-round user input
--    evaluation. battle_history JSON now carries this; no schema change
--    needed for that. We add a single nullable column for quick aggregation.
-- ------------------------------------------------------------
alter table public.battles
  add column if not exists ended_by_hp_zero boolean default false,
  add column if not exists helpers_summoned int default 0;
