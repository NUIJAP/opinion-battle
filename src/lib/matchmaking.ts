import { getServerSupabase } from "@/lib/supabase";
import { getAllAiLevels, tierForId } from "@/lib/ai-levels";
import { getUserTier } from "@/lib/ranking";
import type { AiLevel, DifficultyTag, Matchup, Theme } from "@/types";

/**
 * Deterministic PRNG so a user re-opening the page on the same day
 * gets the same matchups (important: "today's 3 challenges" should feel fixed).
 * Seeded with user_id + date string.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Picks `n` random distinct items using the given PRNG. */
function pickN<T>(items: T[], n: number, rand: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rand() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

interface PickedMatchup {
  slot: number;
  theme: Theme;
  aiLevel: AiLevel;
  difficultyTag: DifficultyTag;
}

/**
 * Produces 3 matchups for the given user:
 *   slot 1 = below (格下)
 *   slot 2 = equal (同格)
 *   slot 3 = above (格上)
 * Each slot uses a distinct theme so the user never plays the same
 * theme twice in a day's set.
 */
export function buildMatchupsInMemory(
  userId: string,
  date: string, // YYYY-MM-DD
  userRp: number,
  themes: Theme[],
  aiLevels: AiLevel[]
): PickedMatchup[] {
  if (themes.length === 0 || aiLevels.length === 0) return [];

  const rand = mulberry32(hashSeed(`${userId}:${date}`));
  const userTier = getUserTier(userRp); // 1-5

  // Pick 3 distinct themes (or all available if fewer).
  const pickedThemes = pickN(themes, 3, rand);

  // Pad with repeats if fewer than 3 themes exist (shouldn't happen in Phase 1 seed).
  while (pickedThemes.length < 3 && themes.length > 0) {
    pickedThemes.push(themes[pickedThemes.length % themes.length]);
  }

  const tags: DifficultyTag[] = ["below", "equal", "above"];
  const matchups: PickedMatchup[] = [];
  // Track ids already used so the user gets 3 distinct 獄吏 in the day.
  const usedIds = new Set<number>();

  tags.forEach((tag, i) => {
    let targetTier = userTier;
    if (tag === "below") targetTier = Math.max(1, userTier - 1);
    else if (tag === "above") targetTier = Math.min(6, userTier + 1);

    const candidates = aiLevels.filter(
      (l) => (l.tier ?? tierForId(l.id)) === targetTier && !usedIds.has(l.id)
    );

    let aiLevel: AiLevel;
    if (candidates.length > 0) {
      aiLevel = candidates[Math.floor(rand() * candidates.length)];
    } else {
      // Tier empty (or all used) → fall back to nearest tier.
      const fallbackPool = aiLevels.filter((l) => !usedIds.has(l.id));
      const pool = fallbackPool.length > 0 ? fallbackPool : aiLevels;
      aiLevel = pool[Math.floor(rand() * pool.length)];
    }
    usedIds.add(aiLevel.id);

    matchups.push({
      slot: i + 1,
      theme: pickedThemes[i],
      aiLevel,
      difficultyTag: tag,
    });
  });

  return matchups;
}

/**
 * Fetches or creates today's matchups for the user, stored in daily_matchups.
 * Returns the full rich objects (theme + aiLevel embedded).
 */
export async function getOrCreateTodayMatchups(
  userId: string,
  userRp: number
): Promise<Matchup[]> {
  const supabase = getServerSupabase();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 1) Try cache hit.
  const { data: existing } = await supabase
    .from("daily_matchups")
    .select("id, slot, theme_id, ai_level, difficulty_tag, completed")
    .eq("user_id", userId)
    .eq("matchup_date", today)
    .order("slot");

  if (existing && existing.length === 3) {
    return hydrateMatchups(existing);
  }

  // 2) Build fresh. Load themes + AI levels in parallel.
  const [themesRes, aiLevels] = await Promise.all([
    supabase.from("themes").select("*").eq("active", true),
    getAllAiLevels(),
  ]);

  const themes = (themesRes.data ?? []) as Theme[];
  if (themes.length === 0) {
    return [];
  }

  const picks = buildMatchupsInMemory(userId, today, userRp, themes, aiLevels);
  if (picks.length === 0) return [];

  // 3) Persist so repeat opens on the same day are stable.
  // Use UPSERT to survive retries during a buggy run.
  const rows = picks.map((p) => ({
    user_id: userId,
    matchup_date: today,
    slot: p.slot,
    theme_id: p.theme.id,
    ai_level: p.aiLevel.id,
    difficulty_tag: p.difficultyTag,
    completed: false,
  }));
  const { data: inserted, error: insertErr } = await supabase
    .from("daily_matchups")
    .upsert(rows, { onConflict: "user_id,matchup_date,slot" })
    .select("id, slot, theme_id, ai_level, difficulty_tag, completed");

  if (insertErr) {
    console.error("[matchmaking] insert error:", insertErr);
    // Even if DB write failed, return in-memory matchups so UX doesn't block.
    return picks.map((p, i) => ({
      id: `local-${i + 1}`,
      slot: p.slot,
      theme: p.theme,
      aiLevel: p.aiLevel,
      difficultyTag: p.difficultyTag,
      completed: false,
    }));
  }

  return hydrateMatchups(inserted ?? rows);
}

interface DailyMatchupRow {
  id?: string;
  slot: number;
  theme_id: string;
  ai_level: number;
  difficulty_tag: string;
  completed: boolean;
}

async function hydrateMatchups(rows: DailyMatchupRow[]): Promise<Matchup[]> {
  const supabase = getServerSupabase();
  const themeIds = Array.from(new Set(rows.map((r) => r.theme_id)));
  const levelIds = Array.from(new Set(rows.map((r) => r.ai_level)));

  const [themesRes, aiLevels] = await Promise.all([
    supabase.from("themes").select("*").in("id", themeIds),
    getAllAiLevels(),
  ]);

  const themeById = new Map<string, Theme>(
    (themesRes.data ?? []).map((t) => [t.id, t as Theme])
  );
  const levelById = new Map<number, AiLevel>(
    aiLevels.filter((l) => levelIds.includes(l.id)).map((l) => [l.id, l])
  );

  const sorted = [...rows].sort((a, b) => a.slot - b.slot);
  return sorted
    .map<Matchup | null>((r) => {
      const theme = themeById.get(r.theme_id);
      const aiLevel = levelById.get(r.ai_level);
      if (!theme || !aiLevel) return null;
      return {
        id: r.id ?? `local-${r.slot}`,
        slot: r.slot,
        theme,
        aiLevel,
        difficultyTag: r.difficulty_tag as DifficultyTag,
        completed: r.completed,
      };
    })
    .filter((m): m is Matchup => m !== null);
}

/** Marks a matchup as completed after the battle saves. */
export async function markMatchupCompleted(matchupId: string): Promise<void> {
  if (!matchupId || matchupId.startsWith("local-")) return;
  const supabase = getServerSupabase();
  await supabase
    .from("daily_matchups")
    .update({ completed: true })
    .eq("id", matchupId);
}
