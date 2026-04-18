// ---- Game constants ----

export const INITIAL_HP = 100;
/** Hard cap on rounds. HP=0 ends the battle earlier. */
export const MAX_ROUNDS = 7;
/** HP cost the user pays to summon a helper character (Stage B). */
export const HELPER_SUMMON_HP_COST = 10;

/** HP is clamped to [0, 200]. AI cannot go below 0; user cannot exceed 200. */
export function clampHp(value: number): number {
  return Math.max(0, Math.min(200, value));
}

// ---- Score (legacy formula kept for the result screen display) ----

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

/**
 * Stage B win condition: AI HP=0 → user wins. User HP=0 → user loses.
 * Otherwise compare HP. A draw needs them within 2 points of each other.
 */
export function judgeResult(
  userHp: number,
  aiHp: number
): "win" | "loss" | "draw" {
  if (aiHp <= 0 && userHp > 0) return "win";
  if (userHp <= 0 && aiHp > 0) return "loss";
  if (userHp <= 0 && aiHp <= 0) return "draw";
  if (Math.abs(userHp - aiHp) <= 2) return "draw";
  return userHp > aiHp ? "win" : "loss";
}
