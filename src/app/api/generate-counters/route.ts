import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { generateCounterChoices } from "@/lib/claude";
import type {
  GenerateCountersRequest,
  GenerateCountersResponse,
  Theme,
} from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: GenerateCountersRequest;
  try {
    body = (await req.json()) as GenerateCountersRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body.themeId ||
    !body.userStanceSide ||
    !body.aiStatement ||
    !body.roundNumber
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: themeId, userStanceSide, aiStatement, roundNumber",
      },
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

    const choices = await generateCounterChoices(theme, body);
    const response: GenerateCountersResponse = { choices };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/generate-counters]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
