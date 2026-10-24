// GET /api/scenario/[id]: public scenario file (narration, suspects, rooms).
import { NextResponse } from "next/server";
import { getPublicScenario } from "@/lib/publicScenarios";
import { bad, checkPasscode } from "@/lib/server/http";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = checkPasscode(req);
  if (denied) return denied;
  const s = getPublicScenario((await params).id);
  return s ? NextResponse.json(s) : bad("unknown_scenario", 404);
}
