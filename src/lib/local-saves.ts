// ============================================================
// 論獄 ローカルセーブスロット (Phase 3a Stage D)
// ============================================================
// キャラクターコードを最大 3 スロット localStorage に保存する。
// 同じキャラでも複数スナップショットを残せる (バトル毎 / 重要節目)。
// 古いものから上書きされる (timestamp desc でソート後、先頭 3 件のみ保持)。
//
// キー: rongoku.characterSaves
// ============================================================

const STORAGE_KEY = "rongoku.characterSaves";
export const MAX_SAVE_SLOTS = 3;

export interface SaveSlot {
  code: string;          // RONGOKU-...
  timestamp: number;     // Date.now()
  battleNumber: number;  // 何戦目でのスナップショットか
  label?: string;        // 任意ラベル ("初期キャラ" 等)
}

function read(): SaveSlot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SaveSlot[]) : [];
  } catch (err) {
    console.error("[local-saves] read failed", err);
    return [];
  }
}

function write(slots: SaveSlot[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch (err) {
    console.error("[local-saves] write failed", err);
  }
}

/** newest first. */
export function listSaveSlots(): SaveSlot[] {
  return read().sort((a, b) => b.timestamp - a.timestamp);
}

/** Push a new slot; oldest gets dropped when over MAX_SAVE_SLOTS. */
export function saveCharacterSnapshot(
  code: string,
  battleNumber: number,
  label?: string,
): SaveSlot[] {
  const slots = read();
  slots.push({ code, timestamp: Date.now(), battleNumber, label });
  slots.sort((a, b) => b.timestamp - a.timestamp);
  if (slots.length > MAX_SAVE_SLOTS) slots.length = MAX_SAVE_SLOTS;
  write(slots);
  return slots;
}

export function loadSaveSlot(index: number): SaveSlot | null {
  const slots = listSaveSlots();
  return slots[index] ?? null;
}

export function deleteSaveSlot(index: number): SaveSlot[] {
  const slots = listSaveSlots();
  slots.splice(index, 1);
  write(slots);
  return slots;
}

export function clearSaveSlots(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
