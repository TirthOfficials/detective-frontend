"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState, PublicClue, PublicScenario, PublicSuspect } from "@/lib/types";
import Portrait from "./Portrait";

function chipsFor(s: PublicSuspect, pub: PublicScenario): string[] {
  const others = pub.suspects.filter((x) => x.id !== s.id);
  const other = others[(pub.suspects.indexOf(s) + 1) % others.length];
  return [
    `Where were you ${pub.alibiWindow}?`,
    "How did you know the victim?",
    "Did you see anyone near the scene?",
    "Who do you think wanted him dead?",
    "Did you notice anything strange tonight?",
    `Tell me about your relationship with ${other.name}.`,
  ];
}

export default function ChatPanel({
  pub,
  state,
  suspect,
  clues,
  busy,
  notice,
  onAsk,
}: {
  pub: PublicScenario;
  state: GameState;
  suspect: PublicSuspect;
  clues: PublicClue[];
  busy: boolean;
  notice: string | null;
  onAsk: (question: string, clueId?: string) => void;
}) {
  const [text, setText] = useState("");
  const [clueId, setClueId] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const history = state.history[suspect.id] ?? [];
  const left = state.questionsLeft[suspect.id] ?? 0;
  const jailed = state.jailed.includes(suspect.id);
  const chips = useMemo(() => chipsFor(suspect, pub), [suspect, pub]);
  const disabled = busy || left <= 0 || jailed;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [history.length, busy]);

  const submit = () => {
    const clue = clues.find((c) => c.id === clueId);
    const q = text.trim() || (clue ? `What can you tell me about this? (${clue.name})` : "");
    if (!q || disabled) return;
    onAsk(q, clueId || undefined);
    setText("");
    setClueId("");
  };

  return (
    <section className="panel flex min-h-[28rem] flex-col rounded-sm lg:h-[calc(100vh-7.5rem)]">
      <header className="flex items-center gap-3 border-b border-gold/15 p-3">
        <Portrait suspect={suspect} stress={state.stress[suspect.id]} size={48} jailed={jailed} active />
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-xl text-gold">{suspect.name}</h2>
          <p className="truncate text-xs text-cream-dim">{suspect.role}</p>
        </div>
        <div className="text-right">
          <div className="font-type text-2xl text-cream">{left}</div>
          <div className="text-[10px] uppercase tracking-widest text-cream-dim">questions left</div>
        </div>
      </header>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
        {history.length === 0 && (
          <p className="font-type text-sm italic text-cream-dim">{suspect.story}</p>
        )}
        <AnimatePresence initial={false}>
          {history.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={t.role === "detective" ? "ml-8 text-right" : "mr-8"}
            >
              <div
                className={`inline-block max-w-full rounded-sm px-3 py-2 text-sm leading-relaxed ${
                  t.role === "detective" ? "bg-gold/10 text-cream" : "border-l-2 border-blood-bright bg-ink-3 text-cream"
                }`}
              >
                {t.role === "detective" ? (
                  <>
                    <span className="font-type mr-1 text-[10px] uppercase tracking-widest text-gold/70">Det.</span>
                    {t.text}
                    {t.clueId && (
                      <div className="font-type mt-1 text-[11px] text-gold/80">📎 shows: {clues.find((c) => c.id === t.clueId)?.name}</div>
                    )}
                  </>
                ) : (
                  <span className="font-display italic">“{t.text}”</span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="mr-8 inline-flex gap-1 rounded-sm bg-ink-3 px-3 py-3" aria-label={`${suspect.name} is thinking`}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-cream-dim"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        )}
        {notice && <p className="font-type rounded-sm border border-gold/30 bg-gold/5 p-2 text-xs text-gold">{notice}</p>}
      </div>

      <div className="space-y-2 border-t border-gold/15 p-3">
        {jailed ? (
          <p className="font-type text-sm text-cream-dim">{suspect.name} is in a cell downtown. No more questions.</p>
        ) : left <= 0 ? (
          <p className="font-type text-sm text-cream-dim">You&apos;ve used all your questions for {suspect.short} this round.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => setText(c)}
                className="rounded-full border border-cream/15 px-2.5 py-1 text-[11px] text-cream-dim transition hover:border-gold/60 hover:text-cream"
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={clueId}
            onChange={(e) => setClueId(e.target.value)}
            disabled={disabled || clues.length === 0}
            className="rounded-sm border border-gold/30 bg-ink-2 px-2 py-2 text-xs text-cream disabled:opacity-40 sm:w-44"
            aria-label="Present a clue"
          >
            <option value="">{clues.length ? "📎 Present clue…" : "No clues found yet"}</option>
            {clues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              disabled={disabled}
              placeholder={disabled ? "" : `Ask ${suspect.short} something…`}
              className="min-w-0 flex-1 rounded-sm border border-gold/30 bg-ink-2 px-3 py-2 text-sm text-cream placeholder:text-cream-dim/50 focus:border-gold focus:outline-none disabled:opacity-40"
            />
            <button className="btn btn-blood" disabled={disabled || (!text.trim() && !clueId)}>
              Ask
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
