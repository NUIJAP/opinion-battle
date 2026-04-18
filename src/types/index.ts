// ---- Domain types ----

export type StanceSide = "a" | "b";

/**
 * 8-axis bipolar vector (Phase 3a / Stage C).
 * Each value is 1-5 representing strength on the FIRST-named pole of the axis:
 *   1 = fully second pole, 3 = neutral, 5 = fully first pole.
 *   e.g. reason_madness = 5 → 完全理性, = 1 → 完全狂気.
 */
export interface Axes8 {
  reason_madness: number;        // 理性 ↔ 狂気
  lust_restraint: number;        // 欲望 ↔ 禁欲
  seduction_directness: number;  // 誘惑力 ↔ 直撃力
  chaos_order: number;           // 奔放 ↔ 秩序
  violence_cunning: number;      // 暴力 ↔ 知略
  nihility_obsession: number;    // 虚無 ↔ 執着
  mockery_empathy: number;       // 嘲笑 ↔ 同調
  deception_honesty: number;     // 欺瞞 ↔ 直言
}

export const AXIS_KEYS: ReadonlyArray<keyof Axes8> = [
  "reason_madness",
  "lust_restraint",
  "seduction_directness",
  "chaos_order",
  "violence_cunning",
  "nihility_obsession",
  "mockery_empathy",
  "deception_honesty",
];

/** Per axis: display label of each pole. left = high-value (5), right = low-value (1). */
export const AXIS_POLES_JP: Record<keyof Axes8, { high: string; low: string }> = {
  reason_madness:        { high: "理性",   low: "狂気" },
  lust_restraint:        { high: "欲望",   low: "禁欲" },
  seduction_directness:  { high: "誘惑力", low: "直撃力" },
  chaos_order:           { high: "奔放",   low: "秩序" },
  violence_cunning:      { high: "暴力",   low: "知略" },
  nihility_obsession:    { high: "虚無",   low: "執着" },
  mockery_empathy:       { high: "嘲笑",   low: "同調" },
  deception_honesty:     { high: "欺瞞",   low: "直言" },
};

/** Compact label combining both poles, used for radar axis labels. */
export const AXIS_LABEL_JP: Record<keyof Axes8, string> = {
  reason_madness:       "理性/狂気",
  lust_restraint:       "欲望/禁欲",
  seduction_directness: "誘惑/直撃",
  chaos_order:          "奔放/秩序",
  violence_cunning:     "暴力/知略",
  nihility_obsession:   "虚無/執着",
  mockery_empathy:      "嘲笑/同調",
  deception_honesty:    "欺瞞/直言",
};

export interface Theme {
  id: string;
  title: string;
  description: string;
  stance_a_name: string;
  stance_b_name: string;
  stance_a_summary: string;
  stance_b_summary: string;
  news_url: string | null;
  news_date: string | null;
  difficulty: number; // 1-5
  active: boolean;
  created_at: string;
  /** Stage B: 8-axis importance vector, each 0-1. Drives helper match% calc. */
  topic_axes?: Axes8 | null;
}

/** AI character definition. Loaded from the ai_levels table.
 *  Stage A: extended from 5 generic levels to 10 named 獄吏 with 4-axis stats.
 *  All extra fields are optional so older rows / fallbacks degrade gracefully. */
export interface AiLevel {
  id: number; // 1-10 (Stage A); was 1-5 pre-Stage A.
  name_jp: string;       // 囁 / 惰 / 量 / 憤 / 嘲 / 詭 / 識 / 狂 / 真 / 黙
  emoji: string;
  tagline: string;
  prompt_hint: string;   // Style instructions injected into Claude prompts
  min_rp_recommended: number;

  // ---- Persona fields (Stage A onwards) ----
  /** Difficulty tier int 1-6 (D=1, C=2, B=3, A=4, S=5, SS=6). */
  tier?: number;
  /** Display tier letter ("D" / "C" / "B" / "A" / "S" / "SS"). Phase 3a. */
  tier_letter?: string;
  /** Composite score 1.0-10.0 used for the tier letter. Phase 3a. */
  composite_score?: number;
  /** Goetia rank ("King" / "Duke" / "Prince" / "Marquis" / "Earl" / "President"). */
  rank_label?: string;
  /** Number of legions commanded in lore. */
  legions?: number;
  /** Subscores making up composite_score. */
  sub_danger?: number;
  sub_complexity?: number;
  sub_reach?: number;

  personality?: string; // 性格
  specialty?: string;   // 得意
  weakness?: string;    // 弱点
  appearance?: string;  // 外見
  catchphrase?: string; // 決め台詞

  // ---- Stage C 8-axis stats (bipolar, each 1-5; see Axes8 docstring) ----
  ax_reason_madness?: number;
  ax_lust_restraint?: number;
  ax_seduction_directness?: number;
  ax_chaos_order?: number;
  ax_violence_cunning?: number;
  ax_nihility_obsession?: number;
  ax_mockery_empathy?: number;
  ax_deception_honesty?: number;
}

/** 8-axis personality accumulated for a single anon user (Stage C). */
export interface UserStats {
  user_id: string;
  ax_reason_madness: number;
  ax_lust_restraint: number;
  ax_seduction_directness: number;
  ax_chaos_order: number;
  ax_violence_cunning: number;
  ax_nihility_obsession: number;
  ax_mockery_empathy: number;
  ax_deception_honesty: number;
  /** Number of battle deltas folded into this row. <5 = 「判定中」 */
  samples: number;
  updated_at?: string;
}

/** Helper character pick + match % vs the current theme. */
export interface HelperPick {
  ai: AiLevel;
  matchPct: number; // 0-100 (cosine similarity, scaled)
}

export type DifficultyTag = "below" | "equal" | "above";

/** One of the 3 matchups on today's home screen. */
export interface Matchup {
  id: string; // daily_matchups.id
  slot: number; // 1-3
  theme: Theme;
  aiLevel: AiLevel;
  difficultyTag: DifficultyTag;
  completed: boolean;
}

export interface UserRank {
  user_id: string;
  rp: number;
  highest_ai_level_beaten: number;
  total_battles: number;
  total_wins: number;
  streak_days: number;
  last_battle_date: string | null;
}

/** Display-only rank info derived from RP. */
export interface RankTier {
  name: string; // e.g. "Silver II"
  tier: string; // "Bronze" | "Silver" | ...
  level: number; // 1-3 within tier (Master has only 1)
  currentRp: number;
  nextRp: number | null; // null for Master
  progressPct: number; // 0-100, progress to next rank
}

/** Stage B: one round of the new text-input battle loop. */
export interface BattleRound {
  round: number;
  aiStance: string;
  aiStatement: string;
  /** What the user typed in response to the AI's statement. Null on round 1. */
  userInput?: string | null;
  /** Claude-evaluated 8-axis breakdown of the user input. Null if not evaluated. */
  userInputAxes?: Axes8 | null;
  /** AI level id of the helper the user summoned this round (-10 HP). Null if none. */
  summonedHelperId?: number | null;
  /** Damage dealt to user / ai HP this round (post-evaluation). */
  hpDamageToUser: number;
  hpDamageToAi: number;
  userHpAfter: number;
  aiHpAfter: number;
}

export interface BattleResult {
  id: string;
  user_id: string | null;
  theme_id: string;
  user_stance: string;
  final_user_hp: number;
  final_ai_hp: number;
  result: "win" | "loss" | "draw";
  score: number;
  rounds_won: number;
  battle_history: BattleRound[];
  player_count: number;
  played_duration_seconds: number;
  created_at: string;
}

// ---- API contracts ----

/** Shared shape for history entries sent to Claude. */
export interface BattleHistoryEntry {
  round: number;
  aiStatement: string;
  userInput?: string | null;
  userInputAxes?: Axes8 | null;
  summonedHelperId?: number | null;
}

export interface GenerateStatementRequest {
  themeId: string;
  userStanceSide: StanceSide;
  /** Round being generated (1 = opening). */
  roundNumber: number;
  battleHistory: BattleHistoryEntry[];
  aiLevelId?: number;
  /** Stage B: user's typed reply for this round (null on round 1). */
  userInput?: string | null;
  /** Stage B: optional helper character the user summoned this round. */
  summonedHelperId?: number | null;
}

export interface GenerateStatementResponse {
  /** AI's next statement (the rebuttal). */
  statement: string;
  tone?: string;
  keyPoint?: string;
  /** Claude's 8-axis evaluation of the user input (null if no input this round). */
  userInputAxes?: Axes8 | null;
  /** HP damage the AI's statement deals to the user this round (0+). */
  hpDamageToUser: number;
  /** HP damage the user's input dealt to the AI this round (0+). */
  hpDamageToAi: number;
}

/** Helper-pick API: returns N candidate helpers for the current round. */
export interface HelperPickRequest {
  themeId: string;
  /** Exclude this character (the opponent) from the pool. */
  opponentAiLevelId: number;
  /** Optional anti-repeat: helpers already summoned this battle. */
  excludeIds?: number[];
  /** How many to return. Default 3. */
  count?: number;
}

export interface HelperPickResponse {
  picks: HelperPick[];
}

export interface SaveBattleRequest {
  theme_id: string;
  user_stance: string;
  final_user_hp: number;
  final_ai_hp: number;
  score: number;
  rounds_won: number;
  battle_history: BattleRound[];
  played_duration_seconds: number;
  /** Present when the user came from a matchup (Phase 2A+). */
  matchup_id?: string | null;
  ai_level_id?: number | null;
  anon_user_id?: string | null;
}

export interface SaveBattleResponse {
  battleId: string;
  /** RP awarded for this battle. 0 on loss. */
  rpAwarded: number;
  /** User's new total RP after this battle. */
  newTotalRp: number;
  /** User's new rank tier name (e.g. "Silver II"). */
  newRankName: string;
  /** True if the user just moved up a rank tier. */
  didRankUp: boolean;
}

// ---- Matchup API ----

export interface DailyMatchupResponse {
  userId: string; // anon user id (client stores in localStorage)
  matchups: Matchup[];
  rank: {
    rp: number;
    rankName: string;
    totalBattles: number;
    totalWins: number;
    streakDays: number;
  };
}
