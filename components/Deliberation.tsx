"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { GameState, PublicClue, PublicScenario, PublicSuspect } from "@/lib/types";
import Portrait from "./Portrait";

export default function Deliberation({
  pub,
  state,
  clues,
  busy,
  onBack,
  onAccuse,
}: {
  pub: PublicScenario;
  state: GameState;
  clues: PublicClue[];
  busy: boolean;
  onBack: () => void;
  onAccuse: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState<PublicSuspect | null>(null);
  const first = (id: string) => pub.suspects.find((s) => s.id === id)?.short ?? id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-type text-sm text-cream-dim">Round {state.round} · {pub.title}</p>
          <h1 className="font-display text-4xl font-black text-gold">The detective thinks…</h1>
        </div>
        <button className="btn" onClick={onBack}>
          ‹ Back to the investigation
        </button>
      </div>

      {state.contradictions.length > 0 && (
        <div className="paper mb-6 rounded-sm p-4">
          <h2 className="font-display mb-2 text-lg font-bold text-blood">Contradictions</h2>
          <ul className="font-type space-y-1 text-sm">
            {state.contradictions.map((c) => (
              <li key={c.id}>
                ⚠ {c.a.label} <span className="opacity-60">vs.</span> {c.b.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pub.suspects.map((s) => {
          const jailed = state.jailed.includes(s.id);
          const claims = state.claims.filter((c) => c.subject === s.id || c.source === `suspect:${s.id}`);
          const contra = state.contradictions.filter((c) => c.a.subject === s.id || c.b.subject === s.id);
          const quotes = (state.history[s.id] ?? []).filter((t) => t.role === "suspect").slice(-3);
          const stress = state.stress[s.id] ?? 0;
          return (
            <motion.div
              key={s.id}
              layout
              className={`panel flex flex-col gap-3 rounded-sm p-4 ${contra.length ? "border-blood-bright/60" : ""}`}
              animate={{ opacity: jailed ? 0.5 : 1 }}
            >
              <div className="flex gap-3">
                <Portrait suspect={s} stress={stress} size={64} jailed={jailed} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl text-gold">{s.name}</h3>
                  <p className="text-xs text-cream-dim">{s.role}</p>
                  <div className="mt-2 flex items-center gap-2" title="Pressure (stress)">
                    <span className="font-type text-[10px] uppercase tracking-widest text-cream-dim">Pressure</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={`h-2 w-4 rounded-sm ${i <= stress ? "bg-blood-bright" : "bg-cream/10"}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="font-type space-y-1 text-xs text-cream-dim">
                {claims.length === 0 && quotes.length === 0 && <p className="italic">You haven&apos;t learned much about {first(s.id)} yet.</p>}
                {claims.map((c) => (
                  <p key={c.id}>· {c.label}</p>
                ))}
                {quotes.map((q, i) => (
                  <p key={i} className="italic text-cream/70">
                    “{q.text}”
                  </p>
                ))}
                {contra.map((c) => (
                  <p key={c.id} className="text-blood-bright">
                    ⚠ {c.a.label} vs. {c.b.label}
                  </p>
                ))}
              </div>

              <button className="btn btn-blood mt-auto" disabled={jailed || busy} onClick={() => setConfirm(s)}>
                {jailed ? "Already jailed" : `Accuse ${first(s.id)}`}
              </button>
            </motion.div>
          );
        })}
      </div>

      {clues.length > 0 && (
        <div className="paper mt-6 rounded-sm p-4">
          <h2 className="font-display mb-2 text-lg font-bold">Evidence</h2>
          <ul className="font-type grid gap-2 text-sm sm:grid-cols-2">
            {clues.map((c) => (
              <li key={c.id}>
                <b>📎 {c.name}.</b> {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AnimatePresence>
        {confirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirm(null)}
          >
            <motion.div
              role="dialog"
              aria-modal
              className="panel w-full max-w-md rounded-sm p-6 text-center"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex justify-center">
                <Portrait suspect={confirm} stress={state.stress[confirm.id]} size={96} />
              </div>
              <h2 className="font-display text-2xl text-gold">Accuse {confirm.name}?</h2>
              <p className="mt-2 text-sm text-cream-dim">A wrong accusation jails an innocent person, and everyone else gets more careful.</p>
              <div className="mt-6 flex justify-center gap-3">
                <button className="btn" onClick={() => setConfirm(null)}>
                  Not yet
                </button>
                <button
                  className="btn btn-blood"
                  disabled={busy}
                  onClick={() => {
                    onAccuse(confirm.id);
                    setConfirm(null);
                  }}
                >
                  Make the arrest
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
