// POST /api/accuse: verdict. Wrong → jail + innocent-secret reveal + next round. No LLM call.
import { NextResponse } from "next/server";
import { loadCase } from "@/lib/server/cases";
import { bad, checkPasscode, sanitizeState } from "@/lib/server/http";
import { computeScore, guardForRound, MAX_ROUNDS, questionsForRound } from "@/lib/rules";
import type { AccuseResponse, PublicScenario, Reveal, SecretScenario } from "@/lib/types";

function buildReveal(pub: PublicScenario, sec: SecretScenario, wrong: number, questionsUsed: number): Reveal {
  return {
    culprit: sec.culprit,
    culpritName: pub.suspects.find((s) => s.id === sec.culprit)?.name ?? sec.culprit,
    motive: sec.motive,
    method: sec.method,
    narration: sec.verdictNarration,
    timeline: sec.timeline.map((t) => ({ time: t.time, event: t.event })),
    score: computeScore(wrong, questionsUsed),
  };
}

export async function POST(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body) return bad("invalid_json");
  const c = loadCase(String(body.scenarioId ?? ""));
  if (!c) return bad("unknown_scenario", 404);
  const { pub, sec } = c;
  const state = sanitizeState(body.state, pub, sec);
  const suspectId = String(body.suspectId ?? "");
  if (!pub.suspects.some((s) => s.id === suspectId)) return bad("unknown_suspect", 404);
  if (state.jailed.includes(suspectId)) return bad("suspect_jailed");

  if (suspectId === sec.culprit) {
    const res: AccuseResponse = { correct: true, reveal: buildReveal(pub, sec, state.wrongAccusations, state.questionsUsed) };
    return NextResponse.json(res);
  }

  const jailed = [...state.jailed, suspectId];
  const remaining = pub.suspects.filter((s) => !jailed.includes(s.id));
  const round = state.round + 1;
  const over = remaining.length <= 1 || round > MAX_ROUNDS;
  const res: AccuseResponse = {
    correct: false,
    jailedId: suspectId,
    jailedReveal: sec.characters[suspectId].innocentSecretReveal ?? "",
    nextRound: over ? null : { round, guard: guardForRound(round), questionsPerSuspect: questionsForRound(round) },
    reveal: over ? buildReveal(pub, sec, state.wrongAccusations + 1, state.questionsUsed) : undefined,
  };
  return NextResponse.json(res);
}
