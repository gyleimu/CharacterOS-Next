# P2.3.5.0a — Appraisal Attribution Semantic Resolution Contract

**Status: NORMATIVE FOR APPRAISAL V0 ATTRIBUTION REPRESENTATION**

**Decision driver (P2.3.5.0 read-only audit, HEAD `7ac43a2`):** `CHANGE_TO_CATEGORICAL_ATTRIBUTION` — repository evidence supports locus semantics only.

**Subordinate to (jointly frozen / committed, read-only authority):**

- `docs/architecture/subjectstate-v0-spec.md` (SubjectState V0)
- `docs/architecture/transition-contracts.md` (Transition Contracts)
- `docs/architecture/micl-design.md` (§19–§22 appraisal design intent)
- `docs/implementation/p2-1-contract-freeze.md` (P2.1 Contract Freeze)
- `docs/evaluation/p1-5-engineering-acceptance-contract.md` (§26 Appraisal Schema Conformance)
- `docs/implementation/p2-3-runtime-plan.md`
- `docs/implementation/p2-3-4-fast-ema-v0-reference-contract.md` (FAST_EMA_V0)
- `docs/implementation/p2-3-4-regulation-v0-reference-contract.md` (REGULATION_V0)

This document resolves the known representation conflict for **Appraisal V0**:

```text
CONTRACT_CONFLICT  →  runtime attribution: UnitIntervalV0
                    vs  architecture attribution: self | other | situation
```

**Scope:** semantic/data-model layer ONLY. This is DOCS ONLY; no runtime code is modified in this slice. Runtime alignment is deferred to P2.3.5.0b under §14/§15 below.

---

## 1. Core Resolution

Appraisal V0 `attribution` is hereby defined as the categorical closed enum:

```text
attribution: "self" | "other" | "situation"
```

The field means:

**DOMINANT ATTRIBUTION LOCUS.**

It answers exactly one question:

> Who/what is the primary locus to which the interpreted outcome is attributed?

It does **NOT** encode:

- attribution strength
- confidence
- probability
- responsibility magnitude
- continuous self↔other polarity
- blame intensity

Any of those concepts would require a separately justified versioned change (see §7).

## 2. Exact Literal Definitions

These are **engineering data semantics** — canonical meaning of one enum member. No claim of psychological correctness attaches to them or to the model using them.

| Literal | Meaning |
|---|---|
| `"self"` | The dominant attribution locus is the subject itself. |
| `"other"` | The dominant attribution locus is another actor / external agent. |
| `"situation"` | The dominant attribution locus is situational / environmental conditions rather than the subject or another specific actor. |

## 3. Cardinality

Appraisal V0 contains **exactly ONE** attribution value per Appraisal instance.

V0 therefore represents:

- **one dominant attribution locus** (singular)

It does NOT represent:

- mixed attribution
- multiple simultaneous loci
- distributions over loci
- weighted attribution
- ambiguity sets

If any of these become necessary later, they require an explicit schema/version decision. Do not expand V0 now.

## 4. Closed Enum

The allowed set is **exactly**:

```text
self
other
situation
```

Rules:

- Case-sensitive exact match (`"self"` valid; `"SELF"`, `"Self"` invalid).
- No aliases (`"environment"`, `"external"`, `"external agent"` invalid).
- Reject: unknown strings, numeric values, `null`, arrays, objects.
- `null` admissibility exists only if some higher frozen contract explicitly permits it — **no such contract exists today**, so `null` is invalid for V0 attribution.
- Do not silently normalize strings (no lowercasing, no trimming, no synonym mapping).

## 5. Numeric Representation Is Retired

The implementation-era representation

```text
attribution: UnitIntervalV0        // RETIRED for Appraisal V0
```

is resolved as an **implementation-era mismatch with the intended semantic contract**, not as a competing design.

No mapping such as `0 = self`, `0.5 = situation`, `1 = other` has committed provenance anywhere in the repository. Inventing one now would be a hidden encoding created after the fact. Numeric attribution semantics are therefore **RETIRED** for Appraisal V0.

Historical documents are not rewritten to hide this conflict (§17).

## 6. Continuous Axes Remain Where They Are

Preserve the frozen six-field Appraisal V0 structure:

```text
{ relevance, goal_congruence, attribution, controllability, uncertainty, intensity }
```

Do not add or remove fields. Field-by-field division of semantic labor:

| Field | Axis |
|---|---|
| `relevance` | event significance magnitude (continuous `[0,1]`) |
| `goal_congruence` | valence-direction magnitude (continuous `[0,1]`) |
| `controllability` | perceived control magnitude (continuous `[0,1]`) |
| `uncertainty` | outcome-predictability magnitude (continuous `[0,1]`) |
| `intensity` | overall arousal-strength magnitude (continuous `[0,1]`) |
| `attribution` | **categorical dominant locus** (the sole categorical dimension) |

Attribution uniquely provides the categorical locus dimension. Do not repurpose any existing field to encode locus semantics (e.g., via controllability polarity tricks).

## 7. NO Target + Strength Split

Do NOT introduce:

```text
attribution_target
attribution_strength
```

Repository evidence supports **locus semantics** but establishes **no independent attribution-strength concept**: every design source uses a single locus label combined with already-existing continuous fields (notably `controllability`). A split representation therefore constitutes:

```text
UNJUSTIFIED_SCHEMA_EXPANSION
```

Any future strength-like concept requires its own evidence review and versioned change.

## 8. FAST_EMA_V0 Interaction (unchanged blindness, retained invariant)

FAST_EMA_V0 remains **attribution-blind**:

- Changing the attribution representation MUST NOT change FAST_EMA_V0 dynamics (routing table §6, strength formula §5.1, lifecycle §7–§8 all never read `attribution`).
- Retained executable-relevant invariant for P2.3.5.0b conformance (A8):

> same Appraisal except attribution ⇒ FAST_EMA_V0 reference output remains byte-equivalent.

This contract resolves the type/meaning conflict but does **NOT** authorize FAST_EMA_V0 to consume attribution in any branch, numeric computation, or indirect encoding.

## 9. REGULATION_V0 Interaction

REGULATION_V0 does not consume Appraisal at all (closed least-privilege input `{context, regulation, elapsed_ticks}`). **Unaffected. No change.**

## 10. Current Persistence Boundary (audited)

Audited state at HEAD `7ac43a2497e875f107137283f1eeabc5094ecbd2`:

**Attribution VALUE is TRANSIENT_ONLY_TODAY.**

- `AppraisalProposalDraftV0` lives only as an in-memory artifact of Observation execution (provider → executor → affect producer input).
- Persisted/canonical structures carry only **appraisal references**: `affect.active_channels[].source_appraisal_ref` (typed `appraisal` ref), trace/result `domain_result_refs` (kind `appraisal`), and the future Learning-side `EpisodicMemoryRecordV0` draft's `appraisal_ref`. None carry the field value.
- SubjectState's 13 top-level fields contain no appraisal block; restore envelopes, journals and MemoryRepository records have never serialized an attribution value.

Therefore this resolution requires:

- NO persisted-data migration
- NO SubjectState migration
- NO MemoryRepository record migration
- NO restore migration
- NO journal migration

This is precisely why correcting Appraisal V0 before Learning is allowed: once experience encoding persists attribution semantics, changing the representation becomes a real historical-data migration problem. We fix the meaning before it becomes durable.

## 11. Future Learning Semantics (minimum stable interpretation)

After runtime alignment, the minimum stable interpretation available to Learning / Experience persistence is the three-literal locus:

- `"self"`: the subject interpreted the event as primarily attributable to itself.
- `"other"`: the subject interpreted the event as primarily attributable to another actor.
- `"situation"`: the subject interpreted the event as primarily attributable to circumstances.

A numeric `UnitInterval` alone could NOT preserve these distinctions without invented post-hoc encoding. The enum target preserves them.

**Do NOT design the ExperienceRecord schema in this slice.** P2.3.5 Learning work proceeds through its own authorized slices.

## 12. Runtime Validation Requirement (normative for P2.3.5.0b)

A TypeScript union type is **NOT sufficient**.

P2.3.5.0b MUST add fail-closed runtime validation at the Appraisal provider boundary (and wherever Appraisal drafts enter proposal assembly):

Valid inputs (exact strings):

- `"self"`
- `"other"`
- `"situation"`

Invalid inputs (fail closed, before any Affect/Context proposal commit):

- numbers (any finite/non-finite)
- unknown strings (including case variants and aliases)
- `null`, `undefined`
- arrays, objects, booleans

Invalid provider output must fail **before** affect/context delta assembly feeds a canonical proposal. Do not silently coerce.

## 13. Implementation Impact Classification (for P2.3.5.0b)

| Surface | Classification | Detail |
|---|---|---|
| `packages/runtime/src/ports/appraisal-port.ts` | **REQUIRED** | introduce/use categorical attribution type; replace `UnitIntervalV0`; correct the stale "freeze §19 / appraisal V0 contract" comment provenance |
| runtime Appraisal validation | **REQUIRED** | enforce exact closed enum at runtime (fail-closed) |
| Observation/Appraisal test fixtures | **REQUIRED** | replace numeric attribution values with legal literals |
| malformed-attribution tests | **REQUIRED** | numeric / unknown string / null / object-array rejection + three valid literals accepted |
| FAST_EMA_V0 algorithm | **NO_CHANGE** | attribution-blindness is permanent policy |
| REGULATION_V0 | **NO_CHANGE** | never consumes Appraisal |
| SubjectState schema | **NO_CHANGE** | attribution was never a canonical field |
| SubjectCore | **NO_CHANGE** | grammar/kind validation surface unchanged |
| Memory package | **NO_CHANGE** | ref-based only today |
| restore envelope / journal | **NO_CHANGE** | nothing persisted |
| canonical transition ownership | **NO_CHANGE** | `/regulation`,`/mood`,`/affect`,`/context` ownership untouched |
| Learning / Experience encoding persistence semantics | **FUTURE_ONLY** | own slices after this resolution |

## 14. Fingerprint / Replay Impact (audited fact vs expected churn)

- **Historical canonical compatibility:** Appraisal field VALUES were never embedded as persistent canonical SubjectState/Memory/restore data ⇒ **no historical replay migration is required**, and historical fingerprints/hashes/state bytes remain authoritative as-is.
- **Current transient fixture bytes:** future runtime tests/fixtures that serialize Appraisal drafts WILL change bytes when numerics are replaced by categorical literals. That is expected test/runtime-contract alignment, **not** historical state migration. Local transient fingerprints that directly include an Appraisal draft need not remain identical across the alignment commit.

Distinguish always: *historical canonical compatibility* vs *current transient fixture bytes*.

## 15. Conflict Status Transition

```text
previous marker:   CONTRACT_CONFLICT / MUST_RESOLVE_BEFORE_P2_3_5     (commit a7e4822)
current status:    RESOLVED_PENDING_RUNTIME_ALIGNMENT                 (this document)
future status:     RESOLVED                                           only after P2.3.5.0b
```

**Do NOT declare `FULLY_RESOLVED` until the P2.3.5.0b runtime type + fail-closed validation alignment is committed and tested.** The distinction matters:

> semantic contract resolved ≠ implementation already aligned

A caller MUST treat the current runtime `UnitIntervalV0` attribution as the last remaining misalignment until P2.3.5.0b lands.

## 16. Conformance Tests Required for P2.3.5.0b

| # | Requirement |
|---|---|
| A1 | valid `"self"` accepted at provider boundary |
| A2 | valid `"other"` accepted |
| A3 | valid `"situation"` accepted |
| A4 | numeric attribution rejected (incl. `0`, `1`, `0.5`, NaN, Infinity) |
| A5 | arbitrary string rejected (incl. `"SELF"`, `"Other"`, `"environment"`, `"unknown"`) |
| A6 | `null` rejected where contract demands non-null (default) |
| A7 | object/array rejected |
| A8 | attribution-only variation ⇒ FAST_EMA_V0 output byte-equivalent (blindness regression) |
| A9 | malformed Appraisal fails BEFORE canonical commit (no transition identity/proposal consumption) |
| A10 | no partial Affect/Mood/Context mutation on malformed attribution |
| A11 | deterministic Observation replay remains valid after categorical alignment |
| A12 | SubjectState/Memory/restore schemas bit-for-bit unchanged (structural non-touch proof) |

## 17. Historical Document Handling (governance)

Frozen/history-bearing documents are **not rewritten** to pretend the conflict never existed. Applied strategy:

| Document | Treatment |
|---|---|
| `p2-3-4-fast-ema-v0-reference-contract.md` §4 | **status note appended only** (`RESOLVED BY:` cross-reference); its normative attribution-blindness requirements untouched |
| `p1-5-engineering-acceptance-contract.md` §26/§27 | untouched; six-field list remains true; `attribution=other` example is valid under the resolved enum (cross-ref lives here, §20) |
| `micl-design.md` §19–§22 | untouched; original `self / other / situation` annotation is precisely the evidence this resolution formalizes |
| round-2/round-3 evaluation reports | untouched (historical audit trail; their CONFLICT records preserve provenance) |
| `subjectstate-v0-spec.md`, `transition-contracts.md`, `p2-1-contract-freeze.md`, `p2-3-runtime-plan.md` | untouched (silent or neutral on this field's representation) |

Provenance history is preserved: resolution + cross-reference, never silent rewrites.

## 18. Non-Scientific Status

Categorical attribution is **canonical engineering semantics for Appraisal V0**.

It is NOT claimed to be:

- psychologically correct
- human-like
- scientifically validated
- a validated emotion/appraisal theory component

Per the same rule that governed the affect bridge: mapping-correctness language is forbidden; determinism/boundedness/evidence-binding language governs instead.

---

## 19. Consistency Review

Compared against the seven authoritative sources plus current code:

| Source | Relevant clause(s) | Finding |
|---|---|---|
| `micl-design.md` §19 (L341–349) | `attribution // self / other / situation` DESIGN DECISION | Consistent: this resolution makes the explicit three-literal definition normative |
| `micl-design.md` §20/§21 (L358/L364) | appraisal describes "what it means"; LLM may propose *semantic* attribution | Consistent: semantic content implies category labels, not magnitudes |
| `micl-design.md` §22 (L374–381) | illustrative bridge uses single-valued `attribution=other/self` | Consistent: examples map onto the defined literals verbatim |
| `p1-5-engineering-acceptance-contract.md` §26 | frozen six-field list; Range Constraint oracle | Consistent: five continuous fields keep their ranges; the sixth gains an exact closed domain (range constraint generalized to its categorical domain). Six-field structure unchanged |
| `p1-5-engineering-acceptance-contract.md` §27 (AffixBridge-1) | `attribution=other` example | Consistent: literal usage matches the enum |
| `p2-1-contract-freeze.md` | only `appraisal` ref-kind grammar; SubjectState catalog contains no appraisal field | Consistent: no canonical-surface impact |
| `p2-3-runtime-plan.md` §"six-field structured output" (L96) | proposal-only fixed providers | Consistent: statement unaffected by the field's inner representation |
| FAST_EMA_V0 contract §4 | conflict marker + mandatory blindness | Consistent: blindness retained; status note cross-references this resolution |
| REGULATION_V0 contract | zero Appraisal consumption | Consistent: unaffected |
| current `appraisal-port.ts` | still `UnitIntervalV0` | Known misalignment → exactly why verdict is READY_FOR_RUNTIME_ALIGNMENT, not FULLY_RESOLVED |

**No higher authority requires numeric attribution. No higher authority conflicts with the categorical closure.**

Verdict: **CONTRACT_READY_FOR_RUNTIME_ALIGNMENT** (runtime itself must be aligned in P2.3.5.0b; see §15).

## 20. Cross-Reference Index

- Resolves: CONTRACT_CONFLICT marked in round-2 §204 / round-3 §13 evaluation reports and commit `a7e4822`.
- Status-note update applied: `p2-3-4-fast-ema-v0-reference-contract.md` §4.
- Supersedes: implementation-era `attribution: UnitIntervalV0` typing in `appraisal-port.ts` (upon P2.3.5.0b landing).
- Governs future consumers: P2.3.5.0b runtime validation (§12), P2.3.5 Learning planning (§11), P2.4+ Experience persistence (FUTURE_ONLY).

---

**FINAL PRINCIPLE:** We are fixing the meaning before Learning makes it durable. Categorical attribution is chosen because repository evidence supports locus semantics — not because categorical models are inherently more psychologically realistic.
