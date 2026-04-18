import Link from "next/link";
import type { Matchup } from "@/types";
import AiCharacterBadge from "@/components/AiCharacterBadge";

interface MatchupCardProps {
  matchup: Matchup;
}

const tagStyle: Record<string, { label: string; cls: string }> = {
  below: {
    label: "格下",
    cls: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  },
  equal: {
    label: "同格",
    cls: "bg-amber-900/40 text-amber-300 border-amber-700/40",
  },
  above: {
    label: "格上",
    cls: "bg-rose-900/40 text-rose-300 border-rose-700/40",
  },
};

export default function MatchupCard({ matchup }: MatchupCardProps) {
  const { theme, aiLevel, difficultyTag, completed } = matchup;
  const tag = tagStyle[difficultyTag] ?? tagStyle.equal;

  return (
    <div
      className={`relative bg-slate-800/70 border rounded-2xl p-4 shadow-xl backdrop-blur transition-all ${
        completed
          ? "border-slate-800 opacity-60"
          : "border-slate-700 hover:border-slate-500"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tag.cls}`}
        >
          Slot {matchup.slot} · {tag.label}
        </span>
        {completed && (
          <span className="text-[11px] text-emerald-400 font-bold">
            ✓ 攻略済
          </span>
        )}
      </div>

      <h3 className="text-base font-bold leading-snug mb-2 text-slate-100">
        {theme.title}
      </h3>
      <p className="text-xs text-slate-400 mb-3 leading-relaxed line-clamp-2">
        {theme.description}
      </p>

      <div className="mb-3">
        <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
          対戦相手
        </p>
        <AiCharacterBadge ai={aiLevel} variant="card" />
      </div>

      {!completed ? (
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/game/${theme.id}?stance=a&matchupId=${matchup.id}&aiLevel=${aiLevel.id}`}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-3 rounded-xl text-center font-semibold shadow-lg transition-all active:scale-[0.98]"
          >
            <div className="text-sm">{theme.stance_a_name}</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5 line-clamp-1">
              {theme.stance_a_summary}
            </div>
          </Link>
          <Link
            href={`/game/${theme.id}?stance=b&matchupId=${matchup.id}&aiLevel=${aiLevel.id}`}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white py-3 rounded-xl text-center font-semibold shadow-lg transition-all active:scale-[0.98]"
          >
            <div className="text-sm">{theme.stance_b_name}</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5 line-clamp-1">
              {theme.stance_b_summary}
            </div>
          </Link>
        </div>
      ) : (
        <div className="text-center text-xs text-slate-500 py-3">
          このマッチアップは今日もう挑戦済みです
        </div>
      )}
    </div>
  );
}
