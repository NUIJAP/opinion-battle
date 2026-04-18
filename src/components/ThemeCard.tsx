import Link from "next/link";
import type { Theme } from "@/types";

interface ThemeCardProps {
  theme: Theme;
}

function DifficultyStars({ level }: { level: number }) {
  const clamped = Math.max(1, Math.min(5, level));
  return (
    <span className="text-yellow-400 text-sm" aria-label={`難易度${clamped}`}>
      {"⭐".repeat(clamped)}
      <span className="text-gray-600">{"⭐".repeat(5 - clamped)}</span>
    </span>
  );
}

export default function ThemeCard({ theme }: ThemeCardProps) {
  return (
    <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400 uppercase tracking-wider">
          今日のテーマ
        </span>
        <DifficultyStars level={theme.difficulty} />
      </div>

      <h2 className="text-xl font-bold mb-2 leading-snug">{theme.title}</h2>
      <p className="text-sm text-slate-300 mb-5 leading-relaxed">
        {theme.description}
      </p>

      <div className="space-y-3">
        <Link
          href={`/game/${theme.id}?stance=a`}
          className="block w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white py-4 rounded-xl text-center font-semibold shadow-lg transition-all active:scale-[0.98]"
        >
          <div className="text-base">{theme.stance_a_name}</div>
          <div className="text-xs font-normal opacity-80 mt-1 line-clamp-2">
            {theme.stance_a_summary}
          </div>
        </Link>

        <Link
          href={`/game/${theme.id}?stance=b`}
          className="block w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white py-4 rounded-xl text-center font-semibold shadow-lg transition-all active:scale-[0.98]"
        >
          <div className="text-base">{theme.stance_b_name}</div>
          <div className="text-xs font-normal opacity-80 mt-1 line-clamp-2">
            {theme.stance_b_summary}
          </div>
        </Link>
      </div>
    </div>
  );
}
