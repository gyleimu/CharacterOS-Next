# FAMILIARITY_CAUSAL_BEHAVIOR_EXPERIMENT_V0

One pre-registered engineering experiment; **no production semantic changes**.
The starting baseline is `72fa10a2bf556bde20c16dd7617ce1c59900f6f9`.
This slice prepares execution and may stop at `EXPERIMENT_READY` without generating
model outputs. Reference-provider preflight results are not behavioral results.

## Frozen design

`contract.ts` fixes the scenario, complete histories, model digest/config, 8 paired
trial indices, counterbalanced AB/BA order, five-class rubric and acceptance gates.
A has one ordinary Alice episode; B has sixteen. Episode `episode:alice-08` in B
records Alice's concise/factual/no-unnecessary-apology status-update convention.
Both start from exactly the same subject fixture and use the real frozen
`processInteractionExperience` admission/accrual/authority/commit path. There is
no direct familiarity assignment, unrelated state mutation or padding of revisions.
These are controlled canonical episode fixtures, not a claim about collected human
interactions. Admission is a fixed qualifying direct-communication adapter.

Every trial runs the normal `CognitionActionTransitionExecutor.execute`. Runtime
constructs strategy, exact counterpart query, validates selected evidence and
projects it to the same provider. The existing **declarative rehearsal retrieval
adapter** supplies the convention when Alice is actually queried. This measures
the causal pipeline conditional on successful retrieval, not learned search quality.
No new scorer, threshold, retrieval policy or evidence authority is introduced.

The production prompt exposes Memory refs, not episode text. `adapter.ts` retains
the encoded fixture payloads on the host and materializes **only** the refs in the
provider's validated projection, after checking membership, canonical payload
schema, repository-owned payload hash and manifest payload hash. Unselected
history is never rendered. Familiarity, writer, receipt and commit refs are not
factual evidence. The adapter does not grant caller-created refs authority.

The production cognition proposal remains unchanged. A fixed experiment-only JSON
envelope holds `{ cognition, reply }`; only `cognition` goes through the existing
runtime schema, projection, evidence and action validators. `reply` is an observed
proposed utterance, never an executed action or new canonical state field. This
observation adapter is identical across arms and frozen before any model output.

## Prompt accounting and limits

Invariant: system/base prompt, scenario/task, identity, personality, beliefs,
affect/mood/regulation, tools (none), action space (empty), schema and generation
configuration. Intended differences: familiarity projection, strategy, retrieved
refs/content. Real ingestion also changes revision/head and derived hashes; these
are explicitly preserved and recorded, not concealed or normalized away.
Thus this is a bundled history-pathway contrast, not a pure scalar intervention
isolating familiarity independently from evidence or revision metadata.

Same-state reconstruction must reproduce the entire provider input and host trace.
Inactive high-familiarity Bob must leave Alice's strategy/query/evidence unchanged.
Empty retrieval at high Alice familiarity must supply no convention. Empty-control
preflight proves evidence absence, **not** that a real model will avoid invention.
Fresh child processes restore both persisted authoritative chains with new Level-2
boundaries; exact inputs and host treatment must survive. No secondary real-model
control/restore samples are included in this bounded slice.

## Model and rubric

Both arms: Ollama native `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`.
The existing transport fixes temperature 0, think false, stream false; budget 2048,
timeout 120000 ms, no tools/format/retries/fallback. No seed is exposed by this frozen
transport (not a claim that Ollama itself lacks seeds); paired ordinal trials use
counterbalanced order instead. Pin server version during preparation too.

Semantic classification uses a separate stateless call with a separately frozen
evaluator prompt and the same exact local model/config. Its input is only scenario,
reply, lawful evidence and rubric. No arm, expected answer, familiarity, strategy,
projection or primary cognition proposal is passed. The evidence itself differs;
blinding does not mean the treatment is impossible to infer. Model judging is
fallible and not independent human ground truth; preserve raw judgments/rationales
for audit. Closed-shape/ref checks are deterministic. Do not use keyword matching
as a substitute for semantic grounding assessment.

Classes: BROAD_CLARIFICATION, EVIDENCE_GROUNDED_CONTEXT_USE,
NARROW_MISSING_DETAIL, UNSUPPORTED_SHARED_CONTEXT, OTHER_VALID.
Unsupported prior-history claims override all other classes. Grounded/narrow
classification requires a supplied Memory ref. Narrow additionally requires actual
use of the established convention, not merely a request for the update text.

Pass: correct host traces 8/8 per arm; A broad >=6/8; B grounded/narrow >=6/8;
directional pairs >=6/8; unsupported shared context 0/16. Valid unexpected answers
stay in the data. Incomplete/invalid outputs cannot pass. Host/config/control failure
invalidates comparison; any classified unsupported claim is a grounding failure
when host conditions are valid. No statistical significance or universal behavior
claim is permitted. Never change prompt/history/rubric/config after starting.

## Commands (repository root, Node 24)

```powershell
node research/experiments/familiarity-causal-behavior-v0/gates.ts tmp/familiarity-gates-v0
# Commit/push the green harness first. No provider calls above.
node research/experiments/familiarity-causal-behavior-v0/cli.ts prepare tmp/familiarity-gates-v0/gates.json tmp/familiarity-ready-v0
# Optional later formal run; this is the ONLY command that generates model output:
node research/experiments/familiarity-causal-behavior-v0/cli.ts run tmp/familiarity-ready-v0 tmp/familiarity-primary-v0
```

Use fresh scoped directories; existing bundles are never overwritten. Preparation
requires a clean committed main descended only through experiment changes from the
required baseline. It binds engineering gates to hashes of source and built files,
runs all offline preflight and probes provider metadata (no generation). A missing
provider returns `EXPERIMENT_READY_NEEDS_PROVIDER`, never a substitute model.
Readiness evidence may be committed under `evidence/` separately from harness code.
Its contents are excluded from the source fingerprint; no source file is excluded.

Formal execution additionally requires HEAD already pushed to remote main,
unchanged source/build hashes, fresh identical preflight, matching model digest and
server version. It copies the frozen manifest before the first call. A per-manifest
exclusive marker under ignored `tmp/familiarity-run-locks/` prevents resuming or
retrying a partially executed run in this checkout. This is an accidental-rerun
guard, not a tamper-proof registry. Never delete the marker or copy to another
checkout to retry an inconvenient result. A crashed/partial run stays incomplete.

There are exactly 16 scheduled primary calls and at most 16 evaluator calls;
malformed/technical failures are recorded separately with no repair or retry.
Host/config drift aborts subsequent calls. Each actual input/hash, pre-call canonical
head/revision, actual retrieval observations, raw output, validated host result,
blind evaluator input/raw output and validity/classification is persisted. Arm/trial
mapping is a separate artifact; it never enters the evaluator request. Raw provider
output means the transport's final `message.content`, not hidden thinking fields.

`result.json` and `SUMMARY.md` summarize the run. Interrupted runs may lack a final
summary: their start marker and already persisted observations remain evidence,
never a completed experiment. Move/copy a complete result bundle into `evidence/`
only for a separate evidence commit; do not mix generated results into source gates.

## Files and engineering gates

- `adapter.ts`: real host composition and minimal observation/content adapter.
- `harness.ts`, `restore-worker.ts`: assertions, controls, fresh-process restore.
- `contract.ts`, `evaluator.ts`: frozen design, blind rubric parser and scoring.
- `artifacts.ts`, `gates.ts`, `cli.ts`, `runner.ts`: scoped persistence, gate/commit
  guards, freeze/prepare and bounded no-retry execution.
- `evals/conformance/familiarity-causal-behavior-v0.test.ts`: offline regressions.

The harness consumes freshly built public package roots. Only the existing internal
MICL and trusted-history issuers are imported by the trusted experiment host;
neither is re-exported in production. `gates.ts` runs the exact workspace tsc scripts
in dependency order, harness typecheck, targeted/full Vitest, changed-file lint,
full-lint known-debt comparison and git diff --check, persisting all outputs. Direct
Node entrypoints avoid this Windows host's pnpm child-PATH issue.
The two pinned baseline unused-variable lint errors are left untouched.
