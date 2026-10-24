"use client";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef } from "react";
import type { GameState, PublicClue, PublicScenario } from "@/lib/types";

export default function Notebook({
  pub,
  state,
  clues,
  totalClues,
}: {
  pub: PublicScenario;
  state: GameState;
  clues: PublicClue[];
  totalClues: number;
}) {
  const controls = useAnimationControls();
  const prev = useRef(state.contradictions.length);

  useEffect(() => {
    if (state.contradictions.length > prev.current) {
      controls.start({
        x: [0, -10, 10, -8, 8, -4, 4, 0],
        boxShadow: ["0 0 0 0 rgba(179,32,44,0)", "0 0 0 4px rgba(179,32,44,0.9)", "0 0 0 0 rgba(179,32,44,0)"],
        transition: { duration: 0.7 },
      });
    }
    prev.current = state.contradictions.length;
  }, [state.contradictions.length, controls]);

  const nameOf = (source: string) => {
    const id = source.split(":")[1];
    return pub.suspects.find((s) => s.id === id)?.short ?? id;
  };
  const statements = state.claims.filter((c) => c.source.startsWith("suspect:"));

  return (
    <motion.aside animate={controls} className="paper flex flex-col overflow-hidden rounded-sm lg:h-[calc(100vh-7.5rem)]">
      <div className="border-b border-paper-ink/20 px-4 py-2">
        <h2 className="font-display text-lg font-bold tracking-wide">Case Notebook</h2>
        <p className="font-type text-[11px] opacity-70">Saved automatically</p>
      </div>
      <div className="font-type flex-1 space-y-4 overflow-y-auto px-4 py-3 text-[13px] leading-[28px]">
        <section>
          <h3 className="font-display text-sm font-bold uppercase tracking-widest">
            Clues ({clues.length}/{totalClues})
          </h3>
          {clues.length === 0 && <p className="opacity-60">Inspect the rooms to find evidence.</p>}
          <AnimatePresence initial={false}>
            {clues.map((c) => (
              <motion.div key={c.id} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="leading-snug">
                <div className="mt-2 font-bold">📎 {c.name}</div>
                <div className="text-[12px] opacity-80">{c.text}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>

        <section>
          <h3 className="font-display text-sm font-bold uppercase tracking-widest">Statements</h3>
          {statements.length === 0 && <p className="opacity-60">Where everyone says they were.</p>}
          {statements.map((c) => (
            <div key={c.id} className="leading-snug">
              <span className="font-bold">{nameOf(c.source)}:</span> {c.label.replace(/^\w+ says /, "")}
            </div>
          ))}
        </section>

        <section>
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-blood">
            Contradictions ({state.contradictions.length})
          </h3>
          {state.contradictions.length === 0 && <p className="opacity-60">None yet. Compare statements against clues.</p>}
          <AnimatePresence initial={false}>
            {state.contradictions.map((c) => (
              <motion.div
                key={c.id}
                initial={{ scale: 1.15, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="my-2 rounded-sm border-l-4 border-blood bg-blood/10 px-2 py-1 leading-snug text-blood"
              >
                <div className="font-bold">⚠ {c.a.label}</div>
                <div className="text-[12px]">vs. {c.b.label}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      </div>
    </motion.aside>
  );
}
