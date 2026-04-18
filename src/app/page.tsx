"use client";

import { useEffect, useState } from "react";
import type { DailyMatchupResponse, Matchup, StaminaInfo } from "@/types";
import { getRankFromRp } from "@/lib/ranking";
import MatchupCard from "@/components/MatchupCard";
import RankDisplay from "@/components/RankDisplay";

const USER_ID_KEY = "rongoku.anonUserId";

interface RankSummary {
  rp: number;
  rankName: string;
  totalBattles: number;
  totalWins: number;
  streakDays: number;
}

export default function HomePage() {
  const [matchups, setMatchups] = useState<Matchup[] | null>(null);
  const [rank, setRank] = useState<RankSummary | null>(null);
  const [stamina, setStamina] = useState<StaminaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(USER_ID_KEY)
            : null;
        const url = stored
          ? `/api/daily-matchup?userId=${encodeURIComponent(stored)}`
          : `/api/daily-matchup`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DailyMatchupResponse;
        if (cancelled) return;

        // Persist (or refresh) the anon user id.
        if (data.userId && typeof window !== "undefined") {
          window.localStorage.setItem(USER_ID_KEY, data.userId);
        }
        setMatchups(data.matchups);
        setRank(data.rank);
        setStamina(data.stamina);
      } catch (err) {
        console.error("[home] load failed:", err);
        if (!cancelled) setError("マッチアップの取得に失敗しました");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rankTier = rank ? getRankFromRp(rank.rp) : null;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 space-y-5">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight">
          論<span className="text-red-500">獄</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1 tracking-widest">
          RONGOKU — 獄吏との議論対決
        </p>
      </header>

      {rank && rankTier && (
        <RankDisplay
          rp={rank.rp}
          rankName={rank.rankName}
          totalBattles={rank.totalBattles}
          totalWins={rank.totalWins}
          streakDays={rank.streakDays}
          progressPct={rankTier.progressPct}
          nextRp={rankTier.nextRp}
        />
      )}

      {stamina && <StaminaBadge stamina={stamina} />}

      <section>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="text-sm font-bold text-slate-200">
            今日の悪魔 <span className="text-slate-400 font-normal">3戦</span>
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">
            {new Date().toLocaleDateString("ja-JP")}
          </span>
        </div>

        {error ? (
          <ErrorState message={error} />
        ) : matchups === null ? (
          <LoadingState />
        ) : matchups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {matchups.map((m) => (
              <MatchupCard key={m.id} matchup={m} />
            ))}
          </div>
        )}
      </section>

      <footer className="text-center text-[10px] text-slate-600 pt-4">
        Phase 3a Stage D · 20 悪魔 (Goetia) 稼働
      </footer>
    </div>
  );
}

function StaminaBadge({ stamina }: { stamina: StaminaInfo }) {
  const { battlesToday, max, remaining } = stamina;
  const exhausted = remaining <= 0;
  const dots = Array.from({ length: max }, (_, i) => i < battlesToday);

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
        exhausted
          ? "bg-rose-950/40 border-rose-800/60 text-rose-200"
          : "bg-slate-800/60 border-slate-700 text-slate-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider opacity-70">
          本日
        </span>
        <span className="font-mono font-bold">
          {battlesToday}/{max}
        </span>
        <div className="flex gap-0.5">
          {dots.map((filled, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                filled ? "bg-rose-400" : "bg-slate-600"
              }`}
            />
          ))}
        </div>
      </div>
      <span className="text-[10px] opacity-80">
        {exhausted
          ? "本日は既に3戦済。明日また戦え。"
          : `残り ${remaining} 戦`}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-44 bg-slate-800/40 border border-slate-700 rounded-2xl animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 text-center">
      <p className="text-slate-300 mb-2">テーマが登録されていません。</p>
      <p className="text-xs text-slate-400">
        Supabase の seed-themes.sql を実行してください。
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-rose-900/30 border border-rose-800/60 rounded-2xl p-5 text-center">
      <p className="text-rose-200 mb-2">⚠️ {message}</p>
      <button
        onClick={() => window.location.reload()}
        className="text-xs text-rose-300 underline hover:text-rose-200"
      >
        再読み込み
      </button>
    </div>
  );
}
