// Game rules shared by client and server (no secret data here).
import type { GameState, PublicScenario } from "./types";

export const ROUND1_QUESTIONS = 5;
export const LATER_ROUND_QUESTIONS = 3;
export const MAX_ROUNDS = 4;
export const MAX_STRESS = 5;
export const FREE_QUESTIONS = 15;

export function guardForRound(round: number): number {
  return Math.min(round, 3);
}

export function questionsForRound(round: number): number {
  return round === 1 ? ROUND1_QUESTIONS : LATER_ROUND_QUESTIONS;
}

export function computeScore(wrongAccusations: number, questionsUsed: number): number {
  const score = 100 - 20 * wrongAccusations - Math.max(0, questionsUsed - FREE_QUESTIONS);
  return Math.max(0, score);
}

export function initialState(scenario: PublicScenario): GameState {
  const ids = scenario.suspects.map((s) => s.id);
  const per = <T,>(v: () => T) => Object.fromEntries(ids.map((id) => [id, v()]));
  return {
    scenarioId: scenario.id,
    round: 1,
    guard: 1,
    jailed: [],
    questionsLeft: per(() => ROUND1_QUESTIONS),
    questionsUsed: 0,
    wrongAccusations: 0,
    cluesFound: [],
    clueCards: [],
    roomsInspected: [],
    presented: per(() => [] as string[]),
    stress: per(() => 0),
    told: per(() => [] as string[]),
    history: per(() => []),
    claims: [],
    contradictions: [],
    askedTopicsPrev: [],
    askedThisRound: [],
    phase: "intro",
    solved: false,
  };
}

/** Applies a wrong accusation: jail, next round, guard up, stress decays by 1. */
export function advanceRound(state: GameState, jailedId: string): GameState {
  const round = state.round + 1;
  const jailed = [...state.jailed, jailedId];
  const q = questionsForRound(round);
  const questionsLeft: Record<string, number> = {};
  const stress: Record<string, number> = {};
  for (const id of Object.keys(state.questionsLeft)) {
    questionsLeft[id] = jailed.includes(id) ? 0 : q;
    stress[id] = Math.max(0, (state.stress[id] ?? 0) - 1);
  }
  return {
    ...state,
    round,
    guard: guardForRound(round),
    jailed,
    questionsLeft,
    stress,
    wrongAccusations: state.wrongAccusations + 1,
    askedTopicsPrev: [...state.askedTopicsPrev, ...state.askedThisRound].slice(-12),
    askedThisRound: [],
    phase: "board",
  };
}

export function stressLevel(stress: number): "calm" | "tense" | "agitated" {
  if (stress <= 1) return "calm";
  if (stress <= 3) return "tense";
  return "agitated";
}
