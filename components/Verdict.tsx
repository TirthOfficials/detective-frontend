"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { speak, stopSpeaking } from "@/lib/narrator";
import { useSound } from "@/lib/client/useSound";
import { sfx } from "@/lib/client/sfx";
import type { GameState, PublicScenario, Reveal } from "@/lib/types";
import Portrait from "./Portrait";

export default function Verdict({
  pub,
  state,
  verdict,
  onReplay,
}: {
  pub: PublicScenario;
  state: GameState;
  verdict: Reveal & { won: boolean };
  onReplay: () => void;
}) {
  const [sound] = useSound();
  const culprit = pub.suspects.find((s) => s.id === verdict.culprit)!;

  useEffect(() => {
    void sfx.gavel(sound);
    const t = setTimeout(() => void speak(verdict.narration, { enabled: sound }), 900);
    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${pub.background})` }} />
      <div className="relative mx-auto max-w-3xl">
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center">
          <p className="font-type text-sm uppercase tracking-[0.3em] text-cream-dim">{pub.title} · Verdict</p>
          <h1 className="font-display mt-2 text-5xl font-black text-gold sm:text-6xl">
            {verdict.won ? "Case closed." : "Closed, the hard way."}
          </h1>
          <p className="mt-2 text-cream-dim">
            {verdict.won
              ? `You caught the killer in round ${state.round}${state.wrongAccusations ? ` after ${state.wrongAccusations} wrong arrest${state.wrongAccusations > 1 ? "s" : ""}` : ", first try"}.`
              : "Every innocent is behind bars. The last one standing is the killer."}
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="my-8 flex flex-col items-center gap-3"
        >
          <Portrait suspect={culprit} size={140} stress={5} />
          <div className="stamp px-3 py-1 text-lg">GUILTY · {culprit.name.toUpperCase()}</div>
        </motion.div>

        <div className="panel rounded-sm p-6">
          <p className="font-display text-lg leading-relaxed text-cream">{verdict.narration}</p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-type text-xs uppercase tracking-widest text-gold">Motive</dt>
              <dd className="text-cream-dim">{verdict.motive}</dd>
            </div>
            <div>
              <dt className="font-type text-xs uppercase tracking-widest text-gold">Method</dt>
              <dd className="text-cream-dim">{verdict.method}</dd>
            </div>
          </dl>
        </div>

        <div className="paper mt-6 rounded-sm p-6">
          <h2 className="font-display mb-3 text-xl font-bold">What really happened</h2>
          <ol className="font-type space-y-1 text-sm">
            {verdict.timeline.map((t, i) => (
              <li key={i}>
                <b>{t.time}</b>: {t.event}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <div>
            <div className="font-type text-xs uppercase tracking-widest text-cream-dim">Score</div>
            <div className="font-display text-6xl font-black text-gold">{verdict.score}</div>
            <div className="font-type text-xs text-cream-dim">
              100 − 20 × {state.wrongAccusations} wrong arrests − {Math.max(0, state.questionsUsed - 15)} extra questions ({state.questionsUsed} asked, 15 free)
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn" onClick={onReplay}>
              Play again
            </button>
            <Link className="btn btn-blood" href="/">
              Other cases
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
