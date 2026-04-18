"use client";

import { useEffect, useState } from "react";
import type { AiLevel } from "@/types";

const RESULT_OVERLAY_KEY = "rongoku.lastBattleResult";

interface StashedResult {
  battleId: string;
  rpAwarded: number;
  newTotalRp: number;
  newRankName: string;
  didRankUp: boolean;
  aiLevel?: AiLevel;
}

interface RpBonusProps {
  battleId: string;
}

/**
 * Client-side RP/rank-up overlay. Reads the just-finished battle's reward
 * from sessionStorage (stashed by GameClient) and animates the RP gained.
 * Renders nothing if the user landed here without going through the game
 * loop (e.g. shared link, refresh).
 */
export default function RpBonus({ battleId }: RpBonusProps) {
  const [result, setResult] = useState<StashedResult | null>(null);
  const [displayRp, setDisplayRp] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(RESULT_OVERLAY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StashedResult;
      if (parsed.battleId !== battleId) return; // stale; ignore.
      setResult(parsed);
    } catch {
      /* ignore */
    }
  }, [battleId]);

  // Tick up RP gained for visual effect.
  useEffect(() => {
    if (!result) return;
    if (result.rpAwarded <= 0) {
      setDisplayRp(0);
      return;
    }
    const target = result.rpAwarded;
    const startedAt = performance.now();
    const durationMs = 900;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayRp(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [result]);

  if (!result) return null;
  const isLoss = result.rpAwarded === 0;

  return (
    <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
      {result.aiLevel && (
        <p className="text-xs text-slate-400 text-center">
          対戦相手: {result.aiLevel.emoji}{" "}
          <span className="text-slate-200 font-bold">
            {result.aiLevel.name_jp}
          </span>
          {result.aiLevel.tier !== undefined && (
            <span className="ml-1 text-slate-500">(Tier {result.aiLevel.tier})</span>
          )}
        </p>
      )}

      <div className="text-center">
        <p className="text-[11px] text-slate-400 uppercase tracking-widest">
          RP 獲得
        </p>
        <p
          className={`text-5xl font-black font-mono ${
            isLoss ? "text-slate-500" : "text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.4)]"
          }`}
        >
          {isLoss ? "0" : `+${displayRp.toLocaleString()}`}
        </p>
        {isLoss && (
          <p className="text-[11px] text-slate-500 mt-1">
            敗北では RP は減らない。明日また挑め。
          </p>
        )}
      </div>

      <div className="flex items-center justify-between bg-slate-900/50 rounded-xl px-4 py-3">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            Rank
          </p>
          <p
            className={`text-lg font-black ${
              result.didRankUp ? "text-rose-300 animate-pulse" : "text-amber-300"
            }`}
          >
            {result.newRankName}
            {result.didRankUp && (
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 font-mono align-middle">
                RANK UP!
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            総 RP
          </p>
          <p className="text-lg font-mono font-black text-slate-100">
            {result.newTotalRp.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
