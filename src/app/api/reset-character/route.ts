import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import {
  decodeCharacterCode,
  defaultCharacterState,
  DEMON_COUNT,
} from "@/lib/character-code";
import type { Axes8 } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reset-character
 *   body: { anon_user_id: string, code?: string }
 *
 * Resets the user's character:
 *   - 8-axis values → from `code` (if valid) or zeros
 *   - demon_affinity → from `code` (if valid) or uniform 1/20
 *   - samples → 0
 *   - possessed_by_demon_id / possessed_at → null
 *   - battles_today / last_battle_date は保持 (スタミナを取り戻す裏技を防ぐ)
 *
 * Used by the /possessed game-over screen.
 */
export async function POST(req: NextRequest) {
  let body: { anon_user_id?: string; code?: string };
  try {
    body = (await req.json()) as { anon_user_id?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.anon_user_id) {
    return NextResponse.json(
      { error: "Missing anon_user_id" },
      { status: 400 },
    );
  }

  // Determine axes + affinity source.
  const state = body.code ? decodeCharacterCode(body.code) : null;
  if (body.code && !state) {
    return NextResponse.json(
      { error: "Invalid character code" },
      { status: 400 },
    );
  }
  const source = state ?? defaultCharacterState();

  // From CharacterState, ensure we have all 20 demon affinities.
  const affinity: Record<string, number> = {};
  for (let i = 1; i <= DEMON_COUNT; i++) {
    affinity[String(i)] = source.demonAffinities[i] ?? 1 / DEMON_COUNT;
  }

  const zeroAxes: Axes8 = {
    reason_madness: 0,
    lust_restraint: 0,
    seduction_directness: 0,
    chaos_order: 0,
    violence_cunning: 0,
    nihility_obsession: 0,
    mockery_empathy: 0,
    deception_honesty: 0,
  };
  // If restoring from a code, use decoded axes (1-5 range); otherwise zeros.
  const axes = state ? source.axes : zeroAxes;

  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("user_stats")
      .upsert(
        [
          {
            user_id: body.anon_user_id,
            ax_reason_madness: axes.reason_madness,
            ax_lust_restraint: axes.lust_restraint,
            ax_seduction_directness: axes.seduction_directness,
            ax_chaos_order: axes.chaos_order,
            ax_violence_cunning: axes.violence_cunning,
            ax_nihility_obsession: axes.nihility_obsession,
            ax_mockery_empathy: axes.mockery_empathy,
            ax_deception_honesty: axes.deception_honesty,
            samples: state ? 5 : 0, // restored code gets 5 samples so radar shows immediately
            demon_affinity: affinity,
            possessed_by_demon_id: null,
            possessed_at: null,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("[api/reset-character] upsert error:", error);
      return NextResponse.json(
        { error: "Failed to reset character" },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, restored: !!state });
  } catch (err) {
    console.error("[api/reset-character]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
