// Symbolic contradiction detection over {subject, pred, place, time} claims.
import type { Claim, Contradiction, NotebookClaim } from "./types";

export function claimsConflict(a: Claim, b: Claim): boolean {
  if (a.subject !== b.subject || a.time !== b.time) return false;
  if (a.pred === "at" && b.pred === "at") return a.place !== b.place;
  if (a.pred !== b.pred) return a.place === b.place; // at(X,P) vs not_at(X,P)
  return false;
}

function explain(a: NotebookClaim, b: NotebookClaim): string {
  return `"${a.label}" conflicts with "${b.label}".`;
}

/** Claims from one fact/clue at several times share a base id (fact:enzo:E2:0, fact:enzo:E2:1). */
const baseId = (id: string) => id.replace(/:\d+$/, "");

/** One contradiction per pair of statements/clues, however many time points they share. */
export function contradictionId(a: NotebookClaim, b: NotebookClaim): string {
  return [baseId(a.id), baseId(b.id)].sort().join("|");
}

/**
 * Checks each new claim against the existing notebook (and against the other new
 * claims) and returns only contradictions not already recorded.
 */
export function findContradictions(
  existing: NotebookClaim[],
  incoming: NotebookClaim[],
  known: Contradiction[] = [],
): Contradiction[] {
  const seen = new Set(known.map((c) => c.id));
  const out: Contradiction[] = [];
  const pool = [...existing];
  for (const n of incoming) {
    for (const e of pool) {
      if (baseId(e.id) === baseId(n.id) || !claimsConflict(e, n)) continue;
      const id = contradictionId(e, n);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, a: e, b: n, explanation: explain(e, n) });
    }
    pool.push(n);
  }
  return out;
}

/** Merges claims by id (no duplicates). */
export function mergeClaims(existing: NotebookClaim[], incoming: NotebookClaim[]): NotebookClaim[] {
  const ids = new Set(existing.map((c) => c.id));
  return [...existing, ...incoming.filter((c) => !ids.has(c.id))];
}
