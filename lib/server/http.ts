// Shared helpers for API route handlers. SERVER ONLY.
import { NextResponse } from "next/server";
import { guardForRound, MAX_ROUNDS } from "../rules";
import type { ChatTurn, GameState, NotebookClaim, PublicScenario, SecretScenario, Contradiction } from "../types";

export function checkPasscode(req: Request): NextResponse | null {
  const expected = process.env.GAME_PASSCODE;
  if (!expected) return null; // no passcode configured (local dev)
  if (req.headers.get("x-passcode") === expected) return null;
  return NextResponse.json({ error: "bad_passcode" }, { status: 401 });
}

export function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");
const strArr = (v: unknown, allowed?: Set<string>, max = 50) =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && (!allowed || allowed.has(x))).slice(0, max);
const num = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : dflt;

/**
 * The client owns the game state, so treat it as untrusted input: keep only known ids,
 * clamp numbers, and cap text sizes (so a tampered history can't inflate LLM cost).
 */
export function sanitizeState(raw: unknown, pub: PublicScenario, sec: SecretScenario): GameState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const suspects = new Set(pub.suspects.map((s) => s.id));
  const clues = new Set(sec.clues.map((c) => c.id));
  const rooms = new Set(pub.rooms.map((x) => x.id));
  const factIds = new Set(Object.values(sec.characters).flatMap((c) => c.facts.map((f) => f.id)));
  const per = <T,>(key: string, fn: (v: unknown) => T): Record<string, T> => {
    const src = (r[key] && typeof r[key] === "object" ? r[key] : {}) as Record<string, unknown>;
    return Object.fromEntries([...suspects].map((id) => [id, fn(src[id])]));
  };
  const round = num(r.round, 1, MAX_ROUNDS, 1);
  const history = per("history", (v) =>
    (Array.isArray(v) ? v : []).slice(-8).map(
      (t): ChatTurn => ({ role: (t as ChatTurn)?.role === "suspect" ? "suspect" : "detective", text: str((t as ChatTurn)?.text, 400) }),
    ),
  );
  const claims = (Array.isArray(r.claims) ? r.claims : []).slice(0, 100).filter(
    (c): c is NotebookClaim => !!c && typeof c === "object" && typeof (c as NotebookClaim).id === "string",
  );
  const contradictions = (Array.isArray(r.contradictions) ? r.contradictions : [])
    .slice(0, 100)
    .filter((c): c is Contradiction => !!c && typeof (c as Contradiction).id === "string");
  return {
    scenarioId: pub.id,
    round,
    guard: guardForRound(round),
    jailed: strArr(r.jailed, suspects),
    questionsLeft: per("questionsLeft", (v) => num(v, 0, 5, 0)),
    questionsUsed: num(r.questionsUsed, 0, 1000, 0),
    wrongAccusations: num(r.wrongAccusations, 0, MAX_ROUNDS, 0),
    cluesFound: strArr(r.cluesFound, clues),
    clueCards: [],
    roomsInspected: strArr(r.roomsInspected, rooms),
    presented: per("presented", (v) => strArr(v, clues)),
    stress: per("stress", (v) => num(v, 0, 5, 0)),
    told: per("told", (v) => strArr(v, factIds)),
    history,
    claims,
    contradictions,
    askedTopicsPrev: strArr(r.askedTopicsPrev, undefined, 12).map((q) => q.slice(0, 120)),
    askedThisRound: strArr(r.askedThisRound, undefined, 30).map((q) => q.slice(0, 120)),
    phase: "board",
    solved: false,
  };
}
