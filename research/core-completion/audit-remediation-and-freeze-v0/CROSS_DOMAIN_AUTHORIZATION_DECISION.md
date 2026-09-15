# CROSS_DOMAIN_AUTHORIZATION_DECISION — TASK 5

`AUDIT_REMEDIATION_AND_FREEZE_V0`. Read-only analysis + formal exemption record.
**Real model calls: 0. Production semantic changes: NONE.**

Baseline HEAD: `ae0a6bf1b1b9d3ae7d4f9a5dcf608ce8d0e8dd91` (`main`, clean).

---

## Question

The audit flagged the `EVIDENCE_SCALE × mean_activation` transfer performed by the
Relationship and Personality plasticity producers as an `ENGINEERING_BASELINE` that is
never routed through the cross-domain authorization machinery. Is that transfer:

- **A.** authorized by a formal cross-domain semantic comparability contract, or
- **B.** authorized only by a module-header prose declaration?

## Verdict

**B — module-header prose only.** The transfer is real, frozen, and bounded, but no formal
comparability contract authorizes it.

Evidence:

| Fact | Location |
| --- | --- |
| `scaled = round4(EVIDENCE_SCALE × aggregate.mean_activation)`; `step = min(MAX_SINGLE_STEP, scaled)` | `packages/runtime/src/transitions/relationship/relationship-plasticity-producer.ts:491-492` |
| `step = min(activePolicy.max_step, round4(activePolicy.evidence_scale × aggregate.mean_activation))` | `packages/personality/src/personality-plasticity-producer.ts:263` |
| `RELATIONSHIP_PLASTICITY_EVIDENCE_SCALE = 1`, `RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP = 0.05` | `relationship-plasticity-producer.ts:98-99` |
| `ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY = { eligibility_policy, max_step: 0.05, evidence_scale: 1 }` | `personality-plasticity-producer.ts:109-115` |
| The only cross-domain authorization artifact registers **one** scale, domain `BELIEF`, range `[-1,1]` | `packages/runtime/src/transitions/cognition-action/tendency-scale-contract.ts:620` |
| No comparability contract is registered; the gate returns `DENY` unconditionally | `tendency-scale-contract.ts:906-928` |
| Neither producer imports or calls the comparability gate | verified by repo-wide search |

Both producers carry the transfer in a module-header declaration
(`PLASTICITY KERNEL — ENGINEERING_BASELINE`, `PLASTICITY POLICY — ENGINEERING_REFERENCE_V0`),
which explicitly states the kernel is an engineering safety bound and **NOT** psychology.
Nothing in the code path consults the default-deny gate.

## Decision

The exemption is a **local explicit semantic authorization**, and that is the correct
classification under the frozen architecture. It is recorded formally here and pinned by
tests. No registry entry is added.

### Why the comparability registry is the WRONG carrier

`TendencyComparabilityContractV0` authorizes an operation **between participant tendency
scales** (`participant_scales`, `EXACT_SET`) drawn from the closed operation vocabulary
`COMPARE_ORDER / ADD / SUBTRACT_CANCEL / MEAN / MAX / TYPED_OVERRIDE / TYPED_VETO /
APPLY_SHARED_THRESHOLD` (`tendency-scale-contract.ts:65-74, 716-728`).

The `EVIDENCE_SCALE × mean_activation` transfer is none of those:

1. It is not a comparison between two domain scales — it maps a **single evidence-strength
   scalar** (`InfluenceEvidenceAggregateV0.mean_activation`, `[0,1]`, `influence-evidence`)
   onto a **bounded single-step delta** inside one target domain.
2. It does not consume the target domain's current value as a comparable quantity; the
   current value is only the base the bounded step is applied to.
3. Registering it would require inventing `TendencyScaleContractV0` entries for memory
   activation, relationship dimensions and personality dimensions — exactly the "new
   complex registry" the remediation brief forbids.

The exemption is therefore recorded as an explicit **local** semantic authorization with
exactly these frozen properties:

- **Frozen constants.** `evidence_scale = 1`, `max_step = 0.05`; both producers' values are
  source-controlled literals, never caller- or model-configurable, and the policy objects
  are deep-frozen.
- **Bounded output.** The step is `min(max_step, round4(evidence_scale × mean_activation))`,
  so the movement is bounded by `max_step ≤ 1` and the next value stays inside `[0,1]`
  regardless of the evidence magnitude.
- **No value fusion.** The transferred magnitude never becomes another domain's VALUE: the
  proposal carries a bounded `next_value` for the target dimension only. No field anywhere
  in the proposal carries `mean_activation`, `activation` or `evidence_scale`.
- **No general authorization.** The exemption authorizes no cross-domain *operation*: the
  default-deny gate still denies every operation between the memory evidence domain and the
  relationship / personality domains.

## Consequences for future work

- Any NEW cross-domain numeric transfer between different domains' semantics must go through
  the default-deny gate; the `ENGINEERING_BASELINE` exemption is not a precedent for
  arbitrary arithmetic.
- Any change to `evidence_scale`, `max_step`, or the eligibility thresholds is a change to
  this recorded exemption and requires its own review — the constants are pinned by test.

## Pinned by

`packages/personality/src/engineering-baseline-cross-domain-exemption.test.ts`
(5 checks: frozen constants; non-widenable bound and no extra policy channel; bounded
movement incl. saturation and a caller-widened `evidence_scale`; every cross-domain
operation still `DENY`; the magnitude never becomes a value).
