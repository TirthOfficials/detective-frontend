"use client";
// Browser → API helpers. Sends the passcode header saved in localStorage.
import type { AccuseResponse, AskResponse, GameState, InspectResponse } from "../types";
import { storage } from "./storage";

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-passcode": storage.get("mm:passcode") ?? "" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new ApiError(res.status, j.error ?? `http_${res.status}`);
  }
  return res.json();
}

export const api = {
  status: () => call<{ mock: boolean; model: string; spentUSD: number; budgetUSD: number; store: string }>("/api/status"),
  ask: (scenarioId: string, suspectId: string, question: string, state: GameState, presentedClueId?: string) =>
    call<AskResponse>("/api/ask", { scenarioId, suspectId, question, presentedClueId, state }),
  inspect: (scenarioId: string, roomId: string, state: GameState) =>
    call<InspectResponse>("/api/inspect", { scenarioId, roomId, state }),
  accuse: (scenarioId: string, suspectId: string, state: GameState) =>
    call<AccuseResponse>("/api/accuse", { scenarioId, suspectId, state }),
};
