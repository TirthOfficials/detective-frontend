// POST /api/inspect: room → pre-written clues. No LLM call.
import { NextResponse } from "next/server";
import { loadCase } from "@/lib/server/cases";
import { bad, checkPasscode, sanitizeState } from "@/lib/server/http";
import { claimsFromClue } from "@/lib/engine";
import { findContradictions } from "@/lib/contradictions";
import type { InspectResponse } from "@/lib/types";

export async function POST(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body) return bad("invalid_json");
  const c = loadCase(String(body.scenarioId ?? ""));
  if (!c) return bad("unknown_scenario", 404);
  const { pub, sec } = c;
  const roomId = String(body.roomId ?? "");
  if (!pub.rooms.some((r) => r.id === roomId)) return bad("unknown_room", 404);
  const state = sanitizeState(body.state, pub, sec);

  const found = sec.clues.filter((x) => x.room === roomId);
  const newClaims = found
    .flatMap((x) => claimsFromClue(pub, x))
    .filter((nc) => !state.claims.some((e) => e.id === nc.id));
  const res: InspectResponse = {
    clues: found.map(({ id, name, text, room }) => ({ id, name, text, room })),
    newClaims,
    newContradictions: findContradictions(state.claims, newClaims, state.contradictions),
  };
  return NextResponse.json(res);
}
