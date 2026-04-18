import type { UserAction } from "@/types";

// ---- Game constants (from PROJECT_SPEC.md §2.1) ----

export const INITIAL_HP = 100;
export const MAX_ROUNDS = 7;

export interface HpDelta {
  user: number;
  ai: number;
}

export function hpDeltaForAction(action: UserAction): HpDelta {
  switch (action) {
    case "like":
      return { user: +15, ai: -5 };
    case "reference":
      return { user: +8, ai: -3 };
    case "oppose":
      return { user: +20, ai: -20 };
  }
}

/**
 * Extra damage when the user commits to a counter-argument.
 * This is added on top of the base "oppose" delta. A committed attack
 * is riskier and more rewarding than just pressing 🔥 and walking away.
 */
export const COUNTER_BONUS_DELTA: HpDelta = { user: +10, ai: -15 };

// HP is clamped to [0, 200] — user HP can climb above 100, AI HP cannot go below 0.
export function clampHp(value: number): number {
  return Math.max(0, Math.min(200, value));
}

// ---- Score (from PROJECT_SPEC.md §2.1) ----

export interface ScoreInput {
  finalUserHP: number;
  roundsWon: number;
  playerCount: number;
  winStreak: number;
}

export function calculateScore({
  finalUserHP,
  roundsWon,
  playerCount,
  winStreak,
}: ScoreInput): number {
  const baseScore = finalUserHP * 100;
  const playerBonus = playerCount * 10;
  const roundBonus = roundsWon * 50;
  const multiplier = 1 + winStreak * 0.5;
  return Math.round((baseScore + playerBonus + roundBonus) * multiplier);
}

export function judgeResult(
  userHp: number,
  aiHp: number
): "win" | "loss" | "draw" {
  if (userHp > aiHp) return "win";
  if (userHp < aiHp) return "loss";
  return "draw";
}
