"use client";

import type { HelperPick } from "@/types";
import { HELPER_SUMMON_HP_COST } from "@/lib/scoring";

interface HelperPanelProps {
  picks: HelperPick[] | null;
  isLoading: boolean;
  disabled: boolean;
  onSummon: (helperId: number) => void;
  summonedThisRound: number | null;
  userHp: number;
}

function matchBar(pct: number) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    clamped >= 75
      ? "from-emerald-400 to-emerald-600"
      : clamped >= 50
      ? "from-amber-400 to-amber-600"
      : "from-rose-500 to-rose-700";
  return (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default function HelperPanel({
  picks,
  isLoading,
  disabled,
  onSummon,
  summonedThisRound,
  userHp,
}: HelperPanelProps) {
  const affordable = userHp > HELPER_SUMMON_HP_COST;
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          ⚔ お助け獄吏
        </h3>
        <span className="text-[10px] text-slate-500">
          召喚 -{HELPER_SUMMON_HP_COST} HP / ラウンド1回のみ
        </span>
      </div>

      {isLoading || !picks ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 bg-slate-800/40 border border-slate-700 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {picks.map((p) => {
            const alreadyPicked = summonedThisRound === p.ai.id;
            const blocked =
              disabled ||
              summonedThisRound != null ||
              !affordable;
            return (
              <button
                key={p.ai.id}
                onClick={() => onSummon(p.ai.id)}
                disabled={blocked}
                className={`text-left bg-slate-900/50 border rounded-xl p-2 transition-all disabled:opacity-40 ${
                  alreadyPicked
                    ? "border-emerald-500/60 shadow-lg shadow-emerald-500/20"
                    : "border-slate-700 hover:border-slate-500 active:scale-[0.98]"
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg leading-none">{p.ai.emoji}</span>
                  <span className="text-sm font-bold text-slate-100">
                    {p.ai.name_jp}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mb-1 leading-snug line-clamp-2">
                  {p.ai.tagline}
                </p>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-slate-500">マッチ度</span>
                  <span
                    className={`font-mono font-bold ${
                      p.matchPct >= 75
                        ? "text-emerald-300"
                        : p.matchPct >= 50
                        ? "text-amber-300"
                        : "text-rose-300"
                    }`}
                  >
                    {p.matchPct}%
                  </span>
                </div>
                {matchBar(p.matchPct)}
                {alreadyPicked && (
                  <p className="text-[10px] text-emerald-300 mt-1 text-center">
                    ✓ 召喚済
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!affordable && (
        <p className="text-[10px] text-rose-400 mt-2 text-center">
          ⚠ HP不足で召喚できない
        </p>
      )}
    </div>
  );
}
