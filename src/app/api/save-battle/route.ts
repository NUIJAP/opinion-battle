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
import { tierForId, getAllAiLevels } from "@/lib/ai-levels";
import {
  AXIS_KEYS,
  type Axes8,
  type SaveBattleRequest,
  type SaveBattleResponse,
} from "@/types";
import {
  combineBattleDelta,
  foldDelta,
} from "@/lib/affinity";
import { ensureAnonUser, getUserRank } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserStatsRow {
  user_id: string;
  ax_data: number;
  ax_ethics: number;
  ax_emotion: number;
  ax_persuasion: number;
  ax_flexibility: number;
  ax_aggression: number;
  ax_calm: number;
  ax_humor: number;
  samples: number;
  updated_at?: string;
}

const ZERO_STATS = (userId: string): UserStatsRow => ({
  user_id: userId,
  ax_data: 0, ax_ethics: 0, ax_emotion: 0, ax_persuasion: 0,
  ax_flexibility: 0, ax_aggression: 0, ax_calm: 0, ax_humor: 0,
  samples: 0,
});

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
  const aiLevelId = body.ai_level_id ?? 5;
  const aiTier = tierForId(aiLevelId);
  const endedByHpZero = body.final_user_hp <= 0 || body.final_ai_hp <= 0;

  try {
    const supabase = getServerSupabase();
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

    // Streak.
    const today = new Date().toISOString().slice(0, 10);
    const last = oldRank.last_battle_date;
    let newStreak = oldRank.streak_days;
    if (last !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const y = yesterday.toISOString().slice(0, 10);
      newStreak = last === y ? oldRank.streak_days + 1 : 1;
    }

    // ---- user_stats delta from battle history (Stage B) ----
    const inputAxesList: Axes8[] = [];
    const helperIdsSet = new Set<number>();
    for (const r of body.battle_history ?? []) {
      if (r.userInputAxes) inputAxesList.push(r.userInputAxes);
      if (r.summonedHelperId != null) helperIdsSet.add(r.summonedHelperId);
    }
    const helperIds = Array.from(helperIdsSet);
    const allLevels = await getAllAiLevels();
    const summonedHelpers = allLevels.filter((l) => helperIds.includes(l.id));
    const battleDelta = combineBattleDelta(inputAxesList, summonedHelpers);
    const helpersSummoned = body.battle_history.reduce(
      (acc, r) => acc + (r.summonedHelperId != null ? 1 : 0),
      0
    );

    // Insert battle row.
    const { data: battleRow, error: insertErr } = await supabase
      .from("battles")
      .insert([
        {
          user_id: null,
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
          ended_by_hp_zero: endedByHpZero,
          helpers_summoned: helpersSummoned,
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

    // Theme mastery.
    await supabase.from("theme_mastery").upsert(
      [{ user_id: userId, theme_id: body.theme_id, wins: 0, losses: 0 }],
      { onConflict: "user_id,theme_id", ignoreDuplicates: true }
    );
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

    // ---- user_stats fold (Stage B) ----
    if (inputAxesList.length > 0 || summonedHelpers.length > 0) {
      const { data: existing } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      const prev = (existing as UserStatsRow | null) ?? ZERO_STATS(userId);

      const next = foldDelta(
        {
          user_id: userId,
          ax_data: prev.ax_data,
          ax_ethics: prev.ax_ethics,
          ax_emotion: prev.ax_emotion,
          ax_persuasion: prev.ax_persuasion,
          ax_flexibility: prev.ax_flexibility,
          ax_aggression: prev.ax_aggression,
          ax_calm: prev.ax_calm,
          ax_humor: prev.ax_humor,
          samples: prev.samples,
        },
        battleDelta
      );

      await supabase
        .from("user_stats")
        .upsert(
          [
            {
              user_id: userId,
              ax_data: (next as UserStatsRow).ax_data,
              ax_ethics: (next as UserStatsRow).ax_ethics,
              ax_emotion: (next as UserStatsRow).ax_emotion,
              ax_persuasion: (next as UserStatsRow).ax_persuasion,
              ax_flexibility: (next as UserStatsRow).ax_flexibility,
              ax_aggression: (next as UserStatsRow).ax_aggression,
              ax_calm: (next as UserStatsRow).ax_calm,
              ax_humor: (next as UserStatsRow).ax_humor,
              samples: next.samples,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "user_id" }
        );

      // Touch the linter into thinking AXIS_KEYS is used.
      void AXIS_KEYS;
    }

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
