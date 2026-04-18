"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AiLevel,
  BattleHistoryEntry,
  GenerateStatementRequest,
  GenerateStatementResponse,
  HelperPick,
  HelperPickRequest,
  HelperPickResponse,
  SaveBattleRequest,
  SaveBattleResponse,
  StanceSide,
  Theme,
} from "@/types";
import { useGameStore } from "@/store/gameStore";
import { MAX_ROUNDS, calculateScore, judgeResult } from "@/lib/scoring";
import HpBar from "@/components/HpBar";
import AiStatementBubble from "@/components/AiStatementBubble";
import AiCharacterBadge from "@/components/AiCharacterBadge";
import TextInputArea from "@/components/TextInputArea";
import HelperPanel from "@/components/HelperPanel";
import HpZeroOverlay from "@/components/HpZeroOverlay";

const USER_ID_KEY = "rongoku.anonUserId";
const RESULT_OVERLAY_KEY = "rongoku.lastBattleResult";

interface GameClientProps {
  theme: Theme;
  userStanceSide: StanceSide;
  aiLevel: AiLevel;
  matchupId: string | null;
}

async function fetchStatement(
  req: GenerateStatementRequest
): Promise<GenerateStatementResponse | null> {
  try {
    const res = await fetch("/api/generate-statement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as GenerateStatementResponse;
  } catch (err) {
    console.error("[fetchStatement]", err);
    return null;
  }
}

async function fetchHelpers(
  req: HelperPickRequest
): Promise<HelperPick[]> {
  try {
    const res = await fetch("/api/helper-pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as HelperPickResponse;
    return data.picks;
  } catch (err) {
    console.error("[fetchHelpers]", err);
    return [];
  }
}

export default function GameClient({
  theme,
  userStanceSide,
  aiLevel,
  matchupId,
}: GameClientProps) {
  const router = useRouter();
  const {
    startBattle,
    setPhase,
    setOpeningStatement,
    summonHelper,
    applyRoundResponse,
    finishBattle,
    theme: storedTheme,
    userHp,
    aiHp,
    round,
    currentAiStatement,
    phase,
    history,
    helpersSummonedThisRound,
    summonedHelperIds,
  } = useGameStore();

  const [helperPicks, setHelperPicks] = useState<HelperPick[] | null>(null);
  const [isLoadingHelpers, setIsLoadingHelpers] = useState(false);
  const [overlay, setOverlay] = useState<"win" | "loss" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasInitialized = useRef(false);
  const isMounted = useRef(true);

  const userStanceName =
    userStanceSide === "a" ? theme.stance_a_name : theme.stance_b_name;
  const aiStanceName =
    userStanceSide === "a" ? theme.stance_b_name : theme.stance_a_name;

  // Initial mount: opening statement.
  useEffect(() => {
    isMounted.current = true;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      startBattle(theme, userStanceSide);
      void loadOpening();
    }
    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOpening = async () => {
    setPhase("generating-ai");
    const resp = await fetchStatement({
      themeId: theme.id,
      userStanceSide,
      roundNumber: 1,
      battleHistory: [],
      aiLevelId: aiLevel.id,
      userInput: null,
      summonedHelperId: null,
    });
    if (!isMounted.current) return;
    if (!resp) {
      // Fallback: synthesize opener from stance summary.
      setOpeningStatement(
        userStanceSide === "a" ? theme.stance_b_summary : theme.stance_a_summary,
        8
      );
    } else {
      setOpeningStatement(resp.statement, resp.hpDamageToUser);
    }
    void loadHelpers();
  };

  const loadHelpers = async () => {
    setIsLoadingHelpers(true);
    setHelperPicks(null);
    const picks = await fetchHelpers({
      themeId: theme.id,
      opponentAiLevelId: aiLevel.id,
      excludeIds: summonedHelperIds,
      count: 3,
    });
    if (!isMounted.current) return;
    setHelperPicks(picks);
    setIsLoadingHelpers(false);
  };

  const toHistoryEntries = (h: typeof history): BattleHistoryEntry[] =>
    h.map((r) => ({
      round: r.round,
      aiStatement: r.aiStatement,
      userInput: r.userInput,
      userInputAxes: r.userInputAxes,
      summonedHelperId: r.summonedHelperId,
    }));

  const handleSubmit = async (text: string) => {
    if (phase !== "input") return;
    setPhase("generating-ai");

    // The API call advances us to the NEXT round's AI statement.
    const nextRoundNumber = round + 1;
    const resp = await fetchStatement({
      themeId: theme.id,
      userStanceSide,
      roundNumber: nextRoundNumber,
      battleHistory: toHistoryEntries(history),
      aiLevelId: aiLevel.id,
      userInput: text,
      summonedHelperId: helpersSummonedThisRound,
    });
    if (!isMounted.current) return;

    const fallback: GenerateStatementResponse = {
      statement:
        "（通信エラーのため一時的に応答できません。次のラウンドへ進む）",
      hpDamageToUser: 8,
      hpDamageToAi: 6,
      userInputAxes: null,
    };
    const r = resp ?? fallback;

    const { battleOver } = applyRoundResponse(aiStanceName, {
      userInput: text,
      userInputAxes: r.userInputAxes ?? null,
      summonedHelperId: helpersSummonedThisRound,
      hpDamageToUser: r.hpDamageToUser,
      hpDamageToAi: r.hpDamageToAi,
      nextAiStatement: r.statement,
    });

    const s = useGameStore.getState();
    const reachedRoundCap = s.round > MAX_ROUNDS;

    if (battleOver || reachedRoundCap) {
      const loser: "user" | "ai" =
        s.userHp <= 0 ? "user" : s.aiHp <= 0 ? "ai" : (s.userHp >= s.aiHp ? "ai" : "user");
      setOverlay(loser === "user" ? "loss" : "win");
      // The overlay fires onComplete which triggers finalize.
    } else {
      // Still alive → fetch fresh helpers for the next round.
      void loadHelpers();
    }
  };

  const handleSummonHelper = (helperId: number) => {
    summonHelper(helperId);
  };

  // ---- Finalize after the overlay finishes ----
  const finalize = async () => {
    if (isSaving) return;
    setIsSaving(true);
    finishBattle();
    const s = useGameStore.getState();

    const finalUserHp = s.userHp;
    const finalAiHp = s.aiHp;
    const roundsWon = s.history.filter(
      (r) => r.userHpAfter > r.aiHpAfter
    ).length;

    const score = calculateScore({
      finalUserHP: finalUserHp,
      roundsWon,
      playerCount: 1,
      winStreak: 0,
    });
    const duration = s.startedAt
      ? Math.round((Date.now() - s.startedAt) / 1000)
      : 0;
    const anonUserId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(USER_ID_KEY)
        : null;

    const payload: SaveBattleRequest = {
      theme_id: theme.id,
      user_stance: userStanceName,
      final_user_hp: finalUserHp,
      final_ai_hp: finalAiHp,
      score,
      rounds_won: roundsWon,
      battle_history: s.history,
      played_duration_seconds: duration,
      matchup_id: matchupId ?? null,
      ai_level_id: aiLevel.id,
      anon_user_id: anonUserId,
    };

    try {
      const res = await fetch("/api/save-battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      const saveResp = (await res.json()) as SaveBattleResponse;
      if (!isMounted.current) return;
      try {
        window.sessionStorage.setItem(
          RESULT_OVERLAY_KEY,
          JSON.stringify({
            battleId: saveResp.battleId,
            rpAwarded: saveResp.rpAwarded,
            newTotalRp: saveResp.newTotalRp,
            newRankName: saveResp.newRankName,
            didRankUp: saveResp.didRankUp,
            aiLevel,
          })
        );
      } catch {
        /* ignore */
      }
      router.push(`/result/${saveResp.battleId}`);
    } catch (err) {
      console.error("[finalize]", err);
      const result = judgeResult(finalUserHp, finalAiHp);
      const fallbackUrl = `/result/local?score=${score}&result=${result}&userHp=${finalUserHp}&aiHp=${finalAiHp}&theme=${encodeURIComponent(theme.title)}`;
      if (!isMounted.current) return;
      router.push(fallbackUrl);
    }
  };

  if (!storedTheme) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-8">
        <p className="text-slate-300 text-center">ゲームを準備中...</p>
      </div>
    );
  }

  const isGenerating = phase === "generating-ai";
  const inputDisabled = phase !== "input";

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 flex flex-col gap-4">
      <div className="text-center">
        <h2 className="text-lg font-bold leading-snug">{theme.title}</h2>
        <p className="text-xs text-slate-400 mt-1">
          あなた: <span className="text-blue-300">{userStanceName}</span>
          {" vs "}
          <span className="text-red-300">{aiStanceName}</span>
        </p>
      </div>

      <AiCharacterBadge ai={aiLevel} variant="card" />

      <div className="flex gap-3">
        <HpBar label="あなた" hp={userHp} color="user" />
        <HpBar
          label={`${aiLevel.emoji} ${aiLevel.name_jp}`}
          hp={aiHp}
          color="ai"
        />
      </div>

      <AiStatementBubble
        statement={currentAiStatement}
        isLoading={isGenerating}
        aiStanceName={`${aiLevel.emoji} ${aiLevel.name_jp}（${aiStanceName}派）`}
        round={round}
        maxRounds={MAX_ROUNDS}
      />

      <HelperPanel
        picks={helperPicks}
        isLoading={isLoadingHelpers}
        disabled={inputDisabled}
        onSummon={handleSummonHelper}
        summonedThisRound={helpersSummonedThisRound}
        userHp={userHp}
      />

      <TextInputArea
        disabled={inputDisabled || isSaving}
        onSubmit={handleSubmit}
      />

      {isSaving && (
        <p className="text-center text-sm text-slate-400 animate-pulse">
          バトル結果を集計中...
        </p>
      )}

      {overlay && (
        <HpZeroOverlay
          loser={overlay === "loss" ? "user" : "ai"}
          aiName={`${aiLevel.emoji} ${aiLevel.name_jp}`}
          onComplete={finalize}
        />
      )}
    </div>
  );
}
