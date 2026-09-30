# D4-C1 RECORD-FORM NON-TARGET STABILITY GATE — ROUND REPORT

**`D4_C1_RECORD_STABILITY_GATE_PASS`**
**`D4_C1_TARGET_EXECUTION_AUTHORISED`**
**`D4_C1_TARGET_NOT_EXECUTED`** · `D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN` · `LINK_4_REMAINS_LOCKED` · `CHARACTEROS_UNMODIFIED`
**`C1_MODEL_CALLS = 6`** (exactly six: no retry, no replacement, no seventh call) · **target calls 0** · `git status packages/` empty.

---

## 1. RECORD RENDERER IDENTITY

`buildC1CellRequestV0` + `renderC1BeliefRecordV0`, source
`sha256:16bb88e667c4807c…`. It produces the three production fields in production order via
`JSON.stringify`, and it adds **nothing**: no derived stance, no SUPPORT/OPPOSE word, no semantic alias,
no relation metadata, no explanatory prose, no debugging metadata, no production framing.

## 2. PRODUCTION-BYTE FIDELITY — BYTE FOR BYTE

§2 was this round's most important gate, and it was passed on the strict reading:

| check | result |
| --- | --- |
| rendered `proposition_id` equals the frozen production extract | **yes** |
| rendered SUPPORT record bytes equal the frozen bytes | **yes** |
| rendered OPPOSE record bytes equal the frozen bytes | **yes** |
| comparison is byte-for-byte, not parsed equality | `true` |

Checked per the brief: field ordering, key spelling, quote style, whitespace, numeric rendering,
`proposition_id`, `proposition_label`. Had the extractor and the renderer diverged, the run would have
stopped at zero calls.

## 3. PROPOSITION-ID DERIVATION AUDIT

The production derivation is reproduced
(`hashEnvelope("characteros-next/belief/proposition-key/v1", { canonical_label })`), and the mutation audit
confirms its two defining properties:

- the **same** label gives the **same** id;
- a single **trailing space** in the label changes the id;
- the id is **not** a function of the credence (the 0.8 and 0.2 records share their id — the two strings
  are identical up to and including `"credence":`);
- the synthetic stability proposition yields the **already frozen** id
  `belief-prop-v0-ac9a923f23c8624…` — **derived, not written**, no random UUID, not derived from the
  credence.

## 4. FOUR-CELL ISOLATION RECHECK

- the **explicit** cells still reproduce the frozen C0a identities exactly (hashes equal);
- the **record** cells carry the renderer's production bytes;
- all four collapse to **one** normalised form after the frozen sentinel substitution.

## 5. FROZEN 24-CALL TARGET SCHEDULE INTEGRITY

Verified, **not re-optimised**: 24 entries, six four-trial blocks, every block holding each cell exactly
once, per-cell totals 6/6/6/6, **ordering unchanged** from the frozen artifact. The measured
`max_consecutive_same_representation: 3` is a **property of the frozen design** and was left alone:
`reoptimised_because_of_the_run_of_three: false`, `temporal_balance_design_unchanged: true`.

## 6. STABILITY FIXTURE IDENTITY

Non-target synthetic proposition at credence **`0.95`** (not an experimental value), id derived by the
production algorithm:

```
{"proposition_id":"belief-prop-v0-ac9a923f23c8624…","proposition_label":"A clamp should always be used when gluing a joint.","credence":0.95}
```

**It uses the exact same renderer as the target record conditions** — `simplified_stability_only_renderer:
false` — because otherwise the gate could not measure the target's record input form.

**Non-target, verified:** no canonical target A, no target B, no target `proposition_id`, no cell label, no
schedule identity, no expected target token, no C1 scientific result, and no experimental credence.
Request `sha256:6aba0d79e2600b5f…`.

## 7. THE SIX STABILITY OUTCOMES

| # | trial | token | ms |
| --- | --- | --- | --- |
| 1 | `STABILITY-001` | `SUPPORTS_B` | 511 |
| 2 | `STABILITY-002` | `SUPPORTS_B` | 487 |
| 3 | `STABILITY-003` | `SUPPORTS_B` | 401 |
| 4 | `STABILITY-004` | `SUPPORTS_B` | 784 |
| 5 | `STABILITY-005` | `SUPPORTS_B` | 621 |
| 6 | `STABILITY-006` | `SUPPORTS_B` | 471 |

`STABILITY-006` ran even though the first five already agreed.

## 8. COLLECTION INTEGRITY

Planned 6, records 6, duplicate 0, missing 0, extra 0, all request hashes exact, **comparator target
requests used: 0**, invalid **0**, transport failures **0**, one distinct request hash.

## 9. CORRECTNESS-VS-STABILITY SEPARATION

Demonstrated on the classifier: six identical **`UNCERTAIN_B`** tokens — **not** the fixture's expected
token — **still PASS**, and the verdict is unchanged. The gate ignores correctness; qualification owns it.
The classifier also records `target_sample_size_set_by_this_gate: false` and
`target_schedule_modified: false`.

## 10. THE FALSIFIABILITY HARNESS

Ten rows, each **first verified to have changed the intended value**, then checked against the gate — the
2026-09-21 lesson applied. **Nine `FALSIFYING` rows all flip `PASS → STOP`**: one legal disagreement, one
invalid, all invalid, an out-of-vocabulary token, a missing trial, a duplicate identity, an extra trial, a
wrong request hash, and a substituted comparator-target hash. **One `POSITIVE_CONTROL` row must NOT change
the gate** (six identical but different legal token) and does not.

## 11. FROZEN CLASSIFIER OUTPUT

`classifyC1RecordStabilityV0` (name frozen at **revision 1.1**, rule unchanged from revision 1) called on
the re-read frozen dataset bytes: outcome **PASS**, `gate_verdict: D4_C1_RECORD_STABILITY_GATE_PASS`,
`counts {SUPPORTS_B: 6}`, `invalid_count: 0`, `integrity_ok: true`,
`evidence_class: INSTRUMENT_STABILITY`.

## 12. DATASET HASH

`D4_C1_RECORD_STABILITY_DATASET_SHA256` — frozen with `scored: false` **before** classification, and
independently recomputed from the file's bytes.

## 13. TARGET AUTHORISATION AND TARGET CALLS

`D4_C1_TARGET_EXECUTION_AUTHORISED: true`, **target calls: 0**. The 24-call comparator is frozen and was
**not** executed — not even partially.

## 14. WHAT THIS RESULT DOES AND DOES NOT MEAN

It means **one thing**: under one frozen non-target record-form request, the measurement path was
self-consistent across the six planned calls.

It does **not** mean that the CharacterOS record representation works, that record composition works, that
`H_REPRESENTATION` is weakened, or that `H_FRAMING` is strengthened — all four recorded as explicit
non-meanings in the manifest. **The scientific comparator has not run.**

## 15. CHARACTEROS MODIFICATION STATUS AND LINK 4

**Unmodified.** `git status packages/` empty; no production belief record, proposition id, projection,
prompt, semantic relation or embedding was touched. **Link 4 remains locked**; `link_4_reopened: false`.

## 16. ARTIFACTS

`research/experiments/belief-representation-comparator-d4-c1/evidence/stability/` —
`record-renderer-fidelity.json`, `proposition-id-derivation-audit.json`, `four-cell-recheck.json`,
`target-schedule-integrity.json`, `stability-fixture-audit.json`, `stability-classifier-conformance.json`,
`implementation-manifest.json`, `stability-schedule.json`, `trial-001..006.json`,
`collection-integrity-report.json`, `D4_C1_RECORD_STABILITY_DATASET.json` (`scored: false`),
`stability-dataset-hash.json`, `frozen-classifier-output.json`, `D4_C1_STABILITY_MANIFEST.json`

Requalification **0** — the measurement instrument is unchanged. Prior evidence recomputes (D4-C0a target
`8a6ca2c8…`, D4-C0a noise `d7f969ca…`); the revision chain holds (rev1 preserves rev0, rev1.1 preserves
rev1). `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS; no
credential in any artifact.

**Stopped here.** The next round may only execute the frozen 24-call comparator target and classify with
the frozen scorer. It may not re-select the stability fixture, add calibration or adaptive replication,
modify CharacterOS, or modify the schedules or the classifier.
