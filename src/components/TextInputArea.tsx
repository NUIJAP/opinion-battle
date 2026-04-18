"use client";

import { useState } from "react";

interface TextInputAreaProps {
  disabled: boolean;
  onSubmit: (text: string) => void;
  placeholder?: string;
}

const MIN_CHARS = 5;
const MAX_CHARS = 280;

export default function TextInputArea({
  disabled,
  onSubmit,
  placeholder,
}: TextInputAreaProps) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const tooShort = trimmed.length < MIN_CHARS;
  const tooLong = trimmed.length > MAX_CHARS;
  const blocked = disabled || tooShort || tooLong;

  const submit = () => {
    if (blocked) return;
    onSubmit(trimmed);
    setText("");
  };

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder={
          placeholder ?? "あなたの反論をここに入力 (5〜280字)"
        }
        rows={4}
        className="w-full bg-slate-900/70 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/40 disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-[11px] font-mono ${
            tooLong
              ? "text-rose-400"
              : tooShort
              ? "text-slate-500"
              : "text-slate-400"
          }`}
        >
          {trimmed.length} / {MAX_CHARS}
          {tooShort && trimmed.length > 0 && " (短すぎる)"}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={blocked}
          className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-bold py-2 px-5 rounded-xl shadow-lg transition-all active:scale-[0.98]"
        >
          🗡 反論を打つ
        </button>
      </div>
    </div>
  );
}
