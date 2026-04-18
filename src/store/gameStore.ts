import { create } from "zustand";
import type {
  AiLevel,
  Axes8,
  BattleRound,
  StanceSide,
  Theme,
} from "@/types";
import { HELPER_SUMMON_HP_COST, INITIAL_HP, clampHp } from "@/lib/scoring";

/**
 * Stage B phases:
 *   "generating-ai" → API in flight (opening or rebuttal)
 *   "input"         → user is typing their reply
 *   "finished"      → HP=0 or MAX_ROUNDS reached, navigating to /result
 */
export type Phase = "generating-ai" | "input" | "finished";

interface GameState {
  // Config
  theme: Theme | null;
  userStanceSide: StanceSide | null;
  startedAt: number | null;

  // Live state
  userHp: number;
  aiHp: number;
  /** 1..MAX_ROUNDS — the AI statement currently visible to the user. */
  round: number;
  currentAiStatement: string;
  phase: Phase;

  // Helper bookkeeping (per battle).
  summonedHelperIds: number[];
  helpersSummonedThisRound: number | null;

  // History (one entry per completed round).
  history: BattleRound[];

  // ---- Actions ----
  startBattle: (theme: Theme, side: StanceSide) => void;
  setPhase: (phase: Phase) => void;
  setOpeningStatement: (statement: string, hpDamageToUser: number) => void;
  /** Pay -10 HP to summon a helper for this round. Returns true if affordable. */
  summonHelper: (helperId: number) => boolean;
  /** Apply the result of one round's API call. Returns true if battle ends. */
  applyRoundResponse: (
    aiStanceName: string,
    payload: {
      userInput: string;
      userInputAxes: Axes8 | null;
      summonedHelperId: number | null;
      hpDamageToUser: number;
      hpDamageToAi: number;
      nextAiStatement: string;
    }
  ) => { battleOver: boolean };
  finishBattle: () => void;
  reset: () => void;
}

const initialLive = {
  userHp: INITIAL_HP,
  aiHp: INITIAL_HP,
  round: 1,
  currentAiStatement: "",
  phase: "generating-ai" as Phase,
  summonedHelperIds: [] as number[],
  helpersSummonedThisRound: null as number | null,
  history: [] as BattleRound[],
};

export const useGameStore = create<GameState>((set, get) => ({
  theme: null,
  userStanceSide: null,
  startedAt: null,
  ...initialLive,

  startBattle: (theme, side) =>
    set({
      theme,
      userStanceSide: side,
      startedAt: Date.now(),
      ...initialLive,
    }),

  setPhase: (phase) => set({ phase }),

  setOpeningStatement: (statement, hpDamageToUser) =>
    set((state) => ({
      currentAiStatement: statement,
      userHp: clampHp(state.userHp - hpDamageToUser),
      phase: "input",
    })),

  summonHelper: (helperId) => {
    const s = get();
    if (s.userHp <= HELPER_SUMMON_HP_COST) return false;
    if (s.helpersSummonedThisRound != null) return false; // one helper per round
    set({
      userHp: clampHp(s.userHp - HELPER_SUMMON_HP_COST),
      helpersSummonedThisRound: helperId,
      summonedHelperIds: [...s.summonedHelperIds, helperId],
    });
    return true;
  },

  applyRoundResponse: (aiStanceName, payload) => {
    const s = get();
    const newUserHp = clampHp(s.userHp - payload.hpDamageToUser);
    const newAiHp = clampHp(s.aiHp - payload.hpDamageToAi);

    const entry: BattleRound = {
      round: s.round,
      aiStance: aiStanceName,
      aiStatement: s.currentAiStatement,
      userInput: payload.userInput,
      userInputAxes: payload.userInputAxes,
      summonedHelperId: payload.summonedHelperId,
      hpDamageToUser: payload.hpDamageToUser,
      hpDamageToAi: payload.hpDamageToAi,
      userHpAfter: newUserHp,
      aiHpAfter: newAiHp,
    };

    const isHpZero = newUserHp <= 0 || newAiHp <= 0;
    set({
      userHp: newUserHp,
      aiHp: newAiHp,
      history: [...s.history, entry],
      currentAiStatement: payload.nextAiStatement,
      round: s.round + 1,
      helpersSummonedThisRound: null,
      phase: isHpZero ? "finished" : "input",
    });

    return { battleOver: isHpZero };
  },

  finishBattle: () => set({ phase: "finished" }),

  reset: () => set({ theme: null, userStanceSide: null, startedAt: null, ...initialLive }),
}));

/** Convenience selector: AI level of the helper picked this round (number or null). */
export function selectHelperThisRound(state: GameState): number | null {
  return state.helpersSummonedThisRound;
}

/** Convenience: derive the AiLevel objects of all summoned helpers from a list. */
export function expandHelperIds(ids: number[], all: AiLevel[]): AiLevel[] {
  return ids
    .map((id) => all.find((a) => a.id === id))
    .filter((x): x is AiLevel => x !== undefined);
}
