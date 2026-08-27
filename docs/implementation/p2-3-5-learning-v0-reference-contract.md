# P2.3.5.2 — Learning V0 Reference Contract

**Status: NORMATIVE FOR LEARNING_V0 REFERENCE IMPLEMENTATION (draft — pending isolation commit)**

**Decision driver (P2.3.5.1 pre-implementation audit, HEAD `e69c13d`):** `LEARNING_REFERENCE_CONTRACT_REQUIRED` → `DRAFT_LEARNING_V0_CONTRACT`. This document closes exactly the four reference-policy gaps identified by that audit: (1) trusted Experience handoff + least-privilege input authority, (2) deterministic `LearningExperienceCandidateV0 → EpisodicMemoryRecordV0` encoding, (3) memory write cardinality, (4) `MEMORY_PREPARE_CONFLICT` failure mapping — and proves compatibility with frozen A12/A13.

**Subordinate to (jointly frozen / committed, read-only authority):**

- `docs/architecture/subjectstate-v0-spec.md` (SubjectState V0)
- `docs/architecture/transition-contracts.md` (Transition Contracts, §§17–§22)
- `docs/architecture/micl-design.md` (§25–§28 illustrative Learning pipeline; §32 retry/resume)
- `docs/implementation/p2-1-contract-freeze.md` (P2.1 Contract Freeze)
- `docs/implementation/p2-3-runtime-plan.md` (§5.4 LearningTransition; §8 slice gates)
- `docs/evaluation/p1-5-engineering-acceptance-contract.md` (A10/A12/A13)
- `docs/implementation/p2-3-5-appraisal-attribution-resolution.md` (attribution = RESOLVED)
- Committed P2.2 memory contracts as implemented: `EpisodicMemoryRecordV0`, `RepositoryRevisionManifestV1`, `MemoryPrepareIntentV1`, `MemoryPreparationAuthority`, retrieval query/result contracts

This contract specifies the reference Learning lifecycle only. It modifies no frozen schema, error code, writable path, ownership tuple, commit protocol, repository contract, or acceptance oracle. Learning implementation is NOT authorized by this document.

---

## 1. Reference-Baseline Disclaimer

Learning V0 is an **ENGINEERING REFERENCE BASELINE**.

It does NOT claim:

- human memory realism
- psychological validity
- biological plausibility
- optimal consolidation
- scientifically valid salience dynamics

The goal is deterministic, auditable, replay-safe, authority-safe, persistence-safe reference behavior. Salience in V0 is `ENCODING_DECLARED_V0` (declared at encoding, bounded, never computed by a ranking/consolidation model).

## 2. Frozen Architecture — Carried Forward Unchanged

Authoritative invariants this contract inherits and MUST NOT reopen:

- SubjectCore = sole canonical state mutator (Producer != Mutator)
- Learning = sole owner of episodic MemoryRepository **content** mutation (six `/memory_state/*` content paths, producer `memory`, domain `memory-content`, transition `Learning` — ownership.ts)
- Observation = retrieval-metadata sub-domain only; **no episodic content write**
- MemoryRepository revisions = immutable; prepare may leave unreachable/orphan candidate revisions (transition-contracts §19)
- SubjectState-bound repository revision = canonical retrieval authority
- Learning does NOT advance `logical_time`; successful commit = exactly `+1` state revision (freeze §6.2 table)
- stale state follows frozen A13 rebase rules; duplicate/retry follows frozen A12
- LLM = proposal only, never canonical mutator
- FAST_EMA_V0 / REGULATION_V0 / attribution resolution / Observation P2.3.4 / Time P2.3.4 semantics unchanged

No `UPSTREAM_CONTRACT_CONFLICT` exists: Learning V0 is definable without altering any of the above (verified in §21).

## 3. Cross-Store Atomicity (frozen engineering term)

The exact normative term is:

**CANONICAL_EXPOSURE_ATOMICITY_WITH_UNREACHABLE_PREPARES**

Learning is NOT "true cross-store atomic". Reference lifecycle:

```text
canonical S0 + bound repository revision R0
        ↓
repository prepare (MemoryPreparationAuthority.prepareRevisionForIntent)
        ↓
candidate revision R1 — physically present, NOT canonical
        ↓
SubjectCore commit binds R1 via /memory_state/repository_revision
        ↓
R1 becomes canonically exposed
```

If the canonical commit fails: SubjectState remains on R0; R1 may remain an unreachable/orphan prepared revision. **Canonical state: +0. Repository physical artifacts: may be non-zero.** This distinction is normative and MUST be reflected in tests and reports (never claim repository-physical "+0").

## 4. Trusted Experience Handoff — `LearningExperienceCandidateV0`

### 4.1 Trust model decision

Committed evidence favors a **successful Observation-derived experience** (transition-contracts §17 DESIGN DECISION: "ObservationTransitionResult 可作为 InternalExperience source"; micl §25: refs + small summary, never a full snapshot copy, never a fabricated external outcome). Arbitrary caller-authored trusted memory payloads are REJECTED as a model.

`LearningExperienceCandidateV0` is the typed conceptual handoff (no TypeScript in this slice). It is **refs-and-metadata only** — it carries NO appraisal values, NO affect values, NO free-form narrative content:

```text
LearningExperienceCandidateV0 (closed) = {
  subject_id                 // must equal the Learning subject
  source_transition_id       // committed Observation transition identity
  observation_ref            // observation:<id> — the source observation
  entity_refs                // sorted unique entity refs of the source input
  event_refs                 // sorted unique event refs of the source input (may be [])
  occurrence_logical_time    // the source Observation occurrence time
  appraisal_ref | null       // provenance ref only — never appraisal values
  scene                      // nonempty NFC encoding-scene label
  focus_refs                 // priority-ordered focus refs of the source scene
  environment_refs           // set-like environment refs of the source scene
  declared_salience          // UnitIntervalV0 — DECLARED by the trusted caller
}
```

Forbidden candidate content: full SubjectState, full MemoryState, full runtime snapshot, full retrieval result, full context state, appraisal/affect/regulation values, LLM-generated summaries. Only the fields above exist, because only these are required by the §6 record mapping.

### 4.2 Source authority rule (anti-fabrication)

A syntactically valid ref is NOT proof of semantic existence. Before encoding, the Learning executor MUST establish, through EXISTING durable surfaces:

1. **Bundle identity:** `readCommittedByTransitionId(source_transition_id)` (existing `ReadOnlyStoreHandle` / facade `StoreReadSurface` read face) returns a committed bundle with `subject_id` equal to the Learning subject and `transition_type == "Observation"`.
2. **Occurrence basis:** `candidate.occurrence_logical_time == bundle.logical_time_after` (Observation never advances logical time, so before == after == occurrence).
3. **Appraisal provenance (when non-null):** `appraisal_ref` MUST belong to the durable appraisal-ref evidence of the source Observation, i.e. the set of `source_appraisal_ref` values inside `bundle.next_snapshot.affect.active_channels`, unioned with the source Observation's `PreparedLogicalResultV1.domain_result_refs` (kind `result`/appraisal-producing refs) when the host WorkflowStore read is available. If neither durable surface supplies the ref, a non-null `appraisal_ref` is rejected fail-closed.
4. **Scene provenance:** `scene` / `focus_refs` / `environment_refs` MUST equal the corresponding fields of `bundle.next_snapshot.context` (durable, bound to the source commit). Mismatch rejects.

If a host composition cannot expose one of these durable read surfaces, it MUST reject the affected validation rather than skip it. No gap is hidden: all four checks rest on already-committed infrastructure (`AtomicCommitBundleV1` fields + frozen `PreparedLogicalResultV1` durability), with no new persistence subsystem.

### 4.3 Crash/resume recovery gate (HARD gate — closed)

Scenario: Observation committed → Learning has not prepared → process crash → resume Learning WITHOUT rerunning Observation.

**Where does the semantic experience come from after crash?** Two grounded answers, both normative:

1. **Deterministic re-supply by the caller/host** — identical to how `ObservationInput` replay already works: the system never persists caller request payloads; resume requires the caller to re-supply the byte-stable request. The candidate is refs-and-metadata only; every field is either part of the host's durable request context (observation/entity/event refs, declared salience) or re-derivable from the committed source bundle (§4.2 surfaces: context scene/refs, occurrence time, appraisal evidence). No transient in-memory `InternalExperience` is relied upon.
2. **System-side durable re-validation** — the re-supplied candidate is re-validated against the durable bundle surfaces (§4.2) and against the journal/intent idempotency surfaces (§9–§10). A changed candidate under the same Learning identity is a fingerprint conflict (A12), not silent divergence.

Because candidate derivation/validation is deterministic and all durable evidence survives the crash (committed bundle + identity journal + repository intent registry), A12 resume holds WITHOUT weakening: same identity + same candidate ⇒ same prepared revision reuse or `ALREADY_COMMITTED`; different candidate ⇒ conflict. **No `EXPERIENCE_HANDOFF_RECOVERY_GAP`.**

The following distinction is normative:

```text
safe retry/resume  !=  system-side persistence of the candidate payload
```

CharacterOS itself does NOT durably persist `LearningExperienceCandidateV0`, `InternalExperience`, full Appraisal values, or any full semantic experience payload; no durable handoff store is invented by this contract. Recovery is safe because validation/idempotency are deterministic over durable evidence — not because the payload is stored. Consequently: **if the host/caller cannot re-supply the candidate, Learning simply cannot resume that experience; this contract does NOT claim autonomous system-side recovery of the semantic payload.**

## 5. Appraisal Value Non-Persistence (normative)

Attribution and all six Appraisal values remain **transient** (per the attribution resolution: TRANSIENT_ONLY_TODAY at P2.3.5.0; now RESOLVED semantically but still not persisted). Learning V0 persists the **appraisal reference only** (`EpisodicMemoryRecordV0.appraisal_ref`). No memory schema expansion is introduced to preserve categorical attribution. Future semantic-memory enrichment is outside this slice.

## 6. Exact `EpisodicMemoryRecordV0` Encoding

The current record shape (memory package, P2.2.1, implemented + validated) — every field, no additions:

| Field | Req | Source authority | Deterministic encoding rule | Validation | Provenance | Classification |
|---|---|---|---|---|---|---|
| `schema_version` | required | literal | `"episodic-memory-record-v0"` | exact literal | — | FROZEN_EXISTING |
| `episode_ref` | required | §6.1 derivation | `episode:<64hex>` over frozen projection of `{subject_id, source_transition_id, intent_id}` (§9) | `parseEpisodeRef` grammar/kind | content identity of this record | **REFERENCE_POLICY_DEFINED_HERE** |
| `occurrence_logical_time` | required | candidate (validated vs bundle §4.2) | pass-through candidate value | `validateLogicalTime` | source Observation occurrence | FROZEN_EXISTING (rule) + candidate-sourced |
| `recorded_at_logical_time` | required | current canonical logical time at encoding read | `= current logical_time` (Learning never advances it); invariant `occurrence <= recorded` enforced by existing validator | safe integer ≥ occurrence | encoding moment on canonical clock | FROZEN_EXISTING |
| `provenance.transition_id` | required | the Learning transition identity (§13) | pass-through | identifier grammar | owning transition | FROZEN_EXISTING |
| `provenance.producer` | required | literal | `"memory"` (validator-enforced) | exact literal | producer identity | FROZEN_EXISTING |
| `provenance.cause_refs` | required | §6.2 rule | sorted unique union: `[observation_ref] + [appraisal_ref if non-null] + entity_refs + event_refs` | sorted unique ref array | experience causality | **REFERENCE_POLICY_DEFINED_HERE** |
| `references` | required | candidate | sorted unique union of candidate `entity_refs + event_refs + [observation_ref]` | sorted unique ref array | referenced entities/events/observations | **REFERENCE_POLICY_DEFINED_HERE** |
| `context.scene` | required | candidate (validated vs bundle §4.2) | pass-through NFC label, nonempty | canonical text | encoding scene | FROZEN_EXISTING (rule) + candidate-sourced |
| `context.focus_refs` | required | candidate (§4.2) | pass-through ordered refs | ref array | scene focus at encoding | FROZEN_EXISTING |
| `context.environment_refs` | required | candidate (§4.2) | pass-through set-like refs | ref array | scene environment at encoding | FROZEN_EXISTING |
| `appraisal_ref` | optional (null allowed) | candidate + §4.2 durable evidence check | pass-through validated ref or null | `parseAppraisalRef` + semantic authority check | appraisal provenance REF ONLY | FROZEN_EXISTING (shape) + authority rule here |
| `affect_snapshot_ref` | optional (null allowed) | no committed V0 source exists | **fixed `null` in V0** (no invented snapshot ref) | null passes | — | **REFERENCE_POLICY_DEFINED_HERE** |
| `salience.declared_score` | required | candidate `declared_salience` | pass-through `[0,1]` value | `validateUnitInterval` | declared at encoding | FROZEN_EXISTING |
| `salience.source` | required | literal | `"ENCODING_DECLARED_V0"` | exact literal | salience provenance marker | FROZEN_EXISTING |

No field lacks a deterministic source, existing default, or committed semantic ⇒ **no `EXPERIENCE_ENCODING_FIELD_GAP`**. No summary/content field exists in the current record ⇒ **no `EXPERIENCE_ENCODING_REFERENCE_GAP`** (§14 of the drafting task is vacuously satisfied: there is no content field to summarize, and no LLM summarization is introduced).

### 6.1 `episode_ref` derivation (new versioned engineering rule)

```text
episode_ref = "episode:" + hex64(
  hashEnvelope("characteros-next/memory/episode-ref/v1", {
    subject_id, source_transition_id, intent_id
  })
)
```

Deterministic, namespaced (domain-separated projection), subject-bound, source-experience-bound, grammar-valid (`episode` is a memory-bound kind). No random UUID; no wall clock.

## 7. Write Cardinality

Verified: no higher committed contract requires any cardinality other than one record per experience (transition-contracts §17 pipeline "Experience → Encode → prepare → commit"; micl §26 one record per experience; no consolidation in V0; no salience gate exists). Therefore:

```text
WRITE_CARDINALITY_V0 = EXACTLY_ONE_RECORD_PER_VALID_LEARNING
```

One valid `LearningExperienceCandidateV0` ⇒ exactly ONE `EpisodicMemoryRecordV0` ⇒ exactly ONE repository prepare/adoption attempt. No salience gate. No zero-record path for a valid Learning input. No one-to-many expansion. No consolidation. This is an engineering reference policy, not a statement about human memory.

## 8. Memory Prepare Basis

Learning prepares against the repository revision currently bound by canonical SubjectState **at Learning read time**:

```text
state S0 · state revision SR0 · memory_state.repository_revision = R0
prepare intent.parent_revision = R0
proposal expected_repository_revision (memory delta) = R0
candidate revision R1 bound on success
```

The prepare intent MUST be bound to: Learning identity (§13), source experience identity (§4), `R0`, and the deterministic record payload refs — using exact existing `MemoryPrepareIntentV1` fields (`intent_id`, `parent_revision`, `records`). No second revision authority is invented.

## 9. Prepare Intent / Idempotency (existing semantics reused)

Uses existing `MemoryPrepareIntentV1` + `computePrepareIntentFingerprint` + repository intent registry semantics:

```text
intent_id = "li-" + hex64(
  hashEnvelope("characteros-next/memory/learning-prepare-intent/v1", {
    subject_id, source_transition_id, expected_state_revision, rebuild_ordinal
  })
)
```

- `rebuild_ordinal = 0` for the first attempt; incremented exactly once per A13 rebuild (§12) so rebuilt attempts carry new deterministic identity.
- intent fingerprint = existing `computePrepareIntentFingerprint({parent_revision, records})` (deterministic over the exact prepared content).
- Same `intent_id` + same fingerprint ⇒ repository returns the SAME prepared revision (existing contract) ⇒ crash-safe replay (§11 C2) with no orphan storm.
- Same `intent_id` + different fingerprint ⇒ repository rejects (`MEMORY_PREPARE_CONFLICT`) ⇒ normalized per §10.
- No random IDs. Derivation is deterministic, namespaced, subject-bound, source-experience-bound — documented as ENGINEERING_REFERENCE_V0 policy (§20).

## 10. Prepare-Conflict Error Mapping (gap closed)

Existing frozen families audited (freeze §13.4): `memory repository prepare unavailable before a new revision exists → ABORTED / SERVICE_UNAVAILABLE / FAIL-PREPARE-001`; runtime precedent wraps provider/repository failures into typed stage failures with non-canonical diagnostic `cause` (Observation/Time executors). Mapping:

| Repository internal | Runtime-normalized |
|---|---|
| prepare unavailable / adapter throw before any candidate | `ABORTED / SERVICE_UNAVAILABLE / FAIL-PREPARE-001` (Learning stage) |
| `MEMORY_PREPARE_CONFLICT` (intent fingerprint change, payload hash mismatch, missing owned payload, ref-content conflict) | `ABORTED / SERVICE_UNAVAILABLE / FAIL-PREPARE-001` (Learning stage; raw repository message survives ONLY as non-canonical `cause` detail) |
| invalid prepare intent schema | `REJECTED / INVALID_SCHEMA / SS-SCHEMA-001` (pre-prepare admission) |

No new public error code is invented. **No `ERROR_CONTRACT_GAP`.**

## 11. Crash / Resume Matrix (compatible with A12, journal, intent idempotency)

| Window | Durable evidence | Possible orphans | Replay behavior | Intent reuse | Transition identity reuse | REBASE_REQUIRED? |
|---|---|---|---|---|---|---|
| **C1** crash before prepare | journal reservation may exist (`attempts=[]` legal) or nothing; source bundle durable | none | caller re-supplies candidate (§4.3); Learning restarts cleanly | n/a | same identity if same fingerprint | no |
| **C2** crash after prepare, before canonical commit | prepared revision in repository; intent registry entry; journal reservation; source bundle | prepared R1 orphan/pending | replay with same intent_id+fingerprint returns SAME R1; no new orphan | **yes** (mandatory) | same identity + same fingerprint | no (unless state moved → C5/F5 path) |
| **C3** crash during/around canonical commit | same as C2 + AtomicCommitStore certainty protocol | R1 orphan only if DEFINITE_NOT_COMMITTED | reconciliation (`OUTCOME_UNKNOWN` resolution) decides committed vs definite-not-committed; then C2/C4 semantics apply | yes | same identity | no |
| **C4** commit succeeded, response lost | committed bundle durable (`readCommittedByTransitionId`) | none | replay ⇒ `ALREADY_COMMITTED` + original result; revision NOT incremented again | n/a | same identity, same fingerprint | no |
| C5 (variant) state advanced while crashed | bundle at newer revision | R1 orphan | A13 rebase path (§12): rebuild with new identity or `REBASE_REQUIRED` | new intent (ordinal+1) on safe rebuild | new identity on rebuild | only if rebuild unsafe |

The handoff survives C1/C2 via §4.3 (deterministic re-supply + durable re-validation) ⇒ **no `EXPERIENCE_HANDOFF_RECOVERY_GAP`**.

## 12. Stale After Prepare — A13 (preserved exactly) + Artifact Policy

Frozen workflow (unchanged): core first returns `REJECTED / STALE_STATE_REVISION / SS-REVISION-001` with no canonical mutation; R1 may remain orphan/pending; then runtime-owned rebase: keep rejection → reload latest canonical state → revalidate source experience (§4.2 against current durable evidence) → revalidate repository base revision → revalidate field ownership → revalidate prepared-revision attachability → safe ⇒ rebuild with **new transition ID/fingerprint**; unsafe ⇒ `REBASE_REQUIRED / STALE_STATE_REVISION / REBASE-STALE-001` (`LearningRebaseRequiredResultV1`). Rebase is NEVER "replace expected_state_revision and retry".

**Artifact policy (audited classification, carried forward):**

| Artifact | Policy |
|---|---|
| Old canonical SubjectState revision | FORBIDDEN_TO_REUSE (reload mandatory) |
| Old expected repository revision | MUST_REBUILD (rederive `parent_revision` from reloaded `memory_state.repository_revision`) |
| Experience encoding | MUST_REVALIDATE (§4.2 re-run against current durable surfaces) |
| Source provenance | MUST_REVALIDATE semantically per §4.2 |
| Old prepared repository revision | reusable ONLY if the explicit attachability predicate passes (§12.1) |
| Old canonical proposal fingerprint | MUST_REBUILD (new identity + new fingerprint) |
| Rebased attempt | new transition identity/fingerprint; `rebuild_ordinal` + 1 (§9/§13) |

### 12.1 Attachability predicate (closes STALE_PREPARE_REUSE)

Reuse of an old prepared revision R1 is legal ONLY if ALL hold, using existing repository semantics:

1. `readManifest(R1)` non-null and `manifest.parent_revision == reloaded memory_state.repository_revision` (parent chain still matches the current bound revision — prevents "prepared from R0 + state now binds incompatible R2 + blindly attach R1");
2. `isAdopted(R1) == false` (existing adoption seam — prevents double-binding);
3. every `record_hashes[].payload_hash` still recomputes from repository-owned payloads (`payloadHashOf`).

Any failure ⇒ R1 is NOT attached: rebuild a fresh revision via a new intent (ordinal+1) or return `REBASE_REQUIRED` when the source/base revalidation itself fails. **No `STALE_PREPARE_REUSE_GAP`** — all three checks exist in current repository semantics.

## 13. Transition Identity (versioned Learning V0 rule)

No Learning-specific derivation was previously frozen (Time/Observation have their own). Smallest consistent versioned rule:

```text
learning transition_id = "t-learn-" + hex64(
  hashEnvelope("characteros-next/runtime/learning-transition-id/v1", {
    subject_id, expected_state_revision, source_transition_id, rebuild_ordinal
  })
)
```

Deterministic; binds all canonical identity dimensions (subject, expected revision, cause, rebuild position); identifier-grammar valid (`t-learn-` + 64 hex ≤ 128); domain-separated projection (Round-3 B4 pattern); no random UUID. Proposal fingerprint = existing `proposal-fingerprint-v1` over the semantic proposal (expected revision included). Journal first-seen reservation, `ALREADY_COMMITTED` and `TRANSITION_ID_REUSE` semantics follow A12 unchanged.

## 14. Memory State Adoption (exact delta)

Using the exact current `MemoryStateV0` shape and Learning-owned paths only:

| Path | Classification | Rule |
|---|---|---|
| `/memory_state/repository_revision` | **REQUIRED** | binds the newly prepared revision (composition requires this path for Learning; engine requires new ≠ current + binding verdict) |
| `/memory_state/active_episode_refs` | UNCHANGED (V0) | consolidation-active episode semantics deferred; not needed for exactly-one adoption |
| `/memory_state/autobiographical_index_revision` | UNCHANGED (V0) | index semantics deferred |
| `/memory_state/consolidation_cursor` | UNCHANGED (V0) | consolidation deferred |
| `/memory_state/pending_encoding_refs` | UNCHANGED (V0) | direct exactly-one encoding leaves no pending queue |
| `/memory_state/lifecycle_metadata` | UNCHANGED (V0) | frozen `EmptyClosedObjectV0` stays `{}` |

Not all six paths change. Successful Learning delta = exactly ONE operation (`/memory_state/repository_revision → R1`) with `expected_repository_revision = R0` and the host-minted `RepositoryRevisionBindingV1` capability beside the commit (existing engine adoption validation). Retrieval-metadata paths remain Observation-owned and are FORBIDDEN to Learning.

## 15. Retrieval Authority

Frozen: retrieval MUST follow the repository revision bound by SubjectState (`MemoryRetrievalQueryV0.repository_revision` is built from `snapshot.memory_state.repository_revision`; services reject unknown revisions with `INVALID_MEMORY_REVISION`). Retrieval MUST NOT use the latest/highest/most-recently-prepared repository revision. Orphan prepared revisions remain invisible to canonical retrieval unless a later valid Learning commit binds them. Conformance tests L12/L22 (§18) lock this property.

## 16. Logical Time (frozen, preserved)

Learning does NOT advance `logical_time`. Successful Learning: `state_revision +1`; `logical_time` unchanged; `last_transition_type = "Learning"`; `last_transition_time = current logical time` (freeze §6.2 table); proposal occurrence MUST equal current logical time (`INVALID_LOGICAL_TIME` otherwise). Record: `occurrence_logical_time` (source Observation occurrence) ≤ `recorded_at_logical_time` (current logical time at encoding) — validator-enforced. No wall clock anywhere.

## 17. Least-Privilege Learning Input Authority

Semantic authority (not an implementation type). Learning V0 may receive ONLY:

- subject identity, current state revision, current logical time (existing `RuntimeContext` read model)
- current `memory_state.repository_revision` + state revision basis (narrow snapshot read via existing `readCurrentSnapshot` + projection)
- trusted `LearningExperienceCandidateV0` (§4)
- Learning transition/runtime identity context (§13)
- durable source-bundle read face (§4.2: `readCommittedByTransitionId` projection)
- repository capability through `MemoryPreparationAuthority` ONLY (frozen projection; raw minting unreachable)

FORBIDDEN inputs to reference encoding: full SubjectState, full MemoryState, current affect state, current mood state, regulation, context state beyond §4.2 validation needs, beliefs, traits, relationships, LLM outputs, wall clock, randomness — unless an exact `EpisodicMemoryRecordV0` field requires it (none beyond §6 does).

## 18. Conformance Matrix (future executable tests)

| # | Requirement | Basis |
|---|---|---|
| L1 | deterministic successful Learning (+1 revision, one trace, domain `memory-content`) | §2/§14/§16 |
| L2 | exactly-one record for a valid Learning V0 input | §7 |
| L3 | correct repository revision binding (new ≠ old, binding verdict, `isAdopted` set) | §8/§14 |
| L4 | Observation still performs zero episodic write (regression, unchanged) | P2.3.4 closure |
| L5 | malformed/untrusted experience rejected BEFORE prepare (fabricated `appraisal="other"` + "X happened" never persists) | §4.2 |
| L6 | deterministic record bytes (same candidate ⇒ byte-identical record) | §6 |
| L7 | prepare failure ⇒ canonical +0 | §3/F3 |
| L8 | prepare conflict normalized (F8 mapping; no new code) | §10 |
| L9 | invalid MemoryDelta ⇒ canonical +0 + orphan tolerance | §3/F4 |
| L10 | stale-after-prepare ⇒ no stale bind (core REJECTED first) | §12 |
| L11 | A13 revalidation/rebase path incl. `REBASE_REQUIRED` unsafe vector | §12 |
| L12 | retrieval follows SubjectState-bound revision | §15 |
| L13 | duplicate transition idempotency (`ALREADY_COMMITTED` / REUSE) | A12 |
| L14 | duplicate prepare intent idempotency (same revision reused) | §9 |
| L15 | crash-after-prepare replay/resume (C2) | §11 |
| L16 | crash-after-commit / lost response ⇒ `ALREADY_COMMITTED` (C4) | §11 |
| L17 | ownership restricted to the six Learning memory-content paths | §2 |
| L18 | Affect/Mood/Context/Regulation bytes unchanged by Learning | §2/§17 |
| L19 | `logical_time` unchanged by Learning | §16 |
| L20 | deterministic replay (fingerprint/state hash/result identity) | §13 |
| L21 | provenance source authority (§4.2 checks, incl. appraisal-ref durable evidence) | §4.2 |
| L22 | prepared orphan invisible through canonical retrieval | §15 |
| L23 | no LLM in reference encoding | §19 |
| L24 | no full SubjectState exposure to encoder/producer beyond §17 | §17 |

Assertions are frozen only where prerequisite contract evidence exists (all rows above are grounded).

## 19. LLM Policy

Reference Learning V0: **NO LLM REQUIRED**. No LLM summarization in baseline encoding. If future Learning uses an LLM: it may propose semantic encoding ONLY, and output must pass deterministic validation before persistence. LLM can never prepare repository revisions directly, bind `SubjectState.memory`, commit SubjectCore, or become state authority.

## 20. Parameter / Policy Provenance Table

| Policy | Source class |
|---|---|
| Ownership partition (six content paths, producer `memory`, transition Learning) | **FROZEN_EXISTING** (transition-contracts §18; ownership.ts; freeze §7.2) |
| Repository revision lifecycle (immutable, intent-idempotent prepare, orphan tolerance) | **FROZEN_EXISTING** (P2.2 contracts; §19) |
| Cross-store atomicity = CANONICAL_EXPOSURE_ATOMICITY_WITH_UNREACHABLE_PREPARES | **FROZEN_EXISTING** (transition-contracts §19 + engine semantics; named here) |
| A13 stale rebase workflow + attachability predicate | **FROZEN_EXISTING** (workflow) + predicate mechanics **FROZEN_EXISTING** (repository semantics) |
| A12 idempotency/resume + journal reservation | **FROZEN_EXISTING** |
| Logical-time rules for Learning | **FROZEN_EXISTING** (freeze §6.2) |
| Record schema + validation | **FROZEN_EXISTING** (EpisodicMemoryRecordV0) |
| Salience = declared `[0,1]`, `ENCODING_DECLARED_V0` | **FROZEN_EXISTING** |
| Error mapping for prepare conflicts → FAIL-PREPARE-001 family | **FROZEN_EXISTING family** + mapping **ENGINEERING_REFERENCE_V0** |
| Experience handoff shape + source authority rule | **ENGINEERING_REFERENCE_V0** |
| Crash-recovery = deterministic re-supply + durable re-validation | **ENGINEERING_REFERENCE_V0** |
| Write cardinality = EXACTLY_ONE_RECORD_PER_VALID_LEARNING | **ENGINEERING_REFERENCE_V0** |
| `episode_ref` / `intent_id` / `transition_id` derivations | **ENGINEERING_REFERENCE_V0** (versioned projections) |
| `affect_snapshot_ref = null` in V0 | **ENGINEERING_REFERENCE_V0** |
| `cause_refs` / `references` composition rules | **ENGINEERING_REFERENCE_V0** |
| Five non-revision memory paths UNCHANGED in V0 | **ENGINEERING_REFERENCE_V0** (consolidation/index/pending-queue semantics **DEFERRED**) |
| Belief/relationship/trait/plasticity evolution | **DEFERRED** (forever-out at record level; future phases) |
| MICL orchestration / WorkflowStore stage ledger | **DEFERRED** (P2.4) |

## 21. Consistency Review

| Source | Relevant clause(s) | Finding |
|---|---|---|
| P2.1 freeze | §6.2 Learning row; §7.2 ownership/writable paths; §7.4 `LearningRebaseRequiredResultV1`; §13.4 prepare-failure family; §14 identity/fingerprint | **CONSISTENT** (all rules reused verbatim; identity derivation is a reference rule under generic identity grammar) |
| P2.2 memory contract | `EpisodicMemoryRecordV0`, manifest/intent contracts, `MemoryPreparationAuthority` projection | **CONSISTENT** + encoding/cardinality/conflict-mapping = **REFERENCE_POLICY_ADDED** |
| P2.2 retrieval contract | query scoped to one revision; unknown revision reject | **CONSISTENT** (§15 restates as norm) |
| transition-contracts | §17 Learning contract; §18 partition; §19 crash/orphan; §22 idempotency | **CONSISTENT** + handoff/rebase-artifact detail = **REFERENCE_POLICY_ADDED** |
| MICL design | §25–§28 illustrative pipeline; §32 resume | **CONSISTENT** (refs+summary handoff honored; V0 record shape governs over illustrative field list) |
| P1.5 A12 | idempotency/resume requirements | **CONSISTENT** (§11 matrix) |
| P1.5 A13 | stale rebase safety scenario + PASS requirements | **CONSISTENT** (§12 preserved exactly) |
| SubjectState spec | MemoryState shape; refs-only persistence | **CONSISTENT** (no schema change) |
| runtime plan | §5.4 Learning; §8 slice gate (A10 fragment + A13 pre-path) | **CONSISTENT** |
| attribution resolution | RESOLVED; transient values; no memory-schema expansion | **CONSISTENT** (§5 restates ref-only persistence) |

No CONFLICT rows ⇒ readiness not blocked by consistency.

## 22. Future Implementation Ports (conceptual, no TypeScript)

P2.3.5 implementation is expected to require, preferring existing abstractions:

- `LearningTransitionExecutor` (orchestration only, mirrors Time/Observation executor pattern over the two-call SubjectCorePort)
- `LearningExperienceCandidateV0` intake + §4.2 source-authority validation
- `ExperienceEncoderV0` (pure deterministic §6 mapping)
- `MemoryPreparationAuthority` (existing — no new memory surface)
- `MemoryAdoptionValidator` (existing engine `memory_adoption_validator` seam — host-minted verdict-only)
- Learning rebase orchestration (runtime-owned §12 steps over existing reads)
- narrow durable source-bundle read projection (read face over existing `readCommittedByTransitionId`)

No unnecessary layers; no new persistence subsystem; no Memory/SubjectState schema work.

## 23. Contract Status

Gate audit results:

- EXPERIENCE_SOURCE_AUTHORITY_GAP — **not present** (§4.2 grounded in existing durable surfaces)
- EXPERIENCE_HANDOFF_RECOVERY_GAP — **not present** (§4.3 + §11)
- EXPERIENCE_ENCODING_FIELD_GAP — **not present** (§6 table complete)
- EXPERIENCE_ENCODING_REFERENCE_GAP — **not present** (no content field exists)
- ERROR_CONTRACT_GAP — **not present** (§10 maps into existing FAIL-PREPARE-001 family)
- STALE_PREPARE_REUSE_GAP — **not present** (§12.1 predicate uses existing repository semantics)
- MEMORY_RECORD_CONTRACT_GAP — **not present** (§6 fits current record exactly)
- UPSTREAM_CONTRACT_CONFLICT — **not present** (§2 invariants untouched; §21 all CONSISTENT)

Verdict: **LEARNING_V0_CONTRACT_READY_FOR_IMPLEMENTATION** (pending isolation commit of this document). Implementation itself remains NOT AUTHORIZED until a separate implementation task.

---

**FINAL PRINCIPLE:** Learning is where transient runtime experience becomes durable memory. This contract makes BOTH explicit: what semantic experience is trusted (§4 — Observation-derived, refs-and-metadata only, durable-evidence validated), and how that trusted experience survives retry/resume boundaries (§4.3/§11 — deterministic re-supply plus durable re-validation; never transient-object dependence). It never pretends transient data is durable, never treats syntactically valid refs as semantic proof, and never claims true cross-store atomicity where the architecture guarantees canonical exposure atomicity only.
