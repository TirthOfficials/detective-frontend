"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import type { GameState, PublicClue, PublicScenario } from "@/lib/types";
import Portrait from "./Portrait";
import ChatPanel from "./ChatPanel";
import Notebook from "./Notebook";
import SoundToggle from "./SoundToggle";

export default function Board({
  pub,
  state,
  selected,
  onSelect,
  clues,
  totalClues,
  busy,
  inspecting,
  notice,
  lastFound,
  onAsk,
  onInspect,
  onReady,
}: {
  pub: PublicScenario;
  state: GameState;
  selected: string;
  onSelect: (id: string) => void;
  clues: PublicClue[];
  totalClues: number;
  busy: boolean;
  inspecting: string | null;
  notice: string | null;
  lastFound: { room: string; clues: PublicClue[] } | null;
  onAsk: (q: string, clueId?: string) => void;
  onInspect: (roomId: string) => void;
  onReady: () => void;
}) {
  const totalLeft = Object.entries(state.questionsLeft)
    .filter(([id]) => !state.jailed.includes(id))
    .reduce((a, [, n]) => a + n, 0);
  const suspect = pub.suspects.find((s) => s.id === selected) ?? pub.suspects[0];

  return (
    <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4">
      <header className="panel mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-sm px-4 py-2">
        <Link href="/" className="font-display text-lg font-bold text-gold hover:underline">
          {pub.title}
        </Link>
        <span className="font-type text-sm text-cream-dim">
          Round <b className="text-cream">{state.round}</b>
        </span>
        <span className="font-type text-sm text-cream-dim">
          Questions left <b className="text-cream">{totalLeft}</b>
        </span>
        <span className="font-type text-sm text-cream-dim" title="Suspects get more careful after each wrong accusation">
          Guard <b className="text-blood-bright">{"●".repeat(state.guard)}{"○".repeat(3 - state.guard)}</b>
        </span>
        <div className="ml-auto flex gap-2">
          <SoundToggle />
          <button className="btn btn-blood" onClick={onReady}>
            I&apos;m ready ›
          </button>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <div className="panel space-y-4 rounded-sm p-3 lg:h-[calc(100vh-7.5rem)] lg:overflow-y-auto">
          <section>
            <h3 className="font-display mb-2 text-xs uppercase tracking-[0.25em] text-cream-dim">Suspects</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-1">
              {pub.suspects.map((s) => {
                const jailed = state.jailed.includes(s.id);
                const active = s.id === selected;
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className={`flex items-center gap-2 rounded-sm p-1.5 text-left transition ${active ? "bg-gold/10" : "hover:bg-cream/5"}`}
                  >
                    <Portrait suspect={s} stress={state.stress[s.id]} size={38} active={active} jailed={jailed} />
                    <div className="min-w-0">
                      <div className={`truncate text-sm ${active ? "text-gold" : "text-cream"}`}>{s.name}</div>
                      <div className="font-type text-[11px] text-cream-dim">
                        {jailed ? "jailed" : `${state.questionsLeft[s.id] ?? 0} Qs left`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="font-display mb-2 text-xs uppercase tracking-[0.25em] text-cream-dim">Rooms</h3>
            <div className="grid grid-cols-2 gap-2">
              {pub.rooms.map((r) => {
                const done = state.roomsInspected.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => onInspect(r.id)}
                    disabled={inspecting !== null}
                    title={r.description}
                    className={`rounded-sm border p-2 text-left text-xs transition ${
                      done ? "border-cream/10 text-cream-dim" : "border-gold/40 text-cream hover:border-gold hover:bg-gold/10"
                    }`}
                  >
                    <div className="font-display text-sm">{r.name}</div>
                    <div className="font-type text-[10px]">{inspecting === r.id ? "searching…" : done ? "✓ searched" : "inspect"}</div>
                  </button>
                );
              })}
            </div>
            {lastFound && (
              <motion.div
                key={lastFound.room}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="paper mt-3 rounded-sm p-2 text-paper-ink"
              >
                <div className="font-display text-xs font-bold uppercase tracking-widest">
                  Found in {pub.rooms.find((r) => r.id === lastFound.room)?.name}
                </div>
                {lastFound.clues.length === 0 && <div className="font-type text-xs">Nothing of interest.</div>}
                {lastFound.clues.map((c) => (
                  <div key={c.id} className="font-type mt-1 text-xs leading-snug">
                    <b>📎 {c.name}.</b> {c.text}
                  </div>
                ))}
              </motion.div>
            )}
          </section>
        </div>

        <ChatPanel pub={pub} state={state} suspect={suspect} clues={clues} busy={busy} notice={notice} onAsk={onAsk} />
        <Notebook pub={pub} state={state} clues={clues} totalClues={totalClues} />
      </div>
    </div>
  );
}
