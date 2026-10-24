// The symbolic game engine: who knows what, what they may say, unlocks, stress.
// Pure functions. Callers pass in the secret case file; nothing here is sent to the client.
import { MAX_STRESS } from "./rules";
import { toClaims } from "./types";
import type {
  Claim,
  Clue,
  Fact,
  GameState,
  NotebookClaim,
  PublicScenario,
  SecretCharacter,
} from "./types";

export type AllowedFact = {
  id: string;
  kind: "tell" | "lie";
  text: string;
  topics: string[];
  claims: Claim[];
  claimVariant: "" | "v2";
  unlocked: boolean; // a conceal fact the detective has just broken open
};

export type Eligibility = {
  allowed: AllowedFact[];
  hiddenTopics: string[];
  leakKeywords: string[];
  contradictKeywords: string[];
  unlockedNow: boolean; // presenting THIS clue unlocked a fact
  withheld: string[]; // fact ids withheld due to guard
};

function unlockClues(fact: Fact): string[] {
  const u = fact.unlock_when;
  const list = Array.isArray(u) ? u : u ? [u] : [];
  return list.filter((s) => s.startsWith("clue:")).map((s) => s.slice(5));
}

/**
 * A conceal fact is unlocked once the detective has found one of its trigger clues AND
 * presented it to this suspect (now or earlier), or if it was already told before.
 */
export function isUnlocked(
  fact: Fact,
  suspectId: string,
  state: GameState,
  presentedClueId?: string,
): boolean {
  if (fact.policy !== "conceal") return false;
  if ((state.told[suspectId] ?? []).includes(fact.id)) return true;
  const presented = new Set([...(state.presented[suspectId] ?? []), presentedClueId].filter(Boolean));
  return unlockClues(fact).some((c) => state.cluesFound.includes(c) && presented.has(c));
}

export function eligibleFacts(
  character: SecretCharacter,
  suspectId: string,
  state: GameState,
  presentedClueId?: string,
): Eligibility {
  const res: Eligibility = {
    allowed: [],
    hiddenTopics: [],
    leakKeywords: [],
    contradictKeywords: [],
    unlockedNow: false,
    withheld: [],
  };
  const told = state.told[suspectId] ?? [];

  for (const fact of character.facts) {
    const unlocked = isUnlocked(fact, suspectId, state, presentedClueId);

    if (fact.reveal_guard_max != null && state.guard > fact.reveal_guard_max) {
      res.withheld.push(fact.id);
      if (fact.policy === "conceal" && !unlocked) {
        res.hiddenTopics.push(...fact.topics);
        res.leakKeywords.push(...(fact.leak_keywords ?? []));
      }
      continue;
    }

    if (fact.policy === "conceal") {
      if (unlocked) {
        const wasUnlocked = isUnlocked(fact, suspectId, state);
        if (!wasUnlocked) res.unlockedNow = true;
        res.allowed.push({
          id: fact.id,
          kind: "tell",
          text: fact.unlocked_text ?? "",
          topics: fact.topics,
          claims: toClaims(fact.unlocked_claim),
          claimVariant: "",
          unlocked: true,
        });
      } else {
        res.hiddenTopics.push(...fact.topics);
        res.leakKeywords.push(...(fact.leak_keywords ?? []));
      }
      continue;
    }

    if (fact.policy === "lie") {
      const useV2 = state.guard >= 2 && !!fact.lie_text_v2;
      res.allowed.push({
        id: fact.id,
        kind: "lie",
        text: (useV2 ? fact.lie_text_v2 : fact.lie_text) ?? "",
        topics: fact.topics,
        claims: toClaims(useV2 && fact.claim_v2 !== undefined ? fact.claim_v2 : fact.claim),
        claimVariant: useV2 ? "v2" : "",
        unlocked: false,
      });
      if (told.includes(fact.id)) res.contradictKeywords.push(...(fact.contradict_keywords ?? []));
      continue;
    }

    res.allowed.push({
      id: fact.id,
      kind: "tell",
      text: fact.text ?? "",
      topics: fact.topics,
      claims: toClaims(fact.claim),
      claimVariant: "",
      unlocked: false,
    });
  }

  // A keyword the suspect has been forced to admit (unlocked text) is no longer a contradiction.
  const admitted = res.allowed.filter((f) => f.unlocked).map((f) => f.text.toLowerCase()).join(" ");
  res.contradictKeywords = res.contradictKeywords.filter((k) => !admitted.includes(k.toLowerCase()));
  res.hiddenTopics = [...new Set(res.hiddenTopics)];
  return res;
}

// ---------- Claims ----------

function placeName(pub: PublicScenario, place: string): string {
  return pub.places[place] ?? `at ${place.replace(/_/g, " ")}`;
}

function personName(pub: PublicScenario, id: string): string {
  return pub.suspects.find((s) => s.id === id)?.short ?? id;
}

export function claimLabel(pub: PublicScenario, claim: Claim, speaker: string | null): string {
  const subj = personName(pub, claim.subject);
  const where = placeName(pub, claim.place);
  const what =
    claim.pred === "at" ? `${subj} was ${where} at ${claim.time}` : `${subj} was NOT ${where} at ${claim.time}`;
  if (!speaker) return what;
  const sp = personName(pub, speaker);
  if (speaker === claim.subject) {
    return claim.pred === "at"
      ? `${sp} says they were ${where} at ${claim.time}`
      : `${sp} says they were not ${where} at ${claim.time}`;
  }
  return `${sp} says ${what}`;
}

export function claimsFromFacts(
  pub: PublicScenario,
  suspectId: string,
  used: AllowedFact[],
): NotebookClaim[] {
  return used.flatMap((f) =>
    f.claims.map((c, i) => ({
      ...c,
      id: `fact:${suspectId}:${f.id}${f.claimVariant ? ":" + f.claimVariant : ""}:${i}`,
      source: `suspect:${suspectId}`,
      label: claimLabel(pub, c, suspectId),
    })),
  );
}

export function claimsFromClue(pub: PublicScenario, clue: Clue): NotebookClaim[] {
  return toClaims(clue.claim).map((c, i) => ({
    ...c,
    id: `clue:${clue.id}:${i}`,
    source: `clue:${clue.id}`,
    label: `${clue.name}: ${claimLabel(pub, c, null)}`,
  }));
}

// ---------- Stress ----------

export function nextStress(current: number, usedLie: boolean, deflecting: boolean, unlockedNow: boolean): number {
  let s = current;
  if (usedLie || deflecting) s += 1;
  if (unlockedNow) s += 1; // cracking a secret rattles them
  return Math.min(MAX_STRESS, s);
}

// ---------- Topic classifier (used by mock mode and prompt hints) ----------

const TOPIC_WORDS: Record<string, string[]> = {
  alibi: ["where were", "where was", "alibi", "at nine", "9:00", "9:15", "8:30", "9:30", "tonight were you", "doing at", "whereabouts"],
  relationship: ["know", "relationship", "how long", "family", "married", "brother", "sister", "son", "work for", "feel about"],
  witness: ["see", "saw", "seen", "anyone", "near the", "hear", "heard", "witness"],
  suspicion: ["who", "wanted", "dead", "kill", "enemies", "suspect", "blame", "motive for"],
  observation: ["strange", "notice", "unusual", "odd", "anything else"],
  motive: ["why", "motive", "secret", "hiding", "lawyer", "will", "inherit", "debt"],
  money: ["money", "ledger", "$", "cash", "books", "accounts", "pay", "bribe", "debt", "manifest"],
  weapon: ["poison", "whiskey", "decanter", "drink", "tray", "weapon", "knife", "gun", "blood"],
};

export function classifyTopics(question: string): string[] {
  const q = question.toLowerCase();
  const out: string[] = [];
  for (const [topic, words] of Object.entries(TOPIC_WORDS)) {
    if (words.some((w) => q.includes(w))) out.push(topic);
  }
  return out;
}
