// POST /api/ask: one question to one suspect. Engine → prompt → LLM → validator → state update.
import { NextResponse } from "next/server";
import { loadCase } from "@/lib/server/cases";
import { bad, checkPasscode, sanitizeState } from "@/lib/server/http";
import { classifyTopics, claimsFromFacts, eligibleFacts, nextStress } from "@/lib/engine";
import { buildPrompt } from "@/lib/context";
import { callSuspect, estimateTokens, isMock, MAX_TOKENS, mockReply } from "@/lib/llm";
import { validateOutput, type LLMOutput } from "@/lib/validator";
import { findContradictions } from "@/lib/contradictions";
import { checkAndReserve, clientIp, costUSD, recordUsage } from "@/lib/budget";
import type { AskResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_QUESTION_CHARS = 300;

const NOTICES: Record<string, string> = {
  budget: "The game's AI budget is used up, so suspects are giving stock answers. This question was not counted.",
  rate_minute: "Slow down, detective. Too many questions this minute. Try again shortly. This question was not counted.",
  rate_day: "You've hit today's question limit. This question was not counted.",
  global_day: "The precinct is closed for today (daily AI limit reached). This question was not counted.",
};

export async function POST(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }
  const c = loadCase(String(body.scenarioId ?? ""));
  if (!c) return bad("unknown_scenario", 404);
  const { pub, sec } = c;

  const suspectId = String(body.suspectId ?? "");
  const suspect = pub.suspects.find((s) => s.id === suspectId);
  const character = sec.characters[suspectId];
  if (!suspect || !character) return bad("unknown_suspect", 404);

  const state = sanitizeState(body.state, pub, sec);
  if (state.jailed.includes(suspectId)) return bad("suspect_jailed");
  if ((state.questionsLeft[suspectId] ?? 0) <= 0) return bad("no_questions_left");

  const question = String(body.question ?? "").trim().slice(0, MAX_QUESTION_CHARS);
  if (!question) return bad("empty_question");

  const presentedClueId = typeof body.presentedClueId === "string" ? body.presentedClueId : undefined;
  if (presentedClueId && !state.cluesFound.includes(presentedClueId)) return bad("clue_not_found");
  const clue = presentedClueId ? sec.clues.find((x) => x.id === presentedClueId) : undefined;

  // 1-3. Symbolic engine: unlocks + eligible facts for THIS suspect.
  const elig = eligibleFacts(character, suspectId, state, presentedClueId);
  const prompt = buildPrompt({
    pub, suspect, character, elig, state, question,
    presentedClue: clue ? { name: clue.name, text: clue.text } : null,
  });

  // 4. Neural layer (or mock), then the validator.
  let output: LLMOutput | null = null;
  let mode: AskResponse["mode"] = "llm";
  let notice: string | undefined;

  if (isMock()) {
    mode = "mock";
    const r = validateOutput(mockReply(elig, classifyTopics(question), character.deflection), elig);
    output = r.ok ? r.output : null;
  } else {
    const estimate = costUSD(estimateTokens(prompt) * 2, MAX_TOKENS * 2); // worst case: one regeneration
    const gate = await checkAndReserve(clientIp(req), estimate);
    if (!gate.ok) {
      mode = "budget";
      notice = NOTICES[gate.reason];
    } else {
      try {
        for (const strict of [false, true]) {
          const p = strict ? buildPrompt({ pub, suspect, character, elig, state, question, presentedClue: clue ? { name: clue.name, text: clue.text } : null, strict }) : prompt;
          const res = await callSuspect(p);
          await recordUsage(res.inputTokens, res.outputTokens);
          const v = validateOutput(res.raw, elig);
          if (v.ok) {
            output = v.output;
            break;
          }
          console.warn(`[validator] ${pub.id}/${suspectId} attempt=${strict ? 2 : 1} reason=${v.reason} raw=${res.raw.slice(0, 200)}`);
        }
        if (!output) mode = "fallback";
      } catch (e) {
        console.error("[llm] call failed", e);
        mode = "fallback";
      }
    }
  }

  if (!output) output = { reply: character.deflection, facts_used: [], deflecting: true };

  // 5. State update (symbolic): facts used, claims, contradictions, stress.
  const usedIds = new Set(output.facts_used);
  if (elig.unlockedNow && mode !== "budget") {
    for (const f of elig.allowed) if (f.unlocked) usedIds.add(f.id); // the unlock is decided symbolically
  }
  const used = elig.allowed.filter((f) => usedIds.has(f.id));
  const newClaims = claimsFromFacts(pub, suspectId, used).filter((nc) => !state.claims.some((x) => x.id === nc.id));
  const newContradictions = findContradictions(state.claims, newClaims, state.contradictions);
  const usedLie = used.some((f) => f.kind === "lie");
  const stress = mode === "budget" ? state.stress[suspectId] ?? 0 : nextStress(state.stress[suspectId] ?? 0, usedLie, output.deflecting, elig.unlockedNow);

  const response: AskResponse = {
    reply: output.reply,
    deflecting: output.deflecting,
    stress,
    factsToldIds: [...usedIds],
    newClaims,
    newContradictions,
    unlockedNow: elig.unlockedNow && mode !== "budget",
    mode,
    notice,
  };
  return NextResponse.json(response);
}
