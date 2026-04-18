// ============================================================
// 論獄 傀儡化メカニクス (Phase 3a Stage D / C' プラン)
// ============================================================
// ユーザーの出現率 (demon_affinity) と軸の「染まり」(taint_sum) が
// tier 別の敷居を両方超えたとき、その悪魔の傀儡 (puppet) になる。
//
// 敷居表 (MD 仕様):
//   SS: appearance ≥ 0.55, taint ≥ 15
//   S : 0.60 / 14
//   A : 0.65 / 13
//   B : 0.70 / 12
//   C : 0.75 / 11
//   D : 0.80 / 10
// ============================================================

import type { AiLevel, Axes8 } from "@/types";
import { AXIS_KEYS } from "@/types";
import { aiLevelVector } from "@/lib/affinity";

const THRESHOLDS: Record<string, { appearance: number; taint: number }> = {
  SS: { appearance: 0.55, taint: 15 },
  S:  { appearance: 0.60, taint: 14 },
  A:  { appearance: 0.65, taint: 13 },
  B:  { appearance: 0.70, taint: 12 },
  C:  { appearance: 0.75, taint: 11 },
  D:  { appearance: 0.80, taint: 10 },
};

export interface PossessionInput {
  userAxes: Axes8;
  demonAffinity: Record<string, number>;
  demons: AiLevel[];
}

export interface PossessionResult {
  possessed: boolean;
  demonId?: number;
  demonName?: string;
  demonTier?: string;
  appearanceRate?: number;
  taintSum?: number;
}

/**
 * 軸の染まりスコア。
 *   - 悪魔の軸値 > 3.5 (強い極) → |userAxis - 3| を係数 1.0 で足す
 *   - それ以外 → 係数 0.5 で足す
 * 8 軸合計を返す (最大 ≈ 16)。
 */
export function taintSum(userAxes: Axes8, demonAxes: Axes8): number {
  return AXIS_KEYS.reduce((sum, k) => {
    const weight = demonAxes[k] > 3.5 ? 1 : 0.5;
    return sum + Math.abs(userAxes[k] - 3) * weight;
  }, 0);
}

/**
 * 全 demon を走査して、敷居を両方超えた最初の 1 体を返す。
 * 複数該当する場合、配列の並び順 (ai_levels.id 昇順 = 強い悪魔から) の最初を優先。
 */
export function checkPossession(input: PossessionInput): PossessionResult {
  const { userAxes, demonAffinity, demons } = input;
  for (const demon of demons) {
    const tier = demon.tier_letter ?? "B";
    const th = THRESHOLDS[tier];
    if (!th) continue;
    const appearance = demonAffinity[String(demon.id)] ?? 0;
    if (appearance < th.appearance) continue;
    const demonAxes = aiLevelVector(demon);
    const taint = taintSum(userAxes, demonAxes);
    if (taint < th.taint) continue;
    return {
      possessed: true,
      demonId: demon.id,
      demonName: demon.name_jp,
      demonTier: tier,
      appearanceRate: appearance,
      taintSum: taint,
    };
  }
  return { possessed: false };
}

/**
 * helper が召喚されたとき、その demon の affinity を boost し全体を正規化する。
 * デフォルト boost = +0.10 (MD 仕様)。20 体の affinity が sum=1 になる。
 */
export function boostAffinity(
  current: Record<string, number>,
  demonId: number,
  boost = 0.10,
  demonCount = 20,
): Record<string, number> {
  // 未登場の悪魔は 1/20 (uniform) で seed。
  const next: Record<string, number> = {};
  for (let i = 1; i <= demonCount; i++) {
    next[String(i)] = current[String(i)] ?? 1 / demonCount;
  }
  next[String(demonId)] = (next[String(demonId)] ?? 0) + boost;

  const total = Object.values(next).reduce((a, b) => a + b, 0);
  if (total <= 0) return next;
  for (const k of Object.keys(next)) {
    next[k] = next[k] / total;
  }
  return next;
}
