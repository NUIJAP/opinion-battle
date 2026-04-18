import { getServerSupabase } from "@/lib/supabase";
import type { Axes8, UserRank } from "@/types";

/** Subset of user_stats columns needed by matchmaking / stamina / possession. */
export interface UserStatsLite {
  demonAffinity: Record<string, number>;
  battlesToday: number;
  lastBattleDate: string | null;
  possessedByDemonId: number | null;
  possessedAt: string | null;
  /** Current 8-axis vector; null values mean user has no samples yet. */
  axes: Axes8;
  samples: number;
}

/**
 * Validates that the given string is a plausible anon user id (UUID format).
 * If not, returns null so the caller can create a fresh user.
 */
function isUuid(s: string | null | undefined): s is string {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s
  );
}

/**
 * Ensures an anon_users row exists for the given id. If the id is missing or
 * invalid, creates a fresh anon_user and returns its new id.
 * Returns the validated/created user id.
 */
export async function ensureAnonUser(
  maybeUserId: string | null | undefined
): Promise<string> {
  const supabase = getServerSupabase();

  if (isUuid(maybeUserId)) {
    // Verify the user actually exists. If a client had a stale id from a
    // prior instance where we wiped the DB, we'll regenerate.
    const { data } = await supabase
      .from("anon_users")
      .select("id")
      .eq("id", maybeUserId)
      .maybeSingle();

    if (data) {
      // Update last_seen (fire-and-forget).
      void supabase
        .from("anon_users")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", maybeUserId);
      return maybeUserId;
    }
  }

  // Create fresh.
  const { data, error } = await supabase
    .from("anon_users")
    .insert([{}])
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create anon_user: ${error?.message ?? "no data"}`);
  }

  // Initialize user_ranks row so later reads always find something.
  await supabase.from("user_ranks").insert([{ user_id: data.id, rp: 0 }]);
  return data.id;
}

/**
 * Fetches user_stats.{demon_affinity, battles_today, last_battle_date,
 * possessed_by_demon_id}. Returns defaults if the row is missing.
 * Lazily resets battles_today to 0 if last_battle_date < today (day rollover).
 */
export async function getUserStats(userId: string): Promise<UserStatsLite> {
  const supabase = getServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const emptyAxes: Axes8 = {
    reason_madness: 0,
    lust_restraint: 0,
    seduction_directness: 0,
    chaos_order: 0,
    violence_cunning: 0,
    nihility_obsession: 0,
    mockery_empathy: 0,
    deception_honesty: 0,
  };

  if (!data) {
    return {
      demonAffinity: {},
      battlesToday: 0,
      lastBattleDate: null,
      possessedByDemonId: null,
      possessedAt: null,
      axes: emptyAxes,
      samples: 0,
    };
  }

  // Lazy day-rollover: if last battle wasn't today, battles_today is effectively 0.
  const lastDate = (data.last_battle_date as string | null) ?? null;
  const battlesToday =
    lastDate === today ? (data.battles_today as number) ?? 0 : 0;

  const axes: Axes8 = {
    reason_madness:       (data.ax_reason_madness       as number) ?? 0,
    lust_restraint:       (data.ax_lust_restraint       as number) ?? 0,
    seduction_directness: (data.ax_seduction_directness as number) ?? 0,
    chaos_order:          (data.ax_chaos_order          as number) ?? 0,
    violence_cunning:     (data.ax_violence_cunning     as number) ?? 0,
    nihility_obsession:   (data.ax_nihility_obsession   as number) ?? 0,
    mockery_empathy:      (data.ax_mockery_empathy      as number) ?? 0,
    deception_honesty:    (data.ax_deception_honesty    as number) ?? 0,
  };

  return {
    demonAffinity: (data.demon_affinity as Record<string, number> | null) ?? {},
    battlesToday,
    lastBattleDate: lastDate,
    possessedByDemonId: (data.possessed_by_demon_id as number | null) ?? null,
    possessedAt: (data.possessed_at as string | null) ?? null,
    axes,
    samples: (data.samples as number) ?? 0,
  };
}

/** Fetches the user's rank row, creating a default one if missing. */
export async function getUserRank(userId: string): Promise<UserRank> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("user_ranks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data as UserRank;

  // Create default if missing.
  if (error) console.warn("[users] getUserRank error:", error);
  const fresh: UserRank = {
    user_id: userId,
    rp: 0,
    highest_ai_level_beaten: 0,
    total_battles: 0,
    total_wins: 0,
    streak_days: 0,
    last_battle_date: null,
  };
  await supabase.from("user_ranks").upsert([fresh]);
  return fresh;
}
