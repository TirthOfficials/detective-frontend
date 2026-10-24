"use client";
import { useSound } from "@/lib/client/useSound";
import { stopSpeaking } from "@/lib/narrator";
import { setAmbient } from "@/lib/client/sfx";

export default function SoundToggle() {
  const [on, setOn] = useSound();
  return (
    <button
      className="btn text-xs"
      aria-pressed={on}
      onClick={() => {
        if (on) {
          stopSpeaking();
          setAmbient(false);
        }
        setOn(!on);
      }}
      title="Narration and sound effects"
    >
      {on ? "🔊 Sound: ON" : "🔇 Sound: OFF"}
    </button>
  );
}
