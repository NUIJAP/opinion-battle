import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { judgeResult } from "@/lib/scoring";
import {
  calculateRpAward,
  didRankUp,
  getRankFromRp,
  getUserTier,
} from "@/lib/ranking";
import { markMatchupCompleted } from "@/lib/matchmaking";
import { tierForId } from "@/lib/ai-levels";
import { ensureAnonUser, getUserRank } from "@/lib/users";
import type { SaveBattleRequest, SaveBattleResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: SaveBattleRequest;
  try {
    body = (await req.json()) as SaveBattleRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body.theme_id ||
    typeof body.final_user_hp !== "number" ||
    typeof body.final_ai_hp !== "number" ||
    typeof body.score !== "number"
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const result = judgeResult(body.final_user_hp, body.final_ai_hp);
  const won = result === "win";
  // Default to id 5 (嘲, Tier 3) if omitted, matching ai-levels default.
  const aiLevelId = body.ai_level_id ?? 5;
  const aiTier = tierForId(aiLevelId);

  try {
    const supabase = getServerSupabase();

    // Resolve the anon user (create if missing).
    const userId = await ensureAnonUser(body.anon_user_id);
    const oldRank = await getUserRank(userId);

    const userTier = getUserTier(oldRank.rp);
    const rpAwarded = calculateRpAward({
      won,
      aiTier,
      userTier,
      finalUserHp: body.final_user_hp,
      roundsWon: body.rounds_won,
    });

    const newRp = oldRank.rp + rpAwarded;
    const newRankTier = getRankFromRp(newRp);
    const rankedUp = didRankUp(oldRank.rp, newRp);

    // Streak logic: if they played today vs yesterday, +1; if they skipped a day, reset to 1.
    const today = new Date().toISOString().slice(0, 10);
    const last = oldRank.last_battle_date;
    let newStreak = oldRank.streak_days;
    if (last === today) {
      // Already counted for today, no change.
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const y = yesterday.toISOString().slice(0, 10);
      newStreak = last === y ? oldRank.streak_days + 1 : 1;
    }

    // Insert the battle row.
    const { data: battleRow, error: insertErr } = await supabase
      .from("battles")
      .insert([
        {
          user_id: null, // legacy column; we use anon_user_id now
          theme_id: body.theme_id,
          user_stance: body.user_stance,
          final_user_hp: body.final_user_hp,
          final_ai_hp: body.final_ai_hp,
          result,
          score: body.score,
          rounds_won: body.rounds_won,
          battle_history: body.battle_history,
          player_count: 1,
          played_duration_seconds: body.played_duration_seconds,
          ai_level: aiLevelId,
          rp_awarded: rpAwarded,
          anon_user_id: userId,
        },
      ])
      .select("id")
      .single();

    if (insertErr || !battleRow) {
      console.error("[api/save-battle] insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to save battle" },
        { status: 500 }
      );
    }

    // Update user rank.
    await supabase
      .from("user_ranks")
      .update({
        rp: newRp,
        total_battles: oldRank.total_battles + 1,
        total_wins: oldRank.total_wins + (won ? 1 : 0),
        streak_days: newStreak,
        last_battle_date: today,
        highest_ai_level_beaten: won
          ? Math.max(oldRank.highest_ai_level_beaten, aiLevelId)
          : oldRank.highest_ai_level_beaten,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // Update per-theme mastery.
    await supabase.from("theme_mastery").upsert(
      [
        {
          user_id: userId,
          theme_id: body.theme_id,
          wins: 0, // Will be incremented via RPC ideally; for now just mark seen.
          losses: 0,
        },
      ],
      { onConflict: "user_id,theme_id", ignoreDuplicates: true }
    );
    // Increment wins/losses (two-step to keep it simple; upsert above ensures row exists).
    const masteryField = won ? "wins" : "losses";
    const { data: mastery } = await supabase
      .from("theme_mastery")
      .select("wins, losses, highest_ai_level_beaten")
      .eq("user_id", userId)
      .eq("theme_id", body.theme_id)
      .maybeSingle();
    if (mastery) {
      await supabase
        .from("theme_mastery")
        .update({
          [masteryField]:
            (masteryField === "wins" ? mastery.wins : mastery.losses) + 1,
          highest_ai_level_beaten: won
            ? Math.max(mastery.highest_ai_level_beaten, aiLevelId)
            : mastery.highest_ai_level_beaten,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("theme_id", body.theme_id);
    }

    // Mark the matchup completed (so the home screen shows ✓).
    if (body.matchup_id) {
      await markMatchupCompleted(body.matchup_id);
    }

    const response: SaveBattleResponse = {
      battleId: battleRow.id,
      rpAwarded,
      newTotalRp: newRp,
      newRankName: newRankTier.name,
      didRankUp: rankedUp,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/save-battle]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
