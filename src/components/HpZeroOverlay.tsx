"use client";

import { useEffect, useState } from "react";

interface HpZeroOverlayProps {
  /** "user" = user got KO'd; "ai" = user knocked the AI out. */
  loser: "user" | "ai";
  aiName: string;
  /** Called when the closing animation finishes (~1.4s). */
  onComplete?: () => void;
}

/**
 * Full-screen flash + center text overlay shown the moment HP hits 0.
 * Plays for ~1.4s, then calls onComplete so the parent can navigate.
 */
export default function HpZeroOverlay({
  loser,
  aiName,
  onComplete,
}: HpZeroOverlayProps) {
  const [phase, setPhase] = useState<"flash" | "text">("flash");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 220);
    const t2 = setTimeout(() => onComplete?.(), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  const isVictory = loser === "ai";
  const headline = isVictory ? "K.O." : "敗北";
  const sub = isVictory
    ? `${aiName}を沈黙させた`
    : `${aiName}に屈した`;
  const colorRing = isVictory ? "ring-amber-400/60" : "ring-rose-500/60";
  const colorText = isVictory ? "text-amber-300" : "text-rose-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Flash */}
      <div
        className={`absolute inset-0 ${
          phase === "flash"
            ? "bg-white/90"
            : "bg-black/85"
        } transition-colors duration-300`}
      />

      {/* Concentric ring pulse */}
      {phase === "text" && (
        <>
          <div
            className={`absolute w-72 h-72 rounded-full ring-4 ${colorRing} animate-ping`}
          />
          <div
            className={`absolute w-96 h-96 rounded-full ring-2 ${colorRing} opacity-50 animate-ping [animation-delay:0.2s]`}
          />
        </>
      )}

      {/* Center text */}
      {phase === "text" && (
        <div className="relative text-center px-6">
          <p
            className={`text-7xl font-black tracking-widest ${colorText} drop-shadow-[0_0_24px_rgba(0,0,0,0.6)] animate-pulse`}
          >
            {headline}
          </p>
          <p className="mt-3 text-sm text-slate-300 font-mono">{sub}</p>
        </div>
      )}
    </div>
  );
}
