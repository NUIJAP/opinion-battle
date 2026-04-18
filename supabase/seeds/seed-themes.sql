-- ============================================================
-- 立場 BATTLE — Phase 1 固定テーマ3つ
-- Run AFTER schema.sql. Idempotent via ON CONFLICT on title.
-- ============================================================

-- Make title uniquely targetable for upserts.
create unique index if not exists uq_themes_title on public.themes(title);

insert into public.themes
  (title, description, stance_a_name, stance_b_name, stance_a_summary, stance_b_summary, difficulty, active)
values
  (
    'AI規制は必要か？',
    '生成AIの急速な普及で、著作権・雇用・偽情報などの懸念が広がる一方、過度な規制はイノベーションを阻害するという議論もある。',
    '規制推進派',
    '市場重視派',
    'AIの進化は速すぎる。著作権侵害や偽情報、雇用破壊が社会を壊す前に、政府主導で明確なルール設計が必要だ。民間任せでは間に合わない。',
    '規制はイノベーションを殺す。AIの恩恵は医療・教育・経済で既に実証済み。市場と現場の自律的な調整に委ねた方が結果的に社会は豊かになる。',
    2,
    true
  ),
  (
    'SNS年齢制限は必要か？',
    '若年層のメンタルヘルス悪化がSNS利用と関連づけられ、各国で16歳未満のSNS利用制限が議論されている。一方で、表現の自由や情報アクセスの権利との衝突も指摘される。',
    '制限賛成派',
    '自由重視派',
    '子どものうつ病・自殺率はSNS普及後に急増した。発達段階にある脳に対する害は明白で、年齢制限は酒やタバコと同様の当然の保護措置だ。',
    '子どもから情報と繋がりを奪うのは過剰反応。問題は使い方の教育であって、一律禁止は貧困層や性的少数者など孤立しがちな子を追い詰める。',
    2,
    true
  ),
  (
    'リモートワークは義務化すべきか？',
    '通勤ラッシュや地方過疎、CO2排出の観点から、一定業種のリモートワーク義務化案が浮上。生産性や組織文化の観点から反論も根強い。',
    'リモート義務派',
    'オフィス回帰派',
    '通勤は生涯で数千時間の損失、都市集中は地方を疲弊させる。リモート可能な職種の義務化は、環境・地方創生・個人の自由すべてに寄与する。',
    '対面の偶発的な会話が組織の創造性を生む。若手の育成もリモートでは限界がある。選択肢として残すべきだが、義務化は組織文化を壊す。',
    1,
    true
  )
on conflict (title) do update set
  description      = excluded.description,
  stance_a_name    = excluded.stance_a_name,
  stance_b_name    = excluded.stance_b_name,
  stance_a_summary = excluded.stance_a_summary,
  stance_b_summary = excluded.stance_b_summary,
  difficulty       = excluded.difficulty,
  active           = excluded.active;
