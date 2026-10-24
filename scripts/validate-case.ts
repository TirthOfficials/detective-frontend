// Usage: npm run validate-case [scenarioId]   (no id = all scenarios)
import { validateCase } from "../lib/caseValidator";
import { loadCase } from "../lib/server/cases";
import { SCENARIO_ORDER } from "../lib/publicScenarios";

const ids = process.argv.slice(2).length ? process.argv.slice(2) : SCENARIO_ORDER;
let failed = false;
for (const id of ids) {
  const c = loadCase(id);
  if (!c) {
    console.error(`✗ ${id}: not found`);
    failed = true;
    continue;
  }
  const r = validateCase(c.pub, c.sec);
  console.log(`\n${r.ok ? "✓" : "✗"} ${id} — ${c.pub.title}`);
  r.info.forEach((m) => console.log(`   · ${m}`));
  r.warnings.forEach((m) => console.log(`   ! ${m}`));
  r.errors.forEach((m) => console.log(`   ✗ ${m}`));
  if (!r.ok) failed = true;
}
process.exit(failed ? 1 : 0);
