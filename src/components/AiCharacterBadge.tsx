import type { AiLevel, Axes8 } from "@/types";
import { AXIS_POLES_JP } from "@/types";

interface AiCharacterBadgeProps {
  ai: AiLevel;
  /** "compact" = horizontal one-liner; "card" = stat block included. */
  variant?: "compact" | "card";
}

/** One axis row: bipolar bar with a marker showing where the demon sits. */
function AxisBar({
  axisKey,
  value,
}: {
  axisKey: keyof Axes8;
  value: number;
}) {
  const v = Math.max(1, Math.min(5, value));
  const pct = ((v - 1) / 4) * 100; // 0..100 across the axis bar
  const poles = AXIS_POLES_JP[axisKey];
  return (
    <div className="text-[10px] leading-tight">
      <div className="flex items-center justify-between text-slate-400 mb-0.5">
        <span className={`font-bold ${v >= 4 ? "text-rose-300" : ""}`}>
          {poles.high}
        </span>
        <span className={`font-bold ${v <= 2 ? "text-cyan-300" : ""}`}>
          {poles.low}
        </span>
      </div>
      <div className="relative h-1 bg-slate-800 rounded-full">
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(252,211,77,0.6)]"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function tierColor(letter?: string): string {
  switch (letter) {
    case "SS": return "bg-amber-500/30 text-amber-200 border-amber-500/40";
    case "S":  return "bg-rose-500/30  text-rose-200  border-rose-500/40";
    case "A":  return "bg-violet-500/30 text-violet-200 border-violet-500/40";
    case "B":  return "bg-blue-500/30  text-blue-200  border-blue-500/40";
    case "C":  return "bg-emerald-500/30 text-emerald-200 border-emerald-500/40";
    case "D":  return "bg-slate-600/40 text-slate-300 border-slate-500/40";
    default:   return "bg-red-900/40 text-red-300 border-red-900/40";
  }
}

export default function AiCharacterBadge({
  ai,
  variant = "compact",
}: AiCharacterBadgeProps) {
  const tierLabel = ai.tier_letter ?? (ai.tier ? `T${ai.tier}` : "");

  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-slate-800/70 border border-slate-700 text-xs">
        <span className="text-base leading-none">{ai.emoji}</span>
        <span className="font-bold text-slate-100">{ai.name_jp}</span>
        {tierLabel && (
          <span
            className={`text-[10px] font-mono font-black px-1.5 rounded border ${tierColor(
              ai.tier_letter
            )}`}
          >
            {tierLabel}
          </span>
        )}
      </div>
    );
  }

  // Build a compact 4-row 8-axis preview (2 axes per row).
  const axisPairs: Array<[keyof Axes8, keyof Axes8]> = [
    ["reason_madness", "lust_restraint"],
    ["seduction_directness", "chaos_order"],
    ["violence_cunning", "nihility_obsession"],
    ["mockery_empathy", "deception_honesty"],
  ];

  const axisValueMap: Record<keyof Axes8, number> = {
    reason_madness:       ai.ax_reason_madness ?? 3,
    lust_restraint:       ai.ax_lust_restraint ?? 3,
    seduction_directness: ai.ax_seduction_directness ?? 3,
    chaos_order:          ai.ax_chaos_order ?? 3,
    violence_cunning:     ai.ax_violence_cunning ?? 3,
    nihility_obsession:   ai.ax_nihility_obsession ?? 3,
    mockery_empathy:      ai.ax_mockery_empathy ?? 3,
    deception_honesty:    ai.ax_deception_honesty ?? 3,
  };

  const hasAxes = ai.ax_reason_madness !== undefined;

  return (
    <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-3">
      <div className="flex items-start gap-3 mb-2">
        <div className="text-3xl leading-none">{ai.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-black text-slate-100">
              {ai.name_jp}
            </span>
            {tierLabel && (
              <span
                className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded border ${tierColor(
                  ai.tier_letter
                )}`}
              >
                {tierLabel}
                {ai.composite_score !== undefined && (
                  <span className="ml-1 opacity-70">
                    {ai.composite_score.toFixed(1)}
                  </span>
                )}
              </span>
            )}
            {ai.rank_label && (
              <span className="text-[10px] text-slate-500 font-mono">
                {ai.rank_label}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            {ai.tagline}
          </p>
        </div>
      </div>
      {hasAxes && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
          {axisPairs.map(([k1, k2]) => (
            <div key={k1} className="contents">
              <AxisBar axisKey={k1} value={axisValueMap[k1]} />
              <AxisBar axisKey={k2} value={axisValueMap[k2]} />
            </div>
          ))}
        </div>
      )}
      {ai.catchphrase && (
        <p className="mt-3 text-[11px] italic text-slate-300 border-l-2 border-red-900/60 pl-2">
          「{ai.catchphrase}」
        </p>
      )}
    </div>
  );
}
