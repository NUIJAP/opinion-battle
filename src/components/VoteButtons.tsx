import type { UserAction } from "@/types";

interface VoteButtonsProps {
  onVote: (action: UserAction) => void;
  disabled: boolean;
}

const buttons: Array<{
  action: UserAction;
  emoji: string;
  label: string;
  hint: string;
  cls: string;
}> = [
  {
    action: "like",
    emoji: "👍",
    label: "いいね",
    hint: "+15 HP",
    cls: "bg-green-500 hover:bg-green-400 active:bg-green-600",
  },
  {
    action: "reference",
    emoji: "💡",
    label: "参考になる",
    hint: "+8 HP",
    cls: "bg-amber-500 hover:bg-amber-400 active:bg-amber-600",
  },
  {
    action: "oppose",
    emoji: "🔥",
    label: "反論を打つ",
    hint: "+20 HP & 攻撃",
    cls: "bg-red-500 hover:bg-red-400 active:bg-red-600",
  },
];

export default function VoteButtons({ onVote, disabled }: VoteButtonsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {buttons.map((b) => (
        <button
          key={b.action}
          onClick={() => onVote(b.action)}
          disabled={disabled}
          className={`${b.cls} text-white py-4 rounded-xl font-semibold shadow-lg transition-all active:scale-95 disabled:bg-slate-600 disabled:cursor-not-allowed flex flex-col items-center gap-1`}
        >
          <span className="text-2xl">{b.emoji}</span>
          <span className="text-sm">{b.label}</span>
          <span className="text-[10px] opacity-80">{b.hint}</span>
        </button>
      ))}
    </div>
  );
}
