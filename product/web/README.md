# CharacterOS — local visual product (V0)

The first real visual CharacterOS product: a local browser interface backed by a
long-lived Node process that owns **ONE persistent subject**. You can see the
subject, talk to it with live provider progress, inspect recent lived Memory and
current state, stop the backend process, start it again, and visibly continue the
**same canonical life**.

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

Configuration is the same environment configuration the CLI uses
(`CHARACTEROS_MODEL`, `OLLAMA_BASE_URL`, `CHARACTEROS_TIMEOUT_MS`,
`CHARACTEROS_DATA_DIR`, …), plus `CHARACTEROS_WEB_HOST` / `CHARACTEROS_WEB_PORT`
for the local server. Both surfaces default to the **same data root**
(`product/sandbox/.data`), so the CLI and the visual product are two windows onto
one life.

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

## Honest limitations (V0)

- one subject only, local-only (`127.0.0.1`), no accounts/authentication;
- no external-observation UI, no environment UI, no canonical-time controls yet
  (the backend services support them; they are deliberately deferred);
- no settings/diagnostics drawer yet (only provider readiness and live stage
  progress);
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
