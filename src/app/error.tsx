"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full bg-rose-950/40 border border-rose-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-bold text-rose-200">⚠️ エラーが発生しました</h1>
        <div className="bg-slate-900 border border-slate-800 rounded p-3 font-mono text-xs text-rose-200 break-all whitespace-pre-wrap">
          {error.message || String(error)}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded text-sm font-bold"
          >
            再試行
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
          >
            ホームへ
          </button>
        </div>
      </div>
    </div>
  );
}
