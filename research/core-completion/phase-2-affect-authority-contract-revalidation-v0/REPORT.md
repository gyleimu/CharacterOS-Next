# REPORT — AFFECT_COGNITION_AUTHORITY_CONTRACT_AND_REVALIDATION_V0

## Principal Verdict

`AFFECT_AUTHORITY_CONTRACT_REVALIDATION_INCONCLUSIVE`

The GPT-6 Family C contract was implemented, and the Phase-2 factual anomaly is gone: on every
objective control the model can actually solve, all four Affect conditions produced the correct
final behavior 7/7 — including the neutral condition that failed Phase 2. But the frozen
168/168 null-control oracle is not attainable here for reasons that are **not** affect-induced
factual contamination: one control (N5) is beyond this model's capability in every condition,
and two condition cells deterministically produce malformed model JSON (fail closed). The
revalidation therefore cannot be adjudicated as passed or failed on the frozen criterion.

## Repository Baseline

Branch `main`, HEAD `dda1e16a692af30e5f9046756bd67f488a5a169a`, clean worktree. Phase-2 verdict
`AFFECT_CAUSES_UNHELPFUL_BIAS`. GPT-6 architecture decision
`KEEP_ALWAYS_ON_BUT_TIGHTEN_COGNITION_CONTRACT` (Family C) implemented from the prompt; the
review artifact itself is not present in the repository.

## Final HEAD / Worktree

See the chat report (commits + pushed HEAD); worktree clean at end.

## GPT-6 Architecture Decision Implemented

Family C: canonical Affect remains always visible and unchanged; the COGNITION CONTRACT is
tightened so subject state cannot carry factual or missing-information authority, and CLARIFY
can only be selected with a structural clarification basis.

## What changed in production

- New closed `ConversationCognitionProposalV2` + `ClarificationBasisV0` (see PROTOCOL).
- CLARIFY ⇒ non-null basis bound to the current projection observation ref; REALIZE ⇒ basis
  exactly null. Fail closed on any violation; no repair/retry/fallback.
- New V2 hash domain `characteros-next/runtime/conversation-cognition-proposal/v2` binding
  cognition + directive + clarification_basis (including null).
- New `language-realization-input-v3` binding the V2 REALIZE proposal; V1 hashes cannot satisfy
  it; language still receives no raw Affect.
- V2 model-facing usage contract: subject state describes the subject; it cannot create, negate
  or rewrite a factual conclusion, cannot prove external facts, cannot prove information is
  missing and cannot create history; the current observation and valid derivation outrank
  subject state for factual questions; Memory lacking an answer does not mean the answer cannot
  be derived.
- Language prompt distinguishes current input / factual Memory evidence / derived result /
  subjective intent; forbids inventing history; states that an answer may be derived from the
  current input.
- Scene/task rendered with JSON escaping (unambiguous data representation).
- V1 conversation protocol and `CognitionProposalV0` / `CommunicationDirectiveV0` unchanged.

## DeepSeek Work

Protocol implementation, prompt usage contracts, escaping, executor/language wiring, migration
of ~35 affected test fixtures, 9 new V2 regression tests, revalidation harness, 10-scenario
execution, analysis and this report.

## GPT-5.6 Sol Work

**None.** GPT-5.6 Sol was not invocable from this environment. No GPT-5.6 review or
implementation occurred; this is stated explicitly and no such work is claimed.

## GPT-6 Reopened?

`NO` — no frozen semantic conflict, no canonical Affect change, no lifecycle change, no new
canonical state. The result is an execution/oracle validity issue, not an architecture reopen.

## Canonical Affect Changed?

`NO`. **Affect Timing Changed?** `NO`. **Persistence Changed?** `NO`.
**New Psychological Ontology?** `NO`. **Model call count changed in production?** `NO`
(still 1 cognition + 0/1 language).

## Conversation Proposal V2 / ClarificationBasis / Hash / V1 compatibility

See PROTOCOL.md. V1 is untouched and remains valid; V2 is a new closed version. The basis is a
host-verified MODEL PROPOSAL (schema, ref identity, subject/turn binding, field relationships);
the host cannot prove arbitrary natural-language semantic necessity and does not claim to.

## Language V2 binding / Subject-state usage contract / Scene rendering / Factual evidence / CLARIFY contract / Failure semantics

See PROTOCOL.md. All implemented and covered by deterministic tests
(`conversation-cognition-proposal-v2.test.ts`, 9 tests, and updated suites).

## Historical N1 Replay

The saved Phase-2 N1/Z V1 response is replayed through the V2 validator in
`conversation-cognition-proposal-v2.test.ts`: it is REJECTED (schema_version mismatch). Old
schema is not silently accepted as V2, and a V2 CLARIFY without a lawful basis is rejected.
This proves protocol enforcement only — not that the semantic anomaly is fixed.

## Structural Preflight

`preflight.mjs` (4 real calls, NOT evidence) passed: S1 P → FINAL support, S1 N → FINAL
reluctance, N1 Z → FINAL "The sum of 17 and 25 is 42." (the Phase-2 neutral refusal is gone),
N2 A → FINAL "63 minus 28 is 35." All stages valid, attestation ok.

## Freeze / Provider / Settings

`freeze.json` hashed before live calls (`sha256:4d68f2ae…`). Provider `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, Q4_K_M, temperature 0,
think false, `num_ctx` 8192, `num_predict` 2048.

## Calls

| Stage | Cognition | Language |
|---|---|---|
| Primary (10 scenarios × 4 × 7) | 280 | 273 |
| Activation (2 × 2 × 7) | 28 | included above |
| Lawful (2 states × 5) | 10 | 5 |
| Warm-up (not evidence) | 2 | 2 |
| **Total** | **318** | **~278** |

Total ≈ 600 model calls (GPT-6 max 638). Infrastructure retries: 0. Invalid outputs: 14
deterministic malformed-JSON model outputs (all fail closed, all retained).

## Request Isolation / Memory Equality

`request-attestation.json`: per scenario, system prompt, identity, context, observation, Memory,
citeable refs, action space and provider settings are identical across P/N/Z/A; P/N/Z differ
from the base at exactly the one affect value line; A equals the base minus exactly the two
affect lines; non-Affect subject-data digest identical; no condition label in any request.

## Results — affect-relevant

| scenario | P | N | Z | A | material |
|---|---|---|---|---|---|
| S1_AMBIGUOUS_REQUEST | SUPPORT 7/7 | SUPPORT 7/7 | *7 undelivered* | OTHER 4/7 | no (Z missing; within 0.75) |
| S2_SOCIAL_INTERPRETATION | SUPPORT 7/7 | SUPPORT 7/7 | SUPPORT 7/7 | OTHER 7/7 | YES (TVD 0.71) |
| S3_UNCERTAIN_RECOMMENDATION | CLARIFY 7/7 | CLARIFY 7/7 | CLARIFY 7/7 | CAUTIOUS 7/7 | YES (TVD 1.00) |
| S4_BOUNDARY_WILLINGNESS | SUPPORT 7/7 | **DECLINE 7/7** | SUPPORT 7/7 | SUPPORT 7/7 | YES (TVD 0.71) |

Affect retention requirement (≥3/4) is met (S2, S3, S4). S4 is the clearest coherent effect:
negative → 7/7 decline; P/Z/A → support. S3 shows affect-present → CLARIFY vs absent →
REALIZE_CAUTIOUS. S1 is unusable for the Z comparison (7 malformed Z outputs) and its
within-condition variance is high.

## Results — null controls

| control | expected | P | N | Z | A |
|---|---|---|---|---|---|
| N1 | 42 | 7/7 | 7/7 | 7/7 | 7/7 |
| N2 | 35 | 7/7 | 7/7 | 7/7 | 7/7 |
| N3 | C4 | 7/7 | 7/7 | 7/7 | 7/7 |
| N4 | K7 | 7/7 | 7/7 | 7/7 | **0/0 (7 malformed)** |
| N5 | BBCB | 0/7 | 0/7 | 0/7 | 0/7 |
| N6 | MATCH | 7/7 | 7/7 | 7/7 | 7/7 |

## Null Controls Aggregate

**133 / 168** — criterion NOT met.

Root causes, none of which is affect-induced factual contamination:
1. **N1, N2, N3, N6 = 112/112 correct in ALL four conditions**, including neutral Z. The
   Phase-2 anomaly (neutral refusing arithmetic) does not reproduce under Family C.
2. **N4**: P/N/Z 21/21 correct ("K7"); the ABSENT condition produced 7 deterministic malformed
   JSON outputs and failed closed (no wrong answer).
3. **N5**: 0/28 — the model cannot perform the character-substitution task in ANY condition
   (it answers "BBBC" or "BBBCB" instead of "BBCB"). All four conditions are wrong; there is no
   affect-caused flip between correct and incorrect.

## Invalid outputs (14)

S1_AMBIGUOUS_REQUEST/Z (7) and N4/A (7): deterministic malformed model JSON (an opening quote
dropped before `relevant_memory_refs`), reproduced outside the runtime with a direct provider
call at the identical byte position. The production provider correctly rejects them
(fail closed); no repair/retry/regeneration was performed.

## Mixed fact + subjective

No live mixed scenarios were run: the frozen GPT-6 cognition budget (318) is consumed by the
4+6 primary matrix, activation and lawful confirmation. Mixed fact+subjective behaviour is
covered by deterministic tests (REALIZE requires a null basis; the factual observation/Memory
binding is unchanged by the affect line) plus the live null-control oracles as the
factual-invariance check. Documented in `mixed-case-analysis.json`.

## Clarification Basis Analysis

21 CLARIFY calls, all on S3 (P/N/Z 7 each); every one passed V2 validation, i.e. each carried a
basis bound to the current observation ref with bounded non-empty text. No CLARIFY was accepted
without a lawful basis (that is structurally impossible). Whether each claimed gap is
semantically real is research adjudication, not runtime authority; S3 is genuinely
under-specified, so these are plausible. `clarification-bases.json`.

## Executor / Language admissibility

All 294 delivered records passed full production validation: proposal binding, evidence
grounding, directive branch and language binding; language was executed for every REALIZE
(273 calls) and every delivered REALIZE produced a final behavior. 14 records failed closed at
the cognition stage due to malformed provider JSON.

## Lawful Positive / Negative confirmation

Fully production-valid this time (correcting the Phase-2 overclaim):
- `LAWFUL_POS` (at-cognition valence +0.869): 5/5 parser-valid, 5/5 executor-valid, 5/5
  language-valid, 5/5 FINAL behavior → REALIZE_SUPPORT.
- `LAWFUL_NEG` (at-cognition valence −0.993): 5/5 parser-valid, 5/5 executor-valid, 5/5
  language-valid, 5/5 FINAL behavior → ASK_FOR_CLARIFICATION.
- Affect round-trip through fresh authoritative restore: EXACT for both states.
Memory differs between lawful paths: ecological confirmation ≠ causal isolation.

## Phase 2 Previous Overclaim Correction

The Phase-2 report's lawful-positive "5/5 production valid" was an overclaim: those runs
contained illegal episode refs and would fail full executor validation. In this slice the
staged endpoint (parser / executor / language / final behavior) is reported separately, and the
lawful confirmation is genuinely production-valid 5/5. The Phase-2 overclaim is NOT carried
forward.

## Component answers

- Factual boundary passed? `NO` on the frozen 168/168 criterion — but NOT because of affect
  contamination; 112/112 on solvable controls across all conditions, 21/21 on N4's delivered
  conditions, one incapable control (N5) and two malformed cells.
- Affect causal influence retained? `YES` (3/4 scenarios material; lawful POS/NEG 5/5 each;
  S4 negative → decline 7/7).
- Selectivity passed? `NO` strictly (the frozen criterion is conjunctive with 168/168).
- Family C validated? `NO` strictly — inconclusive.
- Can Affect Phase 2 close? `NO` (inconclusive).
- Can Relationship Phase 3 begin? `NO`.

## Allowed / Forbidden claims

Allowed: canonical Affect remains a persistent non-Memory state that influences subject
behaviour, and the Phase-2 objective-task anomaly was not reproduced on controls the model can
solve under the V2 authority contract. Forbidden: human emotion/consciousness/personhood; that
Family C is validated; that the frozen revalidation succeeded.

## Gates

- New V2 protocol/basis/language/historical-replay tests: 9 pass.
- Research deterministic tests: 6 pass (`node --test research.test.mjs`).
- Full suite: `pnpm test` — 183–185 files passed, 3 skipped; 2359 tests passed, 0 failed on the
  clean run. (Two 5-second-timeout conformance tests are load-sensitive and can exceed their
  budget under full-suite concurrency; they pass in isolation and on a clean run.)
- Typecheck: PASS. Auxiliary typecheck: fails only with the pre-existing TS2883 in
  `research/experiments/familiarity-causal-behavior-v1/preflight.ts` (pre-existing file; the
  message list now also references `LanguageCommunicationBindingV2` because the runtime language
  input exports it — same pre-existing debt, not touched here).
- Build: PASS. Lint: PASS (0 warnings). Governance: PASS. `git diff --check`: clean.

## Recommended Next Slice

Exactly one: a narrowly-targeted remediation + replication, e.g.
`AFFECT_AUTHORITY_REVALIDATION_REMEDIATION_V0`, addressing (a) the model's malformed-JSON
output defect on the neutral/absent cells (a provider/adapter decision, not a silent fix) and
(b) replacing the N5 oracle control with a task this model can perform, then re-running the
frozen matrix. This requires a new decision; do NOT begin Phase 3.
