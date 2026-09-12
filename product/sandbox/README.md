# CharacterOS-Next — local persistent-subject product (V0)

This workspace package is the local product shell for CharacterOS: ONE persistent
artificial subject, ONE canonical life.

> CharacterOS maintains one canonical persistent subject whose experiences from
> conversation, environment and external structured observations become one lived
> history. Internal state and Memory survive restart and context switching,
> canonical time can advance independently of interactions, and accumulated
> history reaches future cognition.

There is no account system, no server, no cloud: it is a local CLI over the
frozen runtime in `packages/runtime`.

The shell is thin: it owns local process concerns only (readline, provider
wiring, file-backed durable stores, an operational log) and composes the existing
frozen seams. It never chooses Memory refs, writes Memory, sets
Affect/beliefs/relationship, writes `current_intent`, selects a directive, or
authors behavior.

## One session, one life — commands

Start with `pnpm interactive` (see Run below), then use:

| Command | What it does |
|---|---|
| `/help` | list commands |
| `/status` | subject identity, revisions, Affect, pending work |
| `/state` | READ-ONLY canonical state (identity, time, Affect, Regulation, Personality, beliefs, relationships; `ABSENT` when a domain is empty) |
| `/life` | READ-ONLY one-life view: identity, continuity, time, revisions, Affect, state summaries, recent lived Memory |
| `/memory [count]` | recent durable lived episodes (read-only) |
| `/observe source=… event=… entities=… scene="…" [task="…"]` | submit ONE structured external observation |
| `/environment [count]` | run deterministic environment interaction(s) against the SAME subject |
| `/time <ticks>` | advance explicit CANONICAL ticks (never seconds/minutes/hours) |
| `/demo` | run the bounded one-life acceptance scenario |
| `/exit` | finish the current turn, verify no pending work, save, and quit |

Anything else is sent to the subject as natural-language conversation.

### Observe

`/observe` parses one line of `key=value` pairs into the existing structured
observation ingress (bare names are normalized to canonical refs; the ingress
validator remains the authority). Result is `FIRST` (with observation/episode
refs and the new revision), `REPLAY` (already recorded), or `CONFLICT`.

### Time

`/time N` advances N explicit canonical ticks. `0` is a lawful `NO_OP` (no
write). Wall-clock time is never consulted and never displayed as elapsed time.
Time advances the same shared subject without creating Observations or Memory.

### One shared canonical subject

Human conversation, environment interactions and external observations are
different CONTEXTS over ONE canonical subject source
(`subject-<id>.shared-subject.json`). After any context advances it, the session
re-adopts the shared canonical state, so the next command continues the same
life. Stale writers fail closed; no second genesis and no lineage fork.

### Restart = same subject

Exit the process and launch it again: the product prints `RESTORED`, and
`/status`, `/state`, `/life` and `/memory` show the same subject with its
accumulated life. This is a real process restart over the file-backed stores,
not an in-process reset.

## Requirements

- Node.js >= 24 (repo `engines`).
- [Ollama](https://ollama.com/) reachable locally with a chat model, by default:
  - endpoint `http://127.0.0.1:11434`
  - model `qwen3.5:9b`
- The provider is the existing production Ollama cognition transport; appraisal,
  cognition, language and lived-evidence adaptation are separate calls with
  distinct prompts and budgets.

## Run

```bash
pnpm install
pnpm interactive
```

`pnpm interactive` builds the product shell, then starts the CLI. The CLI runs a
metadata-only availability probe first (no generation call); if the provider or
model is unavailable it exits non-zero with a concise message.

### First run (`PERSISTENT_SUBJECT_CONFIGURATION_V0`)

If no subject is configured yet, the CLI asks for a display name and creates the
subject through CharacterOS itself — no environment variables, JSON editing, or
SubjectState construction required:

```text
CharacterOS-Next
No subject configured.
Create a persistent subject.
Display name: Alice

Subject created.
Subject ID: alice-781a9164
...
```

Later launches detect the persisted configuration and restore the same subject
with no setup questions. The subject id is derived deterministically from the
display name (filesystem-safe, stable across retries); the display name is a
canonical identity field and never controls storage paths.

This is identity configuration only: no persona/personality/belief/memory editor,
no backstory generation, and setup inputs never become Memory. The display name
is immutable in V0 (no `/rename`).

Runtime/provider settings are application configuration, not subject identity:
they remain environment variables.

| Variable | Default | Meaning |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `CHARACTEROS_MODEL` | `qwen3.5:9b` | chat model |
| `CHARACTEROS_CONTEXT_WINDOW_TOKENS` | `8192` | total sequence budget (`num_ctx`) |
| `CHARACTEROS_NUM_PREDICT` | `2048` | generation budget (`num_predict`) |
| `CHARACTEROS_TIMEOUT_MS` | `120000` | per provider call timeout |
| `CHARACTEROS_DATA_DIR` | `product/sandbox/.data` | local durable subject data |
| `CHARACTEROS_SUBJECT_ID` | unset | explicit dev/automation override (must match persisted config in the same data root) |
| `CHARACTEROS_DISPLAY_NAME` | unset | non-interactive creation display name |
| `CHARACTEROS_DEBUG` | unset | `1` prints per-turn operational evidence |

Precedence: explicit env override → persisted subject config → first-run
creation. An override that conflicts with the persisted subject in the same data
root FAILS CLOSED (use a separate `CHARACTEROS_DATA_DIR` to run a different
subject).

## Commands

```
/help     show help
/status   show subject + runtime status (read-only)
/memory   show recent durable lived memories (read-only)
/exit     finish the current turn, verify no mandatory pending work, save, quit
```

Anything else is sent to the subject as a natural-language message. Ctrl+C
requests a graceful shutdown (finish the current turn, then exit); pressing it
again forces immediate exit.

### Inspecting lived memory (`/memory`)

`/memory` shows the subject's durable lived history as a safe factual
projection of actual CharacterOS evidence — never fabricated prose, never an
LLM summary, and never retrieval ranking:

```text
Alice remembers 3 lived episodes:

1. The user says: "My favorite color is teal."

2. Alice said:
   "Try keeping only today's items on your desk."
   You replied:
   "That was helpful; keeping only today's items on the desk works for me."
```

- Observation memories are the stored counterpart utterance; behavior-outcome
  memories preserve BOTH the delivered behavior text and the exact user reply.
- It preserves the epistemic boundary: it shows what was *said*, not an
  objective-truth rewrite, and adds no reward/sentiment/trust interpretation.
- It is strictly read-only: no ingress, no Observation, no Experience/Memory
  write, no Affect/Belief/Relationship change, no revision or interaction-index
  advance, and no provider call. Internal refs/payloads/prompts/reasoning are
  never shown (debug mode may show durable episode refs).
- `/memory [count]` bounds the display to the most recent N episodes (default
  10, max 100). This is a presentation bound only — nothing is deleted or
  de-prioritized, and retrieval is unchanged. Very long text is visibly
  truncated for display only; the durable record keeps the full text.
- If canonical memory cannot be read/resolved, it prints "Memory inspection
  failed." and changes nothing.

## Where state lives

Durable subject state is written to `product/sandbox/.data/`:

- `subject-config.json` — product subject configuration: schema version,
  `subject_id`, `display_name`, `identity_anchors`, and a `durable_state` marker.
  It identifies the target subject; it is NOT canonical SubjectState authority.
- `subject-<id>.snapshot.json` — the authoritative durable snapshot (canonical
  subject state + Memory repository revisions/payloads + commit chain + ledgers),
  written atomically (temp file + rename) after every completed interaction.
- `subject-<id>.interactions.jsonl` — append-only operational evidence (turn
  index, directive, revision, provider token counts, finish reason). Optional;
  logging failures never break a conversation.

All three are written atomically (temp file + rename). Storage paths derive only
from the validated canonical `subject_id`, never from the display name.

Failure handling: a malformed/unsupported config fails closed; a config whose
`subject_id` disagrees with the durable snapshot fails closed; a config marked
`durable_state: PRESENT` with a missing snapshot fails closed (never silently
recreated). If a durable snapshot exists but the config is missing, the config is
recovered deterministically from the snapshot's canonical identity.

This directory is `.gitignore`d and is never committed. No telemetry, no cloud
service, no network beyond the configured local Ollama endpoint.

## How persistence works (high level)

1. On first launch the subject is created through the existing production
   explicit-v4 genesis factory (`NEW` / `NEW_SUBJECT_CREATED`) from the
   configured identity; the config is written first (creation commit point), so
   an interrupted creation deterministically re-creates the SAME identity rather
   than a second subject. Setup itself contributes no Memory.
2. Each user message is admitted as a factual event and processed by the frozen
   production lifecycle: appraisal → canonical Affect → retrieval → cognition →
   directive → language realization → delivered reply.
3. The subject's reply is recorded as DELIVERED in the composition-owned ledger.
4. When your NEXT message arrives, it is recorded as the counterpart reply to
   that delivery and closes the prior behavior's Experience/Memory through the
   existing behavior→experience→feedback authority. Nothing is faked: a delivered
   reply whose outcome is not yet answered stays truthfully pending.
5. A user message that has NO behavior-outcome role — most importantly a brand-new
   subject's FIRST message, which has no prior delivered behavior to answer — is
   instead admitted as an **observation-sourced Experience** through the existing
   generic Learning path (Observation → EpisodicMemory → durable Memory). The
   subject durably remembers the external factual event it perceived, with no
   fabricated delivery/behavior/reply parent, no reward or learning signal, and
   no appraisal/affect duplication. Each user event is admitted exactly once.
   The event is committed AFTER that turn's cognition, so a message is never
   retrieved as "past memory" into the very turn answering it.
6. On a later launch the durable snapshot is restored authoritatively. If the
   snapshot exists but cannot be validated/restored, the CLI FAILS CLOSED and
   never silently creates a new subject.
7. Past interactions reach later cognition only through the existing
   Experience → Memory → retrieval path (rendered as untrusted factual evidence).
   There is no transcript replay and no manual memory injection.

### Explicit feedback is ordinary conversation

There is deliberately no `/feedback` command and no reward/sentiment model. When
you answer the subject's last reply, your message is already recorded as the
counterpart response to that delivered behavior through the existing
behavior→experience→feedback authority, preserving the exact delivered behavior
text, your exact reply text, the delivery identity and the logical times.

```text
Subject > Try restarting the service.
You     > That fixed it, thanks.
```

Memory then holds the fact that the subject delivered that behavior and that the
user replied exactly that — nothing more. Explicit feedback like "that was
helpful" or "that didn't solve it" is factual evidence, not a reward score, not
an Affect/Relationship/Belief mutation. Later retrieval exposes both sides to
cognition as untrusted factual evidence.

## Known limitations (V0)

- ONE subject identity per data directory; no character creation UI, subject
  selector, deletion, cloning or rename.
- Subject configuration is identity metadata only (id, display name, anchors) —
  no personality, belief, relationship, mood or memory configuration. The
  display name is immutable in V0 and is never injected into provider prompts.
- ONE process / one subject / one interaction at a time. Input is serialized in
  order; concurrent turns are refused.
- The last delivered reply of a session has its outcome Experience committed when
  you next speak — including after a restart, because the delivery ledger is
  durable. This is the truthful conversational consequence the frozen feedback
  authority requires; there is no delivery-receipt-only Experience path.
- Observation-sourced memory records that the subject **perceived a factual
  event** (e.g. "the user stated …"), not that the statement is objectively true.
  It carries no reward, learning, trust or sentiment semantics, and it never
  feeds behavior-outcome learning.
- Appraisal is **content-sensitive**: the host supplies a model-backed appraisal
  provider (`product-appraisal-provider.ts` + frozen
  `product-appraisal-prompt.ts`) that makes ONE additional local model call per
  factual event and proposes only the six canonical dimensions plus assessment
  confidence. The adapter assembles every authority field (subject, event ref,
  context hash, evidence refs) from the trusted context, so model output can
  never forge identity. The current event is delimited as untrusted data.
  Malformed/invalid output fails the turn closed — there is no constant
  fallback, no sentiment/named-emotion/reward surface, and no JSON repair.
  Appraisal calls are accounted separately from cognition and language calls.
  `createConstantAppraisalProviderV0()` remains as an explicit offline test
  fixture only.
- A crash mid-interaction discards that partial interaction: the next launch
  restores the last completed-interaction boundary. There is no ad-hoc
  "mark it done" recovery path.
- No GUI, voice, vision, multi-user, cloud sync, plugins, or tool use.
- Not a scalability claim: this proves interactive + persistent + restartable +
  lawful, not long-horizon scaling.
- A brand-new subject has no durable canonical state until its first lived
  event, so `/observe`, `/time` and `/environment` refuse with a hint until you
  send the subject one message (or run `/demo`, which talks first).
- No endogenous Need/Goal system and no product action execution
  (`allowed_actions = []`, `action_intent = null` on the conversation path).
- No wall-clock automatic time: only explicit canonical ticks.
- No native camera/audio interpretation: `/observe` accepts structured text.
- State/life views show only state that durably exists. Personality and
  relationship dimensions appear only when the corresponding lived-evidence
  adaptation provider is configured and has lawfully changed them; otherwise the
  domain prints `ABSENT` (no fabricated defaults).
- Real-model behavioral sensitivity is not guaranteed; the causal claims in this
  repository are bounded to the frozen experiments that produced them.

## One-life demo

Run `pnpm interactive`, then `/demo` to execute the bounded acceptance scenario
with the SAME commands listed above: initial state, one human experience, one
structured external observation, one environment interaction, recent Memory,
explicit canonical time, and the current life. Then `/exit`, relaunch, and run
`/life` to see the same subject restored with its accumulated life.

Automated acceptance (deterministic fakes, 0 real provider calls) lives in
`src/product-one-life.test.ts`.
