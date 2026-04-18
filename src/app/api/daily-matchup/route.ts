import { NextRequest, NextResponse } from "next/server";
import { ensureAnonUser, getUserRank, getUserStats } from "@/lib/users";
import { getOrCreateTodayMatchups } from "@/lib/matchmaking";
import { getAllAiLevels } from "@/lib/ai-levels";
import { getRankFromRp } from "@/lib/ranking";
import type { DailyMatchupResponse, PossessedByInfo } from "@/types";

const DAILY_BATTLE_LIMIT = 3;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/daily-matchup?userId=<uuid>
 *   Returns today's 3 matchups + rank summary for the given anon user.
 *   If userId is missing or invalid, a new anon user is created and
 *   its id is returned (client should persist it in localStorage).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawUserId = url.searchParams.get("userId");
    const userId = await ensureAnonUser(rawUserId);
    const rank = await getUserRank(userId);
    const [matchups, stats] = await Promise.all([
      getOrCreateTodayMatchups(userId, rank.rp),
      getUserStats(userId),
    ]);
    const rankTier = getRankFromRp(rank.rp);

    // Hydrate possessedBy with demon details if present.
    let possessedBy: PossessedByInfo | null = null;
    if (stats.possessedByDemonId != null) {
      const allLevels = await getAllAiLevels();
      const demon = allLevels.find((l) => l.id === stats.possessedByDemonId);
      if (demon) {
        possessedBy = {
          demonId: demon.id,
          demonName: demon.name_jp,
          demonTier: demon.tier_letter ?? "?",
          appearanceRate: stats.demonAffinity[String(demon.id)] ?? 0,
          taintSum: 0, // not stored — recomputable on /possessed page if needed
          possessedAt: stats.possessedAt ?? new Date().toISOString(),
        };
      }
    }

    const battlesToday = stats.battlesToday;
    const response: DailyMatchupResponse = {
      userId,
      matchups,
      rank: {
        rp: rank.rp,
        rankName: rankTier.name,
        totalBattles: rank.total_battles,
        totalWins: rank.total_wins,
        streakDays: rank.streak_days,
      },
      stamina: {
        battlesToday,
        max: DAILY_BATTLE_LIMIT,
        remaining: Math.max(0, DAILY_BATTLE_LIMIT - battlesToday),
        lastBattleDate: stats.lastBattleDate,
      },
      possessedBy,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/daily-matchup]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
