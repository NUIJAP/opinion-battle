import {
  AXIS_KEYS,
  AXIS_POLES_JP,
  type AiLevel,
  type Axes8,
  type HelperPick,
  type Theme,
  type UserStats,
} from "@/types";

// ============================================================================
// Vector helpers
// ============================================================================

/** Build the AiLevel's 8-axis stat vector. Falls back to neutral 3 if missing. */
export function aiLevelVector(ai: AiLevel): Axes8 {
  return {
    reason_madness:       ai.ax_reason_madness       ?? 3,
    lust_restraint:       ai.ax_lust_restraint       ?? 3,
    seduction_directness: ai.ax_seduction_directness ?? 3,
    chaos_order:          ai.ax_chaos_order          ?? 3,
    violence_cunning:     ai.ax_violence_cunning     ?? 3,
    nihility_obsession:   ai.ax_nihility_obsession   ?? 3,
    mockery_empathy:      ai.ax_mockery_empathy      ?? 3,
    deception_honesty:    ai.ax_deception_honesty    ?? 3,
  };
}

/** Build the theme's 8-axis topic-importance vector (each 0-1). */
export function themeVector(theme: Theme): Axes8 {
  const t = theme.topic_axes;
  if (!t) {
    return AXIS_KEYS.reduce((acc, k) => {
      acc[k] = 0.5;
      return acc;
    }, {} as Axes8);
  }
  return AXIS_KEYS.reduce((acc, k) => {
    acc[k] = (t as Axes8)[k] ?? 0.5;
    return acc;
  }, {} as Axes8);
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

export function combineBattleDelta(
  inputAxesList: Axes8[],
  summonedHelpers: AiLevel[]
): Axes8 {
  const sum: Axes8 = AXIS_KEYS.reduce((acc, k) => {
    acc[k] = 0;
    return acc;
  }, {} as Axes8);
  let weight = 0;

  for (const a of inputAxesList) {
    for (const k of AXIS_KEYS) sum[k] += a[k];
    weight += 1;
  }
  for (const h of summonedHelpers) {
    const v = aiLevelVector(h);
    for (const k of AXIS_KEYS) sum[k] += v[k] * 0.5;
    weight += 0.5;
  }
  if (weight === 0) return sum;
  for (const k of AXIS_KEYS) sum[k] = sum[k] / weight;
  return sum;
}

// ============================================================================
// Personality typing (rule-based, bipolar 16-type)
// ============================================================================

export const PERSONALITY_JUDGING_UNTIL = 5;

export function userStatsVector(s: UserStats): Axes8 {
  return {
    reason_madness:       s.ax_reason_madness,
    lust_restraint:       s.ax_lust_restraint,
    seduction_directness: s.ax_seduction_directness,
    chaos_order:          s.ax_chaos_order,
    violence_cunning:     s.ax_violence_cunning,
    nihility_obsession:   s.ax_nihility_obsession,
    mockery_empathy:      s.ax_mockery_empathy,
    deception_honesty:    s.ax_deception_honesty,
  };
}

interface TypeName { name: string; comment: string }

/** Per-axis pole → personality archetype. 16 total (8 axes × 2 poles). */
const TYPE_BY_AXIS_POLE: Record<keyof Axes8, { high: TypeName; low: TypeName }> = {
  reason_madness: {
    high: { name: "氷の論理型", comment: "感情を切り捨て、計算で議論を制する冷徹な理性派。" },
    low:  { name: "狂気の咆哮型", comment: "理屈を踏み越え、衝動と熱量で相手を圧倒する。" },
  },
  lust_restraint: {
    high: { name: "渇望の獣型", comment: "欲しいものに躊躇なく手を伸ばす。情熱が最大の武器。" },
    low:  { name: "鋼の戒律型", comment: "欲を律し、目的のために自らを縛れる修行者気質。" },
  },
  seduction_directness: {
    high: { name: "甘言の誘惑者型", comment: "言葉で相手を絡め取る。鎌をかけ、布を被せて勝つ。" },
    low:  { name: "鉄拳の直撃型", comment: "回りくどさを嫌い、最短距離で核心を打ち抜く直球派。" },
  },
  chaos_order: {
    high: { name: "嵐の混沌型", comment: "規則を壊し、自由と即興で議論の地形を変える。" },
    low:  { name: "鉄壁の秩序型", comment: "ルールと構造を尊び、揺るがぬ枠組みで攻める。" },
  },
  violence_cunning: {
    high: { name: "蛮勇の戦士型", comment: "正面突破を恐れず、勢いで相手をねじ伏せる。" },
    low:  { name: "策謀の知将型", comment: "頭で勝つ。罠と布石で気付かぬうちに勝負を決める。" },
  },
  nihility_obsession: {
    high: { name: "虚無の達観型", comment: "「結局どうでもいい」という冷たい視座から議論を解体する。" },
    low:  { name: "執念の追求者型", comment: "一つのことに食らいつき、誰よりも深く掘る。" },
  },
  mockery_empathy: {
    high: { name: "嘲笑の傍観者型", comment: "皮肉と見下しで相手の足場を崩す観察者。" },
    low:  { name: "共感の調停者型", comment: "相手の立場に立ち、理解を武器に対話を進める。" },
  },
  deception_honesty: {
    high: { name: "欺瞞の語り手型", comment: "事実を操り、物語で相手を別の世界に連れ出す。" },
    low:  { name: "直言の挑戦者型", comment: "嘘を許さず、痛い真理を真正面から突きつける。" },
  },
};

export interface PersonalityType {
  name: string;
  description: string;
  topAxes: Array<keyof Axes8>;
  bottomAxes: Array<keyof Axes8>;
}

/** Picks the most-extreme axis (max |v - 3|) and its pole. */
export function personalityType(v: Axes8): PersonalityType {
  let bestKey: keyof Axes8 = AXIS_KEYS[0];
  let bestDist = -1;
  let bestHigh = false;
  for (const k of AXIS_KEYS) {
    const dist = Math.abs(v[k] - 3);
    if (dist > bestDist) {
      bestDist = dist;
      bestKey = k;
      bestHigh = v[k] >= 3;
    }
  }
  const archetype = bestHigh
    ? TYPE_BY_AXIS_POLE[bestKey].high
    : TYPE_BY_AXIS_POLE[bestKey].low;

  // Compute top-2 / bottom-2 axes with pole-aware labels.
  const sortedHigh = AXIS_KEYS.map((k) => ({ k, v: v[k] })).sort(
    (a, b) => b.v - a.v
  );
  const top2 = sortedHigh.slice(0, 2).map((x) => x.k);
  const bottom2 = sortedHigh.slice(-2).map((x) => x.k);

  return {
    name: archetype.name,
    description: archetype.comment,
    topAxes: top2,
    bottomAxes: bottom2,
  };
}

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

/** Convenience: render top-axis keys as Japanese pole labels (high or low). */
export function axesToJpList(keys: Array<keyof Axes8>, vec?: Axes8): string {
  return keys
    .map((k) => {
      if (vec) {
        const pole = vec[k] >= 3 ? AXIS_POLES_JP[k].high : AXIS_POLES_JP[k].low;
        return pole;
      }
      return AXIS_POLES_JP[k].high;
    })
    .join(" / ");
}
