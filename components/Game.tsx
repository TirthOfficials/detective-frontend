"use client";
// Game controller: holds the public GameState (persisted to localStorage) and drives the phases
// intro → board ⇄ deliberation → (jail reveal → next round)* → verdict.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client/api";
import { clearGame, loadGame, saveGame } from "@/lib/client/storage";
import { useSound } from "@/lib/client/useSound";
import { sfx } from "@/lib/client/sfx";
import { mergeClaims } from "@/lib/contradictions";
import { advanceRound, initialState, MAX_STRESS } from "@/lib/rules";
import { getPublicScenario } from "@/lib/publicScenarios";
import type { NarrationLine } from "@/lib/narrator";
import type { GameState, PublicClue } from "@/lib/types";
import Narrator from "./Narrator";
import Board from "./Board";
import Deliberation from "./Deliberation";
import Verdict from "./Verdict";
import PasscodeGate from "./PasscodeGate";

export default function Game({ scenarioId }: { scenarioId: string }) {
  const pub = useMemo(() => getPublicScenario(scenarioId), [scenarioId]);
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastFound, setLastFound] = useState<{ room: string; clues: PublicClue[] } | null>(null);
  const [needPass, setNeedPass] = useState(false);
  const [sound] = useSound();

  useEffect(() => {
    if (!pub) return;
    const saved = loadGame(pub.id);
    const s = saved && saved.scenarioId === pub.id && saved.clueCards ? saved : initialState(pub);
    // Hydrate from localStorage after mount (server render has no access to it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(s);
    setSelected(pub.suspects.find((x) => !s.jailed.includes(x.id))?.id ?? pub.suspects[0].id);
  }, [pub]);

  const phase = state?.phase;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  const update = useCallback((fn: (s: GameState) => GameState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      saveGame(next);
      return next;
    });
  }, []);

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) setNeedPass(true);
    else setNotice(`Something went wrong (${e instanceof Error ? e.message : "error"}). Try again.`);
  }, []);

  const introLines: NarrationLine[] = useMemo(
    () =>
      pub
        ? [
            ...pub.narration.intro.map((text) => ({ text })),
            ...pub.suspects.map((s) => ({ text: s.story, speakerId: s.id })),
            { text: pub.narration.detectiveEnters },
          ]
        : [],
    [pub],
  );

  const ask = useCallback(
    async (question: string, clueId?: string) => {
      if (!state || !pub) return;
      const sid = state.jailed.includes(selected)
        ? (pub.suspects.find((x) => !state.jailed.includes(x.id))?.id ?? selected)
        : selected;
      const snapshot = state;
      setBusy(true);
      setNotice(null);
      update((s) => ({
        ...s,
        history: { ...s.history, [sid]: [...(s.history[sid] ?? []), { role: "detective", text: question, clueId }] },
      }));
      try {
        const r = await api.ask(pub.id, sid, question, { ...snapshot, clueCards: [] }, clueId);
        const counted = r.mode !== "budget";
        update((s) => ({
          ...s,
          history: { ...s.history, [sid]: [...(s.history[sid] ?? []), { role: "suspect", text: r.reply }] },
          stress: { ...s.stress, [sid]: Math.min(MAX_STRESS, r.stress) },
          told: { ...s.told, [sid]: [...new Set([...(s.told[sid] ?? []), ...r.factsToldIds])] },
          presented: clueId ? { ...s.presented, [sid]: [...new Set([...(s.presented[sid] ?? []), clueId])] } : s.presented,
          claims: mergeClaims(s.claims, r.newClaims),
          contradictions: [...s.contradictions, ...r.newContradictions],
          questionsLeft: counted ? { ...s.questionsLeft, [sid]: Math.max(0, (s.questionsLeft[sid] ?? 0) - 1) } : s.questionsLeft,
          questionsUsed: counted ? s.questionsUsed + 1 : s.questionsUsed,
          askedThisRound: counted ? [...s.askedThisRound, question] : s.askedThisRound,
        }));
        if (r.notice) setNotice(r.notice);
        else if (r.unlockedNow) setNotice("That got to them. Something new just came out.");
        if (r.newContradictions.length) void sfx.sting(sound);
      } catch (e) {
        update((s) => ({ ...s, history: { ...s.history, [sid]: snapshot.history[sid] ?? [] } }));
        handleError(e);
      } finally {
        setBusy(false);
      }
    },
    [state, pub, selected, update, sound, handleError],
  );

  const inspect = useCallback(
    async (roomId: string) => {
      if (!state || !pub) return;
      setInspecting(roomId);
      try {
        const r = await api.inspect(pub.id, roomId, { ...state, clueCards: [] });
        setLastFound({ room: roomId, clues: r.clues });
        const isNew = r.clues.some((c) => !state.cluesFound.includes(c.id));
        update((s) => ({
          ...s,
          roomsInspected: [...new Set([...s.roomsInspected, roomId])],
          cluesFound: [...new Set([...s.cluesFound, ...r.clues.map((c) => c.id)])],
          clueCards: [...s.clueCards, ...r.clues.filter((c) => !s.clueCards.some((x) => x.id === c.id))],
          claims: mergeClaims(s.claims, r.newClaims),
          contradictions: [...s.contradictions, ...r.newContradictions],
        }));
        if (r.newContradictions.length) void sfx.sting(sound);
        else if (isNew) void sfx.clue(sound);
      } catch (e) {
        handleError(e);
      } finally {
        setInspecting(null);
      }
    },
    [state, pub, update, sound, handleError],
  );

  const accuse = useCallback(
    async (suspectId: string) => {
      if (!state || !pub) return;
      setBusy(true);
      try {
        const r = await api.accuse(pub.id, suspectId, { ...state, clueCards: [] });
        if (r.correct) {
          update((s) => ({ ...s, phase: "verdict", solved: true, verdict: { ...r.reveal, won: true } }));
        } else {
          update((s) => ({
            ...s,
            phase: "reveal",
            jailReveal: { suspectId: r.jailedId, text: r.jailedReveal, final: !r.nextRound },
            verdict: r.reveal ? { ...r.reveal, won: false } : null,
          }));
        }
      } catch (e) {
        handleError(e);
      } finally {
        setBusy(false);
      }
    },
    [state, pub, update, handleError],
  );

  if (!pub) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="font-display text-2xl">No such case file.</p>
        <Link className="btn" href="/">Back</Link>
      </div>
    );
  }
  if (!state) return null;
  if (needPass) return <PasscodeGate onOk={() => setNeedPass(false)} />;

  if (state.phase === "intro") {
    return (
      <Narrator
        title={pub.title}
        background={pub.background}
        lines={introLines}
        suspects={pub.suspects}
        onDone={() => update((s) => ({ ...s, phase: "board" }))}
      />
    );
  }

  if (state.phase === "reveal" && state.jailReveal) {
    const j = state.jailReveal;
    const jailedSuspect = pub.suspects.find((s) => s.id === j.suspectId)!;
    const lines: NarrationLine[] = [
      { text: `${jailedSuspect.name} is led away in handcuffs.`, speakerId: j.suspectId },
      { text: j.text, speakerId: j.suspectId },
      j.final
        ? { text: "Only one suspect is left standing. And that one is the killer." }
        : { text: `Round ${state.round + 1} begins. The others saw what you did. They're being more careful now.` },
    ];
    return (
      <Narrator
        key={`jail-${j.suspectId}`}
        title="Wrong arrest."
        background={pub.background}
        lines={lines}
        suspects={pub.suspects.filter((s) => !state.jailed.includes(s.id))}
        startLabel="Hear what happened"
        onDone={() =>
          update((s) => {
            const next = advanceRound(s, j.suspectId);
            if (j.final && s.verdict) return { ...next, round: s.round, phase: "verdict", jailReveal: null };
            return { ...next, jailReveal: null };
          })
        }
      />
    );
  }

  if (state.phase === "verdict" && state.verdict) {
    return (
      <Verdict
        pub={pub}
        state={state}
        verdict={state.verdict}
        onReplay={() => {
          clearGame(pub.id);
          const s = initialState(pub);
          saveGame(s);
          setState(s);
          setLastFound(null);
          setSelected(pub.suspects[0].id);
        }}
      />
    );
  }

  if (state.phase === "deliberation") {
    return (
      <Deliberation
        pub={pub}
        state={state}
        clues={state.clueCards}
        busy={busy}
        onBack={() => update((s) => ({ ...s, phase: "board" }))}
        onAccuse={accuse}
      />
    );
  }

  return (
    <Board
      pub={pub}
      state={state}
      selected={state.jailed.includes(selected) ? pub.suspects.find((x) => !state.jailed.includes(x.id))!.id : selected}
      onSelect={(id) => {
        setSelected(id);
        setNotice(null);
      }}
      clues={state.clueCards}
      totalClues={pub.clueCount}
      busy={busy}
      inspecting={inspecting}
      notice={notice}
      lastFound={lastFound}
      onAsk={ask}
      onInspect={inspect}
      onReady={() => update((s) => ({ ...s, phase: "deliberation" }))}
    />
  );
}
