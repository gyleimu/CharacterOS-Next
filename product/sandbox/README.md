# CharacterOS-Next — interactive persistent subject runtime (V0)

This workspace package is the product shell for `INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0`.
It lets you talk to ONE persistent CharacterOS subject with a natural-language CLI,
close the process, reopen it, and continue with the SAME subject whose prior lived
interactions survive restart.

The shell is thin: it owns local process concerns (readline, provider wiring, a
file-backed durable snapshot, an operational log) and delegates every semantic
step to the existing production runtime (`packages/runtime`). It never chooses
Memory refs, writes Memory, sets Affect/beliefs/relationship, writes
`current_intent`, selects a communication directive, or authors behavior.

## Requirements

- Node.js >= 24 (repo `engines`).
- [Ollama](https://ollama.com/) reachable locally with a chat model, by default:
  - endpoint `http://127.0.0.1:11434`
  - model `qwen3.5:9b`
- The provider is the existing production Ollama cognition transport; cognition
  and language realization share it but keep distinct semantics.

## Run

```bash
pnpm install
pnpm interactive
```

`pnpm interactive` builds the product shell, then starts the CLI. The CLI runs a
metadata-only availability probe first (no generation call); if the provider or
model is unavailable it exits non-zero with a concise message.

Configuration is environment-only (sensible local defaults):

| Variable | Default | Meaning |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `CHARACTEROS_MODEL` | `qwen3.5:9b` | chat model |
| `CHARACTEROS_CONTEXT_WINDOW_TOKENS` | `8192` | total sequence budget (`num_ctx`) |
| `CHARACTEROS_NUM_PREDICT` | `2048` | generation budget (`num_predict`) |
| `CHARACTEROS_TIMEOUT_MS` | `120000` | per provider call timeout |
| `CHARACTEROS_SUBJECT_ID` | `alice` | the ONE persistent subject identity |
| `CHARACTEROS_DATA_DIR` | `product/sandbox/.data` | local durable subject data |
| `CHARACTEROS_DEBUG` | unset | `1` prints per-turn operational evidence |

## Commands

```
/help     show help
/status   show subject + runtime status (read-only)
/exit     finish the current turn, verify no mandatory pending work, save, quit
```

Anything else is sent to the subject as a natural-language message. Ctrl+C
requests a graceful shutdown (finish the current turn, then exit); pressing it
again forces immediate exit.

## Where state lives

Durable subject state is written to `product/sandbox/.data/`:

- `subject-<id>.snapshot.json` — the authoritative durable snapshot (canonical
  subject state + Memory repository revisions/payloads + commit chain + ledgers),
  written atomically (temp file + rename) after every completed interaction.
- `subject-<id>.interactions.jsonl` — append-only operational evidence (turn
  index, directive, revision, provider token counts, finish reason). Optional;
  logging failures never break a conversation.

This directory is `.gitignore`d and is never committed. No telemetry, no cloud
service, no network beyond the configured local Ollama endpoint.

## How persistence works (high level)

1. On first launch the subject is created through the existing production
   explicit-v4 genesis factory (`NEW` / `NEW_SUBJECT_CREATED`).
2. Each user message is admitted as a factual event and processed by the frozen
   production lifecycle: appraisal → canonical Affect → retrieval → cognition →
   directive → language realization → delivered reply.
3. The subject's reply is recorded as DELIVERED in the composition-owned ledger.
4. When your NEXT message arrives, it is recorded as the counterpart reply to
   that delivery and closes the prior behavior's Experience/Memory through the
   existing behavior→experience→feedback authority. Nothing is faked: a delivered
   reply whose outcome is not yet answered stays truthfully pending.
5. On a later launch the durable snapshot is restored authoritatively. If the
   snapshot exists but cannot be validated/restored, the CLI FAILS CLOSED and
   never silently creates a new subject.
6. Past interactions reach later cognition only through the existing
   Experience → Memory → retrieval path (rendered as untrusted factual evidence).
   There is no transcript replay and no manual memory injection.

## Known limitations (V0)

- ONE subject identity per data directory; no character creation.
- ONE process / one subject / one interaction at a time. Input is serialized in
  order; concurrent turns are refused.
- The last delivered reply of a session has its outcome Experience committed when
  you next speak — including after a restart, because the delivery ledger is
  durable. This is the truthful conversational consequence the frozen feedback
  authority requires; there is no delivery-receipt-only Experience path.
- The host applies the SAME minimal appraisal profile to every factual event
  (see `product-appraisal-provider.ts`). It is not a sentiment/user-reaction
  model. Affect moves through the canonical dynamics, not through per-content
  appraisal.
- A crash mid-interaction discards that partial interaction: the next launch
  restores the last completed-interaction boundary. There is no ad-hoc
  "mark it done" recovery path.
- No GUI, voice, vision, multi-user, cloud sync, plugins, or tool use.
- Not a scalability claim: this proves interactive + persistent + restartable +
  lawful, not long-horizon scaling.
