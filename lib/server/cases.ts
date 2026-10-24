// SERVER ONLY. Loads the secret case files. Import this only from app/api/* route handlers
// (and scripts/tests). Never import it from a client component.
import don from "@/data/secret/don.json";
import velvet from "@/data/secret/velvet.json";
import pier from "@/data/secret/pier.json";
import { getPublicScenario } from "../publicScenarios";
import type { PublicScenario, SecretScenario } from "../types";

if (typeof window !== "undefined") {
  throw new Error("lib/server/cases.ts must never be bundled for the browser");
}

const SECRET: Record<string, SecretScenario> = {
  don: don as unknown as SecretScenario,
  velvet: velvet as unknown as SecretScenario,
  pier: pier as unknown as SecretScenario,
};

export function loadCase(id: string): { pub: PublicScenario; sec: SecretScenario } | null {
  const pub = getPublicScenario(id);
  const sec = SECRET[id];
  return pub && sec ? { pub, sec } : null;
}
