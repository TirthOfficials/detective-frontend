"use client";
// Tiny synthesized sound effects (Web Audio), so no audio files are required.
// If /public/audio/*.mp3 files exist they are preferred.

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.15, when = 0) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + when;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

async function tryFile(name: string, volume: number): Promise<boolean> {
  try {
    const a = new Audio(`/audio/${name}.mp3`);
    a.volume = volume;
    await a.play();
    return true;
  } catch {
    return false;
  }
}

export const sfx = {
  async sting(enabled: boolean) {
    if (!enabled || (await tryFile("sting", 0.5))) return;
    tone(196, 0.6, "sawtooth", 0.08);
    tone(185, 0.6, "sawtooth", 0.08, 0.02);
    tone(98, 0.9, "triangle", 0.15);
  },
  async gavel(enabled: boolean) {
    if (!enabled || (await tryFile("gavel", 0.6))) return;
    tone(120, 0.15, "square", 0.2);
    tone(110, 0.15, "square", 0.2, 0.35);
  },
  async clue(enabled: boolean) {
    if (!enabled) return;
    tone(523, 0.15, "sine", 0.06);
    tone(784, 0.25, "sine", 0.06, 0.1);
  },
};

let ambient: HTMLAudioElement | null = null;
export function setAmbient(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) {
    ambient ??= Object.assign(new Audio("/audio/ambient-jazz.mp3"), { loop: true, volume: 0.2 });
    ambient.play().catch(() => {}); // file is optional
  } else ambient?.pause();
}
