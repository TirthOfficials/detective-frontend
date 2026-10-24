"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { scenarioSummaries } from "@/lib/publicScenarios";
import { loadGame, storage } from "@/lib/client/storage";
import SoundToggle from "@/components/SoundToggle";
import PasscodeGate from "@/components/PasscodeGate";
import type { GameState } from "@/lib/types";

export default function Home() {
  const cases = scenarioSummaries();
  const [saved, setSaved] = useState<Record<string, GameState | null>>({});
  const [gate, setGate] = useState<"checking" | "need" | "ok">("checking");
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    // Read saved games after mount (localStorage is unavailable during server render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(Object.fromEntries(cases.map((c) => [c.id, loadGame(c.id)])));
    fetch("/api/status", { headers: { "x-passcode": storage.get("mm:passcode") ?? "" } })
      .then(async (r) => {
        if (r.status === 401) return setGate("need");
        setGate("ok");
        const j = await r.json().catch(() => null);
        if (j?.mock) setMode("Demo mode: suspects use scripted answers (no AI calls).");
      })
      .catch(() => setGate("ok"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gate === "need") return <PasscodeGate onOk={() => setGate("ok")} />;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-type text-xs uppercase tracking-[0.35em] text-cream-dim">A neurosymbolic noir mystery</p>
          <h1 className="font-display text-5xl font-black tracking-wide text-gold sm:text-7xl">The Case Files</h1>
          <p className="mt-2 max-w-xl text-cream-dim">
            You are the detective. The suspects are AI, but a rules engine decides what each one knows, hides, and lies
            about. Find the contradictions. Make the arrest.
          </p>
        </div>
        <SoundToggle />
      </div>

      {mode && <p className="font-type mb-6 rounded-sm border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">{mode}</p>}

      <div className="grid gap-6 md:grid-cols-3">
        {cases.map((c, i) => {
          const s = saved[c.id];
          const inProgress = s && s.phase !== "verdict" && (s.phase !== "intro" || s.questionsUsed > 0);
          return (
            <motion.article
              key={c.id}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.12 }}
              whileHover={{ y: -6 }}
              className="panel group flex flex-col overflow-hidden rounded-sm"
            >
              <div className="relative h-44 overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105"
                  style={{ backgroundImage: `url(${c.background})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-2 to-transparent" />
                <span className="font-type absolute left-3 top-3 bg-ink/70 px-2 py-0.5 text-xs text-gold">Case No. {i + 1} · {c.year}</span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <h2 className="font-display text-2xl font-bold text-cream">{c.title}</h2>
                <p className="font-type text-xs text-cream-dim">{c.setting}</p>
                <p className="text-sm text-cream/80">{c.blurb}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {inProgress ? (
                    <>
                      <Link className="btn btn-blood" href={`/play/${c.id}`}>
                        Continue (round {s!.round})
                      </Link>
                      <button
                        className="btn"
                        onClick={() => {
                          storage.remove(`mm:${c.id}`);
                          setSaved((x) => ({ ...x, [c.id]: null }));
                        }}
                      >
                        Restart
                      </button>
                    </>
                  ) : (
                    <Link
                      className="btn btn-blood"
                      href={`/play/${c.id}`}
                      onClick={() => {
                        if (s?.phase === "verdict") storage.remove(`mm:${c.id}`);
                      }}
                    >
                      {s?.phase === "verdict" ? `Solved (score ${s.verdict?.score ?? "?"}) · Play again` : "Open the case"}
                    </Link>
                  )}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      <footer className="font-type mt-12 text-center text-xs text-cream-dim/70">
        CMSC 612 · Neurosymbolic Text Generation · Suspects voiced by Claude Haiku, constrained by a symbolic game engine.
      </footer>
    </main>
  );
}
