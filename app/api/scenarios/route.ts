// GET /api/scenarios: public scenario list.
import { NextResponse } from "next/server";
import { scenarioSummaries } from "@/lib/publicScenarios";
import { checkPasscode } from "@/lib/server/http";

export async function GET(req: Request) {
  return checkPasscode(req) ?? NextResponse.json(scenarioSummaries());
}
