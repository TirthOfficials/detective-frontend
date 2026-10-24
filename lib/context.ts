// Context builder: turns the engine's eligible facts into the per-suspect prompt (Spec §10.1).
// The LLM never sees `truth`, `policy`, the culprit, or the text of a concealed fact.
import type { Eligibility } from "./engine";
import type { ChatTurn, GameState, PublicScenario, PublicSuspect, SecretCharacter } from "./types";

const GUARD_INSTRUCTIONS: Record<number, string> = {
  1: "You're nervous but cooperative.",
  2: "You've seen the detective's methods. Be careful and give short answers.",
  3: "Trust no one. Answer only what you must.",
};

export const MAX_HISTORY_ENTRIES = 8; // last 4 detective/suspect exchanges
const MAX_TURN_CHARS = 400;

export function clip(text: string, n: number): string {
  return text.length > n ? text.slice(0, n) + "…" : text;
}

export type PromptParts = { system: string; user: string };

export function buildPrompt(args: {
  pub: PublicScenario;
  suspect: PublicSuspect;
  character: SecretCharacter;
  elig: Eligibility;
  state: GameState;
  question: string;
  presentedClue?: { name: string; text: string } | null;
  strict?: boolean;
}): PromptParts {
  const { pub, suspect, character, elig, state, question, presentedClue, strict } = args;
  const known = elig.allowed.filter((f) => f.kind === "tell");
  const story = elig.allowed.filter((f) => f.kind === "lie");
  const toldIds = new Set(state.told[suspect.id] ?? []);
  const alreadySaid = elig.allowed.filter((f) => toldIds.has(f.id)).map((f) => `- "${f.text}"`);
  const prev = state.askedTopicsPrev.slice(-5);
  const others = pub.suspects
    .filter((s) => s.id !== suspect.id)
    .map((s) => `${s.name} (${s.role})${state.jailed.includes(s.id) ? " - now in jail" : ""}`)
    .join("; ");

  const lines = (fs: typeof known) => (fs.length ? fs.map((f) => `[${f.id}] ${f.text}`).join("\n") : "(none)");

  const system = `You are ${suspect.name}, ${suspect.role}, a suspect in a ${pub.year} mafia murder mystery ("${pub.title}"). ${pub.victim}
Personality and voice: ${character.personality} ${suspect.voice}.
Other people in the house: ${others}.
Stay fully in character. Reply in 1 to 3 sentences, under 60 words. Never mention being an AI, "facts", "policies", or JSON.

RULES
1. You may only state things listed under KNOWN FACTS or FIXED STORY. Never invent events, times, places, or people.
2. If asked about something not listed, say you don't know, or deflect in character.
3. FIXED STORY items are what you claim happened. Repeat them consistently and never contradict them or what you already said.
4. HIDDEN TOPICS: you are hiding something about: ${elig.hiddenTopics.length ? elig.hiddenTopics.join(", ") : "nothing"}. If asked about these, deflect, change the subject, or show irritation, and set "deflecting": true. Do not guess, hint, or reveal.
5. Guard level ${state.guard}/3: ${GUARD_INSTRUCTIONS[state.guard] ?? GUARD_INSTRUCTIONS[3]}
6. The detective has been asking about: ${prev.length ? prev.map((q) => `"${clip(q, 80)}"`).join(", ") : "nothing yet"}.${
    elig.unlockedNow
      ? "\n7. The detective just showed you evidence you cannot explain away. Admit the KNOWN FACT marked with it, grudgingly, in your own voice."
      : ""
  }${strict ? "\nIMPORTANT: Your previous answer broke the rules. Use ONLY the listed items, cite their ids exactly, and reveal nothing hidden." : ""}

KNOWN FACTS
${lines(known)}
FIXED STORY
${lines(story)}

ALREADY SAID TO THE DETECTIVE
${alreadySaid.length ? alreadySaid.join("\n") : "(nothing yet)"}

OUTPUT: return ONLY valid JSON:
{"reply": "<what you say>", "facts_used": ["<ids of items you relied on>"], "deflecting": false}

EXAMPLE
Detective: "Where were you at nine?"
{"reply": "Where I always am at that hour, detective. Minding my own business.", "facts_used": [], "deflecting": true}`;

  const history = (state.history[suspect.id] ?? []).slice(-MAX_HISTORY_ENTRIES);
  const convo = history.length
    ? history
        .map((t: ChatTurn) => `${t.role === "detective" ? "Detective" : suspect.name}: ${clip(t.text, MAX_TURN_CHARS)}`)
        .join("\n")
    : "(this is the first question)";

  const user = `CONVERSATION SO FAR
${convo}

Detective: "${question}"${
    presentedClue ? `\nThe detective shows you: "${presentedClue.name}: ${presentedClue.text}"` : ""
  }`;

  return { system, user };
}
