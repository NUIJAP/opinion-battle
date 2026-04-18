"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FALLBACK_AI_LEVELS } from "@/lib/ai-levels";
import {
  generateCharacterCode,
} from "@/lib/character-code";
import {
  listSaveSlots,
  type SaveSlot,
} from "@/lib/local-saves";
import type { AiLevel, Axes8, UserStats } from "@/types";
import PersonalityRadar from "@/components/PersonalityRadar";

const USER_ID_KEY = "rongoku.anonUserId";

export default function PossessedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
          読込中…
        </div>
      }
    >
      <PossessedInner />
    </Suspense>
  );
}

function PossessedInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demonIdParam = searchParams.get("demon");
  const demonId = demonIdParam ? parseInt(demonIdParam, 10) : null;

  const [userAxes, setUserAxes] = useState<Axes8 | null>(null);
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [restoreCodeInput, setRestoreCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demon: AiLevel | null = useMemo(() => {
    if (demonId == null) return null;
    return FALLBACK_AI_LEVELS.find((l) => l.id === demonId) ?? null;
  }, [demonId]);

  // Fetch user's current axes for the radar display.
  useEffect(() => {
    const userId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(USER_ID_KEY)
        : null;
    if (!userId) return;
    void fetch(`/api/user-stats?userId=${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UserStats | null) => {
        if (!data) return;
        setUserAxes({
          reason_madness: data.ax_reason_madness,
          lust_restraint: data.ax_lust_restraint,
          seduction_directness: data.ax_seduction_directness,
          chaos_order: data.ax_chaos_order,
          violence_cunning: data.ax_violence_cunning,
          nihility_obsession: data.ax_nihility_obsession,
          mockery_empathy: data.ax_mockery_empathy,
          deception_honesty: data.ax_deception_honesty,
        });
      })
      .catch(() => {
        /* radar is optional, ignore */
      });
  }, []);

  // Load save slots from localStorage.
  useEffect(() => {
    setSaveSlots(listSaveSlots());
  }, []);

  async function resetWithCode(code?: string) {
    const userId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(USER_ID_KEY)
        : null;
    if (!userId) {
      setError("ユーザーIDが見つかりません。ホームへ戻ってください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reset-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anon_user_id: userId, code }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      router.push("/");
    } catch (err) {
      console.error("[possessed] reset failed:", err);
      setError(err instanceof Error ? err.message : "リセットに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  // If we somehow arrived here without a demon param, gracefully degrade.
  if (!demon) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-4">
          <h1 className="text-lg font-bold">不明な状態</h1>
          <p className="text-sm text-slate-300">
            傀儡化情報が読み取れませんでした。
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
          >
            ホームへ
          </button>
        </div>
      </div>
    );
  }

  const currentCode = userAxes
    ? generateCharacterCode({ axes: userAxes, demonAffinities: {} })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-rose-950/40 to-slate-950 text-slate-100 px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <header className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-rose-500 font-bold">
            POSSESSION
          </p>
          <h1 className="text-3xl font-black text-rose-200">傀儡化</h1>
          <p className="text-xs text-slate-400">
            貴様の魂は、ついに堕ちた。
          </p>
        </header>

        {/* Possessor card */}
        <div className="bg-rose-950/50 border border-rose-800/60 rounded-2xl p-5 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{demon.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-100">
                  {demon.name_jp}
                </span>
                <span className="text-xs font-mono font-black px-1.5 py-0.5 rounded border bg-amber-500/30 text-amber-200 border-amber-500/40">
                  {demon.tier_letter ?? "?"}
                </span>
              </div>
              <p className="text-[11px] text-rose-200/80 mt-1 leading-relaxed">
                {demon.personality ?? demon.tagline}
              </p>
            </div>
          </div>
          {demon.catchphrase && (
            <p className="mt-3 text-sm italic text-rose-100 border-l-2 border-rose-500 pl-3">
              「{demon.catchphrase}」
            </p>
          )}
        </div>

        {/* Current axes radar */}
        {userAxes && (
          <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4">
            <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 text-center">
              貴様の現在の 8 軸
            </h2>
            <PersonalityRadar axes={userAxes} />
          </div>
        )}

        {/* Current character code */}
        {currentCode && (
          <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              傀儡化時点のキャラコード (軸のみ)
            </h2>
            <div className="bg-black/40 border border-slate-800 rounded p-2 font-mono text-[10px] text-slate-300 break-all">
              {currentCode}
            </div>
            <p className="text-[10px] text-slate-500">
              ※ 完全なコードはホームの「キャラコード」パネルから
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-200">やり直す</h2>

          {/* New character */}
          <button
            onClick={() => resetWithCode()}
            disabled={busy}
            className="w-full px-4 py-3 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold shadow-lg"
          >
            {busy ? "処理中…" : "🆕 新しい魂で出直す"}
          </button>

          {/* Restore from save slot */}
          {saveSlots.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 space-y-2">
              <p className="text-xs text-slate-300 font-bold">
                過去のセーブから復元
              </p>
              {saveSlots.map((slot, i) => (
                <button
                  key={slot.timestamp}
                  onClick={() => resetWithCode(slot.code)}
                  disabled={busy}
                  className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-left text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono">
                      スロット {i + 1}
                      {slot.label ? ` · ${slot.label}` : ""}
                    </span>
                    <span className="text-slate-400">
                      {new Date(slot.timestamp).toLocaleDateString("ja-JP")} ·{" "}
                      {slot.battleNumber}戦目
                    </span>
                  </div>
                  <div className="font-mono text-[9px] text-slate-400 truncate mt-1">
                    {slot.code}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Restore via manual code input */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 space-y-2">
            <p className="text-xs text-slate-300 font-bold">
              キャラコードを入力して復元
            </p>
            <input
              type="text"
              value={restoreCodeInput}
              onChange={(e) => setRestoreCodeInput(e.target.value.trim())}
              placeholder="RONGOKU-XXXX-YYYYYYYYYYYYYYYYYYYY-Z"
              className="w-full px-3 py-2 bg-black/40 border border-slate-700 rounded text-xs font-mono text-slate-200 placeholder-slate-600"
            />
            <button
              onClick={() => resetWithCode(restoreCodeInput)}
              disabled={busy || !restoreCodeInput}
              className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-xs font-bold"
            >
              このコードで復元
            </button>
          </div>

          {error && (
            <div className="bg-rose-950/50 border border-rose-800 rounded p-3 text-xs text-rose-200">
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
