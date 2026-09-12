# Appraisal exact-input reuse shadow validation V0

Research only. Production reuse is **not enabled**. See `REPORT.md` for the verdict and measurements.

## Reproduce without inference

From the repository root, after `pnpm build`:

```powershell
node --test research/experiments/appraisal-exact-input-reuse-shadow-v0/research.test.mjs
node research/experiments/appraisal-exact-input-reuse-shadow-v0/verify-evidence.mjs
```

These commands use fixed or recorded candidates, never a live provider. Research tests use Node's built-in test runner because root Vitest deliberately includes only workspace and conformance paths. No root test configuration or dependency changed. JavaScript modules are checked by ESLint and executable tests; the repository TypeScript projects do not typecheck these `.mjs` files.

## Collection and freeze

`protocol.json` defines ten synthetic, realistic events before any inference. `freeze.json` records the baseline, code hashes, ordered sample list, local provider settings, installed model digest, Ollama version, and effective `/api/show` model configuration. Metadata queries do not generate text. Collection used the actual product Appraisal transport (`num_predict=256`, `num_ctx=4096`, temperature zero, thinking and streaming disabled, no response-format field).

The metadata-only `collect.mjs --freeze` preceded `collect.mjs --run`. Both are deliberately guarded against overwriting artifacts or silently rerunning started collection. A failed or interrupted collection requires a separate explicitly reviewed recovery decision; do not delete evidence to rerun. The scheduled budget is 20 calls, below the user's absolute ceiling of 24. Every call is journaled before dispatch and written individually upon completion. No retries, output repair, cloud calls, downloads, or configuration changes.

## Lifecycle and isolation

The harness runs `InteractiveSubjectRuntimeV0.submitUserText`, not a reimplementation of its sequencing. A first human turn uses one deterministic Appraisal candidate and the real Appraisal/Learning/Affect authorities. Deterministic Cognition supplies a valid CLARIFY directive through the existing validator; Language has a throwing transport and is never required. Belief, Personality and Relationship adaptation providers are omitted through their existing supported options. No production options are changed.

During the next human turn, A is generated at the current-primary Appraisal stage. The runtime commits that Appraisal before Cognition. Primary AffectApplication occurs after the deterministic response. The prior delivered behavior's reply ingress/Observation and behavior-outcome Experience/Learning then commit. Only when the second Appraisal provider stage is reached does the harness capture authoritative state S and request independent B. There is no second-call precomputation.

Read-only access to the existing TypeScript-private `runtime.authority` property is confined to the research process. It lets the harness use public `captureDurableState`, `durableSource`, `pendingWork`, and `readSnapshot` without calling `runtime.snapshot`, which would flush pending work. This introduces no production observation seam. S contains the complete canonical snapshot, committed bundles, repository manifests/payloads, durable ledgers/workflow images, and pending REPLY work.

CONTROL and SHADOW each deserialize S independently, rebuild a separate repository, restore both conversation ledgers, run the existing authoritative restore chain, and re-enqueue the same pending work. Each full restored image must hash to S before execution. CONTROL supplies B; SHADOW supplies A's seven-field raw JSON through the original product adapter. These are experimental counterfactual injections into isolated copies, **not an operational cache hit across a restore/process boundary**. The separately tested reuse slot forbids such cross-boundary hits.

Both paths run real Appraisal parsing, canonical range/schema validation, factual grounding, trusted-context checks, freshness checks, Memory revision preparation, Learning reservation/atomic commit and AffectApplication. Trusted second-event subject, event ref, context hash and evidence refs are supplied anew by the product adapter; source Observation, payload/history grounding, revisions, transition/intent/appraisal identities, receipts and canonical records are rebuilt by the executor and authorities.

## Equality and normalization

CONTROL versus SHADOW compares complete serialized canonical/persistence images, all appended bundles, Learning provenance, revision progression, pending work and the existing explicit-v4 cognition projection. Object keys are sorted; **no values, event identities, hashes, receipt identities or numerical fields are removed or rounded**. Subject/event identifiers are identical in the two isolated copies. The projection is the existing deterministic V2 builder over the post-second-event snapshot; it is not a generated natural-language response or a future multi-turn behavior benchmark.

A separate cross-check compares the original running baseline continuation to restored CONTROL. Canonical snapshots and repository revisions/payloads must be identical. Production restore resets an internal reservation `first_seen_sequence` counter, which changes downstream receipt/checksum identifiers. Those explicitly recorded identity differences are allowed only in this baseline-versus-restored cross-check, never in CONTROL versus SHADOW. `deterministic-evidence.json` and the compressed sample files preserve those differences.

## Identity and slot

The normalized identity contains the observed actual native HTTP endpoint, method, headers and entire JSON request body, including ordered messages and actual prompt text. It also contains the implementation source hash, provider implementation name, model digest, server version, model template/system/parameters/details/capabilities/model_info, timeout policy, and explicit absence of response format. No event metadata is added when it does not reach the model. Native trace request hashes independently corroborate captured wire bodies.

All currently sent options are included. Unspecified server options remain server/model defaults under the observed version and configuration; hidden hardware/scheduler state is not declared deterministic. Metadata is checked before and after each pair. Provider settings are constructed once by product composition and have no normal mid-turn setter; the research identity nevertheless fails closed on an effective configuration change. Prompt changes naturally change the identity through prompt content.

`TurnSlot` retains both fingerprint and complete normalized identity, with a detached seven-field candidate. Its scope includes subject, human turn, process, restart identity and provider instance. Closed slots cannot be reopened. The slot is never attached to SubjectState, repository, ledgers, host snapshots or product flags. Research evidence on disk is an audit artifact, not a runtime inference cache.

## Failure truth and limitations

Deterministic controls cover changed task/scene/config/model/prompt/order/budgets, hash collisions, cross-turn/subject/process/restart/provider scope, malformed and out-of-range candidates, native timeout/connection failure/truncation, wrong second-event metadata, grounding, stale heads, repository preparation and commit conflicts. Infrastructure faults are injected only into isolated authority instance ports. The real stale-head executor retains its existing one permitted rebuild (two replayed proposal deliveries, zero additional model inference); research does not modify that policy.

Null-task Appraisal durably abstains without invoking the provider. The existing session's subsequent AffectApplication is NOT_ELIGIBLE and the session drain fails. That behavior is preserved and reported; the experiment neither manufactures an inference candidate nor turns a transport failure into abstention.

Collection measures individual native calls using `performance.now`, with Ollama's actual prompt/decode token counts and timing fields. A research-only fetch read-through observes the unchanged wire request and complete parsed response envelope; its small observation/copy cost is inside the client-call timing. Shadow restore/validation and metadata-probe costs are excluded from avoided inference estimates. No performance-heavy repository gates run concurrently with collection. The previous 30–55 second full-turn range comes from the user's architecture-audit brief; it is historical context, not a benchmark collected here.
