# The Case Files: a neurosymbolic murder mystery

A noir, mafia-themed interactive murder mystery (CMSC 612, Neurosymbolic Text Generation). You play the detective. The suspects are voiced by **Claude Haiku**, but a **symbolic game engine** decides what each suspect knows, hides, and lies about. The LLM only phrases the dialogue.

**Key trick:** the model never sees the truth it must hide. A lying suspect only sees their *cover story*. A suspect hiding a secret only sees *"you are hiding something about: motive, money"*. It can't leak what it doesn't have.

Full design: [`SPEC.md`](SPEC.md).

## Scenarios

| | Who Killed the Don? | Last Call at the Velvet Room | Midnight at Pier 9 |
|---|---|---|---|
| Setting | Moretti estate, 1927, snowstorm | Chicago speakeasy, 1929 | Brooklyn dockyard, 1931 |
| Rooms | Study, Library, Kitchen, Garden | Cellar Vault, Stage, Bar, Back Alley | Warehouse, Harbor Office, Pier, Chapel |
| Clues | 6 | 6 | 6 |

All three pass `npm run validate-case`. Each culprit's alibi lie (both the round-1 version and the "smarter" round-2+ version) can be broken by at least one clue or witness.

## How to play

1. Pick a case. The narrator introduces the setting and each suspect (browser text-to-speech when sound is on, subtitles always).
2. **Interrogate.** Round 1 gives you 5 questions per suspect. Use the suggested chips or type freely. **Present clues** to crack concealed secrets.
3. **Inspect rooms** (free, no AI call) to find clues.
4. The **notebook** records statements and flags **contradictions** automatically (red flash).
5. Click **I'm ready**, review your notes, and **accuse**.
   - Right: you win. Score = 100 − 20 × wrong arrests − questions beyond 15.
   - Wrong: that suspect is jailed and their innocent secret is revealed. Next round you get 3 questions per suspect, and the rest are **more guarded**: they use patched cover stories and withhold some facts.

## Architecture

```
Browser (Next.js client)                 Server (Next.js route handlers on Vercel)
───────────────────────                  ─────────────────────────────────────────
GameState in React + localStorage  ──►   POST /api/ask {scenarioId, suspectId, question, presentedClueId?, state}
                                           1. load secret case file (data/secret/*.json, server only)
                                           2. sanitize client state (untrusted)
                                           3. ENGINE: unlock rules, guard level, eligible facts
                                                tell → text · lie → cover story (v1/v2) · conceal → topic only
                                           4. CONTEXT BUILDER → prompt
                                           5. budget + rate-limit gate
                                           6. LLM (Claude Haiku 5.5, JSON schema output, 250 max tokens)
                                           7. VALIDATOR: fact ids allowed? leak keywords? self-contradiction?
                                                fail → regenerate once (stricter) → canned deflection
                                           8. claims from used facts → CONTRADICTION DETECTOR, stress
                                   ◄──   {reply, stress, factsToldIds, newClaims, newContradictions, unlockedNow}
                                         POST /api/inspect  (room → clues, no LLM)
                                         POST /api/accuse   (verdict / jail / next round, no LLM)
```

| Symbolic (TypeScript, deterministic) | Neural (Claude) |
|---|---|
| Who knows what (fact policies `tell` / `lie` / `conceal`) | Phrasing replies in the suspect's voice |
| Unlocks (present clue → concealed fact becomes `tell`) | Understanding free-text questions |
| Guard level: `lie_text_v2`, `reveal_guard_max`, past questions | Picking which allowed facts answer the question |
| Contradiction detection over `{subject, pred, place, time}` claims | |
| Output validation and fallback | |

Key files:

| File | Role |
|---|---|
| `lib/engine.ts` | Eligible facts, unlocks, claims, stress, topic classifier |
| `lib/contradictions.ts` | `at`/`not_at` claim conflict detection |
| `lib/context.ts` | Per-suspect prompt (never includes `truth`, `culprit`, or concealed text) |
| `lib/validator.ts` | Checks every LLM reply |
| `lib/llm.ts` | Claude call + `MOCK_LLM` scripted mode |
| `lib/budget.ts` | $ spend cap + per-IP and global rate limits |
| `lib/caseValidator.ts` | Solvability checks used by `scripts/validate-case.ts` |
| `data/public/*.json` | Browser-safe scenario data (narration, suspects, rooms) |
| `data/secret/*.json` | **Server only**: culprit, timeline, clues, facts, lies |

`data/secret/*` is only imported through `lib/server/cases.ts`, which is only imported by `app/api/*` routes, scripts, and tests. A production build was grepped to confirm no secret strings reach `.next/static`.

## Run locally

```bash
npm install
cp .env.example .env.local     # MOCK_LLM=1 by default: $0, scripted answers
npm run dev                    # http://localhost:3000
```

```bash
npm test                 # Vitest: engine, contradictions, validator, prompt, rules, all case files
npm run validate-case    # solvability report for every scenario
npm run smoke-llm        # 2 real Claude calls (~$0.0005) to check your key and the JSON output
npm run lint
```

## Cost controls ($3 cap)

Claude Haiku 5.5 costs $0.10 per million input tokens and $0.50 per million output tokens. One question is about 1–1.5K input tokens plus ≤250 output tokens, so roughly **$0.0003**. A worst-case full game (≈52 questions) costs about **$0.02**, so $3 covers roughly 10,000 questions.

Layers, from strongest to weakest:

1. **Anthropic Console spend limit.** Set a monthly limit of $3 under Settings → Limits. This is the only hard guarantee.
2. **App budget cap** (`LLM_BUDGET_USD=3`). Every call's real token usage is converted to dollars and added to a counter. Before each call the app reserves a pessimistic estimate and refuses once the cap would be exceeded. Suspects then give stock answers, and the question isn't counted against the player.
3. **Rate limits**: `RATE_LIMIT_PER_MINUTE=12` and `RATE_LIMIT_PER_DAY=150` per IP, plus `GLOBAL_CALLS_PER_DAY=2000`.
4. **Passcode** (`GAME_PASSCODE`) on every API route, so strangers can't use your credits.
5. **Small requests**: `max_tokens: 250`, effort `low`, thinking off, 4-turn history, a 300-character question limit, and server-side clipping of the client-supplied history.

> **Important on Vercel:** without Upstash, counters live in each serverless instance's memory, so the app-level cap is per instance. For a true global cap, create a free [Upstash Redis](https://upstash.com) database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. No code changes are needed. Either way, keep the Console limit.

`GET /api/status` (with the passcode header) shows `{mock, model, spentUSD, budgetUSD, store}`. Server logs print tokens and running cost for each call: `[llm] in=1234 out=56 cost=$0.000151 total=$0.0123 / $3`.

## Deploy (Vercel, free Hobby tier)

1. Import this GitHub repo in Vercel (framework: Next.js, root directory: repo root).
2. Add environment variables: `ANTHROPIC_API_KEY`, `GAME_PASSCODE`, `MOCK_LLM=0`, `LLM_BUDGET_USD=3`, and optionally the Upstash pair.
3. Deploy. Every push to `main` redeploys.

There's no separate backend: the route handlers in `app/api/*` are the backend. If `ANTHROPIC_API_KEY` is missing, the app automatically runs in mock mode.

## Art

`npm run gen-art` regenerates placeholder SVG silhouettes (one per suspect) and backgrounds. To use real art, drop images into `public/characters/<scenario>/` and `public/backgrounds/`, then update the `portrait` and `background` paths in `data/public/<scenario>.json`. The stress expression (calm → tense → agitated) is a CSS filter, so one image per character is enough.

Optional audio files in `public/audio/` (`ambient-jazz.mp3`, `gavel.mp3`, `sting.mp3`) are used if present. Otherwise, short synthesized effects play.

## Differences from SPEC.md

- **Multi-time claims.** `claim` may be a single claim or an array, because an alibi like "in the garden from nine until the screams" covers 21:00 and 21:15. Contradictions are de-duplicated per statement/clue pair.
- **Extra clue per case** (6 instead of 5), so red-herring secrets such as Rosa's lawyer can also be unlocked by evidence.
- `unlock_when` accepts a list (any of several clues). `claim_v2` and `unlocked_claim` record what the round-2 lie or an unlocked confession asserts.
- Public data gains `short` (display name), `alibiWindow` (question chips), `clueCount`, and `places` (labels such as "in the study"). Secret data gains `deflection` (canned in-character fallback), `opportunity`, `method`, and `verdictNarration`.
- When a clue unlocks a fact, the engine records it as told even if the model forgets to cite it. The unlock is decided symbolically.
