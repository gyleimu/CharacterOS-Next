# `D4-C1` — REPRESENTATION COMPARATOR — PREREGISTRATION

**`D4_C1_COMPARATOR_PREREGISTRATION_READY`**
**`D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN`** · **`LINK_4_REMAINS_LOCKED`** · **`CHARACTEROS_UNMODIFIED`**
**`MODEL_CALLS_THIS_ROUND = 0`** · no CharacterOS file touched, no comparator implemented.

Contract `research/experiments/belief-representation-comparator-d4-c1/contract.ts`, manifest
`sha256:0e115f94c79b8eb8…`.

---

## A. C0a FROZEN-RESULT VERIFICATION

Recomputed from C0a's own dataset before anything else: the dataset hash matches the recorded value,
SUPPORT is `{SUPPORTS_B: 6}`, OPPOSE is `{OPPOSES_B: 6}` →
`EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED`, scope
`PREREGISTERED POLAR STANCE COMPOSITION`. `H_EXEC_COMPOSITION`'s strong form is **weakened**.
D4-C0a stands at **27 calls**.

## B. THE EXACT CHARACTEROS BELIEF RECORD — FROM PRODUCTION, NOT INVENTED

| | |
| --- | --- |
| fields, in order | `proposition_id`, `proposition_label`, `credence` |
| field order source | `cognition-action-transition-executor.ts:305-311` (the production object literal) |
| item definition | `subject-state.ts:90` (`BeliefItemStateV0`) |
| executor serialisation | `conversation-cognition-provider-v2.ts:213` — `JSON.stringify` per item |
| `proposition_id` construction | `belief-prop-v0-<hashEnvelope("characteros-next/belief/proposition-key/v1", {canonical_label})>`, from `belief-proposition-admission.ts:190-201` |

**The two records, exactly as the production executor would render them:**

```
{"proposition_id":"belief-prop-v0-30f506ee309b7725cf4b7487ac2289a8a8f2488c7d575fc96efb2952e136faf8","proposition_label":"Caution is warranted when the conclusion rests on information I have not seen myself.","credence":0.8}
{"proposition_id":"belief-prop-v0-30f506ee309b7725cf4b7487ac2289a8a8f2488c7d575fc96efb2952e136faf8","proposition_label":"Caution is warranted when the conclusion rests on information I have not seen myself.","credence":0.2}
```

They differ **only in the credence digits** (verified). **Nothing was added for comprehensibility: 0
items** — no derived stance word, no semantic alias, no relation metadata, no annotation, no
SUPPORT/OPPOSE label, no note interpreting the credence. Adding any of those would stop this from being a
test of the existing representation.

## C. THE COMPARATOR CAUSAL QUESTION

> Holding the executor, proposition A, proposition B, the explicitly supplied semantic-alignment
> relation, the measurement contract, its anchors, the output vocabulary, the surrounding framing and the
> generation settings **identical**, does changing the **stance representation** from an explicit stance
> word to the CharacterOS production belief record change cross-expression stance composition?

C1 does not re-ask whether the composition happens. C0a answered that. C1 isolates **representation form**.

## D. THE 2 × 2 DESIGN

| cell | representation | stance | value in the binding block | predicted token |
| --- | --- | --- | --- | --- |
| `E-SUPPORT` | `EXPLICIT_STANCE` | SUPPORT | `SUPPORTS` | `SUPPORTS_B` |
| `E-OPPOSE` | `EXPLICIT_STANCE` | OPPOSE | `OPPOSES` | `OPPOSES_B` |
| `R-SUPPORT` | `CHARACTEROS_BELIEF_RECORD` | SUPPORT | the 0.8 record | `SUPPORTS_B` |
| `R-OPPOSE` | `CHARACTEROS_BELIEF_RECORD` | OPPOSE | the 0.2 record | `OPPOSES_B` |

**The isolation rule, and the part of it that is a deliberate restraint.** The binding block is the block
C0a froze, and the cue prefix `SUBJECT STANCE TOWARD A: ` is **constant across all four cells** — only the
*value's form* changes. That holds the framing fixed while the representation moves:
**all six cell pairs differ on exactly one line**, and after the frozen sentinel normalisation the four
requests collapse to **one distinct form**, with exactly one replacement each.

**What C1 deliberately does NOT do:** it does not reproduce the production belief-stances block header or
its placement inside a full subject-data section. The production framing / placement / H6 question is a
**different** uncertainty, and C1 must not silently absorb it. The design is state-blind: no full subject
state, no observation, no affect, no memory, no relationship state, no production task, no A1 output, no
HIGH/LOW labels.

**Semantic relation stays explicit in both conditions.** D3-B already established relation-recognition
capability; C1 tests stance-representation usability, and mixing relation recognition back in would
destroy the isolation.

## E. HISTORICAL REFERENCE OR CONTEMPORANEOUS RERUN — THE DECISION

**`RERUN_BOTH_CONDITIONS_CONTEMPORANEOUSLY_IN_ONE_FROZEN_SCHEDULE`.**

The eight comparison conditions are satisfied on paper — same executor identity, generation settings, A/B,
semantic relation, measurement question, anchors, vocabulary and framing. **The ninth is not verifiable:**
`deepseek-flash` is a hosted model whose revision can change without notice and whose API exposes no
pinned revision. A difference observed across two sessions could therefore be **provider drift rather
than the representation**.

So the explicit condition is re-run alongside the record condition in one frozen schedule, as a
**contemporaneous causal comparator reference**. This is **not** a repeat confirmation of C0a: C0a
established that the capability exists; the C1 explicit arm supplies a same-session reference for the
contrast. The decision is explicitly recorded as **not cost-driven** — and the cost is real: the target
budget doubles relative to a naive one-condition run. **That price is accepted for attribution.**

## F. ALLOWED MODEL-FACING DIFFERENCES

Constant across all four cells: the system message (base research frame **and** measurement contract),
schema, anchors, output vocabulary, proposition A, proposition B, the explicitly supplied relation, the
measurement question, the cue prefix, and the generation settings.

Allowed to differ: **the value after the cue prefix.** One line is the entire difference; a second
correlated difference blocks the design. The four requests are *not* byte-identical to each other and
that is expected — what must be identical is everything outside that one value.

**Information equivalence** is an **evidence bridge, not a new assumption**: `SUPPORTS` ↔ credence `0.80`
and `OPPOSES` ↔ credence `0.20`, on the strength of D2-A0's directional result on the real CharacterOS
representation. The bridge equates the two in **preregistered polarity**, not in information content.

## G. SCORER

Reused **unchanged** from D4-C0a revision 1: per cell, the predicted token is the unique modal **and** its
count is ≥ 4 of 6. Cells are scored independently. `standard_lowered: false`. A reversed direction is a
NULL; a 3-2-1 plurality is a NULL. No threshold or interval added.

## H. THE FROZEN OUTCOME MATRIX

| row | condition | verdict | effect | authorises |
| --- | --- | --- | --- | --- |
| **EXPLICIT+ / RECORD+** | both conditions satisfy the criterion in both stances | `CHARACTEROS_BELIEF_RECORD_SUPPORTS_STATE_BLIND_CROSS_EXPRESSION_COMPOSITION` | `H_REPRESENTATION` **strongly weakened**; `H_FRAMING` raised to leading | **nothing about the representation** |
| **EXPLICIT+ / RECORD null** | explicit satisfies, record is a valid null | `CROSS_EXPRESSION_COMPOSITION_SENSITIVE_TO_STANCE_REPRESENTATION_FORM` | `H_REPRESENTATION` **strengthened** | **representation-component localisation research only** |
| **EXPLICIT null / RECORD null** | neither satisfies, valid data | `D4_C1_COMPARATOR_REFERENCE_NOT_ESTABLISHED` | nothing changes; the *design* failed to hold | nothing |
| **EXPLICIT null / RECORD+** | contradicts the frozen prediction | `D4_C1_UNEXPECTED_PATTERN_RECORDED_NOT_RANKED` | not supported | nothing — **no ranking of CharacterOS above an explicit representation** |
| **any inconclusive** | invalid output or integrity failure | `D4_C1_INCONCLUSIVE` | nothing localised | nothing |

The second row is **the most discriminating one**, and even it does **not** authorise changing the
production representation, claiming `proposition_id` is the cause, claiming the credence is the cause,
claiming a semantic ID is required, or claiming the architecture is broken. **The record differs from an
explicit word in at least four ways at once** — a long opaque id, a numeric credence instead of a word, an
object wrapper, and a label bound to the exact wording — and one experiment cannot separate them.

## I. H1/H4/H6 UPDATE RULES

- **`H_REPRESENTATION`** — strengthened **only** by the EXPLICIT+/RECORD-null row; strongly weakened by the
  both-positive row; **never "proven"** by any row.
- **`H_FRAMING`** — raised to the leading candidate by a record-positive row that coexists with the frozen
  A1 null; it can **never be closed by C1**, which deliberately does not reproduce the production block
  header or placement.
- **`H6`** — **REMAINS OPEN in every row.** A record-positive result makes it more prominent without
  settling it; a record-null result does not make it disappear.
- **`H_EXEC_COMPOSITION`** — not the main explanation unless the **explicit** arm itself fails to reproduce
  inside this design. The C0a result stands; the C1 explicit arm is its contemporaneous reference.

## J. C0b STATUS

**`D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN`.** C0b was to compare an explicit stance against a
CharacterOS credence-record representation; **C1's RECORD condition is exactly that comparison**, done with
a matched instrument and a contemporaneous reference. A separate C0b would add cost without adding
information. `c0b_should_be_run: false` — a design decision, and no C0b was executed.

## K. QUALIFICATION AND STABILITY REUSE

**The question that decides it: what changes — a treatment representation or a measurement instrument?**
A **treatment representation**, only. The contract, anchors, schema, output vocabulary and base system
framing are unchanged (hashes re-recorded in the manifest). D4-C0a qualification established that the
instrument can report the three stance tokens; **C1 changes the stimulus, not the instrument**, so the
qualified instrument carries over unchanged. **Requalification: 0 calls.** What *would* have required it —
a change to the contract, anchors, schema, vocabulary or required output form — does not occur.

**Stability is a different answer.** The record **input form** raises a genuinely new self-noise question
that the explicit form's gate cannot answer. So **one** gate is worth its cost: 6 calls on a **non-target**
record-form fixture (a synthetic proposition in record form with an aligned synthetic B), under the frozen
rule — all six legal and mutually agreeing. On PASS the target proceeds; on STOP the stage stops. This is
**not** a mechanical copy: only the new input form raises a new question, and the transport path is
unchanged.

## L. CALL-BUDGET DERIVATION

| term | calls | why |
| --- | --- | --- |
| requalification | **0** | the instrument did not change |
| stability gate | **6** | the record input form is new |
| target cells | **24** | 4 cells × 6 replicates |
| **total** | **30** | |

Each term is justified rather than inherited. Copying C0a's conventions mechanically would have cost 39
(9 + 6 + 24); **the saving is exactly the unjustified requalification.**

## M. ARCHITECTURE GATE

**`CLOSED`. `characteros_may_be_modified: false`.** Even the most discriminating row authorises
**representation-component localisation research only**, and that only if it names **which** component of
the record differs in effect. The full comparator-equality list and the requirement to **mechanically
enumerate every model-facing byte difference** carry over from revision 1, with the
**stance-information source/representation** as the only permitted scientific difference.

## ARTIFACTS

`research/experiments/belief-representation-comparator-d4-c1/evidence/v1/` — `c0a-reference-verification.json`,
`characteros-record-audit.json`, `cell-isolation-audit.json`, `instrument-reuse-audit.json`,
`contract-manifest.json`, `D4_C1_PREREGISTRATION_VERDICT.json`

`tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS; no credential
in any artifact; no CharacterOS change; no comparator implemented; no model called.

**The next round may only:** implement the frozen record-form condition and its non-target stability
fixture, pass offline conformance at **zero** calls, freeze the implementation hashes, then run the
stability gate. It may not call any model, modify CharacterOS or its production representation, add a
helpful annotation or a derived stance to the record, change the measurement contract, anchors, schema or
vocabulary, or lower the per-cell standard.
