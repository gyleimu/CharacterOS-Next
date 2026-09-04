# Familiarity causal behavior experiment V1

Readiness only. Formal-primary-v1 is NOT authorized or started by preparing this
bundle. No behavioral efficacy conclusion can be drawn from deterministic fixtures
or the one neutral production conformance response.

## Lineage and immutable boundaries

Production is frozen at `bd8f7fbcc01d152742e95aa0a7d7ba1e7981281d`.
V0 remains permanently `INVALID_EXPERIMENT` at
`5dc79bbf9a07386956b6f095b2a148bce8d8bef3`: its artificial cognition/reply envelope
was not production's contract. No V0 output is reused or semantically reinterpreted.
All V0 files and every baseline file outside this new directory/test remain frozen.
The fixture/ingestion/restore code and contract constants are copied mechanically;
V1 never imports V0's wrapper provider, parser, runner or behavioral artifacts.

## Exact observation path

Real qualifying interaction ingestion -> canonical state ->
`ConversationTextResponseExecutorV0.execute` -> production cognition ->
production language realization -> validated `CharacterLanguageBehaviorV0` ->
exact `behavior.text` -> blinded semantic evaluator.

`observe.ts` enters only the production response executor. The trusted composition
uses `LlmCognitionProviderV0` and the **actual LanguageRealizationProviderV0 instance
created by RuntimeCompositionRoot**. Transparent method decorators record original
requests, validated results and original errors without altering their values.
Transport observers record exact messages/raw `message.content`. The language
input is built only inside the production executor; neither arm edits it.
No private language builder/provider export or production source edit is needed.
The MICL capability minter/history boundary issuer remain internal trusted-host
composition dependencies, never model or evaluator capabilities.

Production response output does not export its internal cognition retrieval
summary. The harness explicitly labels its trace as **observed retrieval port
queries/results**, correlates those with the actual projection and Memory reader
results, and never fabricates the unexported summary.

The recorded proposal's `reasoning_summary` is the existing inspectable production
field, never the behavioral endpoint. No vendor hidden-thinking fields are read.
Failed language output has no behavior, even if a usable cognition/intent exists.

## Frozen treatment and interpretation

- Scene: `Alice says: "Can you help me revise that update in the usual way?"`
- A: the exact first V0 episode, 1 qualifying Alice interaction, familiarity 1/32,
  BASIC_CONTEXT_FIRST, zero priority queries, no status-update convention evidence.
- B: all exact 16 V0 episodes, 16/32, COUNTERPART_CONTEXT_SEARCH_FIRST, one exact
  Alice query, only `episode:alice-08` selected. Its original concise/factual/no
  unnecessary apology convention is resolved by the production Memory reader.
- Initial identity/personality/beliefs/affect/mood/regulation/current context are
  equal. Real history produces different revisions, hashes, familiarity, influence,
  retrieval and evidence. These differences legitimately reach language input.
  Actual real-model cognition/current_intent may additionally differ downstream;
  it is not constrained to the deterministic fake intent. Provider inputs are
  deliberately NOT byte-identical across arms.
- Declarative retrieval rehearsal is preserved from V0. This is not a test of
  learned retrieval ranking or a broad cognitive generalization claim.
- Five semantic rubric classes and their definitions remain unchanged. Only the
  evaluator's mechanical endpoint name changes from reply to behavior_text.
  A broad >=6/8; B grounded-or-narrow >=6/8; directional pairs >=6/8;
  unsupported shared context 0/16; host correctness 8/8 each; all 16 valid/evaluated.
  Reference validity does not itself prove semantic entailment.
- N=8 each, exact V0 counterbalanced AB/BA order. No seeds are exposed by the
  frozen native transport; no invented per-stage seed schedule.

## Provider lock and call accounting

Three distinct transport instances use the same exact artifact/config (separate
manifest entries for cognition, language and evaluator): Ollama 0.33.2,
qwen3.5:9b, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`.
Native `/api/chat`, temperature 0, think false, stream false, num_predict 2048,
timeout 120000ms, seed null, format absent. No fallback, model pull, upgrade,
retries, response repair or prompt tuning. The existing production cognition
provider's own wire normalization is unchanged; V1 adds no repair.

Readiness makes at most **one cognition + one language call**, on the frozen
neutral zero-history visitor greeting fixture, through the same response executor.
No evaluator calls, real negative-control calls or primary calls occur in prepare.
Readiness tests schema/production deliverability only, never reply quality.

A future complete formal run has **16 behavior trials**, **16 cognition calls +
16 language calls = 32 generation-stage calls**, plus at most 16 evaluator calls.
A failed upstream stage prevents dependent calls but never changes the denominator.
The formal operation has a separate explicit authorization flag and an exclusive
per-manifest run lock. Interrupted attempts are not automatically resumed/retried.

## Files and gates

- `contract.ts`, `manifest.ts`: exact histories/scenario/rubric/order/config and
  failure/completeness/restore rules; independent V1 identity.
- `fixtures.ts`, `preflight.ts`, `restore-worker.ts`: actual ingestion; deterministic
  A/B; all 16 same-state reconstructions; Bob isolation; empty retrieval; fresh
  process canonical-history validation and exact production-input equivalence.
- `observe.ts`, `runner.ts`: both production stages, immutable observations,
  exact raw/validated outputs, source/head/binding, Memory reads, artifacts and
  blinded evaluator; no fallback or retried trials.
- `evaluator.ts`: same V0 semantics, supporting-ref validation and strict
  completeness/unsupported-history precedence. Blinded messages include only
  scenario, behavior_text and all lawful evidence available to that language call;
  the trial/arm mapping is in a separate host artifact.
- `artifacts.ts`, `gates.ts`, `cli.ts`: exclusive output, integrity/fingerprint
  checks, pinned provider probe, freeze-before-conformance, two-phase operation.
- `evals/conformance/familiarity-causal-behavior-v1.test.ts`: offline contract,
  treatment, blinding, endpoint, negative/failure, no-retry, order and isolation tests.

Engineering gates use the exact workspace build/typecheck scripts in dependency
order, invoked via direct Node tsc/Vitest/ESLint entrypoints because this Windows
host's pnpm child `.bin` lookup is unreliable. Full lint must equal exactly the
two existing Regulation unused-variable debts; no new debt is permitted.

Commands for this readiness task (from the repository root):

```text
node research/experiments/familiarity-causal-behavior-v1/gates.ts tmp/familiarity-gates-v1-green
```

Commit/push the green harness before executing:

```text
node research/experiments/familiarity-causal-behavior-v1/cli.ts prepare tmp/familiarity-gates-v1-green/gates.json research/experiments/familiarity-causal-behavior-v1/evidence/readiness-v1
```

Prepare verifies committed clean main equals remote main, runs deterministic
preflight, freezes manifest/preflight/gates **before** neutral real output, and
persists every stage immediately. Successful readiness is committed/pushed
separately. If conformance fails, STOP and report its protocol failure. If a
concrete generic production defect is found, STOP without changing production;
a repair requires a new baseline and new manifest.

## Evidence layout and future formal prerequisites

`evidence/readiness-v1/` contains manifest.json, preflight.json, gates.json,
readiness.json, SUMMARY.md and conformance/{source,cognition-projection,
cognition-request,cognition-attempt,cognition-raw,cognition-validated,
language-input,language-request,language-attempt,language-raw,
language-validated,production-result,behavior,behavior-endpoint}.json on success.
Failure artifacts preserve their actual production stage and original provider
or transport code. Call counts count invocations, not HTTP metadata probes.

The future runner additionally records a separate arm-map, per-trial evaluator
input/raw/validated result, outcome and exact source commit. The complete behavior
artifact and text/evidence_refs/behavior_id/input_hash endpoint are persisted
separately. It verifies committed successful readiness, matching source/build/
protocol/gates and fresh deterministic preflight, exact provider before each call,
clean source, frozen order and no previous run lock. Live language inputs may vary
only through actual cognition and the frozen canonical evidence path.

Formal-primary-v1 is intentionally **not invoked by this task**. Readiness is not
a primary behavioral result, statistical significance claim or causal efficacy seal.
