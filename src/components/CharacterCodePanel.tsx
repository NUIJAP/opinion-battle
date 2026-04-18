"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateCharacterCode,
  validateCharacterCode,
  DEMON_COUNT,
} from "@/lib/character-code";
import {
  listSaveSlots,
  saveCharacterSnapshot,
  deleteSaveSlot,
  MAX_SAVE_SLOTS,
  type SaveSlot,
} from "@/lib/local-saves";
import type { Axes8, UserStats } from "@/types";

interface Props {
  userId: string | null;
  /** Total battles played (used as battleNumber label on save). */
  totalBattles: number;
}

/** Home-screen accordion for managing character codes + save slots. */
export default function CharacterCodePanel({ userId, totalBattles }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [restoreInput, setRestoreInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshSlots = useCallback(() => {
    setSlots(listSaveSlots());
  }, []);

  // Only fetch stats when the panel is first opened (avoid wasting a round-trip).
  useEffect(() => {
    if (!open || !userId || currentCode) return;
    void fetch(`/api/user-stats?userId=${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UserStats | null) => {
        if (!data) return;
        const axes: Axes8 = {
          reason_madness:       data.ax_reason_madness,
          lust_restraint:       data.ax_lust_restraint,
          seduction_directness: data.ax_seduction_directness,
          chaos_order:          data.ax_chaos_order,
          violence_cunning:     data.ax_violence_cunning,
          nihility_obsession:   data.ax_nihility_obsession,
          mockery_empathy:      data.ax_mockery_empathy,
          deception_honesty:    data.ax_deception_honesty,
        };
        const affinity = (data.demon_affinity ?? {}) as Record<string, number>;
        const code = generateCharacterCode({
          axes,
          demonAffinities: Object.fromEntries(
            Array.from({ length: DEMON_COUNT }, (_, i) => [
              i + 1,
              affinity[String(i + 1)] ?? 1 / DEMON_COUNT,
            ]),
          ),
        });
        setCurrentCode(code);
      })
      .catch((err) => {
        console.error("[CharacterCodePanel] stats fetch failed:", err);
        setError("キャラ情報の取得に失敗しました");
      });
  }, [open, userId, currentCode]);

  useEffect(() => {
    if (open) refreshSlots();
  }, [open, refreshSlots]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  };

  const copyCode = async () => {
    if (!currentCode) return;
    try {
      await navigator.clipboard.writeText(currentCode);
      showToast("コピーしました");
    } catch {
      showToast("コピー失敗");
    }
  };

  const saveSnapshot = () => {
    if (!currentCode) return;
    saveCharacterSnapshot(currentCode, totalBattles);
    refreshSlots();
    showToast("保存しました");
  };

  const restoreWithCode = async (code: string) => {
    if (!userId) {
      setError("ユーザーIDが見つかりません");
      return;
    }
    const v = validateCharacterCode(code);
    if (!v.valid) {
      setError(`無効なコード: ${v.error}`);
      return;
    }
    const ok = window.confirm(
      "現在のキャラクター状態を上書きします。よろしいですか？",
    );
    if (!ok) return;

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
      showToast("復元しました");
      router.refresh();
      // Force-refresh of the computed code on next open.
      setCurrentCode(null);
    } catch (err) {
      console.error("[CharacterCodePanel] restore failed:", err);
      setError(err instanceof Error ? err.message : "復元に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details
      className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-slate-800">
        <span>🔑 キャラコード / セーブ</span>
        <span className="text-[10px] text-slate-400 font-mono">
          {slots.length}/{MAX_SAVE_SLOTS}
        </span>
      </summary>

      <div className="p-3 space-y-3 border-t border-slate-700 text-xs">
        {/* Current code */}
        {currentCode ? (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              現在のキャラ
            </p>
            <div className="bg-black/40 border border-slate-800 rounded p-2 font-mono text-[10px] text-slate-300 break-all">
              {currentCode}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={copyCode}
                className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-bold"
              >
                📋 コピー
              </button>
              <button
                onClick={saveSnapshot}
                className="px-2 py-1.5 bg-emerald-800 hover:bg-emerald-700 rounded text-[11px] font-bold"
              >
                💾 スロットに保存
              </button>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-center py-3">
            読込中…
          </div>
        )}

        {/* Save slots */}
        {slots.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              保存スロット (最新順)
            </p>
            {slots.map((slot, i) => (
              <div
                key={slot.timestamp}
                className="bg-slate-900 border border-slate-700 rounded p-2 space-y-1.5"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold">
                    {i + 1}. {slot.battleNumber}戦目
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(slot.timestamp).toLocaleDateString("ja-JP")}
                  </span>
                </div>
                <div className="font-mono text-[9px] text-slate-400 truncate">
                  {slot.code}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => restoreWithCode(slot.code)}
                    disabled={busy}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-[10px]"
                  >
                    このコードで復元
                  </button>
                  <button
                    onClick={() => {
                      deleteSaveSlot(i);
                      refreshSlots();
                    }}
                    disabled={busy}
                    className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900/60 disabled:opacity-50 rounded text-[10px] text-rose-300"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Manual input */}
        <div className="space-y-1.5 pt-2 border-t border-slate-700">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            コードを貼り付けて復元
          </p>
          <input
            type="text"
            value={restoreInput}
            onChange={(e) => setRestoreInput(e.target.value.trim())}
            placeholder="RONGOKU-XXXX-YYYYYYYYYYYYYYYYYYYY-Z"
            className="w-full px-2 py-1.5 bg-black/40 border border-slate-700 rounded text-[10px] font-mono text-slate-200 placeholder-slate-600"
          />
          <button
            onClick={() => restoreWithCode(restoreInput)}
            disabled={busy || !restoreInput}
            className="w-full px-2 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-[11px] font-bold"
          >
            このコードで上書き
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 rounded p-2 text-[10px] text-rose-200">
            ⚠️ {error}
          </div>
        )}
        {toast && (
          <div className="text-[10px] text-emerald-300 text-center">
            ✓ {toast}
          </div>
        )}
      </div>
    </details>
  );
}
