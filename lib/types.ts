// Shared types for the symbolic game engine.
// Public* types are safe for the browser. Secret* types are server-only.

export type Topic =
  | "alibi"
  | "relationship"
  | "witness"
  | "suspicion"
  | "observation"
  | "motive"
  | "money"
  | "weapon"
  | string;

export type ClaimPred = "at" | "not_at";

export type Claim = {
  subject: string; // suspect id
  pred: ClaimPred;
  place: string;
  time: string; // "HH:MM"
};

export type ClaimSpec = Claim | Claim[] | null | undefined;

export function toClaims(spec: ClaimSpec): Claim[] {
  return spec ? (Array.isArray(spec) ? spec : [spec]) : [];
}

/** A claim as recorded in the detective's notebook, with provenance. */
export type NotebookClaim = Claim & {
  id: string; // stable id, e.g. "lie:E2" or "clue:C5"
  source: string; // "suspect:enzo" | "clue:C5"
  label: string; // human readable, e.g. "Enzo says he was in the garden at 21:15"
};

export type Contradiction = {
  id: string; // `${a.id}|${b.id}` sorted
  a: NotebookClaim;
  b: NotebookClaim;
  explanation: string;
};

// ---------- Public scenario (browser-safe) ----------

export type PublicSuspect = {
  id: string;
  name: string;
  short: string; // display name, e.g. "Enzo", "O'Rourke"
  role: string;
  portrait: string;
  story: string;
  voice: string;
  accent: string; // hex color used for SVG fallback portrait
};

export type PublicRoom = { id: string; name: string; description: string };

export type PublicScenario = {
  id: string;
  title: string;
  year: number;
  setting: string;
  blurb: string;
  victim: string;
  alibiWindow: string; // e.g. "between 8:30 and 9:30" (used by question chips)
  clueCount: number;
  background: string;
  narration: {
    intro: string[];
    detectiveEnters: string;
  };
  rooms: PublicRoom[];
  suspects: PublicSuspect[];
  places: Record<string, string>; // place id -> display name (for claim labels)
};

export type ScenarioSummary = Pick<
  PublicScenario,
  "id" | "title" | "year" | "setting" | "blurb" | "background"
>;

// ---------- Secret case file (server-only) ----------

export type FactPolicy = "tell" | "lie" | "conceal";

export type Fact = {
  id: string;
  policy: FactPolicy;
  topics: Topic[];
  text?: string; // tell
  truth?: string; // lie (never sent to the LLM)
  lie_text?: string; // lie, guard 1
  lie_text_v2?: string; // lie, guard >= 2
  claim?: ClaimSpec; // asserted when this fact is used (tell / lie v1)
  claim_v2?: ClaimSpec; // asserted when lie_text_v2 is used
  contradict_keywords?: string[]; // lie: reply must never contain these once told
  unlock_when?: string | string[]; // conceal: "clue:C1" (any of)
  unlocked_text?: string; // conceal: what they admit once unlocked
  unlocked_claim?: ClaimSpec;
  leak_keywords?: string[]; // conceal: must not appear in a reply while locked
  reveal_guard_max?: number; // withheld when guard > this
};

export type Clue = {
  id: string;
  room: string;
  name: string;
  text: string;
  claim: ClaimSpec;
  points_to: string[]; // suspect ids this clue implicates
};

export type TimelineEvent = {
  id: string;
  time: string;
  who: string;
  where: string;
  event: string;
  witnesses: string[];
};

export type SecretCharacter = {
  personality: string;
  innocentSecretReveal: string | null;
  deflection: string; // canned in-character fallback
  facts: Fact[];
};

export type SecretScenario = {
  id: string;
  culprit: string;
  motive: string;
  opportunity: string;
  method: string;
  verdictNarration: string;
  timeline: TimelineEvent[];
  clues: Clue[];
  characters: Record<string, SecretCharacter>;
};

// ---------- Client game state (public, localStorage) ----------

export type ChatTurn = { role: "detective" | "suspect"; text: string; clueId?: string };

export type GameState = {
  scenarioId: string;
  round: number; // 1..4
  guard: number; // 1..3 (= min(round, 3))
  jailed: string[];
  questionsLeft: Record<string, number>;
  questionsUsed: number;
  wrongAccusations: number;
  cluesFound: string[];
  clueCards: PublicClue[]; // public text of found clues, for the notebook
  roomsInspected: string[];
  presented: Record<string, string[]>; // suspectId -> clue ids shown to them
  stress: Record<string, number>;
  told: Record<string, string[]>; // suspectId -> fact ids already used (lie ledger)
  history: Record<string, ChatTurn[]>;
  claims: NotebookClaim[];
  contradictions: Contradiction[];
  askedTopicsPrev: string[];
  askedThisRound: string[];
  phase: "intro" | "board" | "deliberation" | "reveal" | "verdict";
  solved: boolean;
  jailReveal?: { suspectId: string; text: string; final: boolean } | null;
  verdict?: (Reveal & { won: boolean }) | null;
};

export type PublicClue = { id: string; name: string; text: string; room: string };

// ---------- API shapes ----------

export type AskRequest = {
  scenarioId: string;
  suspectId: string;
  question: string;
  presentedClueId?: string;
  state: GameState;
};

export type AskResponse = {
  reply: string;
  deflecting: boolean;
  stress: number;
  factsToldIds: string[];
  newClaims: NotebookClaim[];
  newContradictions: Contradiction[];
  unlockedNow: boolean;
  mode: "mock" | "llm" | "fallback" | "budget";
  notice?: string;
};

export type InspectResponse = {
  clues: PublicClue[];
  newClaims: NotebookClaim[];
  newContradictions: Contradiction[];
};

export type Reveal = {
  culprit: string;
  culpritName: string;
  motive: string;
  method: string;
  narration: string;
  timeline: { time: string; event: string }[];
  score: number;
};

export type AccuseResponse =
  | { correct: true; reveal: Reveal }
  | {
      correct: false;
      jailedId: string;
      jailedReveal: string;
      nextRound: { round: number; guard: number; questionsPerSuspect: number } | null;
      reveal?: Reveal; // set when only the culprit remains
    };
