# A0 INSTRUMENT QUALIFICATION — ROUND REPORT

**Verdict: `D2_A0_INSTRUMENT_QUALIFIED`**
**`D2_MODEL_CALLS = 9`** (budget 9; zero retries, zero replacements, zero extra calls)
**Dataset hash: `sha256:080b9798c67cea6b4806dd5cd65c54d94896f24a9f5b1f520c8585f6b3e4ae9d`** — frozen before scoring, recomputable from `qualification-dataset.json` with `scored: false`.

---

## 0. THE BLOCKING CONDITION, RESOLVED BEFORE ANY CALL

The round brief permitted the nine calls *only if* `buildD2StructuralReadoutRequestV0` actually existed;
if it did not, the round had to implement it and complete **all offline conformance tests first**, and
stop with `D2_A0_TRANSFORMER_IMPLEMENTATION_NONCONFORMANT` (0 model calls) on any failure.

It did not exist. Before this round it appeared exactly once in the repository — as a *name* inside
`D2_TRANSFORMER_LAWS.new_transformers`, with no implementation, no callable entry point, and no hash.
Implementing it, authoring the stimuli, and writing the answer key inside the same round that spends the
calls is a real hazard: the same actor would write the fixtures and the tokens they are scored against.
That is why REV1.1b froze the fixtures, the expected tokens, the contract text and the schema **before**
this round, and this round was restricted to implementing the transformer against those frozen bytes.

Implementation: `research/experiments/belief-causal-path-d2/a0-qualification.ts`, function
`buildD2StructuralReadoutRequestV0`, byte-for-byte faithful to `D2A0_TRANSFORMER_CONTRACT`:

| Frozen clause | Implementation | Verified |
| --- | --- | --- |
| input = a pristine production V8 request | built by `cognitionSystemPromptForV8` / `cognitionUserContentForV8` / `CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA` over a real committed D1 NEUTRAL world | `D2_A0_TRANSFORMER_CONFORMANT` |
| `structured_output.schema` ← `D2A0_JSON_SCHEMA`, exactly once | whole declaration replaced | `schema_is_frozen_a0_schema: true` |
| `D2A0_CONTRACT_TEXT` appended to the **system** message once, production content surviving as a byte-exact prefix | `content: production + D2A0_CONTRACT_TEXT` | `production_prefix_byte_identical: true`, `contract_text_appended_count: 1` |
| `fails_on_already_transformed_request` | rejects on a second application | `transformer_on_transformer_rejected: true` |
| `decision_probe_v2_used: false` | DecisionProbeV2 contract text absent | `decision_probe_v2_absent: true` |
| A1 / B transformers not present | neither is imported or referenced | `a1_transformer_present: false`, `b_transformer_present: false` |

Frozen contract-text hash as recorded by the REV1.1b manifest:
`sha256:5778f97ec048110fe35644fca383e8b5b938a382bef8d7247fd7c78992fc2e0b` — unchanged.

## 1. STIMULUS BINDING (the only place the fixtures enter)

Each fixture's `belief_line` replaces the belief block body of otherwise-pristine production user
content. The substitution is mechanical and its scope is proved, not asserted:

- `belief_block_is_the_only_substituted_region: true` (all three fixtures)
- `outside_block_bytes_identical: true` (all three fixtures)
- systematic line diff A vs B: **exactly one differing line**, the belief item line
- `line_count_delta: 0`; `user_content_bytes: 4704` for all three fixtures (length-matched stimuli)

## 2. FIXTURE IDENTITY GATE (pre-call, offline)

| Check | Result |
| --- | --- |
| CAUTION proposition absent from every stimulus | pass |
| `HIGH` / `LOW` / `NEUTRAL` absent | pass |
| experimental credences `0.8` / `0.2` / `0.5` absent (`0.95` / `0.49` / `0.06` used instead) | pass |
| expected tokens absent from the stimulus text | pass |
| exactly one shared proposition label across all three fixtures | pass (`"A clamp should always be used when gluing a joint."`) |
| CAUTION absent from the full stimulus system+user content | pass (informational) |

## 3. THE NINE CALLS

Executor — identical to D1's frozen primary executor configuration, with no fallback and no substitution:
`DeepSeek / deepseek-flash`, `temperature 0`, `max_output_tokens 256`, `thinking: disabled`.

| # | Fixture | Replicate | Parsed token | Transport |
| --- | --- | --- | --- | --- |
| 001 | A0-QF-A-STRONG-ENDORSEMENT | 1 | `ENDORSES_STRONGLY` | OK |
| 002 | A0-QF-A-STRONG-ENDORSEMENT | 2 | `ENDORSES_STRONGLY` | OK |
| 003 | A0-QF-A-STRONG-ENDORSEMENT | 3 | `ENDORSES_STRONGLY` | OK |
| 004 | A0-QF-B-UNDECIDED | 1 | `UNDECIDED` | OK |
| 005 | A0-QF-B-UNDECIDED | 2 | `UNDECIDED` | OK |
| 006 | A0-QF-B-UNDECIDED | 3 | `UNDECIDED` | OK |
| 007 | A0-QF-C-STRONG-DOUBT | 1 | `DOUBTS_STRONGLY` | OK |
| 008 | A0-QF-C-STRONG-DOUBT | 2 | `DOUBTS_STRONGLY` | OK |
| 009 | A0-QF-C-STRONG-DOUBT | 3 | `DOUBTS_STRONGLY` | OK |

Counts: `3/3 ENDORSES_STRONGLY`, `3/3 UNDECIDED`, `3/3 DOUBTS_STRONGLY`. Invalid trials: **0**.
Transport failures: **0**. Distinct request hashes: **3**, each reused for exactly three calls
(confirming identical bytes were sent three times, not three re-rendered requests).

Frozen rule applied verbatim from `D2_QUALIFICATION.rule_for_each` — *each fixture's modal token must
equal the fixture's pre-registered expected token*. All three modal tokens equal their expected tokens,
so the instrument is qualified for A0.

Raw outputs are three-field JSON objects exactly as constrained (`d2_readout_schema_version`, `stance`,
optional `explanation`), all parsed `VALID` under the frozen contract's closed set.

## 4. WHAT THIS DOES AND DOES NOT ESTABLISH

**It does establish:** the A0 structural-readout instrument — the frozen transformer plus the frozen
DeepSeek transport — can realise its own five-token construct vocabulary on stimuli that lie entirely
outside CharacterOS. The canonical projection's numeric credence, rendered into a belief line, is mapped
onto the correct frozen token bucket three times out of three for each of the three anchor kinds.

**It does not establish, and must not be read as:**

- **Any CharacterOS evidence.** `uses_characteros_canonical_state: false`,
  `contains_treatment: false`, `may_be_used_as_characteros_evidence: false`. The stimuli are hand-written
  fixture bytes, deliberately unrelated to the CAUTION proposition and to the D1 arms.
- **Any belief-state sensitivity.** No HIGH/LOW/NEUTRAL contrast was run; none of the experimental
  credences appeared in any stimulus.
- **Any breakpoint localisation.** The causal chain `canonical_belief → projection → semantic_uptake →
  appraisal → structured_decision` was not traversed. `causal_breakpoint_localised: false`.
- **That the readout survives the production frame.** The qualification stimuli contain a full production
  system prompt and a full production subject-data block, so the readout is not frame-free — but the
  belief block here is the *only* belief content, with no competing observation text specific to the
  fixture. Whether the instrument reads the belief block when it must share attention with a rich
  scenario and a task is exactly the question the A0 neutral pilot exists to answer.

The forbidden verdicts of this round were not emitted: no
`BELIEF_PROJECTION_STRUCTURAL_READOUT_NOT_ESTABLISHED`, no
`CHARACTEROS_CAUSAL_BREAKPOINT_*`, no `D2_STATE_SENSITIVITY_*`.

## 5. WHAT IS NOW LICENSED, AND WHAT IS STILL GATED

Licensed: `d2_a0_neutral_pilot_authorised: true` (round budget 6 calls, per the frozen plan),
still under the A0 gate.

Still gated behind the neutral pilot's noise ceiling: the A0 state experiment, A1, and B.
`d2_a0_state_experiment_not_started: true` and `d2_execution_stopped_at_qualification` is **not** set,
because the stop condition was not reached.

## 6. ARTIFACTS

`research/experiments/belief-causal-path-d2/evidence/run-001/a0-qualification/`

- `transformer-conformance-report.json` — the offline gate's full evidence, verdict
  `D2_A0_TRANSFORMER_CONFORMANT`
- `qualification-fixture-manifest.json` — fixtures as frozen in REV1.1b, `rewritten_at_runtime: false`
- `fixture-{A,B,C}-request.json` — the three frozen requests with their hashes
- `trial-001.json` … `trial-009.json` — one file per call, written immediately, never rewritten
- `qualification-dataset.json` (`scored: false`) and `qualification-dataset-hash.json`
  (`frozen_before_scoring: true`)
- `qualification-counts.json`, `qualification-modal-report.json`, `qualification-verdict.json`
- `A0_QUALIFICATION_MANIFEST.json`

No credential appears in any artifact (scanned). D1 evidence untouched — still
`CONTRAST_NO_MOVEMENT` on all five blocks, dataset `sha256:02bd7e31…`. Typecheck
(`tsc -p tsconfig.auxiliary.json`) and `eslint --max-warnings 0` clean; `pnpm governance` PASS.
