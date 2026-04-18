interface HpBarProps {
  label: string;
  hp: number;
  maxHp?: number;
  color: "user" | "ai";
}

export default function HpBar({ label, hp, maxHp = 100, color }: HpBarProps) {
  // Cap visual width at 100% even though HP can climb past the base.
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const barClass =
    color === "user"
      ? "bg-gradient-to-r from-blue-400 to-blue-600"
      : "bg-gradient-to-r from-red-400 to-red-600";

  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-slate-200">{label}</span>
        <span className="font-mono text-slate-300">{hp}</span>
      </div>
      <div className="h-4 bg-slate-700 rounded-full overflow-hidden shadow-inner">
        <div
          className={`h-full ${barClass} transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
