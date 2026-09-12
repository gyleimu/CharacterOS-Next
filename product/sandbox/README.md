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
| `/config` | READ-ONLY effective product configuration: model, endpoint, timeout, data root, subject identity, and where each value came from |
| `/diagnostics` | READ-ONLY provider stage status/latency/last failure (alias `/provider`) |
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

On a NEW subject the CLI prints a compact startup summary and short first-run
guidance (checked provider readiness, where data will live, how to talk to the
subject and how to inspect it). There is no multi-page wizard and no setup
persistence beyond the subject config. A RESTORED subject prints the
continuation status instead, so an existing life never looks like a fresh setup.

Runtime/provider settings are application configuration, not subject identity:
they remain environment variables, and `/config` shows the effective value and
its source for each one.

### Configuration (`/config`)

`/config` is read-only and answers "what configuration is effective?":

```text
CharacterOS configuration (read-only)

Subject
  id: mira-14aa8fc5
  name: Mira
  status: RESTORED (continuing the same canonical subject)
  durable state: PRESENT (a completed turn has been persisted)
    source: PERSISTED_PRODUCT_CONFIG (subject-config.json)

Provider
  model: qwen3.5:9b
    source: DEFAULT (built-in default)
  endpoint: http://127.0.0.1:11434
    source: DEFAULT (built-in default)
  timeout: 120000 ms (120 s)
    source: ENVIRONMENT (CHARACTEROS_TIMEOUT_MS)
  readiness: READY (metadata preflight passed at startup)

Storage
  data root: D:\...\product\sandbox\.data
    source: DEFAULT (built-in default (product/sandbox/.data))
  contains:
    - subject-config.json (product subject configuration)
    - subject-<id>.snapshot.json (authoritative durable snapshot)
    - subject-<id>.shared-subject.json (shared canonical subject source)
    - subject-<id>.environment-<id>.checkpoint.json (context checkpoint sidecar)
    - subject-<id>.interactions.jsonl (append-only operational log)

/config is read-only and changes nothing. Use /diagnostics for what happened during provider calls.
```

Every effective setting is labeled with where it came from: `DEFAULT`,
`ENVIRONMENT` (with the variable name), `PERSISTED_PRODUCT_CONFIG` (the file),
or `DERIVED` (from another effective setting). `/config` is built from an
explicit allow-list of known settings and never dumps the environment, so
unrelated variables (API keys, tokens, credentials) cannot appear; endpoint
credentials, if any, are redacted. `/config` changes no setting and no canonical
subject state. To change the model, endpoint or timeout, set the corresponding
environment variable and relaunch — there is no `/config set`, no model
selector, and no second configuration authority.

### Configuration table

| Setting | How configured | Default | Meaning |
|---|---|---|---|
| model | `CHARACTEROS_MODEL` | `qwen3.5:9b` | chat model used by appraisal, cognition, language and adaptation |
| provider endpoint | `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | local Ollama endpoint |
| provider timeout | `CHARACTEROS_TIMEOUT_MS` | `120000` | per model call timeout, in ms (positive integer) |
| context window tokens | `CHARACTEROS_CONTEXT_WINDOW_TOKENS` | `8192` | total sequence budget (`num_ctx`) |
| max output tokens | `CHARACTEROS_NUM_PREDICT` | `2048` | generation budget (`num_predict`) |
| data root | `CHARACTEROS_DATA_DIR` | `product/sandbox/.data` | directory holding all durable subject files |
| debug | `CHARACTEROS_DEBUG` | unset | `1` prints per-turn operational evidence |
| disable adaptation | `CHARACTEROS_DISABLE_ADAPTATION` | unset | `1` disables the belief adaptation stage |
| belief semantic model | `CHARACTEROS_BELIEF_SEMANTIC_MODEL` | effective model | model used by the belief semantic provider |
| interval ticks | `CHARACTEROS_INTERVAL_TICKS` | `1` | canonical ticks between environment interactions |
| subject id override | `CHARACTEROS_SUBJECT_ID` | unset | explicit dev/automation override (must match persisted config in the same data root) |
| display name override | `CHARACTEROS_DISPLAY_NAME` | unset | non-interactive creation display name |
| environment interactions | `CHARACTEROS_ENVIRONMENT_INTERACTIONS` | `4` | `environment` subcommand interaction count |
| appraisal exact-input reuse | `CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE` | `0` (off) | `1` reuses one identical-request Appraisal inference within a turn (see below) |

Malformed numeric values (empty, non-numeric, zero, negative, fractional or
overflow) FAIL CLOSED at startup with the setting name, the received value, the
expected format and the source — values are never silently coerced. A malformed
endpoint fails the same way. The reuse switch accepts **only** `0` or `1`; any
other value fails closed. Precedence for subject identity is unchanged:
explicit env override → persisted subject config → first-run creation. An
override that conflicts with the persisted subject in the same data root FAILS
CLOSED (use a separate `CHARACTEROS_DATA_DIR` to run a different subject).

### Appraisal exact-input reuse (`CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE`)

Within ONE human turn the frozen runtime performs two semantic Appraisal
invocations over **different event identities** — this turn's current-primary
event and the previous delivered reply — whose model-facing requests can be
byte-identical. With the switch set to `1`, the second invocation reuses the
first's already parse-validated model candidate instead of paying a duplicate
local inference. Measured on this machine's local model the redundant inference
is ~2.7 s (research median; a single run can be higher).

What is preserved: both semantic Appraisal invocations, both event identities,
independent grounding/freshness/authority/commit for the second event, and the
full Appraisal lifecycle. What disappears: only the duplicate model inference.

Scope is strictly turn-local (same process, subject, turn, provider identity and
complete request identity); the candidate is dropped on turn end, failure or
restart, and is never persisted. `/config` shows the effective setting with its
source; `/diagnostics` separates semantic invocations, real inferences and reuse
hits, and a reused stage prints `inference reused (no model call)` rather than a
fake transport call. Default is **off** (`DEFAULT_OFF`) for the first production
rollout.

## Commands

```
/help        show help
/status      show subject + runtime status (read-only)
/config      show effective product configuration and its sources (read-only)
/diagnostics show provider stage status, latency and last failure (read-only)
/memory      show recent durable lived memories (read-only)
/exit        finish the current turn, verify no mandatory pending work, save, quit
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

The resolved data root is shown by the startup `Data:` line and by `/config`
(together with where the path came from). By default durable subject state is
written to `product/sandbox/.data/`:

- `subject-config.json` — product subject configuration: schema version,
  `subject_id`, `display_name`, `identity_anchors`, and a `durable_state` marker.
  It identifies the target subject; it is NOT canonical SubjectState authority.
- `subject-<id>.snapshot.json` — the authoritative durable snapshot (canonical
  subject state + Memory repository revisions/payloads + commit chain + ledgers),
  written atomically (temp file + rename) after every completed interaction.
- `subject-<id>.shared-subject.json` — the ONE shared canonical subject source
  used across contexts (human session, environment mode, explicit time advance).
- `subject-<id>.environment-<id>.checkpoint.json` — the environment-context
  checkpoint sidecar for deterministic environment continuation.
- `subject-<id>.interactions.jsonl` — append-only operational evidence (turn
  index, directive, revision, provider token counts, finish reason). Optional;
  logging failures never break a conversation.

These are written atomically (temp file + rename). Storage paths derive only
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

## Provider resilience and diagnostics

Every model-backed stage prints concise progress with bounded latency, e.g.:

```text
[appraisal] running...
[appraisal] done (412 ms)
[cognition] running...
[cognition] failed (120 s): PROVIDER_TIMEOUT
```

- **Stage progress** shows which model-backed stage is currently running:
  `appraisal`, `cognition`, `language`, `relationship_adaptation`, and (reported
  after the turn) `belief_adaptation`. Stages that are not configured print
  `DISABLED` — they are not reported as broken.
- **Latency** is process-local monotonic timing only. It is never written into
  canonical state, Memory or the shared subject source, and it resets on restart.
- **`/diagnostics`** (alias `/provider`) shows the configured model, the
  configured timeout, each stage's last status/latency/failure category, and the
  last turn/failure. It performs no model generation.
- **Timeout** means the local model did not answer within
  `CHARACTEROS_TIMEOUT_MS`. The product does not silently retry; the turn fails
  closed and the summary names the stage and the configured timeout.
- **Ollama unavailable / model missing**: the CLI preflight fails fast with
  either "Provider unavailable." (endpoint + detail + "Start Ollama locally,
  then relaunch CharacterOS.") or "Model unavailable: `<model>`" (endpoint +
  detail + install/pull guidance). At turn level the failure is classified
  `PROVIDER_UNAVAILABLE` with the same suggestion. The product never
  auto-downloads a model or runs install commands.
- **After a failed turn** the CLI prints which stage failed, whether persistence
  is `SAFE` (durable state unchanged) or `PARTIAL` (the failed turn — including
  any pre-cognition Appraisal that committed in memory — is not persisted and
  will be discarded on relaunch), the canonical/state revisions, any pending
  lifecycle work, the classified reason, and a suggested action.
- **Still usable during an outage**: `/status`, `/state`, `/life`, `/memory`,
  `/diagnostics`, `/help`, `/exit`, and provider-independent `/time` all work
  while the model is unavailable. Conversation, `/observe` adaptation and
  `/environment` still need the model and fail closed with the summary above.
- **`/exit` is always immediate and safe**, including after a failed turn: any
  unpersisted partial work is explicitly reported as discarded.
- The product never fabricates a successful turn: no synthetic appraisal,
  cognition, language, Belief, Personality or Relationship result exists, and no
  fallback constant is substituted.

### Configuration and onboarding troubleshooting

- **"Configuration is invalid."** — a malformed setting value. The message names
  the setting, the received value, the expected format and the source (e.g.
  `CHARACTEROS_TIMEOUT_MS=abc` → expected a positive integer in milliseconds).
  Fix the value and relaunch; nothing is silently coerced.
- **"Data directory is not usable."** — the data root could not be created or is
  not writable. Fix the path or set `CHARACTEROS_DATA_DIR` to a writable
  directory.
- **"Provider unavailable." / "Model unavailable: …"** — see the actionable
  guidance printed at startup; `/config` shows the effective endpoint and model
  with their sources so you can confirm what is actually being used.
- **"What is it actually using?"** — `/config` answers configuration questions
  (model, endpoint, timeout, data root, subject identity and each value's
  source); `/diagnostics` answers runtime questions (stage status, latency, last
  failure). They are deliberately separate commands.
- `/config` is read-only in V0: there is no `/config set`, no `/model switch`,
  no multi-subject selector, and no cloud setup. Change settings with the
  existing environment variables and relaunch.

Honest limitations: no cloud fallback, no automatic model switching, no retry
orchestration, no SLA, and no guaranteed model latency. Provider diagnostics are
product/transport observability only; they are never persisted in canonical
subject state and are not part of the subject's life. The configuration view is
product metadata only: it is not persisted, not canonical, and not a second
configuration authority.

## Turn progress and latency expectations

A normal talk turn is a bounded sequence of serial local model calls. Before the
first call the CLI prints one compact expectation line, then one line per stage
that actually runs, then the reply, then one timing summary:

```text
Turn: up to 3 reply stages (language skipped when cognition clarifies) + 1 prior-reply stage + optional adaptation | reply estimate ~3.5 s (recent local calls)
[reply 1/3 appraisal] running... (~1.0 s recent)
[reply 1/3 appraisal] done (1.0 s)
[reply 2/3 cognition] running... (~2.0 s recent)
[reply 2/3 cognition] done (2.0 s)
[reply 3/3 language] running... (~500 ms recent)
[reply 3/3 language] done (500 ms)
[prior-reply 1/1 appraisal] running... (~1.0 s recent)
[prior-reply 1/1 appraisal] done (1.0 s)
[adaptation 1/1 relationship_adaptation] running... (~300 ms recent)
[adaptation 1/1 relationship_adaptation] done (300 ms)
Mira > Hello!
Turn completed in 4.8 s (provider time 4.8 s: reply 3.5 s, prior-reply 1.0 s, adaptation 300 ms)
```

### The stages

- **Reply path** (produced by the frozen runtime, in this order):
  1. `appraisal` — the pre-cognition canonical Appraisal of your message;
  2. `cognition` — the cognition proposal and communication directive;
  3. `language` — the realized reply text. **Conditional**: when cognition
     returns `CLARIFY_MISSING_CONTEXT` the reply is host-rendered and no language
     call is made. Because that is only known after cognition, the header says
     "language skipped when cognition clarifies" and the skip is reported after
     the turn (in `/diagnostics` and in the completion line) rather than promised
     live.
- **Prior-reply stage** (from the second turn on): the runtime also admits and
  appraises the *previous* turn's delivered reply (the behavior-outcome feedback
  path). It runs after this turn's reply text is produced and is labeled
  `[prior-reply …]` so it is never mistaken for a second reply slot.
- **Adaptation** (after the reply is produced, still inside the turn):
  `relationship_adaptation` is product-timed; `belief_adaptation` runs on a
  provider-internal transport the product does not time, so it is reported in
  `/diagnostics` but not numbered or estimated. `personality_adaptation` is not
  configured in V0 (`DISABLED`) and is never counted as pending work.

Because the runtime returns the turn only after adaptation completes, the reply
does not become visible before adaptation. The completion line therefore
separates **provider time** (sum of observed stage latencies) from **total
elapsed** (which also includes canonical transitions, Memory and persistence),
and splits reply / prior-reply / adaptation.

### What the estimate is based on

The `reply estimate` is a **rough** sum of the most recent **successful**
latency observed for each reply-path stage **in this process only**. There is no
benchmark, no hardware model, no cross-machine data and no persistent
performance store.

- On the first turn (or the first turn after a restart) no stage has a local
  sample yet, so the product says
  `reply estimate unavailable (no successful local sample yet)`. It never
  presents the configured timeout as an expected duration — the timeout is only
  a safety bound, shown in `/diagnostics` as `Configured timeout: …`.
- If only some stages have samples it says `~X s + N unsampled stage(s)`.
- The per-stage `(~X s recent)` hint on a running line is that stage's own last
  successful latency.

Local model latency varies with prompt length, model, machine load and warm-up,
so the estimate can be wrong in either direction; it is a rough expectation, not
a promise.

### /diagnostics vs live progress vs /config

- **live progress** answers "what is happening now?" — the expectation line and
  one line per running/completed stage.
- **`/diagnostics`** answers "what provider calls happened, and how fast?" — per
  stage status/latency/failure category, process-local latency samples, and the
  last turn's total/provider/reply/adaptation timing.
- **`/config`** answers "what configuration is effective?" — model, endpoint,
  timeout, data root, and each value's source. Dynamic latency samples are
  deliberately NOT in `/config`.

### Honest limitations of this view

- The estimate is process-local and approximate; **restarting resets all
  observed latency history**.
- There is no hardware benchmarking, no guaranteed completion time, no SLA.
- Latency is display-only: it never skips stages, changes the model, disables
  adaptation, alters budgets/prompts or reorders calls, and it never advances
  canonical Time or becomes canonical state.
- No parallel provider execution, no retries, no fallback, no router, no
  fast/economy mode. Provider order, eligibility, timeouts and budgets are
  unchanged.
