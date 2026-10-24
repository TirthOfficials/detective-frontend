// Solvability + consistency checks for a case file (used by scripts/validate-case.ts and tests).
import { claimsConflict } from "./contradictions";
import { toClaims } from "./types";
import type { Claim, PublicScenario, SecretScenario } from "./types";

export type CaseReport = { ok: boolean; errors: string[]; warnings: string[]; info: string[] };

export function validateCase(pub: PublicScenario, sec: SecretScenario): CaseReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  const suspectIds = new Set(pub.suspects.map((s) => s.id));
  const roomIds = new Set(pub.rooms.map((r) => r.id));
  const clueIds = new Set(sec.clues.map((c) => c.id));
  const places = new Set(Object.keys(pub.places));

  if (pub.clueCount !== sec.clues.length) errors.push(`public clueCount ${pub.clueCount} != ${sec.clues.length} clues`);
  if (pub.id !== sec.id) errors.push(`id mismatch: public ${pub.id} vs secret ${sec.id}`);
  if (!suspectIds.has(sec.culprit)) errors.push(`culprit "${sec.culprit}" is not a suspect`);
  for (const id of suspectIds) if (!sec.characters[id]) errors.push(`no secret character for suspect "${id}"`);
  for (const id of Object.keys(sec.characters)) if (!suspectIds.has(id)) errors.push(`secret character "${id}" not in public suspects`);

  const checkClaim = (c: Claim, where: string) => {
    if (!suspectIds.has(c.subject)) errors.push(`${where}: claim subject "${c.subject}" unknown`);
    if (!places.has(c.place)) errors.push(`${where}: claim place "${c.place}" missing from places`);
    if (!/^\d\d:\d\d$/.test(c.time)) errors.push(`${where}: bad time "${c.time}"`);
    if (c.pred !== "at" && c.pred !== "not_at") errors.push(`${where}: bad pred "${c.pred}"`);
  };

  // Clues
  for (const clue of sec.clues) {
    if (!roomIds.has(clue.room)) errors.push(`clue ${clue.id}: room "${clue.room}" unknown`);
    toClaims(clue.claim).forEach((c) => checkClaim(c, `clue ${clue.id}`));
    for (const p of clue.points_to) if (!suspectIds.has(p)) errors.push(`clue ${clue.id}: points_to "${p}" unknown`);
  }
  for (const room of roomIds) if (!sec.clues.some((c) => c.room === room)) warnings.push(`room "${room}" has no clue`);

  // Facts
  const factIds = new Set<string>();
  for (const [sid, ch] of Object.entries(sec.characters)) {
    if (!ch.deflection) errors.push(`${sid}: missing deflection`);
    if (sid === sec.culprit && ch.innocentSecretReveal) errors.push(`culprit ${sid} must not have innocentSecretReveal`);
    if (sid !== sec.culprit && !ch.innocentSecretReveal) errors.push(`${sid}: innocent suspect needs innocentSecretReveal`);
    if (!ch.facts.some((f) => f.policy === "tell")) warnings.push(`${sid}: has no tell facts`);
    for (const f of ch.facts) {
      const where = `${sid}.${f.id}`;
      if (factIds.has(f.id)) errors.push(`duplicate fact id ${f.id}`);
      factIds.add(f.id);
      if (!f.topics?.length) errors.push(`${where}: no topics`);
      if (f.policy === "tell" && !f.text) errors.push(`${where}: tell without text`);
      if (f.policy === "lie" && (!f.lie_text || !f.truth)) errors.push(`${where}: lie needs truth and lie_text`);
      if (f.policy === "conceal" && f.unlock_when && !f.unlocked_text) errors.push(`${where}: unlockable conceal needs unlocked_text`);
      const unlocks = Array.isArray(f.unlock_when) ? f.unlock_when : f.unlock_when ? [f.unlock_when] : [];
      for (const u of unlocks) {
        if (!u.startsWith("clue:") || !clueIds.has(u.slice(5))) errors.push(`${where}: unlock_when "${u}" does not resolve`);
      }
      [...toClaims(f.claim), ...toClaims(f.claim_v2), ...toClaims(f.unlocked_claim)].forEach((c) => checkClaim(c, where));
    }
  }

  // Solvability
  if (!sec.motive?.trim()) errors.push("culprit has no motive");
  if (!sec.timeline.some((t) => t.who === sec.culprit)) errors.push("culprit has no opportunity (no timeline event)");
  const pointing = sec.clues.filter((c) => c.points_to.includes(sec.culprit));
  if (pointing.length < 3) errors.push(`only ${pointing.length} clue(s) point to the culprit (need >= 3)`);
  else info.push(`${pointing.length} clues point to the culprit: ${pointing.map((c) => c.id).join(", ")}`);

  // Each version of the culprit's alibi lie must be breakable by a reachable claim.
  const culprit = sec.characters[sec.culprit];
  const evidence: { claim: Claim; from: string }[] = [
    ...sec.clues.flatMap((c) => toClaims(c.claim).map((claim) => ({ claim, from: `clue ${c.id}` }))),
    ...Object.entries(sec.characters)
      .filter(([sid]) => sid !== sec.culprit)
      .flatMap(([sid, ch]) =>
        ch.facts.flatMap((f) =>
          [...(f.policy === "tell" ? toClaims(f.claim) : []), ...toClaims(f.unlocked_claim)].map((claim) => ({
            claim,
            from: `${sid}.${f.id}`,
          })),
        ),
      ),
  ];
  let breakable = 0;
  for (const f of culprit?.facts.filter((x) => x.policy === "lie") ?? []) {
    for (const [ver, spec] of [
      ["v1", f.claim],
      ["v2", f.claim_v2 !== undefined ? f.claim_v2 : f.claim],
    ] as const) {
      const claims = toClaims(spec);
      if (!claims.length) continue;
      const breakers = evidence.filter((e) => claims.some((c) => claimsConflict(c, e.claim))).map((e) => e.from);
      if (breakers.length) {
        breakable++;
        info.push(`culprit lie ${f.id} (${ver}) is contradicted by: ${[...new Set(breakers)].join(", ")}`);
      } else warnings.push(`culprit lie ${f.id} (${ver}) cannot be contradicted by any claim`);
    }
  }
  if (breakable === 0) errors.push("no culprit lie can be contradicted: the case is not deducible");

  return { ok: errors.length === 0, errors, warnings, info };
}
