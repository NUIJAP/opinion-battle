import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { generateAIStatement } from "@/lib/claude";
import type {
  GenerateStatementRequest,
  GenerateStatementResponse,
  Theme,
} from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: GenerateStatementRequest;
  try {
    body = (await req.json()) as GenerateStatementRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Minimal validation
  if (!body.themeId || !body.userStanceSide || !body.roundNumber) {
    return NextResponse.json(
      { error: "Missing required fields: themeId, userStanceSide, roundNumber" },
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

    const result = await generateAIStatement(theme, body);
    const response: GenerateStatementResponse = {
      statement: result.statement,
      tone: result.tone,
      keyPoint: result.keyPoint,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/generate-statement]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
