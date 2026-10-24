// Spend cap + rate limiting for LLM calls. SERVER ONLY.
//
// Storage: if UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set, counters live in
// Upstash (shared across all Vercel instances, so the cap is global). Otherwise they live in
// process memory, which is per serverless instance: still a useful brake, but set a hard
// monthly spend limit in the Anthropic Console as the real backstop.

// Claude Haiku 5.5 prices (USD per million tokens, prompts <= 100K tokens).
export const PRICE_INPUT_PER_M = 0.1;
export const PRICE_OUTPUT_PER_M = 0.5;

const BUDGET_USD = Number(process.env.LLM_BUDGET_USD ?? "3");
const PER_IP_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? "12");
const PER_IP_PER_DAY = Number(process.env.RATE_LIMIT_PER_DAY ?? "150");
const GLOBAL_PER_DAY = Number(process.env.GLOBAL_CALLS_PER_DAY ?? "2000");

const MICRO = 1_000_000; // store spend as integer micro-dollars
const SPEND_KEY = "mm:spend_micro_usd";

export function costUSD(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_INPUT_PER_M + outputTokens * PRICE_OUTPUT_PER_M) / 1_000_000;
}

// ---------- storage ----------

const mem = new Map<string, { value: number; expires: number }>();

function upstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(commands: (string | number)[][]): Promise<unknown[]> {
  const u = upstash()!;
  const res = await fetch(`${u.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result: unknown }[];
  return json.map((r) => r.result);
}

async function incr(key: string, by: number, ttlSeconds: number | null): Promise<number> {
  if (upstash()) {
    const cmds: (string | number)[][] = [["INCRBY", key, by]];
    if (ttlSeconds) cmds.push(["EXPIRE", key, ttlSeconds, "NX"]);
    const [v] = await redis(cmds);
    return Number(v);
  }
  const now = Date.now();
  const cur = mem.get(key);
  const fresh = !cur || cur.expires < now;
  const value = (fresh ? 0 : cur!.value) + by;
  mem.set(key, { value, expires: fresh ? (ttlSeconds ? now + ttlSeconds * 1000 : Infinity) : cur!.expires });
  return value;
}

async function get(key: string): Promise<number> {
  if (upstash()) {
    const [v] = await redis([["GET", key]]);
    return Number(v ?? 0);
  }
  const cur = mem.get(key);
  return cur && cur.expires >= Date.now() ? cur.value : 0;
}

// ---------- public API ----------

export type Gate = { ok: true } | { ok: false; reason: "budget" | "rate_minute" | "rate_day" | "global_day" };

/** Call before an LLM request. `estimateUSD` is a pessimistic estimate for this call. */
export async function checkAndReserve(ip: string, estimateUSD: number): Promise<Gate> {
  try {
    const spent = (await get(SPEND_KEY)) / MICRO;
    if (spent + estimateUSD > BUDGET_USD) return { ok: false, reason: "budget" };

    const minute = Math.floor(Date.now() / 60_000);
    const day = new Date().toISOString().slice(0, 10);
    if ((await incr(`mm:rl:m:${ip}:${minute}`, 1, 120)) > PER_IP_PER_MINUTE) return { ok: false, reason: "rate_minute" };
    if ((await incr(`mm:rl:d:${ip}:${day}`, 1, 172_800)) > PER_IP_PER_DAY) return { ok: false, reason: "rate_day" };
    if ((await incr(`mm:rl:g:${day}`, 1, 172_800)) > GLOBAL_PER_DAY) return { ok: false, reason: "global_day" };
    return { ok: true };
  } catch (e) {
    // If the counter store is down, fail closed: no LLM call.
    console.error("[budget] counter error", e);
    return { ok: false, reason: "budget" };
  }
}

/** Call after each LLM response with the real token usage. Returns total spent so far. */
export async function recordUsage(inputTokens: number, outputTokens: number): Promise<number> {
  const micro = Math.ceil(costUSD(inputTokens, outputTokens) * MICRO);
  try {
    const total = (await incr(SPEND_KEY, micro, null)) / MICRO;
    console.log(
      `[llm] in=${inputTokens} out=${outputTokens} cost=$${(micro / MICRO).toFixed(6)} total=$${total.toFixed(4)} / $${BUDGET_USD}`,
    );
    return total;
  } catch (e) {
    console.error("[budget] record error", e);
    return NaN;
  }
}

export async function budgetStatus() {
  const spent = (await get(SPEND_KEY).catch(() => NaN)) / MICRO;
  return { spentUSD: spent, budgetUSD: BUDGET_USD, store: upstash() ? "upstash" : "memory" };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}
