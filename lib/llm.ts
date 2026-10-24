// LLM layer: one Claude Haiku call per question. SERVER ONLY.
import Anthropic from "@anthropic-ai/sdk";
import type { Eligibility } from "./engine";
import type { PromptParts } from "./context";

export const MODEL = "claude-haiku-5-5";
export const MAX_TOKENS = 250;

export function isMock(): boolean {
  return process.env.MOCK_LLM === "1" || !process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ maxRetries: 1, timeout: 20_000 });
  return client;
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    facts_used: { type: "array", items: { type: "string" } },
    deflecting: { type: "boolean" },
  },
  required: ["reply", "facts_used", "deflecting"],
  additionalProperties: false,
};

export type LLMResult = { raw: string; inputTokens: number; outputTokens: number };

export async function callSuspect(prompt: PromptParts): Promise<LLMResult> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "disabled" }, // short in-character lines; no reasoning tokens to pay for
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
  });
  let raw = "";
  for (const block of res.content) if (block.type === "text") raw += block.text;
  if (res.stop_reason === "refusal") raw = "";
  return { raw, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}

/** Rough pessimistic token estimate (≈3.5 chars/token) for the pre-call budget check. */
export function estimateTokens(prompt: PromptParts): number {
  return Math.ceil((prompt.system.length + prompt.user.length) / 3.5);
}

/**
 * MOCK_LLM mode: a deterministic reply built from eligible facts (zero API cost).
 * Picks a fact whose topics match the question; deflects on hidden topics.
 */
export function mockReply(elig: Eligibility, topics: string[], deflection: string): string {
  const unlocked = elig.allowed.find((f) => f.unlocked);
  if (elig.unlockedNow && unlocked) {
    return JSON.stringify({ reply: unlocked.text, facts_used: [unlocked.id], deflecting: false });
  }
  const match =
    elig.allowed.find((f) => f.topics.some((t) => topics.includes(t)) && f.kind === "lie") ??
    elig.allowed.find((f) => f.topics.some((t) => topics.includes(t)));
  if (match) return JSON.stringify({ reply: match.text, facts_used: [match.id], deflecting: false });
  if (topics.some((t) => elig.hiddenTopics.includes(t)) || topics.length === 0) {
    return JSON.stringify({ reply: deflection, facts_used: [], deflecting: true });
  }
  const first = elig.allowed.find((f) => f.kind === "tell");
  return JSON.stringify(
    first
      ? { reply: first.text, facts_used: [first.id], deflecting: false }
      : { reply: deflection, facts_used: [], deflecting: true },
  );
}
