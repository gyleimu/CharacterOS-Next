# Final bounded Appraisal reuse validation V1

Research only. No production reuse, flag, semantic change, or user subject mutation. The final decision and required aggregate/engineering report are in `REPORT.md` after collection and gates.

## Immutable prior evidence

Baseline is `4962e45c9ccfa199818b9c410467509068e80220` on main, with origin/main at `ea7eb4bb6f9a1a652a65ad344591a0369179c39f` and a clean initial worktree. V0 is read-only prior evidence. V1 reuses its pure identity utilities and public-authority reconstruction helpers through imports, without changing the V0 files. The V0 regression test's final evidence write is intercepted by `v0-regression-guard.mjs`: new output must equal the existing artifact and the old file is not written.

V0 proved five observed exact requests and five equal candidate/canonical/projection pairs; it did not cover enough difficult cases or a failed second inference from a durable pre-state. V0's sixth raw response contains `goal_conguence`; the prompt correctly says `goal_congruence`, native transmission succeeded, the returned message is unmodified, and the strict parser correctly rejects the wrong key. Classification is **MODEL_SCHEMA_VIOLATION**, not a fixture/parser correction opportunity. Why the model internally generated that typo is not observable from these artifacts.

## Frozen collection rules

`protocol.json` fixes 20 new realistic inputs before inference. Aim for 15 additional complete valid pairs, at most 40 Appraisal inferences. No V0 prompt is repeated to increase N. A malformed A terminates that subject's turn, yields no candidate/B call, and is retained before proceeding to the next independent predeclared subject. Later pool entries are predeclared, not selected from model results. B failure is preserved and compared from S. Material paired differences stop collection after real authority comparison. There are no live Cognition/Language/adaptation calls, retries, output repair, model downloads or provider switching.

`freeze.json` includes source hashes, baseline/V0 tree identity, full observed model configuration and the immutable protocol. Native HTTP requests are observed exactly and compared with the declared full identity and native request hash. The V0 identity domain remains intact: complete normalized identity plus SHA-256, actual prompt text/order/options and effective observed server/model configuration, with event-independent model input and separate subject/turn/process/restart/provider-instance scope.

## Actual lifecycle and shadow isolation

`runBaselinePair` runs the actual interactive runtime, using one fixed valid setup Appraisal and a deterministic, validator-accepted CLARIFY Cognition fixture. The normal primary event is appraised at A, then normal Cognition/primary Affect/delivery/feedback proceed. The reply event's Appraisal stage captures S and synchronously persists `V1xx-S.json.gz` **before** B dispatch. The journal records that ordering. No future inference is precomputed.

Separate deserialized/restored authorities execute CONTROL(B) and SHADOW(A). Each restored complete pre-image must equal S. The only treatment is the model-generated candidate source. SHADOW uses a new research-only turn slot containing just the seven fields, then the original product adapter rebuilds B's subject, event, context hash and evidence refs. The real Appraisal executor supplies grounding/freshness, transition/intent/record identities, repository preparation, Learning commit and AffectApplication. No prior proposal/receipt is cached.

The experimental insertion of recorded A into a new isolated comparison scope is explicitly counterfactual evidence injection; it is not an allowed operational cache transfer across restart. `withTurnScope` closes the private slot in `finally` on normal completion and failure. Independent tests forbid cross-turn/subject/restart/process/provider/model/prompt/format/budget hits, including equal hashes with unequal full identities.

CONTROL versus SHADOW normalizes only object key order. No state, hash, numerical, event, receipt, ledger, revision or pending-work field is dropped. An additional original-runtime versus restored-CONTROL check permits only the existing restore-local reservation counter and its derived receipt/checksum identities, while requiring exact canonical snapshot/repository equality. Those exceptions never apply between CONTROL and SHADOW.

## Failure distinctions

A reused candidate cannot bypass B's factual grounding, subject/context binding, stale head, preparation or commit rejection. The existing one permitted stale rebuild remains (two replayed proposal deliveries; zero new model calls), and its terminal failure behavior is reported as-is.

An independently generated malformed B is different from an event authority failure: CONTROL rejects that raw candidate; a valid reused A can commit through the same B authority. V1 explicitly demonstrates and labels that synthetic `FAILURE_BOUNDARY_EFFECT` instead of claiming unconditional failure equivalence. Synthetic failure controls are not added to empirical model divergence counts. An observed live instance would count in paired admission/failure denominators and trigger the preregistered material-difference stop. Invalid A is never reusable and no rejected reuse secretly calls the model again.

Null-task/lawful scene/task misses and first-turn boundaries remain covered by the unchanged V0 regressions. V1 adds automatic finally cleanup, bad B state capture, provider failures and every second-event authority boundary. Existing deterministic V2 cognition construction checks input sensitivity; no generated reply equality is claimed.

## Timing and accounting

Each native transport call has a monotonic raw client duration. Measured synchronous research wire/envelope capture time is separately recorded and subtracted to yield the reported V1 inference duration. Serialization to disk, S capture, metadata probes and shadow restore/validation are outside the interval. The unchanged product's own trace/response parsing remains part of the ordinary transport. Residual wrapper scheduling overhead is not precisely separable; Ollama's independently reported total/prefill/decode durations provide a cross-check. No artificial full-turn fixture timing is called production performance.

Actual `prompt_eval_count` and `eval_count` are retained. A/B request identity, all seven fields and absolute numeric deltas, validity, disposition, canonical/Affect/projection differences and individual latency remain in artifacts. Semantic Appraisal executor entries are counted separately from already-completed event checks, actual provider inferences and research candidate replay.

## Reproduction without model calls

After the workspace build:

```powershell
node --test research/experiments/appraisal-exact-input-reuse-shadow-v1/research.test.mjs
node --import ./research/experiments/appraisal-exact-input-reuse-shadow-v1/v0-regression-guard.mjs --test research/experiments/appraisal-exact-input-reuse-shadow-v0/research.test.mjs
node research/experiments/appraisal-exact-input-reuse-shadow-v1/verify-evidence.mjs
node research/experiments/appraisal-exact-input-reuse-shadow-v1/summarize.mjs
```

The collector's `--freeze` and `--run` are historical execution commands, not reproduction commands. They refuse overwrites and any already-started call journal. Do not delete old evidence to repeat inference. Any infrastructure interruption is reported rather than silently resumed.

Cold workspace typecheck removes only validated workspace dist paths through the existing repository script, followed by rebuild. Full Vitest, relevant product regressions, workspace typecheck, lint, governance and diff checks are retained separately. The known auxiliary TS2883 issue remains out of scope. Test resource timeouts require bounded independent rechecks and explicit disclosure, not a GREEN claim.
