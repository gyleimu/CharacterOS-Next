# CharacterOS — local visual product (V0)

The real visual CharacterOS product: a local browser interface backed by a
long-lived Node process that owns **persistent subjects**. You can create a subject,
open any stored subject, talk to it with live provider progress, see its current state,
the durable changes its lived history produced, and the material currently reaching
its thinking — then stop the backend process, start it again, reopen the same subject
and visibly continue the **same canonical life**.

`product/sandbox` remains the reference CLI product, developer tool and debug
tool (`pnpm interactive`). This workspace is the visual surface; both reuse the
same frozen product services, so they see the same subject.

## Launch

```bash
pnpm install
pnpm web
```

Then open the printed local URL (default `http://127.0.0.1:4188/`). The command
builds the required workspaces and starts the local product. It is a **local-only
product**: the server binds `127.0.0.1` and there is no account system, no cloud
and no telemetry.

Requirements: Node.js ≥ 24 (repo `engines`) and a local
[Ollama](https://ollama.com/) instance with the configured chat model (default
`qwen3.5:9b` at `http://127.0.0.1:11434`). The startup performs the existing
metadata-only provider preflight; if the provider or model is unavailable the
product **fails closed** with actionable guidance in the terminal and never
starts a fake "ready" UI.

Subjects live one per data root under `CHARACTEROS_SUBJECTS_DIR`
(default `<CHARACTEROS_DATA_DIR>/subjects/<subject_id>/`). The sandbox law stays
"one persistent subject per data root", so the product shell simply gives each
subject its own root: creating a subject runs the real genesis there, opening an
existing one restores it. The conversation you see after a reload or a restart is
read back from that subject's own append-only operational log
(`subject-<id>.interactions.jsonl`) — a VIEW only: canonical state, Memory and the
delivery/ingress ledgers stay the only authorities.

Configuration is the same environment configuration the CLI uses
(`CHARACTEROS_MODEL`, `OLLAMA_BASE_URL`, `CHARACTEROS_TIMEOUT_MS`,
`CHARACTEROS_DATA_DIR`, `CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE`, …), plus
`CHARACTEROS_WEB_HOST` / `CHARACTEROS_WEB_PORT` for the local server. Both
surfaces default to the **same data root** (`product/sandbox/.data`), so the CLI
and the visual product are two windows onto one life.

## Subjects

- **List**: every folder under the subjects root that holds a subject.
- **Create**: a name is enough; the id is derived (), genesis runs in the
  new root, and the new subject becomes active.
- **Open**: switch the active subject; the previous runtime is shut down and the
  selected subject is restored from its own durable files.
- **Isolation**: one runtime per subject, one transcript per subject; the API never
  serves another subject's state, memory, life view or conversation.

## What the panels show

- **Conversation**: the turns that really happened, read from the subject's
  operational log (a view; canonical state and Memory remain authoritative).
- **Subject**: name, NEW/RESTORED status, affect, canonical time, lived count, and a
  collapsible current-state block.
- **Life**: the lived episodes, the durable changes they produced (affect transitions
  with their recorded cause refs; belief transitions with relation and credences) and
  the material currently reaching the subject's thinking. Domains the architecture
  cannot trace are labelled  rather than guessed.
- **Developer details** (Settings): refs, revisions, subject id and executor identity.

Affect/relationship/personality values are read-only projections; nothing in the UI
writes subject state.

## What you see

- **Character** (left): display name, subject id, `NEW` / `RESTORED`, Affect
  (valence, activation), canonical logical time, lived episode count, and an
  expandable **State** section (Regulation, Personality, Beliefs, Relationships;
  empty domains are shown as `ABSENT`, never faked).
- **Conversation** (center): your messages, the subject's replies, and a live
  stage strip while a turn runs. A failed turn renders the same truthful summary
  the CLI prints (failed stage, `SAFE`/`PARTIAL` persistence, reason, suggested
  action) — never a fabricated reply.
- **Life** (right): the subject's recent **lived memory** with provenance
  (external observation vs a conversation the subject actually had). The panel is
  labelled *Life*, not "chat history".

### Life is not chat history

Canonical Memory is the durable life record. The conversation panel is a
**session-only** presentation view: it starts fresh when the page loads, and the
product deliberately does **not** reconstruct a fake exact transcript from
Memory. Continuity after a restart is proven by **Life**, the canonical time, the
revisions and the subject identity — not by a rebuilt chat log.

## Live provider progress

A turn runs several serial local model calls. The browser subscribes to
`GET /api/events` (Server-Sent Events) and renders the same structured stage
events the CLI's diagnostics produce:

```text
TURN_PLAN → STAGE_RUNNING / STAGE_SUCCEEDED / STAGE_FAILED / STAGE_SKIPPED / STAGE_REPORTED → TURN_COMPLETED | TURN_FAILED
```

Numbering is grouped truthfully (`reply` / `prior-reply` / `adaptation`), the
conditional language stage is described as conditional, and `timeout` is never
presented as an expected duration. The browser never invents timers or progress:
every chip comes from a backend event.

**Reply timing truth:** the frozen runtime returns a turn only after adaptation
completes, so the reply appears after the wait; the UI does not imply it arrives
earlier.

## Restart continuity (real process restart)

1. Start `pnpm web`, open the URL, send a message, watch Life and State change.
2. Stop the backend process (Ctrl+C).
3. Start `pnpm web` again and reload the page.

The backend reopens the same `subject-config.json` + shared canonical subject
source and reports `RESTORED` with the previous Memory, Affect, canonical time
and revisions. Reloading the browser alone never creates or forks a subject — it
just re-fetches backend truth (`GET /api/bootstrap`).

## World & settings drawer (hidden by default)

A secondary drawer, opened explicitly from the top bar, exposes the product's
already-frozen non-conversational capabilities without turning the app into an
engineering console. The main surface stays Character / Conversation / Life /
State.

**World**

- **External observation** — the existing structured ingress with the existing
  fields (source, event, entities, scene, task). The UI normalizes bare names to
  the same canonical ref prefixes the CLI uses; the frozen ingress validator
  remains the only authority. Results render exactly as the product reports them:
  *FIRST* → "External observation recorded." (+ episode/revision under
  *Details*), *REPLAY* → "Already recorded — no new lived experience.",
  *CONFLICT* → "Refused: the same event identity arrived with different content."
  Wording never claims objective truth, and a FIRST observation makes the new
  lived experience appear in **Life** on refresh.
- **Environment** — run N (1..100) deterministic environment interactions
  against the same canonical subject; the result reports the interaction count,
  the statuses and the new episodes, then refreshes Life/State.
- **Canonical time** — advance explicit **canonical ticks** (0 is a lawful
  `NO_OP`), showing logical time and Affect before → after and refreshing the
  character header without a page reload. Ticks are never labelled as
  seconds/minutes/hours/days, and there is no wall-clock sync, background timer
  or offline aging.

**Settings / diagnostics** (read-only)

- **Configuration** — model, endpoint, timeout, context/output budgets and data
  root with the existing source labels (`DEFAULT`, `ENVIRONMENT`,
  `PERSISTED_PRODUCT_CONFIG`, `DERIVED`). Endpoint credentials are redacted;
  unrelated environment variables, tokens and secrets are never exposed. There
  are no editor controls: the drawer only answers "what is effective?".
- **Diagnostics** — per-stage status/latency/failure category, configured or
  disabled stage state, process-local latency samples and last-turn timing, from
  the same diagnostics owner that drives the live conversation strip. It also
  separates **semantic Appraisal invocations** from **real inferences** and
  **reuse hits** (`APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0`): when the switch
  is on, a second identical-request Appraisal in the same turn reuses the first
  inference, and the stage renders `REUSED` with `0` provider latency instead of
  a fake transport call. No prompts, user text or Memory content appear; refs and
  revisions stay behind the small *Details* expansion.

## API (bounded, local)

| Route | Meaning |
|---|---|
| `GET /api/health` | liveness only (never a model call) |
| `GET /api/bootstrap` | minimum initial view: identity, NEW/RESTORED, provider, time, Affect, recent Memory, state |
| `GET /api/status` | structured product status |
| `GET /api/state` | read-only canonical state projection |
| `GET /api/memory?limit=N` | recent lived Memory (1..100) |
| `POST /api/talk` | one serialized human turn → structured result or truthful failure |
| `GET /api/events` | SSE provider/turn progress |
| `POST /api/observation` | one structured external observation → FIRST / REPLAY / CONFLICT |
| `POST /api/environment` | bounded deterministic environment interaction (count 1..100) |
| `POST /api/time` | explicit canonical ticks (non-negative integer, 0 = NO_OP) |
| `GET /api/config` | read-only effective configuration with sources (redacted) |
| `GET /api/diagnostics` | read-only bounded provider diagnostics |

There is deliberately **no** generic command endpoint (`/api/execute`,
`/api/command`): each product operation is explicit and bounded.

The API exposes **only** these product operations. It never exposes atomic-commit
internals, authority/capability tokens, raw SubjectState mutators, transition
executors, provider prompts, Memory payloads, private store internals, arbitrary
filesystem access or arbitrary model calls. Request bodies are bounded (64 KiB)
and the static files are an explicit allowlist, so no request path is ever used
as a filesystem path.

## Authority firewall

The browser holds presentation state only: draft input, the session message list,
last fetched Memory/state, stage progress and connection state. It is **not**
authoritative for Memory, Belief, Personality, Relationship, Affect, canonical
Time, subject identity or canonical revisions, and it writes no subject state to
`localStorage`/`sessionStorage`/`IndexedDB`. After any mutation it re-fetches
authoritative views. The backend owns the serialization rule: at most one active
human turn per subject, regardless of what the browser does.

The browser is also not required to prevent concurrent submissions: the backend
queues them through the same serialized-turn service the CLI uses.

## Storage

No new persistence. The product reuses the existing file-backed subject stores
under the data root (`subject-config.json`, `subject-<id>.snapshot.json`,
`subject-<id>.shared-subject.json`, the environment checkpoint sidecar, and the
operational JSONL). No database, no browser-side authority.

## Voice (input/output modality only)

Voice never bypasses the subject: a recording becomes a transcript, the transcript
goes through the SAME turn path a typed message uses (one subject, one life, one
operational log, rows marked `input_mode: voice`), and the subject's FINAL delivered
text is what gets spoken. A degraded turn is spoken as the host's fixed safe line —
never a rejected model output.

- Enable input with `CHARACTEROS_STT_URL` and output with `CHARACTEROS_TTS_URL`
  (optional `CHARACTEROS_VOICE_TOKEN`), pointing at a local service that answers
  `POST /transcribe {audio_base64, content_type} -> {text}` and
  `POST /speak {text} -> {audio_base64, content_type}`. Without them voice is
  UNAVAILABLE and the text product is unaffected; with no output adapter the browser
  can still read replies aloud with its own speech synthesis.
- Failure law: an STT failure asks the subject NOTHING (no turn, no state change); a
  TTS failure leaves the committed turn untouched and the reply visible as text.
- Privacy: the microphone is requested only on an explicit click, the stream is
  released when recording stops or is cancelled, and RAW AUDIO IS NEVER PERSISTED.
- No voice identity: nothing infers emotion, identity, gender or personality from
  voice characteristics, and there is no prosody analysis.
- Browser support: capture uses `MediaRecorder`; playback prefers the server adapter
  and falls back to the browser's speech synthesis.

## Honest limitations (V0)

- one subject only, local-only (`127.0.0.1`), no accounts/authentication;
- the World & settings drawer exposes the existing non-conversational
  capabilities; there is still no hardware adapter (a device would POST to the
  same `/api/observation` boundary), no Action/Need/Goal execution, and no
  canonical-time automation;
- no avatar system (a monogram placeholder only), no animation, no themes;
- no packaging (no exe/Electron/Tauri) — launch is `pnpm web`;
- no cloud, no telemetry, no multi-subject libraries;
- no action execution, no Need/Goal/Commitment;
- real local model latency remains (several serial calls per turn);
- canonical Time is displayed as **canonical ticks**, never as real hours/days;
- the conversation panel is session-only by design; Life is the continuity record.

## Tests

Deterministic, 0 real provider calls: `product/web/src/server.test.ts` (routes,
SSE, validation, body limit, static allowlist, localhost binding) and
`product/sandbox/src/product-runtime.test.ts` (open/create, restart continuity
over the real file stores, progress events, truthful failure, serialized turns,
fail-closed startup). The framework-free frontend is plain HTML/CSS/ES-module
JavaScript served as static files — no bundler, no framework.
