"use client";

import { useEffect, useState } from "react";
import type { AiLevel, UserStats } from "@/types";
import {
  PERSONALITY_JUDGING_UNTIL,
  aiLevelVector,
  axesToJpList,
  bestAffinityAi,
  personalityType,
  userStatsVector,
} from "@/lib/affinity";
import { FALLBACK_AI_LEVELS } from "@/lib/ai-levels";
import PersonalityRadar from "@/components/PersonalityRadar";

const USER_ID_KEY = "rongoku.anonUserId";

/**
 * Self-contained client section for the result page.
 * Fetches the user's accumulated 8-axis stats and renders:
 *   - "判定中…" while samples < threshold
 *   - 8-axis radar chart
 *   - personality type name + comment
 *   - best-matched 獄吏 (overlay on the radar)
 */
export default function PersonalitySection() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiPool, setAiPool] = useState<AiLevel[]>(FALLBACK_AI_LEVELS);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const userId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(USER_ID_KEY)
          : null;
      if (!userId) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/user-stats?userId=${encodeURIComponent(userId)}`
        );
        if (res.ok) {
          const data = (await res.json()) as UserStats;
          if (!cancelled) setStats(data);
        }
      } catch (err) {
        console.error("[PersonalitySection]", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    // Pool stays as fallback unless we wire up another fetch.
    void aiPool;
    setAiPool(FALLBACK_AI_LEVELS);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5 shadow-xl">
      <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
        🧬 あなたの議論性格
        {stats && (
          <span className="text-[10px] text-slate-500 font-normal font-mono">
            ({stats.samples}/{PERSONALITY_JUDGING_UNTIL} 判定サンプル)
          </span>
        )}
      </h2>

      {loading ? (
        <div className="h-48 bg-slate-900/40 rounded-xl animate-pulse" />
      ) : !stats || stats.samples < PERSONALITY_JUDGING_UNTIL ? (
        <JudgingState samples={stats?.samples ?? 0} />
      ) : (
        <Diagnosed stats={stats} aiPool={aiPool} />
      )}
    </div>
  );
}

function JudgingState({ samples }: { samples: number }) {
  const remaining = Math.max(0, PERSONALITY_JUDGING_UNTIL - samples);
  return (
    <div className="text-center py-8">
      <p className="text-3xl font-black text-slate-300 mb-2 animate-pulse">
        判定中…
      </p>
      <p className="text-xs text-slate-400">
        あと <span className="font-mono text-amber-300">{remaining}</span> 戦で
        性格診断を公開
      </p>
      <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
        各バトルでのあなたの応答 + 召喚した獄吏の傾向を集計しています。
      </p>
    </div>
  );
}

function Diagnosed({
  stats,
  aiPool,
}: {
  stats: UserStats;
  aiPool: AiLevel[];
}) {
  const v = userStatsVector(stats);
  const type = personalityType(v);
  const best = bestAffinityAi(v, aiPool);

  return (
    <div className="space-y-4">
      <PersonalityRadar
        axes={v}
        overlay={best ? aiLevelVector(best) : undefined}
        overlayLabel={best ? `${best.emoji} ${best.name_jp}` : undefined}
      />

      <div className="bg-slate-900/50 rounded-xl p-4 text-center">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider">
          診断タイプ
        </p>
        <p className="text-2xl font-black text-rose-300 my-1">{type.name}</p>
        <p className="text-xs text-slate-300 leading-relaxed">
          {type.description}
        </p>
        <p className="text-[10px] text-slate-500 mt-2">
          強い軸: {axesToJpList(type.topAxes)} ／ 弱い軸: {axesToJpList(type.bottomAxes)}
        </p>
      </div>

      {best && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 text-center">
          <p className="text-[11px] text-amber-300 mb-1">
            💛 このキャラと相性良い
          </p>
          <p className="text-base font-bold text-slate-100">
            {best.emoji} {best.name_jp}
            {best.tier !== undefined && (
              <span className="ml-2 text-[10px] text-slate-400 font-mono">
                Tier {best.tier}
              </span>
            )}
          </p>
          <p className="text-[11px] text-slate-300 mt-1 leading-snug">
            {best.tagline}
          </p>
        </div>
      )}
    </div>
  );
}
