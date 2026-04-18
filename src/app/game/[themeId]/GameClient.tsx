"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AiLevel,
  BattleHistoryEntry,
  BattleRound,
  CounterChoice,
  GenerateCountersRequest,
  GenerateCountersResponse,
  GenerateStatementRequest,
  GenerateStatementResponse,
  SaveBattleRequest,
  SaveBattleResponse,
  StanceSide,
  Theme,
  UserAction,
} from "@/types";
import { useGameStore } from "@/store/gameStore";
import { MAX_ROUNDS, calculateScore, judgeResult } from "@/lib/scoring";
import HpBar from "@/components/HpBar";
import VoteButtons from "@/components/VoteButtons";
import AiStatementBubble from "@/components/AiStatementBubble";
import CounterChoices from "@/components/CounterChoices";
import AiCharacterBadge from "@/components/AiCharacterBadge";

const USER_ID_KEY = "rongoku.anonUserId";
const RESULT_OVERLAY_KEY = "rongoku.lastBattleResult";

interface GameClientProps {
  theme: Theme;
  userStanceSide: StanceSide;
  aiLevel: AiLevel;
  matchupId: string | null;
}

function toHistoryEntries(history: BattleRound[]): BattleHistoryEntry[] {
  return history.map((r) => ({
    round: r.round,
    aiStatement: r.aiStatement,
    userAction: r.userAction,
    userCounter: r.userCounter
      ? { label: r.userCounter.label, statement: r.userCounter.statement }
      : null,
  }));
}

async function fetchAiStatement(
  req: GenerateStatementRequest
): Promise<string> {
  try {
    const res = await fetch("/api/generate-statement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as GenerateStatementResponse;
    return data.statement;
  } catch (err) {
    console.error("[fetchAiStatement]", err);
    return "（通信エラーのため一時的に応答できません。もう一度お試しください。）";
  }
}

async function fetchCounterChoices(
  req: GenerateCountersRequest
): Promise<CounterChoice[]> {
  try {
    const res = await fetch("/api/generate-counters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as GenerateCountersResponse;
    return data.choices;
  } catch (err) {
    console.error("[fetchCounterChoices]", err);
    return [
      {
        id: "c1",
        angle: "データで反駁",
        label: "根拠を示せ",
        statement:
          "主張の根拠となる具体的なデータや研究結果を示してほしい。印象論では反論になっていない。",
      },
      {
        id: "c2",
        angle: "論理で反駁",
        label: "論点すり替え",
        statement:
          "その論理は本題から逸れている。前提から結論への飛躍があり、論証が成立していない。",
      },
      {
        id: "c3",
        angle: "倫理で反駁",
        label: "人間が抜けている",
        statement:
          "実際に影響を受ける人々の視点が抜け落ちている。効率論だけでは正当化できない問題だ。",
      },
    ];
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
    setAiStatement,
    applySimpleAction,
    applyCounterAction,
    setPendingCounters,
    commitRound,
    finishBattle,
    theme: storedTheme,
    userHp,
    aiHp,
    round,
    currentAiStatement,
    phase,
    pendingCounters,
  } = useGameStore();

  const [isSaving, setIsSaving] = useState(false);
  const hasInitialized = useRef(false);
  const isMounted = useRef(true);

  const userStanceName =
    userStanceSide === "a" ? theme.stance_a_name : theme.stance_b_name;
  const aiStanceName =
    userStanceSide === "a" ? theme.stance_b_name : theme.stance_a_name;

  // Init on mount.
  useEffect(() => {
    isMounted.current = true;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      startBattle(theme, userStanceSide);
      void loadInitialStatement();
    }
    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialStatement = async () => {
    setPhase("generating-ai");
    const statement = await fetchAiStatement({
      themeId: theme.id,
      userStanceSide,
      userAction: "none",
      roundNumber: 1,
      battleHistory: [],
      aiLevelId: aiLevel.id,
    });
    if (!isMounted.current) return;
    setAiStatement(statement);
    setPhase("voting");
  };

  // --- Vote handlers ---

  const handleLikeOrReference = async (action: "like" | "reference") => {
    if (phase !== "voting") return;

    applySimpleAction(action);
    const s = useGameStore.getState();
    if (s.round >= MAX_ROUNDS) {
      await finalizeBattle(s.history, s.userHp, s.aiHp, s.startedAt);
      return;
    }

    setPhase("generating-ai");
    const nextStatement = await fetchAiStatement({
      themeId: theme.id,
      userStanceSide,
      userAction: action,
      userCounter: null,
      roundNumber: s.round + 1,
      battleHistory: toHistoryEntries(s.history),
      aiLevelId: aiLevel.id,
    });
    if (!isMounted.current) return;
    commitRound(nextStatement);
  };

  const handleOpposePressed = async () => {
    if (phase !== "voting") return;
    setPhase("choosing-counter");
    setPendingCounters(null);
    const s = useGameStore.getState();
    const choices = await fetchCounterChoices({
      themeId: theme.id,
      userStanceSide,
      roundNumber: s.round,
      aiStatement: s.currentAiStatement,
      battleHistory: toHistoryEntries(s.history),
      aiLevelId: aiLevel.id,
    });
    if (!isMounted.current) return;
    if (useGameStore.getState().phase === "choosing-counter") {
      setPendingCounters(choices);
    }
  };

  const handleCounterCancel = () => {
    if (phase !== "choosing-counter") return;
    setPendingCounters(null);
    setPhase("voting");
  };

  const handleCounterPicked = async (counter: CounterChoice) => {
    if (phase !== "choosing-counter") return;

    applyCounterAction(counter);
    const s = useGameStore.getState();
    if (s.round >= MAX_ROUNDS) {
      await finalizeBattle(s.history, s.userHp, s.aiHp, s.startedAt);
      return;
    }

    setPhase("generating-ai");
    const nextStatement = await fetchAiStatement({
      themeId: theme.id,
      userStanceSide,
      userAction: "oppose",
      userCounter: counter,
      roundNumber: s.round + 1,
      battleHistory: toHistoryEntries(s.history),
      aiLevelId: aiLevel.id,
    });
    if (!isMounted.current) return;
    commitRound(nextStatement);
  };

  const handleVote = (action: UserAction) => {
    if (action === "oppose") void handleOpposePressed();
    else void handleLikeOrReference(action);
  };

  // --- Finalize ---

  const finalizeBattle = async (
    finalHistory: BattleRound[],
    finalUserHp: number,
    finalAiHp: number,
    startedAt: number | null
  ) => {
    setIsSaving(true);
    finishBattle();

    const roundsWon = finalHistory.filter(
      (r) => r.userHpAfter > r.aiHpAfter
    ).length;

    const score = calculateScore({
      finalUserHP: finalUserHp,
      roundsWon,
      playerCount: 1,
      winStreak: 0,
    });

    const duration = startedAt
      ? Math.round((Date.now() - startedAt) / 1000)
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
      battle_history: finalHistory,
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

      // Stash RP/rank info so the result screen can play the bonus animation
      // without a second DB round-trip.
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
        /* ignore quota errors */
      }
      router.push(`/result/${saveResp.battleId}`);
    } catch (err) {
      console.error("[finalizeBattle]", err);
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

  const votingDisabled =
    phase !== "voting" || isSaving || !currentAiStatement;
  const isGeneratingStatement = phase === "generating-ai";

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 flex flex-col gap-4">
      {/* Theme header */}
      <div className="text-center">
        <h2 className="text-lg font-bold leading-snug">{theme.title}</h2>
        <p className="text-xs text-slate-400 mt-1">
          あなた: <span className="text-blue-300">{userStanceName}</span>
          {" vs "}
          <span className="text-red-300">{aiStanceName}</span>
        </p>
      </div>

      {/* AI character card */}
      <AiCharacterBadge ai={aiLevel} variant="card" />

      {/* HP bars */}
      <div className="flex gap-3">
        <HpBar label="あなた" hp={userHp} color="user" />
        <HpBar label={`${aiLevel.emoji} ${aiLevel.name_jp}`} hp={aiHp} color="ai" />
      </div>

      {/* AI statement */}
      <AiStatementBubble
        statement={currentAiStatement}
        isLoading={isGeneratingStatement}
        aiStanceName={`${aiLevel.emoji} ${aiLevel.name_jp}（${aiStanceName}派）`}
        round={round}
        maxRounds={MAX_ROUNDS}
      />

      {/* Bottom area: either vote buttons or counter choices */}
      {phase === "choosing-counter" ? (
        <CounterChoices
          choices={pendingCounters}
          isLoading={pendingCounters === null}
          onPick={handleCounterPicked}
          onCancel={handleCounterCancel}
        />
      ) : (
        <div className="mt-1">
          <VoteButtons onVote={handleVote} disabled={votingDisabled} />
        </div>
      )}

      {/* Status */}
      {isSaving && (
        <p className="text-center text-sm text-slate-400 animate-pulse">
          バトル結果を集計中...
        </p>
      )}
    </div>
  );
}
