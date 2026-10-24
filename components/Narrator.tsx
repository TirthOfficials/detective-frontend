"use client";
// Narrated sequence with always-on subtitles. Sound ON = speechSynthesis; OFF = timed subtitles.
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { listVoices, speak, stopSpeaking, type NarrationLine } from "@/lib/narrator";
import { useSound } from "@/lib/client/useSound";
import { storage } from "@/lib/client/storage";
import type { PublicSuspect } from "@/lib/types";
import Portrait from "./Portrait";

export function useNarration(lines: NarrationLine[], onDone: () => void) {
  const [sound] = useSound();
  const [idx, setIdx] = useState(-1);
  const [voice, setVoice] = useState<string | null>(() => (typeof window === "undefined" ? null : storage.get("mm:voice")));
  const run = useRef(0);

  const play = useCallback(
    async (from: number) => {
      const token = ++run.current;
      for (let i = from; i < lines.length; i++) {
        if (token !== run.current) return;
        setIdx(i);
        await speak(lines[i].text, { enabled: sound, voiceName: voice, rate: 0.9 });
        if (token !== run.current) return;
      }
      onDone();
    },
    [lines, sound, voice, onDone],
  );

  const stop = useCallback(() => {
    run.current++;
    stopSpeaking();
  }, []);

  useEffect(() => stop, [stop]);

  return {
    idx,
    start: () => play(0),
    next: () => {
      const n = idx + 1;
      stop();
      if (n >= lines.length) onDone();
      else void play(n);
    },
    skip: () => {
      stop();
      onDone();
    },
    voice,
    setVoice: (v: string) => {
      setVoice(v);
      storage.set("mm:voice", v);
    },
    sound,
  };
}

export default function Narrator({
  title,
  background,
  lines,
  suspects,
  onDone,
  startLabel = "Begin",
  autoStart = false,
}: {
  title: string;
  background: string;
  lines: NarrationLine[];
  suspects?: PublicSuspect[];
  onDone: () => void;
  startLabel?: string;
  autoStart?: boolean;
}) {
  const n = useNarration(lines, onDone);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const started = n.idx >= 0;
  const line = started ? lines[n.idx] : null;

  useEffect(() => {
    const load = () => setVoices(listVoices());
    load();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", load);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
    }
  }, []);

  useEffect(() => {
    if (autoStart) n.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <motion.div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${background})` }}
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.55 }}
        transition={{ duration: 6, ease: "easeOut" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/60 to-ink" />

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8">
        <h1 className="font-display text-center text-4xl font-black tracking-wide text-gold sm:text-6xl">{title}</h1>

        <div className="min-h-[9rem] w-full max-w-3xl text-center">
          <AnimatePresence mode="wait">
            {line ? (
              <motion.p
                key={n.idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="font-display text-lg leading-relaxed text-cream sm:text-2xl"
              >
                “{line.text}”
              </motion.p>
            ) : (
              <motion.p key="pre" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-type text-cream-dim">
                {n.sound ? "Narration is on. Turn your volume up." : "Sound is off. The story will play as subtitles."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {suspects && (
          <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
            {suspects.map((s) => {
              const on = line?.speakerId === s.id;
              return (
                <motion.div key={s.id} className="flex flex-col items-center gap-2" animate={{ scale: on ? 1.12 : 1, opacity: line?.speakerId && !on ? 0.45 : 1 }}>
                  <Portrait suspect={s} size={72} highlight={on} />
                  <span className={`font-type text-xs ${on ? "text-gold" : "text-cream-dim"}`}>{s.short}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {!started ? (
            <button className="btn btn-blood px-6 py-2 text-lg" onClick={n.start}>
              {startLabel}
            </button>
          ) : (
            <button className="btn" onClick={n.next}>
              Next ›
            </button>
          )}
          <button className="btn" onClick={n.skip}>
            Skip ››
          </button>
          {n.sound && voices.length > 0 && (
            <select
              className="rounded-sm border border-gold/30 bg-ink-2 px-2 py-1.5 text-xs text-cream"
              value={n.voice ?? ""}
              onChange={(e) => n.setVoice(e.target.value)}
              aria-label="Narrator voice"
            >
              <option value="">Default voice</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
