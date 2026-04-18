import type { AiLevel } from "@/types";

interface AiCharacterBadgeProps {
  ai: AiLevel;
  /** "compact" = horizontal one-liner; "card" = stat block included. */
  variant?: "compact" | "card";
}

/** Renders a single 4-axis stat row (label + dots). */
function StatRow({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-12 text-slate-400">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`inline-block w-2 h-2 rounded-full ${
              i < v ? "bg-red-400" : "bg-slate-700"
            }`}
          />
        ))}
      </div>
      <span className="font-mono text-slate-300">{v}</span>
    </div>
  );
}

export default function AiCharacterBadge({
  ai,
  variant = "compact",
}: AiCharacterBadgeProps) {
  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-slate-800/70 border border-slate-700 text-xs">
        <span className="text-base leading-none">{ai.emoji}</span>
        <span className="font-bold text-slate-100">{ai.name_jp}</span>
        {ai.tier !== undefined && (
          <span className="text-slate-400">T{ai.tier}</span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-3">
      <div className="flex items-start gap-3 mb-2">
        <div className="text-3xl leading-none">{ai.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-slate-100">
              {ai.name_jp}
            </span>
            {ai.tier !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 font-mono">
                Tier {ai.tier}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            {ai.tagline}
          </p>
        </div>
      </div>
      {ai.stat_iq !== undefined && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
          <StatRow label="IQ"   value={ai.stat_iq ?? 0} />
          <StatRow label="悪辣" value={ai.stat_venom ?? 0} />
          <StatRow label="機知" value={ai.stat_wit ?? 0} />
          <StatRow label="深慮" value={ai.stat_depth ?? 0} />
        </div>
      )}
      {ai.catchphrase && (
        <p className="mt-2 text-[11px] italic text-slate-300 border-l-2 border-red-900/60 pl-2">
          「{ai.catchphrase}」
        </p>
      )}
    </div>
  );
}
