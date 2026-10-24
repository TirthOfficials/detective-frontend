"use client";
// Narrator: a queue over the browser's speechSynthesis (Web Speech API). Zero API cost.

export type NarrationLine = { text: string; speakerId?: string };

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => v.lang.startsWith("en"));
  const preferred = ["Daniel", "Google UK English Male", "Arthur", "Alex", "Fred", "Microsoft George", "Microsoft Guy"];
  for (const name of preferred) {
    const v = en.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return en.find((v) => v.lang === "en-GB") ?? en[0] ?? null;
}

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function listVoices(): SpeechSynthesisVoice[] {
  return speechAvailable() ? window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")) : [];
}

/** Speaks one line. Resolves when finished (or immediately when sound is off). */
export function speak(text: string, opts: { enabled: boolean; voiceName?: string | null; rate?: number }): Promise<void> {
  return new Promise((resolve) => {
    if (!opts.enabled || !speechAvailable()) {
      // Subtitles-only pacing: ~55ms per character, min 2.5s.
      const t = setTimeout(resolve, Math.max(2500, text.length * 55));
      currentTimer = t;
      currentResolve = resolve;
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    u.voice = (opts.voiceName && voices.find((v) => v.name === opts.voiceName)) || pickVoice();
    u.rate = opts.rate ?? 0.9;
    u.pitch = 0.85;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    currentResolve = resolve;
    window.speechSynthesis.speak(u);
  });
}

let currentTimer: ReturnType<typeof setTimeout> | null = null;
let currentResolve: (() => void) | null = null;

export function stopSpeaking() {
  if (speechAvailable()) window.speechSynthesis.cancel();
  if (currentTimer) clearTimeout(currentTimer);
  currentTimer = null;
  const r = currentResolve;
  currentResolve = null;
  r?.();
}
