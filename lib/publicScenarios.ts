// Browser-safe scenario data. Safe to import from client components.
import don from "@/data/public/don.json";
import velvet from "@/data/public/velvet.json";
import pier from "@/data/public/pier.json";
import type { PublicScenario, ScenarioSummary } from "./types";

export const PUBLIC_SCENARIOS: Record<string, PublicScenario> = {
  don: don as PublicScenario,
  velvet: velvet as PublicScenario,
  pier: pier as PublicScenario,
};

export const SCENARIO_ORDER = ["don", "velvet", "pier"];

export function getPublicScenario(id: string): PublicScenario | null {
  return PUBLIC_SCENARIOS[id] ?? null;
}

export function scenarioSummaries(): ScenarioSummary[] {
  return SCENARIO_ORDER.map((id) => {
    const s = PUBLIC_SCENARIOS[id];
    return { id: s.id, title: s.title, year: s.year, setting: s.setting, blurb: s.blurb, background: s.background };
  });
}
