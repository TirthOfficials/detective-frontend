import { describe, expect, it } from "vitest";
import { loadCase } from "@/lib/server/cases";
import { claimsFromClue, claimsFromFacts, eligibleFacts, classifyTopics } from "@/lib/engine";
import { findContradictions, claimsConflict } from "@/lib/contradictions";
import { validateOutput } from "@/lib/validator";
import { buildPrompt } from "@/lib/context";
import { validateCase } from "@/lib/caseValidator";
import { advanceRound, computeScore, initialState } from "@/lib/rules";
import { mockReply } from "@/lib/llm";
import { SCENARIO_ORDER } from "@/lib/publicScenarios";

const { pub, sec } = loadCase("don")!;
const enzo = sec.characters.enzo;
const lucia = sec.characters.lucia;
const fresh = () => initialState(pub);

describe("case files", () => {
  for (const id of SCENARIO_ORDER) {
    it(`${id} is valid and solvable`, () => {
      const c = loadCase(id)!;
      const r = validateCase(c.pub, c.sec);
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
    });
  }
});

describe("contradictions", () => {
  it("flags Enzo's garden alibi against the untouched snow (C5)", () => {
    const state = fresh();
    const elig = eligibleFacts(enzo, "enzo", state);
    const e2 = elig.allowed.filter((f) => f.id === "E2");
    const enzoClaims = claimsFromFacts(pub, "enzo", e2);
    const snow = claimsFromClue(pub, sec.clues.find((c) => c.id === "C5")!);
    const found = findContradictions(enzoClaims, snow);
    expect(found).toHaveLength(1); // one per statement/clue pair, not one per time point
    expect(found.every((c) => c.a.subject === "enzo")).toBe(true);
  });

  it("flags Enzo vs Lucia once Lucia's sighting is unlocked", () => {
    const state = { ...fresh(), cluesFound: ["C5"] };
    const elig = eligibleFacts(lucia, "lucia", state, "C5");
    expect(elig.unlockedNow).toBe(true);
    const l3 = elig.allowed.filter((f) => f.id === "L3");
    const luciaClaims = claimsFromFacts(pub, "lucia", l3);
    const enzoClaims = claimsFromFacts(pub, "enzo", eligibleFacts(enzo, "enzo", state).allowed.filter((f) => f.id === "E2"));
    const found = findContradictions(enzoClaims, luciaClaims);
    expect(found).toHaveLength(1);
    expect(found[0].b.label).toMatch(/Lucia says Enzo was in the study corridor at 21:15/);
  });

  it("does not flag compatible claims or duplicates", () => {
    expect(claimsConflict({ subject: "a", pred: "at", place: "x", time: "1" }, { subject: "a", pred: "at", place: "x", time: "1" })).toBe(false);
    expect(claimsConflict({ subject: "a", pred: "at", place: "x", time: "1" }, { subject: "a", pred: "not_at", place: "y", time: "1" })).toBe(false);
    expect(claimsConflict({ subject: "a", pred: "at", place: "x", time: "1" }, { subject: "a", pred: "at", place: "y", time: "2" })).toBe(false);
    const snow = claimsFromClue(pub, sec.clues.find((c) => c.id === "C5")!);
    const e = claimsFromFacts(pub, "enzo", eligibleFacts(enzo, "enzo", fresh()).allowed.filter((f) => f.id === "E2"));
    const first = findContradictions(e, snow);
    expect(findContradictions([...e, ...snow], [], first)).toHaveLength(0);
    expect(findContradictions(e, snow, first)).toHaveLength(0);
  });
});

describe("fact policies", () => {
  it("never exposes truth or concealed text to the eligible set", () => {
    const elig = eligibleFacts(enzo, "enzo", fresh());
    const texts = elig.allowed.map((f) => f.text).join(" ");
    expect(texts).not.toContain("hallway at 9:00");
    expect(texts).not.toContain("Calabrese");
    expect(elig.hiddenTopics).toEqual(expect.arrayContaining(["motive", "money"]));
  });

  it("switches to lie_text_v2 at guard >= 2 (new claim defeats the snow)", () => {
    const s = advanceRound(fresh(), "rosa");
    expect(s.guard).toBe(2);
    const e2 = eligibleFacts(enzo, "enzo", s).allowed.find((f) => f.id === "E2")!;
    expect(e2.text).toMatch(/porch/);
    const claims = claimsFromFacts(pub, "enzo", [e2]);
    const snow = claimsFromClue(pub, sec.clues.find((c) => c.id === "C5")!);
    expect(findContradictions(claims, snow)).toHaveLength(0);
  });

  it("unlocks a concealed fact only when the clue is found AND presented", () => {
    const found = { ...fresh(), cluesFound: ["C1"] };
    expect(eligibleFacts(enzo, "enzo", found).allowed.some((f) => f.id === "E3")).toBe(false);
    const elig = eligibleFacts(enzo, "enzo", found, "C1");
    expect(elig.unlockedNow).toBe(true);
    expect(elig.allowed.find((f) => f.id === "E3")?.text).toMatch(/Calabreses/);
    // Presenting a clue that hasn't been found does nothing.
    expect(eligibleFacts(enzo, "enzo", fresh(), "C1").unlockedNow).toBe(false);
  });

  it("withholds facts above reveal_guard_max", () => {
    let s = fresh();
    s = advanceRound(s, "rosa");
    s = advanceRound(s, "sal");
    expect(s.guard).toBe(3);
    const gino = sec.characters.gino;
    const elig = eligibleFacts(gino, "gino", { ...s, cluesFound: ["C4"] }, "C4");
    expect(elig.withheld).toContain("G4");
    expect(elig.allowed.some((f) => f.id === "G4")).toBe(false);
  });
});

describe("validator", () => {
  const elig = eligibleFacts(enzo, "enzo", fresh());
  it("accepts a clean reply", () => {
    const r = validateOutput(JSON.stringify({ reply: "In the garden, detective.", facts_used: ["E2"], deflecting: false }), elig);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown fact ids, leaks, bad JSON and meta talk", () => {
    expect(validateOutput(JSON.stringify({ reply: "x", facts_used: ["E3"], deflecting: false }), elig).ok).toBe(false);
    expect(validateOutput(JSON.stringify({ reply: "The Calabrese money? No.", facts_used: [], deflecting: true }), elig).ok).toBe(false);
    expect(validateOutput("not json", elig).ok).toBe(false);
    expect(validateOutput(JSON.stringify({ reply: "As an AI I cannot", facts_used: [], deflecting: false }), elig).ok).toBe(false);
  });
  it("rejects self-contradiction once a lie is on the record", () => {
    const told = { ...fresh(), told: { ...fresh().told, enzo: ["E2"] } };
    const e = eligibleFacts(enzo, "enzo", told);
    const r = validateOutput(JSON.stringify({ reply: "I was in the hallway.", facts_used: [], deflecting: false }), e);
    expect(r.ok).toBe(false);
  });
});

describe("prompt builder", () => {
  it("contains the cover story but not the truth, culprit or concealed text", () => {
    const state = fresh();
    const elig = eligibleFacts(enzo, "enzo", state);
    const p = buildPrompt({ pub, suspect: pub.suspects[0], character: enzo, elig, state, question: "Where were you?" });
    const all = p.system + p.user;
    expect(all).toContain("I was in the garden having a cigar");
    expect(all).not.toContain("I was in the hallway at 9:00");
    expect(all).not.toContain("Calabrese");
    expect(all).not.toContain("culprit");
    expect(all).toContain("motive, money");
  });
});

describe("mock LLM", () => {
  it("answers alibi questions with the cover story and deflects hidden topics", () => {
    const elig = eligibleFacts(enzo, "enzo", fresh());
    const r1 = JSON.parse(mockReply(elig, classifyTopics("Where were you between 8:30 and 9:30?"), enzo.deflection));
    expect(r1.facts_used).toEqual(["E2"]);
    const r2 = JSON.parse(mockReply(elig, ["motive"], enzo.deflection));
    expect(r2.deflecting).toBe(true);
  });
});

describe("rules", () => {
  it("scores and advances rounds", () => {
    expect(computeScore(0, 15)).toBe(100);
    expect(computeScore(1, 20)).toBe(75);
    const s = advanceRound({ ...fresh(), stress: { ...fresh().stress, enzo: 3 } }, "sal");
    expect(s.round).toBe(2);
    expect(s.questionsLeft.sal).toBe(0);
    expect(s.questionsLeft.enzo).toBe(3);
    expect(s.stress.enzo).toBe(2);
  });
});
