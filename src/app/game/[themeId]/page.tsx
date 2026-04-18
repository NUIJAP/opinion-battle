import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";
import { getAiLevelById } from "@/lib/ai-levels";
import type { AiLevel, StanceSide, Theme } from "@/types";
import GameClient from "./GameClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { themeId: string };
  searchParams: {
    stance?: string;
    matchupId?: string;
    aiLevel?: string;
  };
}

export default async function GamePage({ params, searchParams }: PageProps) {
  const stance = searchParams.stance;
  if (stance !== "a" && stance !== "b") {
    notFound();
  }

  const supabase = getServerSupabase();
  const { data: theme, error } = await supabase
    .from("themes")
    .select("*")
    .eq("id", params.themeId)
    .eq("active", true)
    .single<Theme>();

  if (error || !theme) {
    notFound();
  }

  // Resolve the AI character (defaults to id 5 if missing/invalid).
  const aiLevelIdRaw = parseInt(searchParams.aiLevel ?? "", 10);
  const aiLevelId = Number.isFinite(aiLevelIdRaw) && aiLevelIdRaw > 0 ? aiLevelIdRaw : 5;
  const aiLevel: AiLevel = await getAiLevelById(aiLevelId);

  return (
    <GameClient
      theme={theme}
      userStanceSide={stance as StanceSide}
      aiLevel={aiLevel}
      matchupId={searchParams.matchupId ?? null}
    />
  );
}
