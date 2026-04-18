import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import type { UserStats } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/user-stats?userId=<uuid>
 *   Returns the user's accumulated 8-axis personality vector and sample count.
 *   404 if the user has no stats row yet.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) console.warn("[api/user-stats] read error:", error);
    if (!data) {
      return NextResponse.json({ error: "no_stats" }, { status: 404 });
    }
    return NextResponse.json(data as UserStats);
  } catch (err) {
    console.error("[api/user-stats]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
