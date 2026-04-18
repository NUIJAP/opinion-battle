// ---- Domain types ----

export type StanceSide = "a" | "b";

/** 8-axis vector used for theme/character/user personality math. */
export interface Axes8 {
  data: number;        // データ力
  ethics: number;      // 倫理力
  emotion: number;     // 感情力
  persuasion: number;  // 説得力
  flexibility: number; // 柔軟性
  aggression: number;  // 攻撃性
  calm: number;        // 冷静さ
  humor: number;       // ユーモア
}

export const AXIS_KEYS: ReadonlyArray<keyof Axes8> = [
  "data",
  "ethics",
  "emotion",
  "persuasion",
  "flexibility",
  "aggression",
  "calm",
  "humor",
];

export const AXIS_LABEL_JP: Record<keyof Axes8, string> = {
  data: "データ力",
  ethics: "倫理力",
  emotion: "感情力",
  persuasion: "説得力",
  flexibility: "柔軟性",
  aggression: "攻撃性",
  calm: "冷静さ",
  humor: "ユーモア",
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

  // ---- Stage A persona fields ----
  /** 1-5. Maps the 10 characters into 5 difficulty tiers (2 chars per tier). */
  tier?: number;
  stat_iq?: number;     // 1-5  (legacy 4-axis, kept for backward compat)
  stat_venom?: number;  // 1-5  悪辣
  stat_wit?: number;    // 1-5  機知
  stat_depth?: number;  // 1-5  深慮
  personality?: string; // 性格
  specialty?: string;   // 得意
  weakness?: string;    // 弱点
  appearance?: string;  // 外見
  catchphrase?: string; // 決め台詞

  // ---- Stage B 8-axis stats (each 1-5) ----
  ax_data?: number;
  ax_ethics?: number;
  ax_emotion?: number;
  ax_persuasion?: number;
  ax_flexibility?: number;
  ax_aggression?: number;
  ax_calm?: number;
  ax_humor?: number;
}

/** 8-axis personality accumulated for a single anon user. */
export interface UserStats {
  user_id: string;
  ax_data: number;
  ax_ethics: number;
  ax_emotion: number;
  ax_persuasion: number;
  ax_flexibility: number;
  ax_aggression: number;
  ax_calm: number;
  ax_humor: number;
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
