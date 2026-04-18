"use client";
import { useEffect, useState } from "react";

interface AiStatementBubbleProps {
  statement: string;
  isLoading: boolean;
  aiStanceName: string;
  round: number;
  maxRounds: number;
}

/**
 * Displays AI statement with a 1-char-at-a-time typing effect
 * (TikTok-style visual cue from PROJECT_SPEC.md §3 フェーズ2).
 */
export default function AiStatementBubble({
  statement,
  isLoading,
  aiStanceName,
  round,
  maxRounds,
}: AiStatementBubbleProps) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (isLoading || !statement) {
      setDisplayed("");
      return;
    }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplayed(statement.slice(0, i));
      if (i >= statement.length) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [statement, isLoading]);

  return (
    <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5 min-h-[180px] shadow-xl">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded-full font-semibold">
          🤖 {aiStanceName}
        </span>
        <span className="text-slate-400 font-mono">
          Round {round} / {maxRounds}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
          </div>
          <span>AIが反論を構築中...</span>
        </div>
      ) : (
        <p className="text-base leading-relaxed text-slate-100 whitespace-pre-wrap">
          {displayed}
          {displayed.length < statement.length && (
            <span className="inline-block w-1 h-5 bg-slate-300 ml-0.5 animate-pulse align-middle" />
          )}
        </p>
      )}
    </div>
  );
}
