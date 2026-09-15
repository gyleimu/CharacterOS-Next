# BASELINE — repository truth before this slice (§3) and the §8 determination

Verified at the frozen Core head `64ec93d` by reading the source, not by trusting any
handoff. All claims are source-located; every one is re-proved by the zero-model
conformance suite in this slice.

## §3 Relationship truth (current source)

| Question | Answer | Where |
| --- | --- | --- |
| Feature registry | `REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0` holds **exactly one** entry: the interaction-familiarity semantics contract `relationship-interaction-familiarity-semantics-v0` (dimension id `relationship_core_interaction_familiarity_v0`) | `packages/runtime/src/transitions/relationship/relationship-feature-decision-semantics.ts:620-624,703-739` |
| Effective feature count | **1** (not zero). `REGISTERED_RELATIONSHIP_DECISION_FEATURE_COUNT` / `FIRST_RELATIONSHIP_DECISION_FEATURE_V0` do not exist under those names; the equivalent is the frozen id array + `GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0 = 1` | same file; `packages/runtime/src/authority/historical-writer-authority-registry.ts:567-581` |
| Semantic-only? | No — the semantics are registered AND admitted AND writable AND persisted AND projected AND decision-admissible. Storage-level opaque dimension ids are distinct from decision admission | `relationship-feature-decision-semantics.ts:825-845` |
| Writer authority | `relationship-governed-feature-writer-authorization-gate-v0` (one gate, LEVEL_2, dynamic registration FORBIDDEN) + `relationship-governed-feature-write-policy-v0` (one policy: `POSITIVE_EXACT_REGISTERED_BINDING_REQUIRED`, `removal_support: UNSUPPORTED`, `reinitialize_support: EXPLICIT_POLICY_PERMISSION_REQUIRED`) | `historical-writer-authority-registry.ts:165-307,559-581` |
| `relationship_core_*` write guard | SubjectCore membrane: reserved-target writes without a prepared governed token fail closed at the engine; structural clones, wrong-proposal, stale-revision and wrong-head tokens are rejected; removal, multi-target and non-governed token supply are rejected | `packages/subject-core/src/commit/engine.ts:418-510`, `writer-authority-membrane.ts` |
| Operations | `INITIALIZE` / `UPDATE` / `REINITIALIZE` with epoch law: INITIALIZE and REINITIALIZE mint a new epoch from the transition id, UPDATE inherits the **proven prior** epoch; the caller can never supply an epoch | `relationship-governed-writer-authority.ts:48-52,322-332`; `relationship-governed-write-authority-service.ts:31-33,225-308` |
| Evidence binding | `authority_payload.evidence_receipt_refs == proposal.cause_refs == delta.provenance_refs`, non-empty, unique, raw-ASCII sorted; familiarity evidence must be `appraisal:`-family receipts, never raw `episode:` refs | `relationship-governed-write-authority-service.ts:416-430`; `relationship-interaction-familiarity-evidence-receipt.ts:56-58,173-187` |
| Producer | Deterministic host computation: `processInteractionExperience` (canonical episode → verification → qualifying admission → deterministic receipt → accrual law → governed write evaluation → membrane token → the ONE Atomic Commit V2 pipeline). No LLM is needed for the value update | `relationship-interaction-familiarity-ingestion.ts:380-833` |
| Production wiring | Automatic per committed episode in the product/session paths; the admission provider is a dependency (model-backed in product, injectable in tests/harness) | `explicit-v4-session-authority-v0.ts:1479-1632`; `interactive-subject-runtime-v0.ts:625-628`; `product/sandbox/src/external-observation-ingress.ts:360-365`; `product/sandbox/src/product-provider-bundle.ts:152-158` |
| Projection | `interaction_familiarity` (13-field read projection: presence ABSENT/PRESENT, `canonical_value`, `ordinal_level`/`ordinal_max` 32, `STATE_VISIBLE_NOT_CITEABLE`) + `interaction_familiarity_cognition_influences` (`BASIC_CONTEXT_FIRST` / `COUNTERPART_CONTEXT_SEARCH_FIRST` at ordinal ≥ 2). Rendered into the conversation prompt verbatim; never citeable | `relationship-interaction-familiarity-read-projection.ts:87-101,188-212`; `relationship-interaction-familiarity-cognition-influence.ts:79-131`; `conversation-cognition-provider-v2.ts:222-239,275-276` |
| Persistence / restore | Canonical `RelationshipStateV0` inside the subject state; v4 authoritative restore re-materializes the exact head and validates the full commit chain | `packages/subject-core/src/types/subject-state.ts:101-124`; `explicit-v4-session-authority-v0.ts:398-495` |
| ABSENT | A counterpart may be registered with no familiarity dimension: `presence=ABSENT`, `canonical_value=null`, never 0 or 0.5 | read projection `:26-38,188-212`; rendered-prompt tests `relationship-interaction-familiarity-read-projection.test.ts:476-534` |

## §8 Value-semantics determination: ALREADY FROZEN — implement exactly

The frozen law (no invention was required or performed):

1. **Value type**: number on the k/32 grid (`UnitIntervalV0` ∈ [0,1]; only k/32 lawful),
   `RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0 = 32`.
2. **Initial semantics**: first admitted firsthand receipt → `INITIALIZE`, value `1/32`
   (never 0; ABSENT ≠ PRESENT 0).
3. **Update semantics**: `+1` credit per unique admitted firsthand receipt:
   `(k)/32 → (k+1)/32`; the credit lineage is the cumulative unique receipt set.
4. **Saturation**: 32/32 is the maximum; the 33rd qualifying receipt yields
   `QUALIFIED_BUT_SATURATED` with **no** proposal and **no** commit. No value above
   32/32 is lawful.
5. **Decay**: none, by construction — monotonic non-decreasing; "credits model neither
   recency nor memory accessibility, so decay, forgetting and retrieval failure are NOT
   familiarity decrements" (`relationship-interaction-familiarity-accrual-policy.ts:21-24`).
6. **Count-like, not normalized**: one credit per admitted interaction, saturating at 32.
7. **What constitutes firsthand interaction**: a canonical episode that (a) references
   the counterpart, (b) is bound to the subject's memory revision with a verified payload
   hash, (c) is admitted by the qualifying-admission provider into a frozen firsthand
   class (`DIRECT_COMMUNICATION` / direct-observation classes), and (d) is registered as
   a counterpart interaction — after which a deterministic `appraisal:` receipt is the
   only lawful evidence ref.
8. **REINITIALIZE** is not authorized for familiarity
   (`FAMILIARITY_REINITIALIZE_UNSUPPORTED`); removal is unsupported.

Because the semantics were already frozen in code + contract fingerprint
(`INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0 =
sha256:fcafcad1…f374`) and pinned by tests, the §8 STOP condition
(`RELATIONSHIP_FAMILIARITY_VALUE_SEMANTICS_NOT_FROZEN`) is **not** triggered.

## Gaps this slice closed (zero-model tests)

- cross-domain composition alongside a governed reserved change (reachable layer:
  ownership matrix) — added to `writer-authority-membrane.test.ts`;
- negative/hostile firsthand interaction still credits, and no other relationship
  dimension is touched — added to `relationship-interaction-familiarity-ingestion.test.ts`;
- third-party report does not credit the subject↔reported-counterpart relationship —
  added (structural host binding);
- frozen write-policy literals (`reinitialize_support`, `removal_support`) pinned —
  added to `historical-writer-authority-registry.test.ts`.
