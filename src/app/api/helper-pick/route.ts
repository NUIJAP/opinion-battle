import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getAllAiLevels } from "@/lib/ai-levels";
import { pickHelpers } from "@/lib/affinity";
import type {
  HelperPickRequest,
  HelperPickResponse,
  Theme,
} from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/helper-pick
 *   Returns N (default 3) random helper characters from the 10 獄吏,
 *   excluding the current opponent and any already-summoned helpers.
 *   Each pick comes with a match% computed against the theme's topic_axes.
 */
export async function POST(req: NextRequest) {
  let body: HelperPickRequest;
  try {
    body = (await req.json()) as HelperPickRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.themeId || !body.opponentAiLevelId) {
    return NextResponse.json(
      { error: "Missing required fields: themeId, opponentAiLevelId" },
      { status: 400 }
    );
  }

  try {
    const supabase = getServerSupabase();
    const { data: theme, error } = await supabase
      .from("themes")
      .select("*")
      .eq("id", body.themeId)
      .single<Theme>();

    if (error || !theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    const allLevels = await getAllAiLevels();
    const exclude = new Set<number>([body.opponentAiLevelId, ...(body.excludeIds ?? [])]);
    const pool = allLevels.filter((l) => !exclude.has(l.id));
    const picks = pickHelpers(pool, theme, body.count ?? 3);

    const response: HelperPickResponse = { picks };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/helper-pick]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
