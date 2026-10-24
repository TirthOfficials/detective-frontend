// One real Claude Haiku call (~$0.0003) to check the API key, prompt, JSON output and validator.
// Usage: npm run smoke-llm   (reads ANTHROPIC_API_KEY from .env.local)
import { loadCase } from "../lib/server/cases";
import { eligibleFacts } from "../lib/engine";
import { buildPrompt } from "../lib/context";
import { callSuspect, MODEL } from "../lib/llm";
import { validateOutput } from "../lib/validator";
import { costUSD } from "../lib/budget";
import { initialState } from "../lib/rules";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY in .env.local first");
  const { pub, sec } = loadCase("don")!;
  const state = initialState(pub);
  const suspect = pub.suspects.find((s) => s.id === "enzo")!;
  const elig = eligibleFacts(sec.characters.enzo, "enzo", state);
  for (const question of ["Where were you between 8:30 and 9:30?", "Were you stealing money from the Don?"]) {
    const prompt = buildPrompt({ pub, suspect, character: sec.characters.enzo, elig, state, question });
    const res = await callSuspect(prompt);
    const v = validateOutput(res.raw, elig);
    console.log(`\nQ: ${question}\nraw: ${res.raw}\nvalid: ${v.ok ? "yes" : `NO (${v.reason})`}`);
    console.log(`tokens in=${res.inputTokens} out=${res.outputTokens} cost=$${costUSD(res.inputTokens, res.outputTokens).toFixed(6)} (${MODEL})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
