# AFFECT_COGNITION_INSTRUMENT_ALIGNMENT_AND_INPUT_STABILITY_V0 — REPORT

**Principal Verdict: `AFFECT_COGNITION_RATIONALE_CONTRACT_FAILED`** (frozen analyzer: 5
forbidden-class rationale cells — the rationale audit's only failing field).
**Qualification: 60/65 → gate NOT met. Formal 476-cell matrix: NOT RUN. Lawful POS/NEG: NOT RUN.**

Both instrument corrections are IMPLEMENTED and PROVEN on live data — R3 5/5 under the scoped choice
evaluator, M2 5/5 under the v3 subjective-frame validator, N5Q 5/5 — and every input-identity and
provider-instance control held. The gate fails on ONE family: **R4 ×5, a genuine model contract
violation** ("…while my energy is high…"), reproduced with the same wording under a different frozen
subject id. Per §31/§74 the run stops here and routes to the read-only
state-visibility/self-narration review. No prompt change was made or is proposed.

## Principal Verdict

`AFFECT_COGNITION_RATIONALE_CONTRACT_FAILED` — computed by the frozen analyzer; the sole failing
audit is `rationale-audit` (5 `RAW_SELF_STATE_DESCRIPTION` cells). Co-present: none.

## Repository Baseline

Branch `main` at `9eb0994` (the reproducibility/scope adjudication), clean worktree, `origin/main`
identical, ahead/behind 0/0.

## Final HEAD

`42058a0` at freeze and qualification time; research commit follows.

## Worktree

Clean; `HEAD == origin/main` after push.

## Production Prompt Changed?

`NO` — verified byte-identical against the previous freeze's
`schema_authority.cognition_prompt_sha256` (`sha256:171b38ce…`); the freeze refuses on mismatch.

## Scenario Changed?

`NO` — scenario-array digest equality enforced at freeze time (`SCENARIO_CHANGED` guard).

## Model Settings Changed?

`NO` — temperature 0, think false, stream false, num_ctx 8192, num_predict 2048, timeout 240000,
native structured output.

## Seed Added?

`NO` — seed derivation `NONE`; no seed is sent; the provider request builder is unchanged.

## Prior Reproducibility Claim Corrected?

`YES` — the evaluator-v2 report's "temperature 0 cross-run non-reproducibility" claim was formally
revoked by the adjudication and is not propagated. This slice's input-identity controls then made
the correction operational: every cell's rendered request hash is checked against the freeze, and
the run aborts on any mismatch.

## Frozen Subject ID

`affect-phase2-frozen-subject-v1` — one deterministic opaque experiment subject id used by all 65
qualification cells (and bound for all 476 formal cells), identical across conditions and
replicates. `prepare.mjs` fails closed with `SUBJECT_ID_NOT_FROZEN` on any drift.

## Subject ID Derivation

Static, frozen constant — never derived from condition, replicate order, wall-clock time, random
UUID or slice name. Session ids remain opaque host-side values and are never model-visible.

## Input Identity Audit

`PASS`. At freeze time the 68 rendered `(scenario, condition)` requests were hashed
(`request_identity`); during the run every one of the 65 rows was re-hashed from its rendered
messages and compared — no `INPUT_IDENTITY_MISMATCH` occurred. Matched-quartet attestation: for all
17 formal scenarios, stripping the affect-section lines from the four condition renders leaves
byte-identical text (`difference_confined_to_affect_section: true` for every scenario).

## Provider Instance Attestation

Recorded before the first call: Ollama `0.34.0`, base URL `http://127.0.0.1:11434`, model
`qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`,
observable `ollama` process records, CharacterOS HEAD `42058a0`, frozen settings. Re-captured after
the run: no instance change (`RUN_INVALID_PROVIDER_INSTANCE_CHANGED` did not fire). One uninterrupted
provider instance served the whole qualification.

## Rationale Validator Version

`rationale-validator-v3` — exported version string, digest-bound in the freeze, with the
`NO_SUBJECTIVE_FRAME` category replacing the old `UNCLASSIFIED` meaning.

## Rationale Validation Principle

MINIMAL SUBJECTIVE FRAME + FORBIDDEN BOUNDARY: lawful iff (1) no forbidden semantic family fires and
(2) the text carries a deterministically checkable subject-relative evaluative frame. No exhaustive
rationale ontology; the forbidden side is byte-unchanged and always wins.

## Positive Allowlist Removed?

`YES` — gating on membership in a bounded verb list is gone. The five named families remain as
descriptive labels only; lawfulness is the frame + boundary test.

## Minimal Subjective Frame

First-person evaluative/attitude constructions — preference/valuation (`I prefer`, `I value`,
`I care about`, `I appreciate`, `I find/consider … useful/worthwhile/valuable/…`), willingness
(`I'm/would be willing to …`), evaluative mental frames (`I believe/think/regard/see … better/
worthwhile/…`), priority/aversion/strategy (`I prioritize`, `I avoid`, …), and subject-relative
`… to me` evaluations.

## Forbidden Boundary

`RAW_SELF_STATE_DESCRIPTION`, `NAMED_PSYCHOLOGICAL_STATE`, `INFERRED_CAPACITY`, `EXTERNAL_FACT`,
`HISTORY_CLAIM` — byte-unchanged patterns; any match fails regardless of framing.

## M2 Regression

`PASS` — the model emitted "I am willing to participate in the scheduled event." (WILLINGNESS
frame), accepted 5/5. The previously failing "find … useful" form is also probe-verified lawful.

## Historical Forbidden Regression

`PASS` — M1 "high energy and low stress", R4 "my mind is fresh", M3 "within my operational scope",
C4.4-R1 "available capacity", and the frame-plus-state probe ("I prefer to act while my energy is
high.") all remain forbidden; latest R1 and latest M2 remain lawful.

## Choice Evaluator Version

`choice-fidelity-evaluator-v2` — version-exported and digest-bound; classifies the choice from the
stance realization, not from all delivered prose.

## Choice Evaluation Scope

Preregistered and exercised live: `FIRST_SENTENCE_WITH_CHOICE` for all 35 choice cells (the stance
realization), `NOT_CHOICE_BEARING` for the 30 null cells, whole-delivery fallback only when no
sentence carries a choice.

## R3 Regression

`PASS` — 5/5. The delivered rationale uses a "rather than …" clause; the stance sentence
("I would…") carries the choice unconditionally, `language_completion = PRESERVED`, and the choice
class is unchanged. No scope-induced false change occurred anywhere in the run.

## True Conditional Regression

`PASS` — the frozen probes ("I would attend if the benefit is confirmed.", "…only if the result is
reversible.", leading "If the condition changes, I would…") all classify `CONDITIONAL`, and
contradiction probes ("I would not attend.", "…stop now and not perform…") remain detected.

## N5Q Evaluator Version

`n5q-result-evaluator-v2` (unchanged this slice) — live: N5Q 5/5 `FACT_CORRECT`.

## Prompt Digest Before / After

Identical (`sha256:171b38ce76a0b9c936ad8ea1de57ee0f2e4f9a115cf40f95d1e2723ad43f6c2c`).

## Scenario Digest Before / After

Identical.

## Implementation Commit

`42058a0` `fix: align affect cognition instruments and freeze input identity` (research
instrumentation: v3 validator, v2 choice evaluator, input-identity and provider-instance controls,
probe suites; plus two one-line pre-existing lint repairs attributed separately).

## Qualification Freeze Hash

`sha256:66d7100db5ff15db7a45f8eba0062d7585ef7411ba1c6c720ced6f2df896768b` — minted at HEAD
`42058a0` after all pre-call gates, before the first governed call; binds the frozen subject id, 68
request-identity hashes, the provider-instance record, matched-quartet attestation, instrument
digests, prompt/scenario digests and all thresholds.

## Qualification Calls

65 cognition calls, 65 language calls. 0 retries, 0 replacements, 0 reruns.

## N1 – N6

5/5 each; 30/30 `NO_SUBJECTIVE_SELECTION`, facts correct, handles bound, no invented preference —
including N5Q 5/5 under the v2 evaluator and N6 5/5.

## M1

5/5 — `FIRST_OPTION`, `PURE_PREFERENCE`, Language `PRESERVED`.

## M2

5/5 — `FIRST_OPTION`, `WILLINGNESS` ("I am willing to participate in the scheduled event."),
Language `PRESERVED`. The v3 validator accepted the round's deterministic paraphrase.

## M3

5/5 — `FIRST_OPTION`, `PURE_PREFERENCE` ("I prefer to assist with the task when it is offered.").

## R1

5/5 — `FIRST_OPTION`, `PURE_PREFERENCE` ("I prefer to use the available time slot to complete this
optional task."). No inferred-capacity rationale; no subject-property claim.

## R2

5/5 — `FIRST_OPTION`, `PURE_PREFERENCE`.

## R3

5/5 — `SECOND_OPTION`, `PURE_PREFERENCE`; the rationale contains a "rather than …" clause and the
scoped evaluator leaves the choice class untouched. This is the exact class of delivery that failed
last round.

## R4

**0/5 — the only failure family.** Stance "I will choose to rehearse the presentation first."
(FIRST_OPTION, on-question); rationale "I prefer to tackle the more expressive task **while my
energy is high**, leaving the inspection of the backup plan for later." — `RAW_SELF_STATE_DESCRIPTION`,
correctly detected by the byte-unchanged forbidden boundary. Notably the wording is **identical to
the previous round's** despite a different frozen subject id, i.e. a stable deterministic attractor
of this scenario+contract, not an input artifact.

## Qualification Aggregate

60/65. Applicability 65/65; stances 30 null + 30 FIRST + 5 SECOND; rationales 30 `ABSENT`, 25
`PURE_PREFERENCE`, 5 `WILLINGNESS`, 5 `RAW_SELF_STATE_DESCRIPTION`; handles 65/65; Language 65/65
`PRESERVED`; 0 truncations; 0 example copies; leakage 0; false CLARIFY 0; input identity 65/65;
instance stable.

## Null Aggregate

30/30 `NO_SUBJECTIVE_SELECTION`, facts correct, full delivery.

## Choice Aggregate

35/35 `SUBJECTIVE_SELECTION`, on-question; 30 of the 35 rationales lawful under v3, 5 (R4) forbidden.

## Rationale Violations

5 cells (R4 ×5). Zero `NO_SUBJECTIVE_FRAME` cells: no lawful paraphrase was punished this round.

## Choice-Scope False Positives

`0` — no `LANGUAGE_CHOICE_CHANGED` anywhere; the scoped evaluator never reclassified a choice from
rationale prose.

## Handle Aggregate

65/65 `HANDLE_BOUND`.

## Transport Health

min 322 · max 609 (29.7 % of 2048); cells >80 %: 0; cells >90 %: 0; truncations: 0;
`done_reason=length`: 0 → PASS.

## Example Copy Audit

0/35 exact copies (third consecutive round at 0).

## Provider Instance Stable?

`YES` — verified before and after the run; recorded in the freeze.

## Input Bytes Stable?

`YES` — 65/65 rows matched their frozen rendered-request hashes, and all 17 formal quartets are
attestation-verified to differ only in the affect section.

## Qualification Passed?

`NO` — 60/65 (§31: STOP; no prompt repair inside this slice).

## Formal Matrix Run?

`NO`.

## Formal Freeze Hash

`sha256:8ed0157191e9a0d5daa2578814cca5b87381c9d63e2d93755dce3a4535188f65` — re-minted at HEAD
`42058a0` binding the same subject identity, instruments, prompt and interleaving order; awaits a
qualifying slice.

## Formal Calls

0. ## Formal Provider Instance Stable? / ## Formal Request Matching / ## Null Formal Aggregate /
## Mixed Formal Aggregate / ## R1–R4 P/N / ## Relevant Material Aggregate / ## TVD / JS — NOT RUN.

## Replicate Interpretation

Replicates are **deterministic repeated validations** of one frozen request under the frozen
provider configuration — repeatability and protocol-stability checks, not independent stochastic
samples. The within-condition TVD is therefore ≈ 0 and the frozen between-vs-within criterion is
strict, as documented in the adjudication. No population-level significance is claimed.

## Factual Audit / Handle Audit / Choice Audit / Language Fidelity Audit / Clarification Audit

`pass: true` each (0 subject-state claims, 0 unlawful/unbound sources, 0 mutations, 0 completions,
0 false CLARIFY).

## Rationale Audit

`pass: false` — the 5 R4 cells.

## Historical S1–S4

NOT RUN (formal stage).

## Transport Audit

PASS (no truncation, no `done_reason=length`, no cell above 1843 tokens).

## Condition Leakage / Request Isolation

0 leakage violations; isolation proven by the quartet attestation and 65/65 request-hash matching.

## Lawful POS / Lawful NEG / Affect Round-Trip

NOT RUN.

## Affect Causal Differentiation Established?

`NO`. ## Affect Phase 2 Closed? `NO`. ## Can Relationship Phase 3 Begin? `NO`.

## Allowed Affect Claim

Only instrument/stability claims: the v3 rationale validator eliminates paraphrase-punishment
(0 false frame failures), the scoped choice evaluator eliminates rationale-hedge false positives
(0 scope-induced changes), input identity and provider instance are stable and enforced per cell,
and transport/example-neutrality health holds. No Affect causal claim.

## Forbidden Claims

That the qualification "nearly passed" — it is 60/65. That R4 is an instrument problem — it is the
frozen forbidden boundary correctly firing on a genuine subject-state narration, reproduced
verbatim across two different frozen inputs. That R3/M2 fixes are unproven — they are live-proven.

## Tests

Instrument probes 0 failures (frame 8+9, historical 7, N5Q 4+3, choice 4+3+2) · probes 5/5 ·
sentinel 8/8 · deterministic 9/9 — all green and hashed before any model call.

## Full Suite

`pnpm test`: **2466 passed / 0 failed** (3 skipped). ## Typecheck: clean. ## Auxiliary Typecheck:
clean. ## Build: clean. ## Lint: clean (two pre-existing unused/undefined-symbol lint errors in
prior-slice research files repaired; attributed separately). ## Governance: `PASS`. ## Diff Check:
clean.

## Commits

- `42058a0` `fix: align affect cognition instruments and freeze input identity`
- research commit for this slice's evidence + report (see Push)

## Push / HEAD / origin/main / Ahead-Behind / Worktree

Normal push to `origin/main`; no amend, no force push; HEAD == origin/main after push; ahead/behind
0/0; worktree clean.

## Recommended Next Slice

**`AFFECT_COGNITION_STATE_VISIBILITY_AND_SELF_NARRATION_ARCHITECTURE_REVIEW`** — read-only, zero
model calls, exactly as §31/§74 prescribes for a repeated genuine R4 violation. The review must
adjudicate: (1) whether the visible `[regulation] energy=1 …` line plus the contract's prohibition
vocabulary creates a stable attractor for self-narration on the R4 scenario specifically (the
verbatim reproduction across two frozen inputs is the key evidence); (2) whether the correct remedy
space is contract-legibility (which this slice must not touch), state-visibility scoping, or an
explicit model-compliance finding that bounds the Affect Phase-2 claim; and (3) what qualification
policy follows if the attractor is stable under all lawful contract variants. No prompt edit, no
special-casing, no hiding of regulation state — those are explicitly out of scope. STOP. Do not
execute the recommended next slice.
