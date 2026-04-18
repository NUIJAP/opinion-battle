// ============================================================
// 論獄 キャラクターコード (Phase 3a Stage D)
// ============================================================
// フォーマット:
//   RONGOKU-{axes:8文字}-{affinities:20文字}-{checksum:1文字}
//   例: RONGOKU-Z4K2M9X1-P7R5Q8W2E3T6Y9O4U1F2-K
//
// エンコード:
//   - 8 軸 (reason_madness..deception_honesty) はそれぞれ 1.00-5.00 → 0-31 に量子化 → Base32 1文字
//   - 20 悪魔出現率 (0.0-1.0) はそれぞれ 0-31 に量子化 → Base32 1文字
//   - チェックサム = 本体文字列 "{axes}-{affinities}" の文字コード合計 mod 32 → Base32 1文字
//
// 精度: 5bit (=32段階)。
//   軸 4.0 幅を 31 等分 → 0.13 刻みの丸め。往復で ±0.07 程度の誤差は許容。
//   出現率は小数第2位程度の精度 (0.032 刻み)。
//
// 重要: このコードは DB に保存しない。localStorage のみで自己完結。
// ============================================================

import type { Axes8, CharacterState } from "@/types";
import { AXIS_KEYS } from "@/types";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PREFIX = "RONGOKU";
export const DEMON_COUNT = 20;

const CODE_RE = new RegExp(
  `^${PREFIX}-([A-Z2-7]{${AXIS_KEYS.length}})-([A-Z2-7]{${DEMON_COUNT}})-([A-Z2-7])$`,
);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function axisToIdx(v: number): number {
  // (v - 1) / 4 を 0-1 に正規化してから 0-31 に量子化
  return Math.round(clamp01((v - 1) / 4) * 31);
}
function idxToAxis(idx: number): number {
  return (idx / 31) * 4 + 1;
}
function rateToIdx(r: number): number {
  return Math.round(clamp01(r) * 31);
}
function idxToRate(idx: number): number {
  return idx / 31;
}

function sumMod32(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    sum = (sum + s.charCodeAt(i)) % 32;
  }
  return sum;
}

/** Generate a character code from the current user state. */
export function generateCharacterCode(state: CharacterState): string {
  const axesCode = AXIS_KEYS
    .map((key) => BASE32[axisToIdx(state.axes[key])])
    .join("");

  const affinityCode = Array.from({ length: DEMON_COUNT }, (_, i) => {
    const rate = state.demonAffinities[i + 1] ?? 1 / DEMON_COUNT;
    return BASE32[rateToIdx(rate)];
  }).join("");

  const body = `${axesCode}-${affinityCode}`;
  const checksum = BASE32[sumMod32(body)];
  return `${PREFIX}-${body}-${checksum}`;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/** Validate structure + checksum of a character code string. */
export function validateCharacterCode(code: string): ValidationResult {
  const match = code.match(CODE_RE);
  if (!match) return { valid: false, error: "Invalid format" };
  const [, axesCode, affCode, csChar] = match;
  const expected = BASE32[sumMod32(`${axesCode}-${affCode}`)];
  if (csChar !== expected) return { valid: false, error: "Checksum mismatch" };
  return { valid: true };
}

/** Decode a character code back into CharacterState. Returns null on invalid input. */
export function decodeCharacterCode(code: string): CharacterState | null {
  const v = validateCharacterCode(code);
  if (!v.valid) return null;

  const match = code.match(CODE_RE)!;
  const [, axesCode, affCode] = match;

  const axes = {} as Axes8;
  AXIS_KEYS.forEach((key, i) => {
    axes[key] = idxToAxis(BASE32.indexOf(axesCode[i]));
  });

  const demonAffinities: Record<number, number> = {};
  for (let i = 0; i < DEMON_COUNT; i++) {
    demonAffinities[i + 1] = idxToRate(BASE32.indexOf(affCode[i]));
  }

  return { axes, demonAffinities };
}

/** Default new-character state: neutral axes (3.0) + uniform 5% affinities. */
export function defaultCharacterState(): CharacterState {
  const axes = AXIS_KEYS.reduce((out, key) => {
    out[key] = 3;
    return out;
  }, {} as Axes8);
  const demonAffinities: Record<number, number> = {};
  for (let i = 1; i <= DEMON_COUNT; i++) {
    demonAffinities[i] = 1 / DEMON_COUNT;
  }
  return { axes, demonAffinities };
}
