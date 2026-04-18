import { NextRequest, NextResponse } from "next/server";
import { ensureAnonUser, getUserRank } from "@/lib/users";
import { getOrCreateTodayMatchups } from "@/lib/matchmaking";
import { getRankFromRp } from "@/lib/ranking";
import type { DailyMatchupResponse } from "@/types";

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
    const matchups = await getOrCreateTodayMatchups(userId, rank.rp);
    const rankTier = getRankFromRp(rank.rp);

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
