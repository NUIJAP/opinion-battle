import { create } from "zustand";
import type {
  BattleRound,
  CounterChoice,
  StanceSide,
  Theme,
  UserAction,
} from "@/types";
import {
  COUNTER_BONUS_DELTA,
  INITIAL_HP,
  clampHp,
  hpDeltaForAction,
} from "@/lib/scoring";

/**
 * Game states:
 *   "voting"           → user picks 👍 / 💡 / 🔥
 *   "choosing-counter" → user pressed 🔥, picking one of 3 counter cards
 *   "generating-ai"    → AI is crafting the next statement
 *   "finished"         → battle over, waiting for navigation to /result
 */
export type Phase =
  | "voting"
  | "choosing-counter"
  | "generating-ai"
  | "finished";

interface GameState {
  // Config
  theme: Theme | null;
  userStanceSide: StanceSide | null;
  startedAt: number | null;

  // Live state
  userHp: number;
  aiHp: number;
  round: number;
  currentAiStatement: string;
  phase: Phase;

  // Counter flow
  pendingCounters: CounterChoice[] | null;

  // History
  history: BattleRound[];

  // ---- Actions ----
  startBattle: (theme: Theme, side: StanceSide) => void;
  setPhase: (phase: Phase) => void;
  setAiStatement: (statement: string) => void;

  /** Applies HP change for a simple (non-counter) vote and records a round. */
  applySimpleAction: (action: UserAction) => void;

  /** Applies HP change for an "oppose + counter" pair and records a round. */
  applyCounterAction: (counter: CounterChoice) => void;

  setPendingCounters: (choices: CounterChoice[] | null) => void;

  /** Advances to the next round with the fresh AI statement. */
  commitRound: (nextStatement: string) => void;

  finishBattle: () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  theme: null,
  userStanceSide: null,
  startedAt: null,
  userHp: INITIAL_HP,
  aiHp: INITIAL_HP,
  round: 1,
  currentAiStatement: "",
  phase: "generating-ai", // round-1 kickoff uses this
  pendingCounters: null,
  history: [],

  startBattle: (theme, side) =>
    set({
      theme,
      userStanceSide: side,
      startedAt: Date.now(),
      userHp: INITIAL_HP,
      aiHp: INITIAL_HP,
      round: 1,
      currentAiStatement: "",
      phase: "generating-ai",
      pendingCounters: null,
      history: [],
    }),

  setPhase: (phase) => set({ phase }),

  setAiStatement: (statement) => set({ currentAiStatement: statement }),

  applySimpleAction: (action) =>
    set((state) => {
      if (!state.theme || !state.userStanceSide) return state;
      const delta = hpDeltaForAction(action);
      const newUserHp = clampHp(state.userHp + delta.user);
      const newAiHp = clampHp(state.aiHp + delta.ai);

      const aiStanceName =
        state.userStanceSide === "a"
          ? state.theme.stance_b_name
          : state.theme.stance_a_name;

      const roundEntry: BattleRound = {
        round: state.round,
        aiStance: aiStanceName,
        aiStatement: state.currentAiStatement,
        userAction: action,
        userCounter: null,
        userHpAfter: newUserHp,
        aiHpAfter: newAiHp,
      };

      return {
        userHp: newUserHp,
        aiHp: newAiHp,
        history: [...state.history, roundEntry],
      };
    }),

  applyCounterAction: (counter) =>
    set((state) => {
      if (!state.theme || !state.userStanceSide) return state;

      // Oppose base + committed-counter bonus.
      const base = hpDeltaForAction("oppose");
      const newUserHp = clampHp(
        state.userHp + base.user + COUNTER_BONUS_DELTA.user
      );
      const newAiHp = clampHp(state.aiHp + base.ai + COUNTER_BONUS_DELTA.ai);

      const aiStanceName =
        state.userStanceSide === "a"
          ? state.theme.stance_b_name
          : state.theme.stance_a_name;

      const roundEntry: BattleRound = {
        round: state.round,
        aiStance: aiStanceName,
        aiStatement: state.currentAiStatement,
        userAction: "oppose",
        userCounter: counter,
        userHpAfter: newUserHp,
        aiHpAfter: newAiHp,
      };

      return {
        userHp: newUserHp,
        aiHp: newAiHp,
        history: [...state.history, roundEntry],
        pendingCounters: null,
      };
    }),

  setPendingCounters: (choices) => set({ pendingCounters: choices }),

  commitRound: (nextStatement) =>
    set((state) => ({
      round: state.round + 1,
      currentAiStatement: nextStatement,
      phase: "voting",
    })),

  finishBattle: () => set({ phase: "finished" }),

  reset: () =>
    set({
      theme: null,
      userStanceSide: null,
      startedAt: null,
      userHp: INITIAL_HP,
      aiHp: INITIAL_HP,
      round: 1,
      currentAiStatement: "",
      phase: "generating-ai",
      pendingCounters: null,
      history: [],
    }),
}));
