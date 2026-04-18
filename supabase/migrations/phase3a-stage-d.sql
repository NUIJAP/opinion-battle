-- ============================================================
-- 論獄 (RONGOKU) — Phase 3a Stage D migration
-- Run AFTER phase3a-stage-c.sql.
--
-- Additive only (既存行を壊さない):
--   - user_stats.demon_affinity       : 20体の出現率 JSONB (既存行は uniform 5% で初期化)
--   - user_stats.battles_today        : 1日3戦スタミナのカウンタ
--   - user_stats.last_battle_date     : 翌日判定用 (日付が変わったら battles_today を 0 に戻す)
--   - user_stats.possessed_by_demon_id: 傀儡化した悪魔 (NULL = 未傀儡化)
--   - user_stats.possessed_at         : 傀儡化発火時刻
--
-- キャラクターコード自体は DB に保存しない (localStorage のみ、自己完結)。
-- Idempotent (safe to re-run).
-- ============================================================

alter table public.user_stats
  add column if not exists demon_affinity        jsonb,
  add column if not exists battles_today         int not null default 0,
  add column if not exists last_battle_date      date,
  add column if not exists possessed_by_demon_id int,
  add column if not exists possessed_at          timestamptz;

-- FK: possessed_by_demon_id → ai_levels.id (nullable, set null on demon delete)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name   = 'user_stats'
       and constraint_name = 'user_stats_possessed_by_demon_id_fkey'
  ) then
    alter table public.user_stats
      add constraint user_stats_possessed_by_demon_id_fkey
      foreign key (possessed_by_demon_id) references public.ai_levels(id)
      on delete set null;
  end if;
end$$;

-- battles_today は 0 以上の範囲制約 (念のため)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name   = 'user_stats'
       and constraint_name = 'user_stats_battles_today_nonneg'
  ) then
    alter table public.user_stats
      add constraint user_stats_battles_today_nonneg
      check (battles_today >= 0) not valid;
  end if;
end$$;

-- 既存行の demon_affinity を uniform 5% (1/20) で初期化。
-- ai_levels に存在する id のみ seed するので、20体分出揃っている前提 (Stage C 後)。
update public.user_stats
   set demon_affinity = (
     select coalesce(
       jsonb_object_agg(d.id::text, 0.05),
       '{}'::jsonb
     )
       from public.ai_levels d
   )
 where demon_affinity is null;
