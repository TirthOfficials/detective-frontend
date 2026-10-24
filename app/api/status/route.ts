// GET /api/status: is the passcode right, which LLM mode, and how much budget is used.
import { NextResponse } from "next/server";
import { budgetStatus } from "@/lib/budget";
import { isMock, MODEL } from "@/lib/llm";
import { checkPasscode } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;
  return NextResponse.json({ mock: isMock(), model: MODEL, ...(await budgetStatus()) });
}
