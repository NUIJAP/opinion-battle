import {
  AXIS_KEYS,
  AXIS_LABEL_JP,
  type AiLevel,
  type Axes8,
  type HelperPick,
  type Theme,
  type UserStats,
} from "@/types";

// ============================================================================
// Vector helpers
// ============================================================================

/** Build the AiLevel's 8-axis stat vector. Falls back to mid-3 if missing. */
export function aiLevelVector(ai: AiLevel): Axes8 {
  return {
    data: ai.ax_data ?? 3,
    ethics: ai.ax_ethics ?? 3,
    emotion: ai.ax_emotion ?? 3,
    persuasion: ai.ax_persuasion ?? 3,
    flexibility: ai.ax_flexibility ?? 3,
    aggression: ai.ax_aggression ?? 3,
    calm: ai.ax_calm ?? 3,
    humor: ai.ax_humor ?? 3,
  };
}

/** Build the theme's 8-axis topic-importance vector. Falls back to neutral. */
export function themeVector(theme: Theme): Axes8 {
  const t = theme.topic_axes;
  if (!t) {
    return {
      data: 0.5, ethics: 0.5, emotion: 0.5, persuasion: 0.5,
      flexibility: 0.5, aggression: 0.5, calm: 0.5, humor: 0.5,
    };
  }
  return {
    data: t.data ?? 0.5,
    ethics: t.ethics ?? 0.5,
    emotion: t.emotion ?? 0.5,
    persuasion: t.persuasion ?? 0.5,
    flexibility: t.flexibility ?? 0.5,
    aggression: t.aggression ?? 0.5,
    calm: t.calm ?? 0.5,
    humor: t.humor ?? 0.5,
  };
}

function dot(a: Axes8, b: Axes8): number {
  return AXIS_KEYS.reduce((s, k) => s + a[k] * b[k], 0);
}

function magnitude(a: Axes8): number {
  return Math.sqrt(AXIS_KEYS.reduce((s, k) => s + a[k] * a[k], 0));
}

/** Cosine similarity in [0,1] (we treat all values as ≥0). */
export function cosineSim(a: Axes8, b: Axes8): number {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  return Math.max(0, Math.min(1, dot(a, b) / (ma * mb)));
}

/** Match% (0-100, integer) of a helper for a theme. */
export function matchPctForHelper(theme: Theme, helper: AiLevel): number {
  const sim = cosineSim(themeVector(theme), aiLevelVector(helper));
  return Math.round(sim * 100);
}

// ============================================================================
// Helper picks
// ============================================================================

/**
 * Picks N helpers from the candidate pool (must already exclude the opponent).
 * Returns each pick with a match% computed against the theme.
 */
export function pickHelpers(
  pool: AiLevel[],
  theme: Theme,
  count = 3,
  rand: () => number = Math.random
): HelperPick[] {
  const remaining = [...pool];
  const out: HelperPick[] = [];
  const n = Math.min(count, remaining.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rand() * remaining.length);
    const ai = remaining.splice(idx, 1)[0];
    out.push({ ai, matchPct: matchPctForHelper(theme, ai) });
  }
  return out;
}

// ============================================================================
// User stats accumulation
// ============================================================================

/** Adds a single delta-vector to the user_stats running average. */
export function foldDelta(prev: UserStats, delta: Axes8): UserStats {
  const n = prev.samples;
  const np1 = n + 1;
  const next: UserStats = { ...prev, samples: np1 };
  for (const k of AXIS_KEYS) {
    const col = ("ax_" + k) as keyof UserStats;
    const oldVal = (prev[col] as number) ?? 0;
    const newVal = (oldVal * n + delta[k]) / np1;
    (next[col] as number) = Number(newVal.toFixed(3));
  }
  return next;
}

/**
 * Combines an evaluation of the user's input axes with the helpers
 * they summoned this battle. Helpers contribute at half weight (the user's
 * own writing matters more than who they leaned on).
 */
export function combineBattleDelta(
  inputAxes: Axes8[], // one entry per round that had user input
  summonedHelpers: AiLevel[]
): Axes8 {
  const sum: Axes8 = {
    data: 0, ethics: 0, emotion: 0, persuasion: 0,
    flexibility: 0, aggression: 0, calm: 0, humor: 0,
  };
  let weight = 0;

  for (const a of inputAxes) {
    for (const k of AXIS_KEYS) sum[k] += a[k];
    weight += 1;
  }
  for (const h of summonedHelpers) {
    const v = aiLevelVector(h);
    for (const k of AXIS_KEYS) sum[k] += v[k] * 0.5;
    weight += 0.5;
  }
  if (weight === 0) {
    return sum;
  }
  for (const k of AXIS_KEYS) sum[k] = sum[k] / weight;
  return sum;
}

// ============================================================================
// Personality typing (rule-based, no Claude call)
// ============================================================================

/** Threshold below which user_stats are still in 「判定中」 mode. */
export const PERSONALITY_JUDGING_UNTIL = 5;

/** Read the user's 8-axis vector out of UserStats. */
export function userStatsVector(s: UserStats): Axes8 {
  return {
    data: s.ax_data, ethics: s.ax_ethics, emotion: s.ax_emotion,
    persuasion: s.ax_persuasion, flexibility: s.ax_flexibility,
    aggression: s.ax_aggression, calm: s.ax_calm, humor: s.ax_humor,
  };
}

interface PersonalityType {
  name: string;       // "論理エリート型"
  description: string; // 一行コメント
  topAxes: Array<keyof Axes8>;
  bottomAxes: Array<keyof Axes8>;
}

/** Single-axis tier name (used when one axis dominates). */
const SINGLE_TYPE_BY_AXIS: Record<keyof Axes8, { name: string; comment: string }> = {
  data:        { name: "データ・サムライ型",   comment: "数字と事実で押し切る統計フェチ。"  },
  ethics:      { name: "正義の説教師型",         comment: "倫理を旗印に揺るがない論者。"      },
  emotion:     { name: "情熱の語り部型",         comment: "心を動かすことで議論を制する。"    },
  persuasion:  { name: "言葉の戦略家型",         comment: "巧妙な構成で相手の退路を塞ぐ。"    },
  flexibility: { name: "風読み型",                 comment: "状況に応じて軸足を巧みに変える。"  },
  aggression:  { name: "猛攻撃型",                 comment: "迷わず正面から殴る突撃論者。"      },
  calm:        { name: "氷の論理型",               comment: "冷徹で揺るがず、表情も変えない。"  },
  humor:       { name: "皮肉とユーモア型",         comment: "笑いと皮肉で議論を制する遊撃手。" },
};

/** Compute personality type from a user vector. Pure function. */
export function personalityType(v: Axes8): PersonalityType {
  const sorted = AXIS_KEYS.map((k) => ({ k, val: v[k] })).sort(
    (a, b) => b.val - a.val
  );
  const top = sorted[0];
  const baseType = SINGLE_TYPE_BY_AXIS[top.k];
  const top2 = sorted.slice(0, 2).map((x) => x.k);
  const bottom2 = sorted.slice(-2).map((x) => x.k);

  return {
    name: baseType.name,
    description: baseType.comment,
    topAxes: top2,
    bottomAxes: bottom2,
  };
}

/** Returns the AiLevel from `pool` whose 8-axis vector is most similar to v. */
export function bestAffinityAi(v: Axes8, pool: AiLevel[]): AiLevel | null {
  if (pool.length === 0) return null;
  let best: AiLevel = pool[0];
  let bestSim = -Infinity;
  for (const ai of pool) {
    const s = cosineSim(v, aiLevelVector(ai));
    if (s > bestSim) {
      bestSim = s;
      best = ai;
    }
  }
  return best;
}

/** Convenience: turn a top-axis array into a Japanese label list. */
export function axesToJpList(keys: Array<keyof Axes8>): string {
  return keys.map((k) => AXIS_LABEL_JP[k]).join(" / ");
}
