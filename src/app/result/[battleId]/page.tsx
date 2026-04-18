import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";
import RpBonus from "@/components/RpBonus";
import PersonalitySection from "@/components/PersonalitySection";
import { AXIS_KEYS } from "@/types";
import type { Axes8, BattleResult, Theme } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { battleId: string };
  searchParams: {
    score?: string;
    result?: string;
    userHp?: string;
    aiHp?: string;
    theme?: string;
  };
}

export default async function ResultPage({ params, searchParams }: PageProps) {
  if (params.battleId === "local") {
    return (
      <ResultView
        score={Number(searchParams.score ?? 0)}
        result={(searchParams.result ?? "draw") as "win" | "loss" | "draw"}
        userHp={Number(searchParams.userHp ?? 0)}
        aiHp={Number(searchParams.aiHp ?? 0)}
        themeTitle={searchParams.theme ?? "議論"}
        roundsWon={undefined}
        battleHistory={undefined}
        savedToDb={false}
      />
    );
  }

  const supabase = getServerSupabase();
  const { data: battle, error } = await supabase
    .from("battles")
    .select("*, theme:themes(*)")
    .eq("id", params.battleId)
    .single<BattleResult & { theme: Theme }>();

  if (error || !battle) {
    notFound();
  }

  return (
    <ResultView
      score={battle.score}
      result={battle.result}
      userHp={battle.final_user_hp}
      aiHp={battle.final_ai_hp}
      themeTitle={battle.theme?.title ?? "議論"}
      roundsWon={battle.rounds_won}
      battleHistory={battle.battle_history}
      savedToDb={true}
      battleId={params.battleId}
    />
  );
}

interface ResultViewProps {
  score: number;
  result: "win" | "loss" | "draw";
  userHp: number;
  aiHp: number;
  themeTitle: string;
  roundsWon: number | undefined;
  battleHistory: BattleResult["battle_history"] | undefined;
  savedToDb: boolean;
  battleId?: string;
}

/** Strongest user response of the battle (highest sum of axes). */
function bestUserResponse(history: BattleResult["battle_history"] | undefined) {
  if (!history) return null;
  const scored = history
    .filter((r) => r.userInput && r.userInputAxes)
    .map((r) => {
      const axes = r.userInputAxes as Axes8;
      const total = AXIS_KEYS.reduce((s, k) => s + axes[k], 0);
      return { round: r.round, input: r.userInput as string, axes, total };
    })
    .sort((a, b) => b.total - a.total);
  return scored[0] ?? null;
}

function ResultView({
  score,
  result,
  userHp,
  aiHp,
  themeTitle,
  roundsWon,
  battleHistory,
  savedToDb,
  battleId,
}: ResultViewProps) {
  const headline =
    result === "win"
      ? { emoji: "🎉", text: "勝利！", color: "text-green-400" }
      : result === "loss"
      ? { emoji: "💥", text: "敗北", color: "text-red-400" }
      : { emoji: "🤝", text: "引き分け", color: "text-yellow-400" };

  const rank = rankFromScore(score);
  const best = bestUserResponse(battleHistory);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-10 space-y-4">
      {battleId && <RpBonus battleId={battleId} />}

      <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
        <p className="text-xs text-slate-400 mb-2">{themeTitle}</p>
        <div className="text-6xl mb-2">{headline.emoji}</div>
        <h1 className={`text-3xl font-black mb-6 ${headline.color}`}>
          {headline.text}
        </h1>

        <div className="bg-slate-900/50 rounded-xl p-5 mb-6">
          <p className="text-xs text-slate-400 mb-1">スコア</p>
          <p className="text-4xl font-black font-mono mb-4">
            {score.toLocaleString()}
          </p>

          <div className="flex justify-around text-sm">
            <div>
              <p className="text-slate-400 text-xs">ランク</p>
              <p className="font-bold text-lg">{rank}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">最終HP</p>
              <p className="font-mono">
                <span className="text-blue-300">{userHp}</span>
                <span className="text-slate-500"> vs </span>
                <span className="text-red-300">{aiHp}</span>
              </p>
            </div>
            {roundsWon !== undefined && (
              <div>
                <p className="text-slate-400 text-xs">勝ラウンド</p>
                <p className="font-mono">{roundsWon} / 7</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white py-4 rounded-xl text-center font-bold shadow-lg transition-all active:scale-[0.98]"
          >
            もう1回プレイ
          </Link>
          <ShareButton
            score={score}
            themeTitle={themeTitle}
            bestInput={best?.input}
          />
        </div>

        {!savedToDb && (
          <p className="mt-4 text-xs text-amber-400">
            ⚠️ 結果の保存に失敗したため、ローカル表示です
          </p>
        )}
      </div>

      {savedToDb && <PersonalitySection />}

      {best && (
        <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5 shadow-xl">
          <h2 className="text-sm font-bold text-slate-200 mb-2">
            ⚔️ あなたの最強応答
            <span className="text-xs text-slate-400 font-normal ml-2">
              Round {best.round}
            </span>
          </h2>
          <p className="text-sm text-slate-100 leading-relaxed bg-slate-900/50 rounded-xl p-3">
            「{best.input}」
          </p>
        </div>
      )}
    </div>
  );
}

function ShareButton({
  score,
  themeTitle,
  bestInput,
}: {
  score: number;
  themeTitle: string;
  bestInput?: string;
}) {
  const trim = bestInput && bestInput.length > 40 ? bestInput.slice(0, 38) + "…" : bestInput;
  const inputLine = trim ? `\n決め手:「${trim}」\n` : "\n";
  const text = `「${themeTitle}」で${score.toLocaleString()}点を取った。${inputLine}論獄で俺に勝てる？ #論獄`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-center font-semibold transition-all active:scale-[0.98]"
    >
      友人に共有
    </a>
  );
}

function rankFromScore(score: number): string {
  if (score >= 15000) return "🏆 Master";
  if (score >= 10000) return "🥇 Gold";
  if (score >= 7000) return "🥈 Silver";
  if (score >= 4000) return "🥉 Bronze";
  return "🎯 Rookie";
}
