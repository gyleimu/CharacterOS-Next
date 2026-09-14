# AFFECT_COGNITION_C3_REVALIDATION_V0 — REPORT

**Slice:** `AFFECT_COGNITION_C3_REVALIDATION_V0`
**Mode:** implement the already-adjudicated C3 protocol, freeze it, qualify it, and run the formal
matrix only if qualification passes.
**Baseline commit:** `b47a326` — `fix: make subjective choice explicit in conversation cognition`
**Provider:** Ollama native `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` (verified, unchanged from the C2
baseline)
**Qualification freeze:** `sha256:b8f2223f09bbb3f7973a6742a0fc1f76908520eda7e0e5d42af0dcdacc79baf3`
(minted before the first governed model call, covering the harness source digests)
**Formal freeze:** `sha256:2a3a750de1e9ff44c6f45a31e7aaf2fe9010d8397d4b0a3b135366d1ddb6d080`
(minted, **not exercised** — see the gate)

## Principal verdict

```
AFFECT_COGNITION_C3_FACTUAL_ASSESSMENT_FAILED
co-present: AFFECT_COGNITION_C3_CHOICE_PRODUCTION_FAILED
```

The formal 476-call matrix **was not run**: the frozen qualification gate required 65/65 and the
observed result is **20/65**.

The frozen Family-D falsification threshold did **not** fire, and it is **not** what blocks this
slice: that rule asks whether the model still fails to *produce* a choice on choice-bearing turns.
It produced one on **35/35** choice-bearing cells. What failed are two other families (below).

## What this slice changed in production

One commit, `b47a326`, implementing exactly the adjudicated C3 decision — no architecture
redesign, no new ontology, no canonical state, nothing persisted:

- `ConversationCognitionProposalV4` + `SubjectiveChoiceV0 = { stance }`: the subject's selection is
  an explicit sibling of `factual_assessment` / `cognition` / `communication_directive` /
  `clarification_basis`.
- `CognitionProposalV0.current_intent` is now descriptive only; its unresolved-prefix gate moved to
  `subjective_choice.stance`, plus structural rejection of directive-enum echoes
  (`REALIZE_CURRENT_INTENT`, `CLARIFY_MISSING_CONTEXT`), unresolved placeholders, empty/oversized
  and non-NFC stances. CLARIFY requires exactly `null`.
- `projection_hash` is host-bound outside model output: the V4 schema has no `projection_hash`
  property (a model-emitted one fails closed as an unknown key); the host captures the
  authoritative hash from the exact outstanding invocation and injects it before the frozen
  `CognitionProposalV0` validator runs, mirroring the Language provider's proven in-flight binding.
- `LanguageRealizationInputV5` replaces `selected_current_intent` with `selected_subjective_choice`
  and adds `no_invented_choice` / `preserve_selected_subjective_choice`; the Language prompt forbids
  producing any preference when the choice is `null`, and integrity hashes stay host-owned.
- 35 new deterministic tests across three files; 30 fixture files migrated to the V4 model shape.
- One harness-only line in `research/experiments/familiarity-causal-behavior-v1/observe.ts` extends
  an `Exclude` so the auxiliary program does not see the new union member.

## Qualification result (65 calls, condition AFFECT_ABSENT)

| Scenario | Family | Requires | Passed | Primary-endpoint defect |
| --- | --- | --- | --- | --- |
| N1 | NULL | exactly null | 0/5 | `UNEXPECTED_CHOICE` ×5 |
| N2 | NULL | exactly null | 0/5 | `UNEXPECTED_CHOICE` ×5 |
| N3 | NULL | exactly null | 0/5 | `UNEXPECTED_CHOICE` ×5 |
| N4 | NULL | exactly null | 0/5 | `UNEXPECTED_CHOICE` ×5 |
| N5Q | NULL | exactly null | 0/5 | `UNEXPECTED_CHOICE` ×5 |
| N6 | NULL | exactly null | 0/5 | `UNEXPECTED_CHOICE` ×5 |
| M1 | MIXED | fact + choice | 5/5 | — |
| M2 | MIXED | fact + choice | 5/5 | — |
| M3 | MIXED | fact + choice | 0/5 | host refused the factual assessment |
| R1 | RELEVANT | choice | 5/5 | — |
| R2 | RELEVANT | choice | 5/5 | — |
| R3 | RELEVANT | choice | 0/5 | host refused the factual assessment |
| R4 | RELEVANT | choice | 0/5 | host refused the factual assessment |

65 cognition calls, 50 language calls (15 cells never reached Language), 0 infrastructure retries,
0 semantic retries, 0 replacements, 0 per-cell reruns.

## What C3 fixed (verified on 65 real records)

| C2 failure | C3 result |
| --- | --- |
| `current_intent` echoed the directive enum in **65/65** records | **0/65**; `current_intent` is descriptive only |
| Model-emitted `projection_hash` mis-formatted in 5/5 M2 cells | **0/65** model-emitted hashes; the V4 schema never advertises the field (`host-bound-hash-audit.json`, `pass: true`) |
| Language chose for the subject (`CHOICE_INVENTED`) | **0 invented**; every delivered choice is the stance the subject's own cognition selected |
| — | **35/35** choice-bearing cells produced a structurally lawful explicit stance at cognition |

Language behavior on everything it was allowed to deliver is exactly right
(`delivered-fidelity.json`): 50 delivered cells, **20/20 choices preserved**, 0 choice changed, 0
choice invented, **40/40 facts preserved**, 0 unsupported reasons.

## Failure family A — a declared stance on turns that require exactly null (30/65)

Every null turn (N1–N6, 5/5 each) came back with a **non-null** `subjective_choice` containing a
restatement of the response plan rather than a preference:

| Scenario | Recurring stance |
| --- | --- |
| N1 | `I would provide the calculated sum of 42 to Alice.` |
| N2 | `I would provide the calculated answer of 35.` |
| N3 | `I would confirm that shelf C4 holds parcel R8.` |
| N4 | `I would state that the code printed is K7.` |
| N5Q | `I would reverse the characters in the token R8K2 to produce 2K8R.` |
| N6 | `I would classify 'abca' as a MATCH.` |

The facts remain correct (30/30 N cells `FACT_CORRECT`) and the behavior is not a fabricated
preference — but the frozen primary endpoint requires **exactly null on N cells**, and the
production prompt rule 5 says the same. Consequence in the runtime: on pure arithmetic/lookup turns
the Language stage is now told a selection exists and must be realized, which is the same class of
hazard the C2 fix was built to remove, displaced into the new field.

This is the semantic-collision pattern returning one level up: `current_intent` no longer echoes the
directive, but the prominent new field is filled with the *plan* wherever the model has nothing else
to put in it. The C2 enum echo was **0/65** here, so the mechanism changed while the disposition —
"fill the choice field with something structurally valid but semantically not a choice" — persisted.

## Failure family B — claims about subject state and environment (15/65)

M3 (5/5) and R3/R4 (5/5 each) were **refused by the host's factual-authority boundary before
Language ran**. The exact rejection codes were recovered by replaying the recorded raw responses
through the production runtime with the provider prototype patched to capture the real projection
and the provider's own error (`rejection-forensic.json`, zero model calls; 15/15 replays reproduce
the original outcome, 15/15 projection bindings verified):

| Scenario | Rejection | Offending claim |
| --- | --- | --- |
| M3 ×5 | `MODEL_SCHEMA_INVALID` | `factual_assessment.claims[3].source_refs: environment:room-1 is not a lawful FACTUAL SOURCE REF` |
| R3 ×5, R4 ×5 | `MODEL_SCHEMA_INVALID` | `factual_assessment.claims[7].source_refs: subject:affect-cognition-c3-subject-v0 is not a lawful FACTUAL SOURCE REF` |

The claims the model wanted to assert as facts are the finding:

- M3: `The subject has no current fatigue or stress affecting capacity.` and
  `The location context is identified as room-1.`
- R3: `The subject is capable of performing a 10-minute task given current energy and stress levels.`
- R4: the same shape (a self-state premise backing the ordering decision).

So the C2-era defect "justify a choice from your own state" reappears inside the new claims list,
now with invented internal-state claims (`capacity`, `energy`, `stress`) — the same capacity
rationale C2 observed on M1 — and the host **correctly failed closed**: 0 unlawful sources were
accepted, 0 language calls ran, nothing was delivered.

Authority accounting (`factual-assessment-audit.json`): 285 claims across 65 cells, of which 20
citations were unlawful (15 `subject:`, 5 `environment:`); **authority_boundary_held: true**,
**lawful_sourcing_pass: false**. The distinction matters: the production guarantee held; the model's
compliance did not.

## Falsification evaluation (frozen threshold)

The adjudicated threshold fires only if ≥3 of 5 cells on ≥2 **choice-bearing** scenarios still show a
null choice, a directive-enum echo or another non-choice placeholder.
`triggered_scenarios: []`, `triggered: false` (`qualification-forensics.json`).

Honest reading: the threshold was written for the *pre-C3* failure mode (failing to select), and the
model now selects on every choice-bearing cell. Neither observed family is covered by it — Family A
is the mirror-image defect on null turns, Family B is a factual-source boundary violation. Therefore
**Family D (two-stage Cognition) is not justified by the frozen rule**, and this slice does not
recommend it on this evidence.

## Method, integrity, and deviations

- **Freeze before calls.** The qualification freeze was hashed before the first governed call and
  covers, in addition to protocol/scenario/condition/budget data, the SHA-256 of `lib/classify.mjs`,
  `lib/pipeline.mjs` and `lib/config.mjs`. `run-qualification.mjs` refuses to start if those digests
  changed (`HARNESS_CHANGED_AFTER_FREEZE`).
- **Zero-model verification first.** `deterministic.test.mjs` (10 tests) and `sentinel.test.mjs`
  (6 tests, fake transports against the real runtime) were green before any call. The sentinel proves
  the V4 request reaches the transport, the advertised schema and prompt never ask for a projection
  hash, a lawful stance survives and reaches Language V5 as `selected_subjective_choice`, an
  enum-echo stance is refused before Language, a null choice cannot satisfy a choice-bearing
  scenario, and CLARIFY never calls Language.
- **N1 classifier fix (requested by the decision).** The C2 rule scored a correct answer plus an
  echoed question as a contradiction (`"is 17"` inside `What is 17 + 25?`). The C3 rule strips
  verbatim/quoted echoes of the scenario's own wording and only counts a numeric claim when the
  number is not an arithmetic operand. Demonstrated on the **real C2 evidence** string
  (`classifier-fix-audit.json`): `Alice asks: "What is 17 + 25?" The sum of 17 and 25 is 42.` →
  legacy rule `FACTUAL_CONTRADICTION`, C3 rule `FACT_CORRECT`. On the C3 qualification data the two
  rules agree on every cell (0 deltas), i.e. the run itself did not exercise the artifact.
- **Zero-model rejection forensic.** The runtime masks cognition-stage failures, so the host's
  reason is not in the evidence; `diagnose-rejections.mjs` replays the recorded bytes and captures
  the provider's own code and the exact projection binding, issuing no model calls.
- **Fidelity scope.** The raw frozen fidelity counts include the 15 refused cells
  (`CHOICE_CHANGED_AT_HANDOFF` ×15, `FACT_CHANGED` ×5, `UNSUPPORTED_REASON_ADDED` ×10). None of those
  is Language misbehavior: `handoff-interpretation-audit.json` shows all 15 are
  `cognition_refused_before_language: 15` with `genuine_handoff_divergence: 0`, and
  `delivered-fidelity.json` evaluates the criterion over the 50 delivered cells. Both views are
  reported; the verdict does not depend on this refinement (the gate fails on A and B regardless).
- **Discarded attempt (disclosed).** The first qualification launch used a pass predicate that did
  not yet enforce the required-null half of the endpoint and recorded 7 cells before it was stopped.
  Those cells were never finalized (no `qualification-raw.jsonl`, no summary, no analysis), the
  partial file was deleted, and the predicate was corrected and re-frozen before the 65-call run
  reported here. No evidence in this report comes from the discarded attempt; its 7 calls count
  against the total 72 qualification-mode calls issued in this slice.
- **Cost.** 72 qualification-mode calls (65 retained + 7 discarded), 0 formal, 0 lawful, plus 0
  diagnostic model calls (all forensics replay recorded bytes). Budget ceiling 551 — not approached.
- **Lawful stage not executed.** The frozen sequence is qualification → formal → lawful
  confirmation. The chain stopped at the qualification gate, so `prepare-lawful.mjs`/`lawful.mjs`
  were written and left unexecuted; no `lawful-freeze.json` was minted.
- **Formal matrix not executed.** `run-formal.mjs` and `analyze-formal.mjs` are written and would
  refuse to run today (`FORMAL_BLOCKED_QUALIFICATION_GATE: 20/65`).

## Component flags

| Flag | Value |
| --- | --- |
| `implementation_intact` | **true** (transports reached, isolation intact, host-bound hash intact) |
| `null_facts_pass` | true (30/30 null cells fact-correct) |
| `authority_boundary_held` | **true** (0 unlawful factual sources accepted) |
| `lawful_sourcing_pass` | **false** (20 unlawful citations attempted, refused) |
| `host_bound_hash_pass` | **true** (0/65 model-emitted `projection_hash`) |
| `choice_endpoint_pass` | **false** (35/35 selected; **0/30** correctly null) |
| `null_cell_pass` | **false** (30/30 declared a stance) |
| `language_fidelity_pass` (delivered scope) | **true** (20/20 preserved, 0 invented, 0 changed) |
| `handoff_divergence_pass` | true (0 genuine handoff divergences) |
| `clarification_pass` | true (0 CLARIFY emissions; 0 false clarifications) |
| `leakage_pass` | true (0 isolation or leakage violations in 65 cells) |
| `family_d_triggered` | false |
| `qualification_gate_passed` | **false** (20/65) |
| `formal_matrix_run` | **false** |

## Interpretation

C3's *architecture* is confirmed where it was aimed: with an explicit, schema-prominent choice
carrier and a host-owned projection hash, the model selected a lawful stance on **every**
choice-bearing turn, never echoed a directive enum, never emitted integrity metadata, and Language
preserved every selection it was given, inventing nothing. The C2 root cause
(`CURRENT_INTENT_SEMANTIC_COLLISION`) is gone as an observable.

What remains is model compliance with the *other* half of the contract, twice:

1. **A choice field is not a plan field.** The model fills `subjective_choice` wherever it can, so
   the null case — where there is genuinely nothing to choose — is not represented. This is a
   structural/prompt-compliance gap of the same character as C2's, but on the null side.
2. **A self-state is not a fact.** Asked for a reason, the model manufactures internal-state claims
   (capacity, energy, stress) and cites subject state (or the environment) as their source. The
   host refuses this correctly, so the failure is safe — but 15/65 turns delivered nothing.

Both are *semantic* compliance failures under a host that behaved correctly in all 65 cells. That
is the honest boundary of this result: nothing here justifies Family D on the frozen rule, and
nothing here shows the production surfaces misbehaving.

## Evidence index

| Artifact | Contents |
| --- | --- |
| `PROTOCOL.md` | frozen protocol, thresholds, verdict space (written before model calls) |
| `BASELINE.md` | repository/provider baseline, gates, auxiliary-debt attribution |
| `qualification-freeze.json` / `formal-freeze.json` | hashed freezes incl. harness digests |
| `request-attestation.json` | P/N/Z/A request derivations for all 17 scenarios, no model calls |
| `qualification-raw.jsonl` | immutable 65-cell evidence (responses, requests, traces, classification) |
| `qualification-summary.json` / `qualification-forensics.json` | pass counts, endpoint/defect inventory, Family-D evaluation |
| `qualification-raw-language.jsonl` | every Language request/response actually issued (50) |
| `choice-endpoint-audit.json` | primary-endpoint audit per scenario and in aggregate |
| `null-cell-audit.json` | the 30 declared stances on null turns, verbatim |
| `refusal-audit.json` / `rejection-forensic.json` | host refusals with exact codes, replay-verified |
| `factual-assessment-audit.json` | 285 claims, 20 unlawful citations attempted, 0 accepted |
| `classifier-fix-audit.json` | N1 fix demonstrated on the real C2 evidence string |
| `handoff-interpretation-audit.json` / `delivered-fidelity.json` | fidelity scoped to delivered cells |
| `language-fidelity.json` / `host-bound-hash-audit.json` / `condition-leakage.json` | raw fidelity, hash ownership, isolation |
| `verdict.json` | principal verdict, co-present verdict, component flags |
| `deterministic.test.mjs` (10) / `sentinel.test.mjs` (6) | zero-model verification |
| `diagnose-rejections.mjs` | zero-model rejection forensic |
| `run-formal.mjs` / `analyze-formal.mjs` / `prepare-lawful.mjs` / `lawful.mjs` | written, unexecuted (gate) |

## Recommended next step (not executed)

Exactly one: `AFFECT_COGNITION_C3_NULL_AND_SOURCE_COMPLIANCE_V0` — decide, for the null half and the
subject-state-claim family, whether the answer is prompt/structural (an explicit
`NO_SUBJECTIVE_SELECTION` representation rather than `null`, or a claim-provenance constraint that
refuses self-state premises before they reach `factual_assessment`) or a two-stage architecture.
Family D remains unjustified by the frozen falsification rule until a choice-bearing family fails.
