// ---- Domain types ----

export type StanceSide = "a" | "b";

export type UserAction = "like" | "reference" | "oppose";

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
  stat_iq?: number;     // 1-5
  stat_venom?: number;  // 1-5  悪辣
  stat_wit?: number;    // 1-5  機知
  stat_depth?: number;  // 1-5  深慮
  personality?: string; // 性格
  specialty?: string;   // 得意
  weakness?: string;    // 弱点
  appearance?: string;  // 外見
  catchphrase?: string; // 決め台詞
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

/** A single counter-argument candidate the user can pick after pressing 🔥. */
export interface CounterChoice {
  id: string;        // Short id like "c1"
  label: string;     // Short headline (~15 chars) for the button
  statement: string; // Full counter text (~80 chars) that the AI will see
  angle: string;     // What kind of attack (e.g. "データで反駁", "倫理で反駁")
}

export interface BattleRound {
  round: number;
  aiStance: string;
  aiStatement: string;
  userAction: UserAction | null;
  /** The counter the user picked (only set if userAction === "oppose") */
  userCounter?: CounterChoice | null;
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
  userAction: UserAction | null;
  userCounter?: { label: string; statement: string } | null;
}

export interface GenerateStatementRequest {
  themeId: string;
  userStanceSide: StanceSide;
  userAction: UserAction | "none";
  /** Populated only when userAction === "oppose" and the user picked a counter. */
  userCounter?: CounterChoice | null;
  roundNumber: number;
  battleHistory: BattleHistoryEntry[];
  /** AI character level (1-5). Optional for backward compat; defaults to level 3. */
  aiLevelId?: number;
}

export interface GenerateStatementResponse {
  statement: string;
  tone?: string;
  keyPoint?: string;
}

export interface GenerateCountersRequest {
  themeId: string;
  userStanceSide: StanceSide;
  roundNumber: number;
  /** The AI statement the user wants to push back against. */
  aiStatement: string;
  battleHistory: BattleHistoryEntry[];
  /** AI character level (1-5). Optional; affects tone of counter suggestions. */
  aiLevelId?: number;
}

export interface GenerateCountersResponse {
  choices: CounterChoice[];
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
