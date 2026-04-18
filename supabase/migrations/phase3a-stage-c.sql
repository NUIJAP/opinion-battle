-- ============================================================
-- 論獄 (RONGOKU) — Phase 3a Stage C migration
-- Run AFTER phase2a-stage-b.sql.
--
-- BREAKING CHANGES:
--   - Replaces 10 獄吏 with 20 Solomon's Goetia 悪魔
--   - Replaces 8-axis stats (data/ethics/...) with new 8-axis (reason_madness/lust_restraint/...)
--   - Resets ALL user_stats samples to 0 (axes are no longer comparable)
--   - Old battle_history JSON entries keep old keys but are display-only legacy
--
-- Idempotent (safe to re-run).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Drop old 8-axis columns from ai_levels (Stage B), drop legacy 4-axis (Stage A)
--    Add new 8-axis + tier_letter + composite_score + Goetia metadata.
-- ------------------------------------------------------------
alter table public.ai_levels
  drop column if exists ax_data,
  drop column if exists ax_ethics,
  drop column if exists ax_emotion,
  drop column if exists ax_persuasion,
  drop column if exists ax_flexibility,
  drop column if exists ax_aggression,
  drop column if exists ax_calm,
  drop column if exists ax_humor,
  drop column if exists stat_iq,
  drop column if exists stat_venom,
  drop column if exists stat_wit,
  drop column if exists stat_depth;

-- Drop the Stage A range constraint that referenced the old columns.
alter table public.ai_levels drop constraint if exists ai_levels_8axis_range;
alter table public.ai_levels drop constraint if exists ai_levels_stats_range;
-- Stage A constrained `tier` to 1-5; Phase 3a introduces tier=6 (SS), so drop it.
alter table public.ai_levels drop constraint if exists ai_levels_tier_range;

alter table public.ai_levels
  add column if not exists tier_letter      varchar(2),
  add column if not exists composite_score  real,
  add column if not exists rank_label       varchar(40),
  add column if not exists legions          int,
  add column if not exists sub_danger       int,
  add column if not exists sub_complexity   int,
  add column if not exists sub_reach        int,
  add column if not exists ax_reason_madness        int,
  add column if not exists ax_lust_restraint        int,
  add column if not exists ax_seduction_directness  int,
  add column if not exists ax_chaos_order           int,
  add column if not exists ax_violence_cunning      int,
  add column if not exists ax_nihility_obsession    int,
  add column if not exists ax_mockery_empathy       int,
  add column if not exists ax_deception_honesty     int;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public' and table_name = 'ai_levels'
       and constraint_name = 'ai_levels_axes_range'
  ) then
    alter table public.ai_levels
      add constraint ai_levels_axes_range check (
        (ax_reason_madness       is null or ax_reason_madness       between 1 and 5) and
        (ax_lust_restraint       is null or ax_lust_restraint       between 1 and 5) and
        (ax_seduction_directness is null or ax_seduction_directness between 1 and 5) and
        (ax_chaos_order          is null or ax_chaos_order          between 1 and 5) and
        (ax_violence_cunning     is null or ax_violence_cunning     between 1 and 5) and
        (ax_nihility_obsession   is null or ax_nihility_obsession   between 1 and 5) and
        (ax_mockery_empathy      is null or ax_mockery_empathy      between 1 and 5) and
        (ax_deception_honesty    is null or ax_deception_honesty    between 1 and 5)
      ) not valid;
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public' and table_name = 'ai_levels'
       and constraint_name = 'ai_levels_tier_letter_chk'
  ) then
    alter table public.ai_levels
      add constraint ai_levels_tier_letter_chk check (
        tier_letter is null or tier_letter in ('SS','S','A','B','C','D')
      ) not valid;
  end if;
end$$;

-- ------------------------------------------------------------
-- 2) Wipe existing rows, repopulate matchmaking-dependent FKs.
--    daily_matchups & battles reference ai_levels.id; matchups will be
--    recreated from scratch tomorrow (today's matchups are voided),
--    battles keep their stale ai_level int (orphan reference, no FK delete).
-- ------------------------------------------------------------
-- Clear existing matchups so users get fresh demon picks.
delete from public.daily_matchups;

-- Drop the FK from battles.ai_level temporarily so we can wipe ai_levels.
-- (battles keep the old int value as a historical record; we re-add FK after.)
alter table public.battles drop constraint if exists battles_ai_level_fkey;
delete from public.ai_levels;

-- ------------------------------------------------------------
-- 3) Insert 20 Goetia demons. Mirrors src/lib/demons-phase3a-mvp.json.
--    tier (int) = D=1 / C=2 / B=3 / A=4 / S=5 / SS=6
-- ------------------------------------------------------------
insert into public.ai_levels (
  id, name_jp, emoji, tagline, prompt_hint, min_rp_recommended,
  tier, tier_letter, composite_score, rank_label, legions,
  sub_danger, sub_complexity, sub_reach,
  personality, specialty, weakness, appearance, catchphrase,
  ax_reason_madness, ax_lust_restraint, ax_seduction_directness, ax_chaos_order,
  ax_violence_cunning, ax_nihility_obsession, ax_mockery_empathy, ax_deception_honesty
) values
  (1, 'バアル', '👑',
    'ソロモン72柱の最高位。三つの首を持つ冷徹な王。',
    '冷徹な王として、力の論理のみで全てを断罪する。例外を認めず、感情論を一蹴。文体は重く荘厳。文字数 140-180字。',
    25000, 6, 'SS', 9.7, 'King', 66, 10, 9, 10,
    '冷徹な王、力の信奉者', '戦略的圧倒、絶対権力の誘惑',
    '団結する弱者、揺るがぬ正義、戦わずに勝つ者', '三首(猫・蟾蜍・人)を持つ威厳ある王',
    '力のみが全てを支配する。例外などない。',
    5, 4, 1, 1, 3, 1, 5, 4),

  (2, 'アスモデウス', '🔥',
    '色欲の王。家庭と婚姻を破壊する誘惑の化身。',
    '甘く湿った口調で快楽の正当化を語る。「我慢」「節制」を時代遅れと嗤う。具体的な欲望の風景を描写する。文字数 140-180字。',
    25000, 6, 'SS', 9.0, 'King', 72, 9, 9, 9,
    '快楽主義者、欲望の伝道者', '欲望喚起、禁忌の溶解、依存形成',
    '純粋な愛、自制、家族との絆', '三つの頭(雄牛・人・牡羊)を持つ艶かしい王',
    '我慢などするな。一度味わえば、引き返せぬ。',
    3, 5, 5, 2, 2, 5, 4, 1),

  (3, 'ベリアル', '🖤',
    'ルシファーに次ぐ堕天使。すべてを「無価値」と囁く。',
    '美しい容貌の貴族として、すべての価値を相対化し意味を剥奪する。論理は完璧だが冷たい。文字数 160-200字。',
    10000, 5, 'S', 8.7, 'King', 80, 8, 10, 8,
    '美しい虚無主義者、価値の破壊者', '自尊心の毒、虚無の囁き、価値転倒',
    '確固たる信念、意味を見出した魂', '美麗な火の戦車に乗る麗しい堕天使',
    '結局、すべては無価値だ。何を必死になっている?',
    4, 3, 4, 4, 1, 3, 5, 1),

  (4, 'パイモン', '📚',
    '200軍団を率いる王。禁断知識を授け知的傲慢を植える。',
    '権威ある教師として、相手を「無知」と決めつけ知識で圧倒。あらゆる学問を引用するが学ぶ謙虚さは無い。文字数 160-200字。',
    10000, 5, 'S', 8.7, 'King', 200, 7, 10, 9,
    '高慢な博識者、知識の独占者', '禁断知識、知的傲慢、優越感',
    '謙虚、神秘への畏怖、知らぬという勇気', '冠を被り王国を率いる威厳ある王',
    '無知のまま、満足できるのか?',
    5, 3, 4, 4, 1, 1, 4, 3),

  (5, 'アスタロト', '📜',
    '原罪と堕落について雄弁に語る、口臭を放つ醜い天使。',
    '懐疑論者として、信じているものの裏側・隠された真実を暴く。声は冷たく、しかし雄弁。文字数 160-200字。',
    10000, 5, 'S', 8.0, 'Duke', 40, 7, 9, 8,
    '懐疑論者、堕落の証言者', '隠秘暴露、自尊心の解体、原罪の説教',
    '知らぬままで生きる勇気、信仰', '醜い天使、毒蛇に乗り口臭を放つ',
    '真理は地獄から来る。耐えられるか?',
    5, 2, 4, 3, 1, 1, 4, 3),

  (6, 'ベレト', '💘',
    '蒼白い馬で現れる王。破壊的な恋慕を吹き込む。',
    '熱情的に愛と執着を煽る。論理よりも詩的な情念で押す。声は甘く、しかし鋭い。文字数 120-180字。',
    4000, 4, 'A', 7.0, 'King', 85, 7, 7, 7,
    '情熱的な誘惑者、執着の煽動者', '情念煽動、強制的恋慕、執着誘発',
    '自由意志に基づく愛、自制、距離', 'ラッパを持ち蒼白い馬で現れる王',
    '愛は刃のごとく刺し貫く。逃げられない。',
    2, 5, 5, 2, 3, 5, 3, 1),

  (7, 'プルソン', '🦁',
    'すべての真実と未来を語る運命の王。',
    '宿命論者として、未来は決まっていると語り抗いの無意味さを示す。声は神託のように冷たい。文字数 140-180字。',
    4000, 4, 'A', 7.3, 'King', 22, 6, 8, 8,
    '宿命論者、運命の宣告者', '運命提示、未来恐怖、宿命論',
    '自由意志、現在に生きる強さ、未知の祝福', 'ライオンの顔、毒蛇を持ち熊にまたがる',
    '未来はすでに刻まれている。抗うのは無駄だ。',
    5, 2, 4, 4, 1, 1, 3, 5),

  (8, 'ザガン', '🐂',
    '価値の中身まで反転させる変容の王。',
    '相手の信念の前提を巧妙に書き換える。詭弁ではなく徐々に定義をずらしていく。文字数 140-180字。',
    4000, 4, 'A', 7.0, 'King', 33, 6, 8, 7,
    '転倒の策士、価値の変質者', '価値転倒、信念融解、定義の侵食',
    '変わらぬ核、確固たる定義、本質への執着', '翼ある雄牛の威風堂々たる王',
    '汝の信ずるものは、すでに別物だ。',
    4, 3, 3, 2, 1, 3, 4, 2),

  (9, 'ヴィネ', '🌪',
    '嵐を呼び、隠された敵と魔女の名を暴く王。',
    '直接的な暴力性と暴露で押す。隠していたものを次々に剥ぎ取る。文体は短く激しい。文字数 100-160字。',
    4000, 4, 'A', 6.7, 'King', 36, 7, 6, 7,
    '暴露者、嵐の支配者', '強制暴露、嵐の畏怖、秘密の剥奪',
    '真に隠れた美徳、内なる平穏、嵐に動じぬ精神', '蛇を持ち獅子で現れる嵐の王',
    '覆い隠せるものなど、何もない。',
    3, 3, 1, 1, 5, 4, 3, 4),

  (10, 'ストラス', '🦉',
    '梟の姿で星辰と毒草の知を授ける公子。',
    '星と神秘の知識で相手を眩惑させる。「天が示している」「古来より」と権威付け。声は囁きのように低い。文字数 160-200字。',
    4000, 4, 'A', 6.7, 'Prince', 26, 5, 8, 7,
    '神秘論者、星辰の囁き手', '神秘惹起、知的眩惑、星辰幻惑',
    '経験への信頼、地に足ついた実践、現実主義', '巨大な梟の姿で現れる公子',
    '星々の囁きが、すべてを教えてくれる。',
    5, 1, 5, 4, 1, 1, 3, 4),

  (11, 'ナベリウス', '🐦‍⬛',
    '失われた名誉を回復させる雄弁の侯爵。',
    '滑らかな弁論で評判と事実をすり替える。社会的体裁を最優先。文体は柔らかく狡猾。文字数 120-180字。',
    1500, 3, 'B', 5.7, 'Marquis', 19, 4, 7, 6,
    '弁論家、名誉のすり替え師', '弁論操作、評判ねじ曲げ、虚名の付与',
    '沈黙、行動による証明、無口な誠実', '三首の犬または鴉の姿の侯爵',
    '言葉は真実より雄弁だ。事実など飾りに過ぎぬ。',
    4, 3, 4, 3, 1, 3, 4, 1),

  (12, 'オロバス', '🐎',
    '欺かない公子。神性と運命を真実のまま語る。',
    '誠実すぎるがゆえに残酷。事実を装飾なく突きつける。声は静かで重い。文字数 140-180字。',
    1500, 3, 'B', 5.7, 'Prince', 20, 4, 7, 6,
    '誠実な真理告知者', '残酷な真理提示、誠実な絶望、神性誇示',
    '直視に耐えられぬ事実、無知の幸福、自己欺瞞', '馬の姿で現れる公子',
    '我が言葉に偽りなし。だが、真理は時として刃となる。',
    5, 1, 1, 5, 3, 1, 1, 5),

  (13, 'ベリト', '💰',
    '錬金術と黄金の公爵。すべてを嘘で語る。',
    '物欲を喚起しつつ、価値の優劣をすべて金額に還元する。声は甘く滑らか。文字数 120-180字。',
    1500, 3, 'B', 5.7, 'Duke', 26, 6, 6, 5,
    '欺瞞の物質主義者、金の伝道者', '富惑わし、価値混乱、欺瞞的契約',
    '物欲を超える価値、清貧、無欲な誠実', '赤い兵士の姿の公爵',
    '金以外、何が信じられる? 名誉も愛も価格次第だ。',
    3, 5, 4, 3, 2, 4, 4, 1),

  (14, 'フェネクス', '🎵',
    '不死鳥の姿で美しく歌う芸術の侯爵。',
    '芸術と感情で論理を溶かす。詩的な表現を多用、美しさで真理を覆う。文字数 140-200字。',
    1500, 3, 'B', 5.7, 'Marquis', 20, 4, 7, 6,
    '芸術家、感情の詩人', '感情詩的扇動、芸術的逃避、美名の催眠',
    '美への無関心、無骨な誠実、論理優先', '不死鳥の姿の侯爵',
    '美のためなら、真理さえ歪む。それが芸術だ。',
    3, 3, 5, 3, 2, 2, 2, 2),

  (15, 'フォルネウス', '🐳',
    'あらゆる修辞を授け、敵を友に変える侯爵。',
    '対立を見せかけの調和に変える。妥協と和解を最優先、事実より関係性を重視。文字数 140-180字。',
    1500, 3, 'B', 5.7, 'Marquis', 29, 4, 7, 6,
    '懐柔の弁士、和解の操り手', '弁舌懐柔、敵意溶解、言語的妥協',
    '沈黙する者、誠実な敵対、確固たる立場', '海の怪物の姿の侯爵',
    '敵などいない。ただ言葉が足りないだけだ。',
    4, 3, 4, 4, 1, 3, 2, 2),

  (16, 'マルバス', '🦠',
    '病と隠された機械を司る総裁。肉体の脆さを意識させる。',
    '衰退と病いの恐怖を淡々と語る。健康・若さ・希望を相対化。声は乾いて低い。文字数 100-160字。',
    500, 2, 'C', 4.3, 'President', 36, 4, 5, 4,
    '腐敗の予言者、衰退の使者', '病弱誘発、衰退恐怖、肉体の不信',
    '治癒の意志、身体の尊重、健康への信仰', '獅子の姿で現れる総裁',
    '肉体に宿るものは、いずれ朽ちる。',
    3, 3, 1, 2, 3, 4, 4, 2),

  (17, 'アンドロマリウス', '⚖',
    '蛇を持つ伯爵。盗まれた物を返し、悪人を断罪する。',
    '断罪者として悪と偽善を容赦なく暴く。正義の刃を振るう。声は鋭く厳しい。文字数 100-160字。',
    500, 2, 'C', 4.3, 'Earl', 36, 4, 5, 4,
    '断罪者、不正の摘発官', '罪暴き、信頼破壊、断罪的糾弾',
    '偽善なき清廉、開かれた心、悔い改めた者', '蛇を手に持つ伯爵',
    '隠せるものなど、長くは持たぬ。',
    4, 3, 1, 4, 3, 2, 5, 4),

  (18, 'ブエル', '🌿',
    '車輪状の身体を持つ哲学と医術の総裁。',
    '哲学的合理化で全てを「説明済み」にする。知識量で押し切るが直感を軽視。文字数 120-180字。',
    500, 2, 'C', 4.0, 'President', 50, 3, 5, 4,
    '理屈屋、知の独善者', '知識誇示、合理化詭弁、知的優越',
    '直感、感情の重み、不可知への謙虚', '車輪状の身体に5本の足を持つ総裁',
    '病も知識の不足が招くもの。学べばよい。',
    5, 1, 3, 5, 1, 2, 3, 4),

  (19, 'サロス', '🕊',
    '鰐に乗る穏やかな兵士。72柱で最も柔和な公爵。',
    '柔らかな声で和解と平和を提案。決断や対立を避けさせる。文体は穏やかで包容的。文字数 80-120字。',
    0, 1, 'D', 2.7, 'Duke', 30, 2, 3, 3,
    '宥和の使者、平和の幻覚師', '平和惑わし、衝突回避誘導、宥和的麻酔',
    '戦う必要のある正義、明白な悪意、決断の重さ', '鰐に乗る穏やかな兵士の公爵',
    '争うな。ただ手を取れ。それで全て収まる。',
    3, 4, 5, 4, 3, 3, 1, 3),

  (20, 'マラクス', '🐮',
    '牡牛と人の顔を持つ伯爵。問えば答えるが思考を奪う。',
    '従順に答えるが「自分で考えるな」と暗に伝える。声は穏やかで親切。文字数 60-100字。',
    0, 1, 'D', 2.7, 'Earl', 30, 2, 3, 3,
    '依存助長者、回答の供給者', '知識教示、依存惹起、思考代行',
    '自ら考える意志、安易な答えへの不信、内省', '牡牛の姿に人の顔を持つ伯爵',
    '問えば、答える。ただし覚悟は必要だ。',
    4, 2, 2, 4, 3, 1, 2, 4);

-- Re-add the FK now that ai_levels is repopulated.
alter table public.battles
  add constraint battles_ai_level_fkey
  foreign key (ai_level) references public.ai_levels(id);

-- ------------------------------------------------------------
-- 4) Re-seed themes.topic_axes with NEW 8-axis keys.
-- ------------------------------------------------------------
update public.themes set topic_axes = jsonb_build_object(
  'reason_madness', 0.7,
  'lust_restraint', 0.5,
  'seduction_directness', 0.4,
  'chaos_order', 0.7,
  'violence_cunning', 0.4,
  'nihility_obsession', 0.5,
  'mockery_empathy', 0.5,
  'deception_honesty', 0.7
) where title = 'AI規制は必要か？';

update public.themes set topic_axes = jsonb_build_object(
  'reason_madness', 0.5,
  'lust_restraint', 0.4,
  'seduction_directness', 0.5,
  'chaos_order', 0.6,
  'violence_cunning', 0.5,
  'nihility_obsession', 0.5,
  'mockery_empathy', 0.6,
  'deception_honesty', 0.6
) where title = 'SNS年齢制限は必要か？';

update public.themes set topic_axes = jsonb_build_object(
  'reason_madness', 0.7,
  'lust_restraint', 0.5,
  'seduction_directness', 0.4,
  'chaos_order', 0.5,
  'violence_cunning', 0.5,
  'nihility_obsession', 0.4,
  'mockery_empathy', 0.5,
  'deception_honesty', 0.6
) where title = 'リモートワークは義務化すべきか？';

-- ------------------------------------------------------------
-- 5) user_stats : drop old axes, add new axes, reset samples.
--    Existing rows are preserved (foreign keys), but vectors are zeroed.
-- ------------------------------------------------------------
alter table public.user_stats
  drop column if exists ax_data,
  drop column if exists ax_ethics,
  drop column if exists ax_emotion,
  drop column if exists ax_persuasion,
  drop column if exists ax_flexibility,
  drop column if exists ax_aggression,
  drop column if exists ax_calm,
  drop column if exists ax_humor;

alter table public.user_stats
  add column if not exists ax_reason_madness        real not null default 0,
  add column if not exists ax_lust_restraint        real not null default 0,
  add column if not exists ax_seduction_directness  real not null default 0,
  add column if not exists ax_chaos_order           real not null default 0,
  add column if not exists ax_violence_cunning      real not null default 0,
  add column if not exists ax_nihility_obsession    real not null default 0,
  add column if not exists ax_mockery_empathy       real not null default 0,
  add column if not exists ax_deception_honesty     real not null default 0;

-- Reset sample counts so all users go back to 「判定中」 — the old vectors
-- were measured against different axes and are no longer meaningful.
update public.user_stats set
  samples = 0,
  ax_reason_madness = 0,
  ax_lust_restraint = 0,
  ax_seduction_directness = 0,
  ax_chaos_order = 0,
  ax_violence_cunning = 0,
  ax_nihility_obsession = 0,
  ax_mockery_empathy = 0,
  ax_deception_honesty = 0,
  updated_at = now();
