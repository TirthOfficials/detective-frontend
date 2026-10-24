# "Who Killed the Don?" — Prototype Spec (CMSC 612 Milestone 2)

A noir, mafia-themed interactive murder mystery. You play the detective. Suspects are AI agents (Claude) whose knowledge, lies and secrets are controlled by a **symbolic game engine**. The LLM only phrases dialogue.

Stack: **Next.js (App Router, TypeScript) + Tailwind + Framer Motion**, Claude Haiku via the Anthropic SDK, deployed free on **Vercel**, code on **GitHub**. No database, no separate backend.

---

## 0. TL;DR

1. Landing page: pick 1 of **3 saved scenarios**.
2. **Narrator intro** (browser text-to-speech, on/off toggle): setting → each suspect's story → "you, the detective, enter."
3. **Interrogation round:** ask each suspect up to **5 questions** (suggested question chips *or* free text). Inspect rooms for clues. Present clues to suspects.
4. **Deliberation ("detective thinks"):** a notebook, saved in localStorage, shows every statement, clue and auto-detected **contradiction**.
5. **Accuse** a suspect.
   - Correct → win (score = fewer rounds is better).
   - Wrong → that suspect is jailed (and their innocent secret is revealed). Next round the remaining suspects are **more guarded and lie smarter**.
6. The game continues until the culprit is caught.

**Key trick:** the LLM is never shown the truth it must hide. A suspect who is lying only sees their *cover story*. A suspect hiding a secret only sees *"you are hiding something about X, deflect"*. So the model can't leak what it doesn't have.

---

## 1. Changes vs. the proposal (say this in the report)

| Proposal | Prototype | Why |
|---|---|---|
| Player plays one of the characters | Player is **the detective** | Gives a clear goal and ending (TA's question: "what is the player trying to do?") |
| Mafia diagram (doctor, night phase, voting) | New murder-mystery pipeline (Section 7) | The old diagram did not match the game |
| Accuse culprit + motive | Accuse **culprit only**; the reveal explains the motive | Keeps it simple |
| Unspecified case generation | **Hand-written** scenarios (3) + a solvability validator script | Answers "who creates the case file, how do you ensure it's solvable" |

---

## 2. Game rules (precise)

### 2.1 Flow

```
Landing → Pick scenario → Narrator intro
   → ROUND 1: Interrogate (5 Qs per suspect) + inspect rooms
   → Deliberation (notebook, contradictions)
   → Accuse
        ├─ correct → VERDICT (win)
        └─ wrong  → suspect jailed + innocent-secret reveal
                     → guard level +1 → ROUND 2 (3 Qs per remaining suspect) → ...
```

- Round 1: **5 questions per suspect** (5 suspects → 25 questions max).
- Round 2+: **3 questions per remaining suspect** (keeps API cost bounded).
- Inspecting a room: free, once per room, **no LLM call** (clues are pre-written).
- Presenting a clue to a suspect counts as one of their questions.
- Detective may click "I'm ready" before using all questions.
- Max 4 rounds (if 4 innocents are jailed the last one left is the culprit).
- **Score:** 100 − 20 × (wrong accusations) − 1 × (questions used beyond 15). Shown on verdict screen.

### 2.2 What can change during play (answers TA: "which parts can players change?")

Fixed in the case file: murderer, motive, timeline, clue locations, each suspect's true facts.
Changes during play:
- Which clues the detective has found.
- Which **concealed facts get unlocked** (by presenting the right clue).
- Each suspect's **stress** (drives portrait animation).
- The suspect's **lie ledger** (what they already claimed, so they stay consistent).
- **Guard level** (rises after each wrong accusation).
- Which suspects remain.

So the *story the player experiences* varies with what they ask and show, while the underlying truth stays logically consistent.

---

## 3. The three scenarios

All mafia-flavored, different settings, different culprit types. 5 suspects and 4 rooms each.

| | **1. Who Killed the Don?** | **2. Last Call at the Velvet Room** | **3. Midnight at Pier 9** |
|---|---|---|---|
| Setting | Moretti estate, 1927, snowstorm | Speakeasy, 1929, after closing | Dockyard, 1931, foggy night |
| Victim | Don Vincent Moretti, poisoned in his study | Club owner "Lucky" Mickey Doyle, struck in the cellar vault | Union boss Tommy Kane, found in a warehouse |
| Rooms | Study, Library, Kitchen, Garden | Cellar Vault, Stage, Bar, Back Alley | Warehouse, Harbor Office, Pier, Chapel |
| Culprit | **Enzo Bellini** (consigliere) | **Sgt. O'Rourke** (bribed cop) | **Maria Costa** (dock clerk) |
| Motive | Skimming for a rival family; the Don found the ledger | Mickey kept a ledger of police payoffs and planned to leak it | Falsified manifests; Kane discovered it |
| Twist | Alibi is broken by *untouched snow* | The "uniform" glimpsed in the alley | Least suspicious person; forged signature |
| Other suspects | Sal (brother), Rosa (widow), Lucia (bookkeeper), Gino (butler) | Dolly (singer), Frankie (bartender), Ace (pianist), Vivian (sister/co-owner) | Capt. Haugen, Big Paulie, Father Anselm, Jack Kane (son) |

**Build order:** write Scenario 1 completely first (it's specified below). Then use Claude to draft 2 and 3 in the same JSON schema, edit by hand, and run the validator.

### 3.1 Scenario 1 in detail (the reference scenario)

**Timeline (truth):**

| Time | Event |
|---|---|
| 20:30 | Sal argues with the Don about gambling debts (heard by Rosa through the door). |
| 20:50 | Gino prepares the whiskey tray (kitchen note records this). |
| 20:55–21:05 | Gino leaves the tray unattended in the hallway for a smoke break (he hides this). |
| 21:00 | **Enzo poisons the decanter** on the unattended tray. |
| 21:15 | Lucia sees Enzo near the study corridor. Enzo later claims he was in the garden. |
| 21:20 | Don drinks. |
| 21:30 | Don found dead. |

**Suspects (each has a "story to tell" for the narrator):**

| Suspect | Public story (narrator reads) | Hidden secret |
|---|---|---|
| **Enzo Bellini**, consigliere | Twenty years loyal to the Moretti family; the Don's right hand. | **Culprit.** Skimmed $40k to the rival Calabrese family. |
| **Sal Moretti**, brother | Hot-tempered younger brother, always short of cash. | Argued with the Don at 8:30 about money; owes gambling debts. |
| **Rosa Moretti**, widow | Elegant, guarded; has outlived worse storms. | Meeting a lawyer about changing the will; eavesdropped at the study door. |
| **Lucia Ferraro**, bookkeeper | Quiet, nervous; the only one who understands the ledgers. | Saw Enzo near the study at 9:15; afraid of him. |
| **Gino Russo**, butler/driver | Loyal servant who sees everything and says little. | Left the whiskey tray unattended; fears being blamed. |

**Clues (found by inspecting rooms):**

| ID | Room | Clue | Points to |
|---|---|---|---|
| C1 | Library | Torn ledger page in the fireplace: $40,000 to "C.F." | Skimming → Enzo (unlocks his motive) |
| C2 | Study | Cufflink engraved "E.B." under the desk | Enzo (weak alone, since he often visits the study) |
| C3 | Study | Decanter with bitter residue | Poison in the whiskey |
| C4 | Kitchen | Note: "Whiskey tray ready 8:50. G." | Opens window of tampering (Gino's secret) |
| C5 | Garden | Snow completely untouched at 9 pm | **Enzo was not in the garden** |

**Decisive logic:** Enzo claims `at(enzo, garden, 21:15)`. C5 says `not_at(enzo, garden, 21:15)`; Lucia says `at(enzo, study_corridor, 21:15)`. The contradiction engine flags both.

---

## 4. Screens and UX

### 4.1 Wireframes (use real screenshots in the report later)

**Screen 1: Scenario select**
```
+----------------------------------------------------------+
|  THE CASE FILES                      [Sound: ON]         |
|                                                          |
|  +-----------+   +-----------+   +-----------+           |
|  | [art]     |   | [art]     |   | [art]     |           |
|  | Who Killed|   | Last Call |   | Midnight  |           |
|  | the Don?  |   | at Velvet |   | at Pier 9 |           |
|  | 1927      |   | 1929      |   | 1931      |           |
|  | [ PLAY ]  |   | [ PLAY ]  |   | [ PLAY ]  |           |
|  +-----------+   +-----------+   +-----------+           |
|  (Continue saved game)                                   |
+----------------------------------------------------------+
```

**Screen 2: Narrator intro** (subtitles with the spoken line highlighted; Skip button)
```
+----------------------------------------------------------+
|        [ dark mansion background image ]                 |
|                                                          |
|  "Snow fell on the Moretti estate the night the Don      |
|   took his last drink..."                                |
|                                                          |
|  [portrait] [portrait] [portrait] [portrait] [portrait]  |
|     Enzo      Sal       Rosa      Lucia      Gino        |
|   (active suspect glows while their story is read)       |
|                                      [Skip]  [Sound: ON] |
+----------------------------------------------------------+
```

**Screen 3: Investigation board (main screen)**
```
+----------------------------------------------------------------------+
| Round 1 | Questions left: 18 | Guard: 1       [Sound]  [I'm ready]    |
+----------------------+---------------------------+-------------------+
| SUSPECTS             | CHAT with ENZO            | NOTEBOOK          |
| [Enzo  5/5]          |                           | Clues (2/5)       |
| [Sal   5/5]          | Det: Where were you at    |  C1 Ledger page   |
| [Rosa  5/5]          |      9pm?                 |  C5 Untouched snow|
| [Lucia 5/5]          | Enzo: "In the garden,     |                   |
| [Gino  5/5]          |  with a cigar."           | Statements        |
|                      |                           |  Enzo: garden 9:15|
| ROOMS                | Suggested questions:      |  Lucia: saw Enzo  |
| [Study][Library]     | (Where were you?) (Who    |   near study 9:15 |
| [Kitchen][Garden]    |  wanted him dead?) (How   |                   |
|                      |  did you know him?)       | CONTRADICTIONS    |
|                      | [Present clue v]          |  Enzo vs Snow (C5)|
|                      | [ type your question... ] |  Enzo vs Lucia    |
+----------------------+---------------------------+-------------------+
```

**Screen 4: Deliberation ("The detective thinks")**
Full notebook grouped by suspect: statements, matching clues, flagged contradictions in red, and a "pressure" meter (stress). Each suspect has an **Accuse** button. A confirm dialog: "Accuse Enzo Bellini? A wrong accusation jails an innocent person."

**Screen 5: Verdict**
Win: gavel sound, narrator explains what happened, the full timeline, motive, score. Wrong accusation: jailed suspect leaves, narrator reveals their innocent secret ("Rosa was meeting her lawyer about the will"), then "Round 2 begins. They're being more careful."

### 4.2 Visual style

- Palette: near-black `#0b0b0d`, deep red `#7a1018`, gold `#c9a227`, cream text `#efe6d2`.
- Fonts: Playfair Display (headings), Special Elite or Courier Prime (notebook text).
- Film grain overlay and vignette via CSS; a case-folder look for the notebook.
- Animation (Framer Motion):
  - Idle "breathing" bob on portraits.
  - Typing-dots while the LLM replies.
  - Shake + red flash when a contradiction is found.
  - Slide-in clue cards.
  - Stress glow ring on a portrait that grows with stress.
  - Portrait slides out on jailing.
- Suspect expression is driven by **stress**, via CSS filter (calm → tense → agitated) so you need only **one image per character**.

### 4.3 Suggested question chips (per suspect, shown above the input)

Static, six per suspect, all free text underneath:
1. "Where were you between 8:30 and 9:30?" (alibi)
2. "How did you know the victim?" (relationship)
3. "Did you see anyone near the study?" (witness)
4. "Who do you think wanted him dead?" (suspicion)
5. "Did you notice anything strange tonight?" (observation)
6. "Tell me about your relationship with [other suspect]." (relationship)

Plus a **Present clue ▾** dropdown (lists clues found so far). Chips just prefill the text box; the LLM treats chips and free text the same way.

---

## 5. Sound

Free and simple: **browser `speechSynthesis`** (Web Speech API) for the narrator. No API cost.

- **Sound toggle** in the header, persisted in `localStorage` (`mm:sound`). Default OFF until the user clicks "Begin" (browsers block autoplay anyway, so start narration from that click).
- Narrator reads (pre-written text from the scenario JSON, zero LLM cost):
  1. Setting and the murder.
  2. Each suspect's story (portrait glows during their paragraph).
  3. "Enter the detective" line.
  4. Verdict and reveal.
- Controls: Skip, voice selector (list `speechSynthesis.getVoices()`, prefer a deep en-GB/en-US voice), rate 0.9.
- When sound is OFF the same text shows as subtitles. Subtitles are always on.
- Optional audio files in `/public/audio/` (royalty-free): `ambient-jazz.mp3` (loop, volume 0.2), `gavel.mp3`, `sting.mp3` (contradiction found). All gated by the same toggle.
- Should suspect replies be spoken? Optional later; start with narrator only.

---

## 6. Tech stack and repo structure

```
murder-mystery/
├─ app/
│  ├─ page.tsx                      # scenario select
│  ├─ play/[scenarioId]/page.tsx    # intro + board + deliberation + verdict
│  └─ api/
│     ├─ scenarios/route.ts         # GET public scenario list
│     ├─ ask/route.ts               # POST: suspect reply (LLM)
│     ├─ inspect/route.ts           # POST: room → clue (no LLM)
│     └─ accuse/route.ts            # POST: verdict / jail / next round
├─ components/                      # SuspectRow, ChatPanel, Notebook, RoomMap, AccuseModal, Narrator, SoundToggle
├─ lib/
│  ├─ types.ts
│  ├─ engine.ts                     # eligible facts, unlocks, guard, stress
│  ├─ contradictions.ts             # claim conflict detection
│  ├─ context.ts                    # builds the per-suspect prompt
│  ├─ validator.ts                  # checks LLM output
│  ├─ llm.ts                        # Claude call (+ MOCK_LLM mode)
│  └─ narrator.ts                   # speechSynthesis queue
├─ data/
│  ├─ public/<scenarioId>.json      # safe for the browser
│  └─ secret/<scenarioId>.json      # SERVER ONLY (truth, policies, lies)
├─ public/characters/<scenarioId>/<id>.png
├─ public/backgrounds/<scenarioId>.jpg
├─ public/audio/
├─ scripts/validate-case.ts
├─ tests/                            # Vitest
├─ .env.local                        # never committed
└─ README.md
```

**Rule:** `data/secret/*` is imported only in `app/api/*` route files. Never import it in a client component. Never return secret fields in an API response.

**State (stateless backend on Vercel):** the browser holds the game state in React + `localStorage` (`mm:<scenarioId>`) and sends the *public* part with each request. The server loads the secret file and computes the result. It is tamperable (fine for a class demo). An upgrade path is Upstash Redis.

---

## 7. Backend architecture (use this diagram in the report)

```
 Player (detective)
     │ question / present clue / inspect / accuse
     ▼
 UI (Next.js)  ──────────────────────────────►  localStorage (notebook, state)
     │  POST /api/ask {scenarioId, suspectId, question, publicState}
     ▼
 GAME ENGINE (symbolic, TypeScript)
   1. Load secret case file
   2. Apply unlock rules (clues presented → unlock facts)
   3. Select eligible facts for THIS suspect:
        tell → full text      lie → cover story only (v1/v2 by guard)
        conceal → topic hint only (no text)
        drop facts above guard threshold
   4. Build prompt (CONTEXT BUILDER)
     ▼
 LLM (Claude Haiku, prompted only)
   → {reply, facts_used[], deflecting}
     ▼
 VALIDATOR (symbolic)
   • every fact id ∈ allowed set?
   • no concealed topic named explicitly?
   • lie cover story not contradicted?
   fail → regenerate once → else canned deflection
     ▼
 STATE UPDATE
   • lie ledger += lies told
   • stress += 1 if lie told or deflecting
   • claims extracted from used facts → CONTRADICTION DETECTOR
   • return reply, stress, new claims, contradictions
     ▼
 UI updates chat, portrait glow, notebook
```

### 7.1 Neural vs. symbolic

| Symbolic (deterministic code) | Neural (Claude) |
|---|---|
| Who knows what (fact policies) | Natural-language phrasing in the suspect's voice |
| Whether to tell, conceal, or lie | Understanding free-text questions |
| Unlock rules (clue → secret) | Choosing which allowed facts answer the question |
| Guard level and smarter lies | |
| Contradiction detection | |
| Validation of output | |

---

## 8. Data model

### 8.1 Public file (browser-safe): `data/public/don.json`

```json
{
  "id": "don",
  "title": "Who Killed the Don?",
  "year": 1927,
  "blurb": "A snowstorm. A poisoned drink. Five people who loved the Don, or needed him dead.",
  "narration": {
    "intro": "Snow fell on the Moretti estate the night the Don took his last drink...",
    "detectiveEnters": "And then there was you. The one person in the house who owed the Don nothing."
  },
  "rooms": [
    {"id": "study", "name": "The Study"},
    {"id": "library", "name": "The Library"},
    {"id": "kitchen", "name": "The Kitchen"},
    {"id": "garden", "name": "The Garden"}
  ],
  "suspects": [
    {
      "id": "enzo",
      "name": "Enzo Bellini",
      "role": "Consigliere",
      "portrait": "/characters/don/enzo.png",
      "story": "Twenty years loyal to the Moretti family. The Don's right hand, and the man who always knew where the bodies were buried.",
      "voice": "formal, smooth, never rushed"
    }
  ]
}
```

### 8.2 Secret file (server only): `data/secret/don.json`

```json
{
  "id": "don",
  "culprit": "enzo",
  "motive": "Enzo skimmed $40,000 to the Calabrese family; the Don found the ledger and planned to expose him.",
  "timeline": [
    {"id": "T3", "time": "21:00", "who": "enzo", "where": "hallway",
     "event": "Enzo poisons the decanter on the unattended whiskey tray", "witnesses": []},
    {"id": "T4", "time": "21:15", "who": "enzo", "where": "study_corridor",
     "event": "Enzo walks toward the study; Lucia sees him", "witnesses": ["lucia"]}
  ],
  "clues": [
    {"id": "C1", "room": "library", "name": "Torn ledger page",
     "text": "A charred page: $40,000 sent to 'C.F.'", "claim": null},
    {"id": "C5", "room": "garden", "name": "Untouched snow",
     "text": "The garden snow is perfectly smooth. No one walked here tonight.",
     "claim": {"subject": "enzo", "pred": "not_at", "place": "garden", "time": "21:15"}}
  ],
  "characters": {
    "enzo": {
      "personality": "Smooth, loyal-sounding, answers questions with questions when pressed.",
      "innocentSecretReveal": null,
      "facts": [
        {"id": "E1", "policy": "tell", "topics": ["relationship"],
         "text": "I am the Don's consigliere. Twenty years at his side."},
        {"id": "E2", "policy": "lie", "topics": ["alibi"],
         "truth": "I was in the hallway at 9:00 and near the study at 9:15.",
         "lie_text": "I was in the garden having a cigar from nine until I heard the screams.",
         "lie_text_v2": "I stood under the porch by the garden door. I never stepped into the snow.",
         "claim": {"subject": "enzo", "pred": "at", "place": "garden", "time": "21:15"}},
        {"id": "E3", "policy": "conceal", "topics": ["motive", "money"],
         "unlock_when": "clue:C1",
         "unlocked_text": "Fine. I moved money for the Calabreses. But I did not kill him.",
         "reveal_guard_max": 3},
        {"id": "E4", "policy": "tell", "topics": ["suspicion"],
         "text": "I heard Sal and the Don screaming about money at half past eight."}
      ]
    }
  }
}
```

**Fact policies**

| Policy | LLM sees | Meaning |
|---|---|---|
| `tell` | the full `text` | May be said truthfully. |
| `lie` | only `lie_text` (v1, or v2 if guard ≥ 2). Never the `truth`. | Must repeat the cover story and never contradict it. |
| `conceal` | only the *topics* ("you are hiding something about: motive, money") | Deflect. When unlocked, becomes `tell` with `unlocked_text`. |

Other fields: `reveal_guard_max` means at guard levels above this, the fact is withheld (the suspect clams up). `claim` is a structured assertion used for contradiction detection.

Every character also has `innocentSecretReveal`, a line the narrator reads **if that suspect is jailed wrongly**, explaining their suspicious behavior (so wrong guesses still give the detective information).

### 8.3 Client game state (public, in localStorage)

```ts
type GameState = {
  scenarioId: string;
  round: number;               // 1..4
  guard: number;               // 1..3 (= min(round, 3))
  jailed: string[];            // suspect ids
  questionsLeft: Record<string, number>;
  cluesFound: string[];
  roomsInspected: string[];
  stress: Record<string, number>;
  told: Record<string, string[]>;       // suspectId → fact ids already told (lie ledger)
  history: Record<string, {role: "detective" | "suspect"; text: string}[]>;
  claims: Claim[];             // notebook statements with source suspect/clue
  contradictions: Contradiction[];
  askedTopicsPrev: string[];   // detective's questions from previous rounds
};
```

---

## 9. Engine rules (symbolic)

### 9.1 Eligible facts for a suspect

```
for fact in character.facts:
  if fact.policy == "conceal" and unlocked(fact, state):  treat as "tell" with unlocked_text
  if fact.reveal_guard_max and state.guard > fact.reveal_guard_max: skip   (clammed up)
  tell    → include text
  lie     → include lie_text (v2 if guard >= 2 and lie_text_v2 exists)
  conceal → add fact.topics to hiddenTopics (no text)
```

`unlocked(fact, state)`: `fact.unlock_when == "clue:Cx"` and `Cx ∈ state.cluesFound` **and** the detective presented Cx to this suspect (or it is already in `told`).

### 9.2 Guard level (the "smarter next round" mechanic)

`guard = min(round, 3)`. Effects, all deterministic:
1. Lies switch to `lie_text_v2` (hand-written to patch holes the detective probed; e.g., Enzo now says he stayed under the porch, defeating the snow clue).
2. Facts with `reveal_guard_max < guard` are withheld.
3. The prompt includes the detective's previous questions: "The detective has been asking about X; be careful."
4. Stress decays by 1 at the start of each round so the detective has to re-pressure.

### 9.3 Stress

`stress += 1` when a reply uses a `lie` fact or the LLM returns `deflecting: true`. Cap at 5. CSS expression: 0–1 calm, 2–3 tense, 4–5 agitated.

### 9.4 Contradiction detection

Each `claim` is `{subject, pred, place, time}` with `pred ∈ {at, not_at}`. Two claims conflict if they have the same `subject` and `time` and:
- `at(X,P1)` vs `at(X,P2)` with `P1 ≠ P2`, **or**
- `at(X,P)` vs `not_at(X,P)`.

Claims come from used facts (`at`) and clues (`not_at` / `at`). When a new claim is added, check it against every claim in the notebook and flag any conflict immediately (red flash and sting sound).

### 9.5 Validator

After the LLM returns `{reply, facts_used, deflecting}`:
1. JSON parses; `reply` is non-empty and ≤ 400 chars.
2. Every id in `facts_used` is in the allowed set for this suspect.
3. No `hiddenTopics` keyword list match, e.g., a concealed secret's keywords (`"Calabrese"`, `"$40,000"`) must not appear in `reply`. Each `conceal` fact has an optional `leak_keywords` array.
4. If a `lie` fact is in `told`, the reply must not include its opposite (keyword check, optional).

On failure: regenerate **once** with a stricter reminder; on a second failure, return a canned in-character deflection (`"I've said all I'm going to say about that."`). Log all failures (useful for the evaluation section).

---

## 10. LLM layer

- **Model:** `claude-haiku-5-5` via `@anthropic-ai/sdk`. **Prompted only**: no training or fine-tuning.
- `max_tokens: 250`. History limited to the last 4 turns with that suspect.
- **One LLM call per question.** No calls for narration, room inspection, accusation, or contradictions.
- **`MOCK_LLM=1`** env flag: the API returns a canned reply built from the first eligible `tell` fact. Use this while building the UI so you spend **$0** on development.
- Log `usage.input_tokens` / `output_tokens` per call to the server console and keep a running total.

### 10.1 Prompt template (zero-shot plus one example)

```
SYSTEM
You are {name}, {role}, a suspect in a 1920s mafia murder mystery ("{title}").
Personality and voice: {personality}; {voice}.
Stay fully in character. Reply in 1 to 3 sentences. Never mention being an AI, "facts", "policies", or JSON.

RULES
1. You may only state things listed under KNOWN FACTS. Never invent events, times, places, or people.
2. If asked about something not in KNOWN FACTS, say you don't know, or deflect in character.
3. FIXED STORY items are what you claim happened. Repeat them consistently and never contradict them or what you already said.
4. HIDDEN TOPICS: you are hiding something about: {hiddenTopics}. Deflect, change the subject, or show irritation. Do not guess, hint, or reveal.
5. Guard level {guard}/3: {guardInstruction}
6. The detective has been asking about: {previousQuestions}.

KNOWN FACTS
[E1] I am the Don's consigliere. Twenty years at his side.
[E4] I heard Sal and the Don screaming about money at half past eight.
FIXED STORY
[E2] I was in the garden having a cigar from nine until I heard the screams.

ALREADY SAID TO THE DETECTIVE
- "I was in the garden having a cigar..."

CONVERSATION (last 4 turns)
...

OUTPUT: return ONLY valid JSON:
{"reply": "<what you say>", "facts_used": ["E1"], "deflecting": false}

EXAMPLE
Detective: "Where were you at nine?"
{"reply": "In the garden, detective. A cigar and the cold, nothing more.", "facts_used": ["E2"], "deflecting": false}

USER
Detective: "{question}"
{presentedClueLine}   // e.g. 'The detective shows you: "Torn ledger page — $40,000 sent to C.F."'
```

`guardInstruction` examples: 1 = "You're nervous but cooperative." 2 = "You've seen the detective's methods. Be careful and give short answers." 3 = "Trust no one. Answer only what you must."

---

## 11. API routes

All routes require header `x-passcode` equal to `process.env.GAME_PASSCODE` (stops strangers burning your credits).

| Route | Body | Returns |
|---|---|---|
| `GET /api/scenarios` | none | list of public scenario metadata |
| `GET /api/scenario/[id]` | none | public scenario file (narration, suspects, rooms) |
| `POST /api/ask` | `scenarioId, suspectId, question, presentedClueId?, state` | `reply, stress, factsToldIds, newClaims, newContradictions, unlockedNow` |
| `POST /api/inspect` | `scenarioId, roomId, state` | `clue {id,name,text}` or `nothing`, plus new claim and contradictions |
| `POST /api/accuse` | `scenarioId, suspectId, state` | `correct`; if wrong: `jailedReveal` text, `nextRound` info; if right: full reveal (timeline, motive, score) |

Never return `culprit`, `truth`, `lie_text`, or `policy` before the verdict.

---

## 12. Build phases for Claude Code

Do these **in order**; each ends with something that works.

| Phase | Build | Acceptance criteria |
|---|---|---|
| **P0** | Next.js + TS + Tailwind + Framer Motion scaffold, GitHub repo, Vercel deploy of a hello page, env vars (`ANTHROPIC_API_KEY`, `GAME_PASSCODE`, `MOCK_LLM`) | Live Vercel URL; `.env*` gitignored |
| **P1** | `types.ts`, `engine.ts`, `contradictions.ts`, `validator.ts`, public and secret JSON for Scenario 1, `scripts/validate-case.ts`, Vitest tests | `npm test` passes; validator confirms the case is solvable (culprit has motive and opportunity; ≥3 clues point to culprit; all fact/clue ids resolve); contradiction test flags Enzo vs C5 |
| **P2** | `llm.ts`, `context.ts`, `/api/ask`, `/api/inspect`, `/api/accuse` with `MOCK_LLM` and real mode | `curl` calls work in both modes; the secret file never leaks to responses |
| **P3** | UI: scenario select, board (suspect row, chat, chips, present-clue dropdown, room buttons, notebook with contradictions), localStorage save/continue | Full Round 1 of Scenario 1 playable in mock mode; refresh keeps progress |
| **P4** | Narrator (`speechSynthesis`), subtitles, sound toggle, intro cinematic with portrait highlight, optional audio files | Sound OFF = subtitles only; ON = narration; Skip works |
| **P5** | Deliberation screen, accusation, jail + `innocentSecretReveal`, guard level, Round 2+, verdict and score | Wrong accusation → Round 2 where Enzo uses `lie_text_v2`; correct accusation → win screen |
| **P6** | Scenarios 2 and 3, character art and backgrounds, polish animations, README | Both new scenarios pass `validate-case`; deployed on Vercel |

**Target for the Oct 27 deadline:** P0–P3 for Scenario 1 plus screenshots. P4–P6 can follow for Milestone 3.

---

## 13. Claude Code kickoff prompt

Save this file as `SPEC.md` in the repo root, then tell Claude Code:

```
Read SPEC.md fully. We are building the prototype described in it. Build Phase P0 and P1 only, in order, and stop after P1 for my review. Follow the repo structure, the fact policies, the symbolic rules in Section 9, and the secret-vs-public data split exactly. Never import data/secret/* from client components. Use TypeScript, Vitest, and keep everything minimal. After P1, summarize what you built and how to run the tests.
```

Then repeat with "Now build P2", "Now build P3", etc. Small steps keep it cheap and reviewable.

---

## 14. Art and asset plan (keep it small)

- **15 portraits** (5 per scenario), **one image per character**; the expression effect is done in CSS from stress.
- **3 background images** (one per scenario). Rooms are icon cards, not separate images.
- Any image generator works. Use one **style prompt** across all of them for consistency, e.g.:
  `"1920s film-noir character portrait, [role], dramatic side lighting, deep shadows, muted palette with red accents, painterly illustration, head and shoulders, plain dark background"`
- Fallback if art isn't ready: SVG silhouette + colored accent per character.
- Use only images you have the right to use, and cite the generator in the LLM/asset statement of your report.

---

## 15. Deployment, cost and safety

- **GitHub:** one repo (Next.js app + data + docs). Commit often. Add `.env.local` to `.gitignore` *before* the first commit.
- **Vercel (free Hobby tier):** import the GitHub repo and add `ANTHROPIC_API_KEY`, `GAME_PASSCODE`, and `MOCK_LLM=0` as environment variables. Every push to `main` deploys. Preview deployments are generated for branches. Add `export const maxDuration = 30;` in `/api/ask` if replies are slow.
- **No separate backend host needed**: Route Handlers are the backend.
- **Budget ($5 cap):**
  - Worst case **≈52 LLM calls per full game**: 25 (round 1) + 12 + 9 + 6 (rounds 2–4 at 3 Qs per suspect).
  - Set a monthly spend limit in the Anthropic Console.
  - Develop with `MOCK_LLM=1`; test the real model only to tune prompts.
  - Check the token log after your first real game and multiply by the current Haiku price on the pricing page (look it up; don't assume).
  - Passcode on every route, `max_tokens: 250`, 4-turn history cap, optional in-memory per-IP rate limit.
- **Safety:** the API key lives only in server env vars; nothing sensitive in the client bundle.

---

## 16. Evaluation ideas (useful for the Paper track or the demo report)

- **Leak rate:** run N scripted interrogations; count replies where a `conceal` or `truth` keyword appears. Compare *with* vs *without* the validator.
- **Consistency:** count suspects contradicting their own earlier lie (lie ledger on vs. off).
- **Baseline:** a plain-LLM version (all character info in one prompt, no policies). Compare leak and consistency rates.
- **Playability:** have 3–5 classmates play Scenario 1; record win rate, rounds taken, and a 1–5 "felt consistent / felt fun" rating.

---

## 17. Mapping to the Milestone 2 report and the TA feedback

| TA comment | Where it's answered |
|---|---|
| Mockup of the user experience | Section 4.1 wireframes (swap in real screenshots) |
| What is the player trying to do; how does it end; turn limit; win/lose | Section 2 (detective; accuse; question limits; score; win on correct accusation) |
| Which parts of the story can change | Section 2.2 |
| Show the JSON; how many scenarios | Section 8 examples; **3 scenarios**, hand-written |
| Who creates the case file; consistency and solvability | Section 3 (hand-written) and `validate-case.ts` (Section 12, P1) |
| Are lies written ahead of time or generated | **Written ahead of time** (`lie_text`, `lie_text_v2`); the LLM never invents lies |
| How is what each character knows represented and updated | Sections 8.2–8.3 and 9.1 |
| Enforcing constraints: input filtering only or output check too | **Both** (Sections 7 and 9.5) |
| Deliberate lie vs. hallucinated contradiction; who decides lies | **Symbolic layer decides**; lie ledger + validator (Sections 8.2, 9.5) |
| Which LLM | Claude Haiku (`claude-haiku-5-5`), prompted only (Section 10) |
| What do the rules and state look like | Sections 8, 9; example in Section 3.1 (Enzo vs snow vs Lucia) |
| Existing LLM mystery games / interactive dramas like Façade | Add to the Related Work section (research and cite before submitting) |

**Report sections ↔ this spec**

| Report section | Pull from |
|---|---|
| 1. Project Description (+ repo link, related work) | Sections 0, 1, 17 |
| 2. Front End (mockup, interaction) | Section 4 |
| 3. Back End Architecture (diagram) | Section 7 |
| 4. Back End Details (data, prompts, models) | Sections 8, 9, 10 |
| 5. Team Members (done / to-do) | Your own status + Section 12 phases |
| 6. LLM Use Statement | Describe exactly how you used Claude for planning, drafting scenario JSON, and code generation |

---

## 18. Out of scope (stretch goals)

- Suspects spoken aloud with per-character voices.
- LLM-generated case files (validated by the same solvability script).
- User accounts, leaderboards, a database (Upstash Redis).
- Suspects talking to each other; free movement between rooms; motive in the accusation.
