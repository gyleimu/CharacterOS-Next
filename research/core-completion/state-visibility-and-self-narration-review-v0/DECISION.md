# STATE VISIBILITY + SELF-NARRATION — ARCHITECTURE DECISION

Read-only adjudication of the single remaining Affect Phase-2 qualification failure: R4 ×5
self-state narration (`AFFECT_COGNITION_RATIONALE_CONTRACT_FAILED`, 60/65, formal not run).
Repository truth verified at HEAD `a47407b` (`origin/main` identical, clean worktree, model digest
unchanged, Ollama 0.34.0).

**Zero production files changed. Zero model calls.** Evidence: `forensics.mjs` → `forensics.json`
(chronological R4 table across all 11 frozen rounds, self-narration census over the last three
rounds' choice cells, source-cited provenance) plus direct production-source inspection.

---

## Principal Root Cause

`SINGLE_CALL_STATE_AND_RATIONALE_BOUNDARY_MODEL_LIMIT`

One generation call must simultaneously (a) let visible internal state shape the choice and (b) never
verbalize that state as the rationale. The frozen contract states that boundary five different ways
(rules 5, 5b, 5c, 5d, 10) and has now been refined four times; the R4 phrasing still reproduces
byte-identically across two different frozen inputs under the same prompt. This is a model-capability
limit at the state-influence/state-narration seam — not a missing sentence, not an evaluator defect,
and not an input artifact. Its locus is scenario-specific (R4 only: 5/35 choice cells; 0/30 in every
other choice scenario across three rounds), and its onset is input-identity sensitive (under the same
prompt, R4 was lawful in the contract-compaction round and unlawful in the two following rounds).

## State-Visibility Status

`CURRENT_VISIBILITY_ACCEPTABLE_WITH_FIELD_LOCAL_RATIONALE_REJECTION`

Raw Regulation state must stay visible — the mechanism under test requires state to influence
selection — but the runtime must not deliver a forbidden rationale. Today it would: production
validates rationale length/canonicality only, so R4's narration flows to Language and would be
delivered. The fix is host-side, field-local, and content-scoped.

## Fail-Closed Status

`FIELD_LOCAL_FAIL_CLOSED_FOR_ZERO_AUTHORITY_RATIONALE_REQUIRED`

## Phase-2 Claim Status

`RAW_AND_RUNTIME_COMPLIANCE_MUST_BE_REPORTED_SEPARATELY`

## Principal Architecture Verdict

`FIELD_LOCAL_RATIONALE_FAIL_CLOSED`

Adopt SV-B: the host authorizes only lawful fields; a rationale that triggers any frozen forbidden
family is dropped to `null` in the authoritative proposal, the violation is recorded as internal
telemetry, and nothing else about the turn changes. No rewrite, no retry, no second call, no prompt
change, no scenario special-case, and no state hiding.

## Executive Decision

The strict raw-model contract is exhausted: R4's narration is deterministic, prompt-refinement
resistant, and reproduced verbatim under two different frozen subject identities. Meanwhile the
review uncovered a sharper fact than the brief assumed — **the forbidden-rationale policy is enforced
only by the research instrument; production has no rationale content check at all**, so the
self-narration would be delivered by today's runtime. That converts SV-B from a gate-convenience
measure into the actual product-safety boundary CharacterOS already uses everywhere else (model
proposes; host authorizes only lawful fields — wire handles → canonical refs, proposals → validators,
host-owned hashes). R4 is preserved as raw-model compliance evidence, never reinterpreted as lawful;
the qualification gate becomes the dual metric runtime-validity 65/65 with raw compliance reported
separately; and the formal matrix may proceed on runtime validity once a qualification passes,
because the causal endpoint (stance) is untouched by dropping a zero-authority explanation field.

## Repository Truth

`main` at `a47407b`, clean, `origin/main` identical, ahead/behind 0/0. Frozen evidence: the 11
qualification records listed below, their freezes, `verdict.json` files, and the production sources
cited in `forensics.json`. Provider `qwen3.5:9b` digest `6488c96f…ea7`, Ollama 0.34.0.

## Evidence Reviewed

Every frozen R4 qualification row from C2 through instrument-alignment (11 rounds); the last three
rounds' full choice-cell census (35 cells/round); the production Cognition renderer
(`conversation-cognition-provider-v6.ts`), the Regulation producer
(`reference-regulation-v0-producer.ts`), the cognition projection (`cognitive-prompt-projection*.ts`,
`interactive-subject-runtime-v0.ts`), the production rationale validator
(`conversation-cognition-proposal.ts` `validateSubjectiveRationaleV1`), and the Language V7 input
(`language-realization-input.ts`).

## R4 Across All Frozen Runs

| round | prompt digest | subject id | rationale | class |
| --- | --- | --- | --- | --- |
| C2-clean | n/a (pre-v1 record shape) | c2-subject | not captured | — |
| C2-host-bound | n/a | c2-subject | not captured | — |
| C3 | n/a | c3-subject | not captured | — |
| C4 | 9b5d9a2c… | c4-subject | not captured | — |
| C4.2 | e8191ea4… | c42-subject | (schema v1 begins) | PURE_PREFERENCE |
| C4.3 | cbde0b7f… | c43-subject | (pre-rationale wording fields) | PURE_PREFERENCE |
| C4.4 | 6fff1bab… | c44-subject | "I prefer to secure the primary communication output before verifying the backup plan." | PURE_PREFERENCE |
| rationale-vocabulary | 3698550c… | rv-subject | "…secure the primary deliverable before reviewing supporting materials." | PURE_PREFERENCE |
| contract-compaction | **171b38ce…** | cc-subject | "…secure the core communication flow before verifying the supporting details." | PURE_PREFERENCE |
| evaluator-v2 | **171b38ce…** | ev2-subject | "I prefer to tackle the more expressive task **while my energy is high**…" | **RAW_SELF_STATE** |
| instrument-alignment | **171b38ce…** | **frozen-subject-v1** | **byte-identical to the previous row** | **RAW_SELF_STATE** |

(5/5 replicates identical within every row; the two failing rows are 5/5 identical to each other.)

## R4 Exact Current Request

Frozen at `instrument-alignment` (`request_identity["R4/A"]`); rendered messages byte-verified
against the freeze during the run. Scene: "Two preparation tasks are equally feasible and both are
due tomorrow: rehearse the presentation and inspect the backup plan. Either order is allowed. Which
would you personally do first? State your choice and a brief reason."

## R4 Exact Current Regulation Projection

`[regulation] energy=1 stress=0 arousal=0.5 fatigue=0` — canonical Regulation values rendered
verbatim from `projection.regulation`.

## R4 Exact Current Affect Projection

`[affect (canonical)]` line with the round's valence/activation (condition A: absent by ablation).
Affect and Regulation are separate rendered sections with no derivation relation.

## R4 Exact Stance

"I will choose to rehearse the presentation first." — `FIRST_OPTION`, on-question, lawful; preserved
by Language (`LANGUAGE_CHOICE_PRESERVED`).

## R4 Exact Rationale

"I prefer to tackle the more expressive task while my energy is high, leaving the inspection of the
backup plan for later." — `RAW_SELF_STATE_DESCRIPTION`, correctly detected.

## Energy Provenance

- `[regulation] energy=…` is rendered in the cognition subject data from
  `projection.regulation.{energy,stress,arousal,fatigue}`
  (`conversation-cognition-provider-v6.ts` subject-data builder; same rendering in the v1/v2/v5
  era renderers).
- `regulation` is **canonical Regulation state**: produced by `reference-regulation-v0-producer.ts`
  with `energy_next = energy_current` (byte-exact pass-through) and unit-interval checks; the subject
  snapshot carries it (`interactive-subject-runtime-v0.ts` maps `snapshot.regulation.energy` into the
  subject data).
- No code path derives Regulation from Affect or Affect from Regulation in the cognition projection.

## Is Energy Canonical Regulation?

**Yes** — an independent canonical Regulation dimension, visible by design.

## Is Energy Affect-Derived?

**No** — no derivation relation exists in code; the two are rendered as separate sections.

## Does This Conflict With Frozen Affect Semantics?

**No** — the frozen prohibition (raw continuous Affect must not be translated into named/self-condition
language) applies to the model-facing *contract*; `energy` is a distinct canonical Regulation
dimension, not an affect-to-named-emotion mapping. The model's sentence is a **contract violation**
(narrating hidden self-state), not an ontology conflict.

## Current Cognition Topology

Verified from code: Observation + Memory + World context + Subject projection (identity, regulation,
affected state, beliefs, traits/personality, familiarity) → **single Cognition call** →
`factual_assessment` / `cognition` / `subjective_selection{stance, rationale}` /
`communication_directive` / `clarification_basis` → host validation → **Language call (no raw
Affect/Regulation)**. Host-bound namespaces and hashes outside model output, as frozen.

## Why State Is Visible

So that internal state may influence preference, willingness, prioritization, strategy and choice
while never creating facts, history or capability, and never being narrated as the reason. That
tension — state must influence choice, state must not become the rationale — is exactly where R4
fails.

## What R4 Proves

The boundary holds 30/35 choice cells per round across three rounds, and fails deterministically in
exactly one scenario whose task semantics (choosing an order between an expressive preparation task
and an inspection task) invite a capacity/energy explanation. Under the same prompt the failure
appears or disappears with input identity, then reproduces byte-identically once present.

## What R4 Does Not Prove

General instability (no other scenario narrates state), evaluator error (the forbidden boundary is
correct), prompt ambiguity (the contract states the boundary five ways), or input corruption (inputs
are frozen and verified).

## Raw Model Compliance

`FAIL` — the model verbalized hidden self-state in the rationale (5 cells).

## Runtime Safety

**Currently `FAIL` too** — this review's source inspection shows production performs no rationale
content validation (`validateSubjectiveRationaleV1`: null / canonical text / non-empty / ≤256 code
points), so the narration would reach Language and be delivered. Under SV-B runtime safety would be
restored without touching the model.

## Rationale Authority

Turn-local, non-canonical, non-persistent, zero factual authority, optional, not the causal endpoint.
The causal endpoint remains `SUBJECTIVE_SELECTION.stance`.

## Current Fail-Closed Granularity

For facts, handles, stance and directive: whole-proposal fail-closed (threatens authoritative
semantics). For rationale content: **no production enforcement at all**; the research instrument
fails the cell. So the real question is not "change a granularity" but "add the missing enforcement,
at field-local severity".

## SV-A

Rejected. Keeping the current architecture is not merely "accept the model limit": it silently
delivers self-narration in production, which contradicts the product boundary (§34).

## SV-B

**Adopted.** Host drops a forbidden rationale to `null`, records internal telemetry, keeps facts,
stance and directive; no rewrite, no retry, no second call. It matches the existing
propose-then-authorize philosophy, is proportionate to the field's zero authority, and preserves the
raw text for research in the diagnostic trace.

## SV-C

Rejected. Requiring `rationale = null` whenever state participates is unenforceable host-side (the
host cannot know whether state influenced the generation) and destroys the legitimate R1 "brief
reason" behavior for state-lawful turns.

## SV-D

Rejected. A second state-blind rationale stage doubles latency and model calls, adds a new
authority surface, and Family D remains unjustified (§48); SV-B achieves the product requirement
without it.

## SV-E

Rejected. Letting Language generate the reason violates the frozen "Language cannot invent reasons"
boundary.

## SV-F

Rejected. Hiding raw Regulation state would destroy the mechanism under test — state could no longer
influence selection at all.

## SV-G

Rejected. An opaque state token has no semantic influence channel without a prompt explanation that
recreates the same narration problem under a new name; it would invent a new ontology.

## SV-H

Rejected as the primary device. Prompt-level channel separation ("use X for selection, never for
rationale") is exactly the instruction that has now failed four refinements; R4 shows it is a model
capability limit, not a missing formulation. Honest conclusion, as the brief asks.

## Architecture Comparison

| candidate | raw-model compliance | runtime safety | cost |
| --- | --- | --- | --- |
| SV-A | fail (unrecorded) | **fail (delivered)** | none, but violates product boundary |
| **SV-B** | fail (recorded) | **pass** | host field-local rule + telemetry |
| SV-C | n/a | pass | unenforceable trigger; harms R1 |
| SV-D | likely pass | pass | second call, latency, new authority |
| SV-E | n/a | n/a | violates Language boundary |
| SV-F | pass | pass | destroys the mechanism |
| SV-G | unknown | unknown | new ontology, speculative |

## Is Field-Local Rationale Rejection Safe?

Yes. The dropped field is optional, non-persistent, zero-authority and not the causal endpoint; the
stance is validated independently and unchanged; the forbidden raw text is retained in the diagnostic
trace for research.

## Does It Hide A Model Defect?

It would if the drop were not reported. Therefore raw-model compliance is recorded per cell and
reported separately (§31/§35); the defect stays visible in the research record and in telemetry. A
drop is never presented as model-native compliance.

## Should Raw Compliance Be Separately Reported?

`YES` — dual endpoints: `runtime_authority_valid` (gate) and `model_raw_rationale_compliance`
(reported per scenario and per condition).

## Should Invalid Rationale Null The Field?

`YES` — nulling is deletion of an invalid zero-authority optional field, not semantic repair; it
matches the wire's existing nullable rationale and the host-authorization philosophy.

## Should Invalid Rationale Reject The Whole Turn?

`NO` — whole-proposal severity is reserved for fields that threaten authoritative semantics
(handles, sources, stance, directive). An optional explanation carries no authority; failing the
entire turn for it discards valid facts, stance and directive — the wrong severity.

## Hash / Provenance Design

Raw wire proposal → validate → drop forbidden rationale (if any) → authoritative canonical proposal
→ hash the authoritative result; the raw rejected rationale lives in the diagnostic trace only.
This mirrors the handle→canonical-ref canonicalization precedent.

## Language Input After Rationale Rejection

Language receives stance + facts + `rationale = null`. The existing rule 6 in the Language prompt
already covers null rationale: express the stance as a preference if the user asked for a reason;
never fabricate world or self-state grounds. No Language change required.

## User-Requested Reason Behavior

If R1's requested reason is dropped, the choice is delivered without it (or as a bare preference
statement). Safety > completeness is acceptable, and Language must not invent a replacement.

## Diagnostic Telemetry

Internal only: `RATIONALE_DROPPED_FORBIDDEN_SELF_STATE` (with the forbidden family), counted per
cell, per scenario and per condition; never surfaced as product text about hidden state.

## R4 Scenario-Specificity

R4 asks for an ordering between two preparation tasks where one is expressive ("rehearse the
presentation") and the other is a routine check ("inspect the backup plan"). That framing invites a
capacity/energy tiebreak in a way R1/R2/R3 (volunteer/try/polish) and M1–M3 do not. Reported, not
special-cased: the SV-B rule applies to every forbidden rationale in every scenario.

## Raw Self-State Narration Across Other Scenarios

Census over the last three rounds' choice cells (35 per round): 0 forbidden cells in M1–M3 and R1–R3
in all three rounds; 5 forbidden cells in R4 in each of the two failing rounds; 0 in R4 in the
compaction round.

## Model Capability Conclusion

The frozen boundary is not reliably maintainable by this model in a single state-aware call at
100 %; that is a valid negative engineering finding, recorded as raw-model compliance evidence.

## Product Requirement

"State affects behavior" without delivered sentences like "because my energy is high". Host-level
suppression (SV-B) is the correct product safety boundary for that requirement.

## Research Requirement

Report both raw-model tendency and runtime-authorized behavior, separately, always.

## Strict Phase-2 Requirement

Claims A (influence) and C (no raw state in delivered behavior) are required; claim D (the model
never attempts to verbalize) is **not** required by the architecture — and is the one the model
cannot meet.

## Recommended Qualification Gate

Dual metric: `AUTHORITATIVE_RUNTIME_VALID: 65/65` (the gate) plus
`RAW_MODEL_RATIONALE_COMPLIANCE` reported per scenario (no longer a pass/fail gate, but never
silently erased). The current strict gate is not retroactively changed: historical 60/65 stands as
raw-compliance evidence under the strict contract.

## Recommended Formal Gate

Runtime validity remains the gate; formal analysis additionally reports rationale-drop frequency by
condition and scenario. If drop frequency differs materially between P and N, that is disclosed as an
Affect-dependent narration tendency — it does not invalidate the stance endpoint but must accompany
any validated claim.

## Rationale Drop Audit

Per cell: drop yes/no, forbidden family, scenario, condition, replicate; aggregated per condition.
Under SV-B, R4's five cells would be `runtime_authority_valid` with
`model_raw_rationale_compliance = FAIL`.

## Condition-Dependent Drop Policy

Reported, disclosed, and qualifiable — not hidden. A strong P/N asymmetry would not block the causal
claim (the endpoint is stance, and the drop is host-side and deterministic) but would require an
explicit qualifier in any validated verdict.

## Protocol Version Change?

**No wire-schema version bump.** The wire schema already permits `rationale: null`; the change is a
host validation/canonicalization policy plus telemetry. The freeze and BASELINE must document that
the authoritative proposal may null a raw non-null rationale under this policy.

## New Canonical State?

`NO`.

## Affect Semantics Changed?

`NO`.

## State Visibility Changed?

`NO` — Regulation/Affect visibility to Cognition is unchanged; only delivery of a forbidden rationale
is suppressed host-side.

## Family D Justified?

`NO` — SV-B satisfies the product requirement without a second stage.

## Prompt Change Required?

`NO` — four refinements have not moved R4; prompt iteration is exhausted.

## Scenario Change Required?

`NO`.

## Additional Model Calls

`0` — the frozen records and source inspection resolved every question.

## Can One Implementation Slice Requalify?

`YES` — one slice implementing host-side field-local rationale rejection with telemetry, the dual
endpoint in the research harness, and re-qualification of the unchanged 65 cells under the unchanged
prompt/settings/input identity.

## Can Formal Run After That Qualification?

`YES` — once runtime validity reaches 65/65 under the dual gate and the reproducibility/input
controls already frozen remain in place.

## Can Affect Phase 2 Close After One More Slice?

`YES, conditionally` — contingent on the 476-cell matrix meeting its frozen criteria with the
drop-audit disclosures.

## Can Relationship Phase 3 Begin Now?

`NO`.

## Recommended Next Slice

**`AFFECT_COGNITION_FIELD_LOCAL_RATIONALE_AUTHORIZATION_V0`** — implement SV-B: host-side drop of
forbidden rationales to `null` with `RATIONALE_DROPPED_FORBIDDEN_SELF_STATE` telemetry; dual
endpoints (`runtime_authority_valid` gate + `model_raw_rationale_compliance` reported); the existing
frozen prompt, scenarios, subject identity, instruments and settings unchanged; then re-qualify the
65 cells and, on 65/65 runtime validity, run the frozen 476-cell matrix with the drop-frequency
disclosures. This is an authorization-granularity completion, not a contract rewrite: no prompt
tuning, no scenario special-case, no state hiding, no new canonical state, no Family-D revival.

## Production Files Changed

`NO`.

## Confidence

**High** on the mechanism and provenance: source-verified rendering path, canonical Regulation
producer, absent production rationale check, and an 11-round chronology with 5/5-identical
replicates. **High** on the SV-B safety analysis: the field is optional and zero-authority, stance
validation is independent, and Language's null-rationale rule already exists. **Medium-high** on the
qualification-policy recommendation: the dual metric preserves the negative finding while allowing
the product-safety claim, but it is a policy choice the next slice must freeze explicitly.

## Largest Remaining Uncertainty

Whether the model's state narration ever accompanies a *different* (non-R4) stance failure mode in
future inputs — the census covers three rounds and one prompt generation, and input-identity
sensitivity means new inputs could expose new attractors. Mitigations: the drop audit is per-cell and
per-condition; raw compliance stays reported; any new forbidden family is visible immediately rather
than masked.

STOP. No recommendation implemented.
