"use client";
import { motion } from "framer-motion";
import { stressLevel } from "@/lib/rules";
import type { PublicSuspect } from "@/lib/types";

const FILTERS = {
  calm: "grayscale(0.15) contrast(1)",
  tense: "grayscale(0.05) contrast(1.15) sepia(0.25)",
  agitated: "contrast(1.3) saturate(1.6) sepia(0.3) hue-rotate(-20deg)",
};

export default function Portrait({
  suspect,
  stress = 0,
  size = 96,
  active = false,
  jailed = false,
  highlight = false,
}: {
  suspect: PublicSuspect;
  stress?: number;
  size?: number;
  active?: boolean;
  jailed?: boolean;
  highlight?: boolean;
}) {
  const level = stressLevel(stress);
  const glow = highlight
    ? `0 0 0 2px var(--gold), 0 0 28px rgba(201,162,39,0.7)`
    : stress > 0
      ? `0 0 0 2px rgba(179,32,44,${0.3 + stress * 0.12}), 0 0 ${6 + stress * 6}px rgba(179,32,44,${0.25 + stress * 0.1})`
      : active
        ? `0 0 0 2px var(--gold)`
        : `0 0 0 1px rgba(201,162,39,0.25)`;
  return (
    <motion.div
      className="relative shrink-0 overflow-hidden rounded-sm bg-ink-3"
      style={{ width: size, height: size * 1.2, boxShadow: glow }}
      animate={
        jailed
          ? { opacity: 0.35 }
          : level === "agitated"
            ? { y: [0, -1.5, 0], x: [0, -1, 1, 0] }
            : { y: [0, -2.5, 0] }
      }
      transition={{ duration: level === "agitated" ? 0.6 : 3.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={suspect.portrait}
        alt={suspect.name}
        className="h-full w-full object-cover transition-[filter] duration-700"
        style={{ filter: jailed ? "grayscale(1)" : FILTERS[level] }}
        draggable={false}
      />
      {jailed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(90deg, transparent 0 14%, rgba(0,0,0,0.85) 14% 18%)" }} />
          <span className="stamp relative bg-ink/70 px-1 text-[10px]">JAILED</span>
        </div>
      )}
    </motion.div>
  );
}
