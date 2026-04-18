"use client";
import type { CounterChoice } from "@/types";

interface CounterChoicesProps {
  choices: CounterChoice[] | null;
  isLoading: boolean;
  onPick: (choice: CounterChoice) => void;
  onCancel: () => void;
}

const angleColors: Record<string, string> = {
  データで反駁: "border-cyan-500/50 bg-cyan-900/20",
  論理で反駁: "border-purple-500/50 bg-purple-900/20",
  倫理で反駁: "border-amber-500/50 bg-amber-900/20",
};

function angleClass(angle: string): string {
  return (
    angleColors[angle] ?? "border-slate-500/50 bg-slate-800/40"
  );
}

const angleEmoji: Record<string, string> = {
  データで反駁: "📊",
  論理で反駁: "🧩",
  倫理で反駁: "❤️",
};

function angleIcon(angle: string): string {
  return angleEmoji[angle] ?? "⚔️";
}

export default function CounterChoices({
  choices,
  isLoading,
  onPick,
  onCancel,
}: CounterChoicesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          🔥 反論を選ぶ
        </h3>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40"
        >
          キャンセル
        </button>
      </div>

      {isLoading || !choices ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 border border-slate-700 bg-slate-800/40 rounded-xl animate-pulse"
            />
          ))}
          <p className="text-center text-xs text-slate-400">
            反論カードを生成中...
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {choices.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className={`w-full text-left border ${angleClass(c.angle)} rounded-xl p-4 hover:brightness-125 transition-all active:scale-[0.98]`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  {angleIcon(c.angle)} {c.angle}
                </span>
                <span className="text-xs text-slate-400">→ 打つ</span>
              </div>
              <div className="font-bold text-sm text-slate-100 mb-1">
                {c.label}
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                {c.statement}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
