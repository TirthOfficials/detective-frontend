// Symbolic output check for every LLM reply (Spec §9.5).
import type { Eligibility } from "./engine";

export type LLMOutput = { reply: string; facts_used: string[]; deflecting: boolean };

export type ValidationResult =
  | { ok: true; output: LLMOutput }
  | { ok: false; reason: string; output?: LLMOutput };

export const MAX_REPLY_CHARS = 400;

export function parseLLMJson(raw: string): LLMOutput | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    if (typeof obj.reply !== "string") return null;
    return {
      reply: obj.reply.trim(),
      facts_used: Array.isArray(obj.facts_used) ? obj.facts_used.filter((x: unknown) => typeof x === "string") : [],
      deflecting: obj.deflecting === true,
    };
  } catch {
    return null;
  }
}

function containsKeyword(text: string, kw: string): boolean {
  return text.toLowerCase().includes(kw.toLowerCase());
}

const META_WORDS = ["as an ai", "language model", "known facts", "fixed story", "hidden topics", "facts_used", "policy"];

export function validateOutput(raw: string, elig: Eligibility): ValidationResult {
  const output = parseLLMJson(raw);
  if (!output) return { ok: false, reason: "invalid_json" };
  if (!output.reply) return { ok: false, reason: "empty_reply", output };
  if (output.reply.length > MAX_REPLY_CHARS) return { ok: false, reason: "too_long", output };

  const allowedIds = new Set(elig.allowed.map((f) => f.id));
  const bad = output.facts_used.filter((id) => !allowedIds.has(id));
  if (bad.length) return { ok: false, reason: `unknown_fact_ids:${bad.join(",")}`, output };

  const leak = elig.leakKeywords.find((kw) => containsKeyword(output.reply, kw));
  if (leak) return { ok: false, reason: `leak:${leak}`, output };

  const contra = elig.contradictKeywords.find((kw) => containsKeyword(output.reply, kw));
  if (contra) return { ok: false, reason: `self_contradiction:${contra}`, output };

  const meta = META_WORDS.find((kw) => containsKeyword(output.reply, kw));
  if (meta) return { ok: false, reason: `meta:${meta}`, output };

  return { ok: true, output };
}
