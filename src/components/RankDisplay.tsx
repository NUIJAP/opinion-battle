interface RankDisplayProps {
  rp: number;
  rankName: string;
  totalBattles: number;
  totalWins: number;
  streakDays: number;
  /** Optional: progress-bar fill towards next rank (0-100). */
  progressPct?: number;
  nextRp?: number | null;
}

export default function RankDisplay({
  rp,
  rankName,
  totalBattles,
  totalWins,
  streakDays,
  progressPct,
  nextRp,
}: RankDisplayProps) {
  const winRate =
    totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0;

  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            Rank
          </p>
          <p className="text-xl font-black text-amber-300 leading-tight">
            {rankName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            RP
          </p>
          <p className="text-xl font-mono font-black text-slate-100">
            {rp.toLocaleString()}
          </p>
        </div>
      </div>

      {progressPct !== undefined && nextRp !== null && (
        <div className="mb-3">
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
            />
          </div>
          {nextRp !== undefined && nextRp !== null && (
            <p className="text-[10px] text-slate-500 text-right mt-1 font-mono">
              次のランクまで {(nextRp - rp).toLocaleString()} RP
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="戦闘" value={totalBattles.toString()} />
        <Stat label="勝率" value={`${winRate}%`} />
        <Stat label="連続日数" value={`${streakDays}🔥`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-100 font-mono">{value}</p>
    </div>
  );
}
