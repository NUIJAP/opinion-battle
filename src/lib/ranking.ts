import type { RankTier } from "@/types";

/**
 * Rank tiers are indexed by RP. Each tier has 3 levels (I / II / III)
 * except Master. The RP growth is roughly geometric — Diamond III
 * takes ~50x as long as Bronze I. Numbers are tuned for:
 *   - Bronze reached in ~1-3 battles (instant reward)
 *   - Silver in ~10 battles
 *   - Gold in ~30
 *   - Platinum in ~100
 *   - Diamond in ~300
 *   - Master in ~1000 (endgame flex)
 */
export const RANK_THRESHOLDS: Array<{ name: string; rp: number }> = [
  { name: "Bronze I", rp: 0 },
  { name: "Bronze II", rp: 100 },
  { name: "Bronze III", rp: 300 },
  { name: "Silver I", rp: 700 },
  { name: "Silver II", rp: 1500 },
  { name: "Silver III", rp: 3000 },
  { name: "Gold I", rp: 5000 },
  { name: "Gold II", rp: 8000 },
  { name: "Gold III", rp: 12000 },
  { name: "Platinum I", rp: 18000 },
  { name: "Platinum II", rp: 26000 },
  { name: "Platinum III", rp: 36000 },
  { name: "Diamond I", rp: 50000 },
  { name: "Diamond II", rp: 70000 },
  { name: "Diamond III", rp: 100000 },
  { name: "Master", rp: 150000 },
];

/** Returns the user's current rank + progress to the next rank. */
export function getRankFromRp(rp: number): RankTier {
  let currentIdx = 0;
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (rp >= RANK_THRESHOLDS[i].rp) {
      currentIdx = i;
      break;
    }
  }
  const current = RANK_THRESHOLDS[currentIdx];
  const next = RANK_THRESHOLDS[currentIdx + 1];

  const [tier, roman] = current.name.split(" ");
  const level = roman === "I" ? 1 : roman === "II" ? 2 : roman === "III" ? 3 : 1;

  const progressPct = next
    ? Math.max(0, Math.min(100, ((rp - current.rp) / (next.rp - current.rp)) * 100))
    : 100;

  return {
    name: current.name,
    tier: tier ?? current.name,
    level,
    currentRp: rp,
    nextRp: next ? next.rp : null,
    progressPct,
  };
}

/** Map RP to the user's tier 1-6 (Stage C: D=1, C=2, B=3, A=4, S=5, SS=6). */
export function getUserTier(rp: number): number {
  if (rp >= 25000) return 6; // SS
  if (rp >= 10000) return 5; // S
  if (rp >= 4000)  return 4; // A
  if (rp >= 1500)  return 3; // B
  if (rp >= 500)   return 2; // C
  return 1;                   // D
}

/** Back-compat alias. Prefer getUserTier in new code. */
export const getUserAiLevel = getUserTier;

/**
 * Core RP reward formula.
 * Design goals:
 *   - Loss never subtracts RP (Duolingo-style soft design)
 *   - Beating a higher-tier AI gives a big bonus
 *   - Beating a lower-tier AI gives less but still positive
 *   - Score at the end of battle (finalUserHp) scales the reward
 *
 * Stage A note: the AI is now identified by its tier (1-5), not its raw
 * level id (1-10). The 10 獄吏 share rewards within a tier.
 */
export interface RpAwardInput {
  won: boolean;
  aiTier: number;       // 1-5, derived from the AI character's tier
  userTier: number;     // 1-5, derived from the user's current RP
  finalUserHp: number;  // 0+, higher = cleaner win
  roundsWon: number;    // 0-7
}

export function calculateRpAward(input: RpAwardInput): number {
  if (!input.won) return 0;

  const baseByTier: Record<number, number> = {
    1: 30,    // D
    2: 80,    // C
    3: 180,   // B
    4: 400,   // A
    5: 800,   // S
    6: 1500,  // SS
  };
  const base = baseByTier[input.aiTier] ?? 100;

  const tierDiff = input.aiTier - input.userTier;
  let multiplier = 1.0;
  if (tierDiff >= 2) multiplier = 2.0;
  else if (tierDiff === 1) multiplier = 1.5;
  else if (tierDiff === 0) multiplier = 1.0;
  else if (tierDiff === -1) multiplier = 0.7;
  else multiplier = 0.4;

  const hpBonus = 0.5 + Math.min(1.0, input.finalUserHp / 150) * 0.8;
  const roundBonus = 1 + Math.max(0, input.roundsWon - 3) * 0.05;

  return Math.round(base * multiplier * hpBonus * roundBonus);
}

/**
 * Given old & new RP, figure out if we crossed a rank boundary.
 * Used on the result screen to play the "rank up!" animation.
 */
export function didRankUp(oldRp: number, newRp: number): boolean {
  const oldRank = getRankFromRp(oldRp).name;
  const newRank = getRankFromRp(newRp).name;
  return oldRank !== newRank;
}
