# HISTORY_INTERNALIZATION_V1 — PHASE 0 · PRE-TEST STATE GATE REPORT

**`PRE_TEST_GATE_PUBLISHED`** · **`MODEL_CALLS = 0`** · **`READ_ONLY = TRUE`** · **`SUBJECT_STATE_WRITTEN = FALSE`**
`REAL_SUBJECT: INCONCLUSIVE_BY_SATURATION` · `RUN5_SUBJECTS: BOUND HALF PASSES, δ_state GATE_INCOMPLETE`
**`THIS IS NOT EVIDENCE AGAINST H1 AND NOT A NULL RESULT`**

Evidence path mandated by §15 of `research/north-star/HISTORY_INTERNALIZATION_TEST_V1_DESIGN.md`.
Implementation: [`pre-test-gate.ts`](pre-test-gate.ts). Conformance: [`evals/conformance/history-internalization-v1-pre-test-gate.test.ts`](../../../evals/conformance/history-internalization-v1-pre-test-gate.test.ts).

---

## 1. WHY THIS IS PUBLISHED FIRST

§7 of the design doc states the rule this report applies:

> **State-distance gate.** ... The test phase may run only if `δ_state ≥ δ_min` for the declared target
> dimension **AND no target dimension is at a bound**. If the gate fails, the run is recorded as
> `INCONCLUSIVE_BY_SATURATION` — a statement about the trajectory design, **not** evidence against H1.

and the Phase-0 honesty clause requires the state-distance result to be **published first**, not
predicted. It is also free: §7 says "All state reads are read-only projections over an exact historical
revision ... Zero model calls."

## 2. THE REAL SUBJECT — `INCONCLUSIVE_BY_SATURATION`

`alice-longrun-869f387d`, 216 episodes (`logical_time` 216), revision `R647`, state revision 1954.

| dimension | §7 rule | reading |
| --- | --- | --- |
| **affect** | activation NOT pinned at 1.0 | **AT A BOUND — `activation = 1` exactly**, valence `0.9933555062550344` |
| belief | `0 < credence < 1` for ≥1 item | NOT READ over this path — §7 requires the production read-only projection; this program refuses to guess a gate input |
| relationship | below the `32/32` cap | same |
| regulation | recorded to document inertness | the durable identity carries no regulation block; §7 does not gate it |
| personality | reported as an ABSENCE | reported as an absence |
| memory | reported, not gated | 216 episodes |

**The affect bound is re-measured on the current snapshot, not quoted from the audit.** The audit
reported "19/19 and 50/50 end-of-turn readings at exactly 1.000". Across the full history this snapshot
carries: **634 affect applications, 354 of them at the 1.0 bound — 55.8%**.

**Outcome: `INCONCLUSIVE_BY_SATURATION`.** §7's conjunction fails on `no target dimension is at a bound`.

### What that means, and what it does not

- It is **"a statement about the trajectory design, NOT evidence against H1"** (§7).
- It is **not a null result.**
- `GATE_INCOMPLETE` is **not** a pass; neither is an empty dimension list.
- The design doc's phasing says Phase 1 (the two-trajectory life) is "Required only if Phase 0 is
  `INCONCLUSIVE` rather than negative". Phase 1 has been run — `HISTORY_INTERNALIZATION_TEST_V1_PHASE_0`
  run-5 attempt 2 returned **POSITIVE** at **L2**. So the path actually taken is the design doc's own
  prescribed path for this subject.

**The process requirement was still unmet until now**: §7 requires this gate to be *published* rather
than assumed, and it had never been published.

## 3. THE FRESH SUBJECTS FROM THE L2 RUN — the bound half PASSES

Evaluated on run-5 attempt 2's frozen `pre-state-*.json` / `post-state-*.json`, which were written by the
production read path and therefore contain the FULL canonical state view — so every gated dimension is
readable here, unlike on the live subject.

| dimension | arm A POST | arm B POST | §7 rule |
| --- | --- | --- | --- |
| affect | `activation 0.4906` | `activation 0.5045` | not pinned → **passes** |
| belief | `prop.nadia-keeps-commitments = 0.8000000000000003` | `= 0.4` | one item strictly inside (0,1) → **passes** |
| relationship | `0 counterpart(s)` | `0 counterpart(s)` | below the cap (vacuously); **carries no contrast** |
| regulation | `{energy:1,stress:0,arousal:0.5,fatigue:0}` | same | recorded, not gated |
| personality | absent by construction | absent | reported as an absence |
| memory | `logical_time 5`, `state_revision 47` | same | reported, not gated |

Measured target-dimension contrast: **belief post A `0.8000000000000003` vs post B `0.4` → |Δ| = 0.4**.
Recorded as *measured*; it is **not** compared to `δ_min`, which is undeclared.

Per-subject outcome: `GATE_INCOMPLETE` — **only** because `δ_state`/`δ_min` are undeclared.

## 4. WHAT REMAINS UNDECLARED, AND WHY THIS REPORT DOES NOT FILL IT IN

**`δ_state` needs the twin, and the frozen design does not specify the twin construction.** §6 defines the
four cells (A/B/C/D) and the `ablation_equivalence` requirement for the *retrieval* dimension, and §7
defines `δ_state` as "the declared distance between a trajectory's state and **its twin's** state". But no
document specifies how a twin is built, nor an equivalence rule for the *state* dimension (A→C, B→D) to
sit beside the retrieval one. This report therefore reports `GATE_INCOMPLETE` and does **not** invent a
twin. A guessed gate input would be worse than an absent one.

Consequence, stated plainly: **the gate is published for the bound half on both subject sets, and remains
incomplete on the `δ_state` half.** The bound half is the half that decides `INCONCLUSIVE_BY_SATURATION`
on the real subject, and it is decisive there.

## 5. TWO DEFECTS IN MY OWN RULES, FOUND BY THE CONFORMANCE SUITE

1. **A `δ_state` failure was allowed to pass.** `decidePreTestGateV0` pushed the `δ_state < δ_min` reason
   into the list but still returned `GATE_PASS`, so a run whose state distance was too small would have
   proceeded. Fixed: with §7's blanket sentence — "If the gate fails, the run is recorded as
   `INCONCLUSIVE_BY_SATURATION`" — a δ failure carries that verdict, with the reason naming δ, rather than
   inventing a token the frozen text does not contain.
2. **An empty relationship set was misreported as saturated.** §7's rule is "below the `32/32` cap"; an
   empty set is *vacuously* below the cap. The rule had conflated "not at a bound" with "carries content".
   Now split: `cap satisfied` (vacuously true when empty) and `carries_contrast` (false when empty), so a
   dimension that is merely empty is not reported as a bound failure — and is not silently relied on as
   the declared target dimension either.
3. Related precision fix: affect now fails for **two distinct reasons kept distinct** — pinned at exactly
   1.0 (§7's rule) versus out of domain (`>1` or `<0`), because reporting an out-of-domain value as
   "non-degenerate" would be a silent hole.

## 6. REPRODUCTION

```
npx tsx research/experiments/history-internalization-v1/pre-test-gate.ts
npx tsx research/experiments/history-internalization-v1/pre-test-gate.ts --run <frozen-run-dir>
npx vitest run evals/conformance/history-internalization-v1-pre-test-gate.test.ts
```

Artifacts: `evidence/pre-test-gate.json` (live subject), `evidence/pre-test-gate-run5.json` (frozen run).
