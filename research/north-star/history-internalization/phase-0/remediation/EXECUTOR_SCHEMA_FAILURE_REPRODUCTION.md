# EXECUTOR SCHEMA FAILURE — REPRODUCTION

**0 model calls. Stub transports. No production change.** Machine-readable evidence:
`PHASE0_RUN1_REPRODUCTION.json`, `PHASE0_RECOVERY_PROBE.json`, `remediation.test.ts`.

---

## 1. WHY A REPRODUCTION WAS REQUIRED FIRST

The brief forbids inferring the root cause from run-1's artifacts. `reproduce.ts` therefore drives
the **real** production runtime with deterministic stub transports and asks whether the chain
reappears. It is independent of run-1's wording: the malformed response is constructed from the
authoritative contract.

## 2. THE FIRST ATTEMPT DID **NOT** REPRODUCE — AND THAT IS THE MOST USEFUL RESULT

The first malformed shape was a valid proposal with the `subjective_selection` **key deleted**. It
produced a **different** failure on a **different** path:

| | first attempt | run-1 |
| --- | --- | --- |
| shape | `subjective_selection` key removed | key present, `kind = NO_SUBJECTIVE_SELECTION` |
| rejection | `CONVERSATION_COGNITION_MODEL_SCHEMA_INVALID: unexpected keys` | `CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED: SEMANTIC_COMPLETENESS_FAILED` |
| turn status | **DEGRADED** | **FAILED** |
| turn index advanced? | **yes** (1 → 2) | **no** (1 → 1) |
| next turn | completed normally | ingress CONFLICT |

The cause is the order of checks in `conversation-cognition-proposal.ts:1904-1910`: the
**structural** closed-key check runs **before** the **semantic** completeness check. A structurally
broken response is caught by the first and routed to the *protected* DEGRADED branch; only a
structurally valid but semantically incomplete response reaches the *unprotected* FAILED branch.

**Consequence:** "the model produced an invalid response" is not one condition. At least two
distinct violations exist, on two code paths, with two different post-turn session states — and only
one of them is poisonous. Had this reproduction been skipped, the root-cause document would have
named the wrong mechanism.

## 3. THE CONTRACT-DERIVED SHAPE

```ts
// conversation-cognition-proposal.ts:1904
if (kind === PRIMARY_RESPONSE_KIND_STANCE_V0) {
  const keys = exactClosedKeys(value, STANCE_ATOM_KEYS, detail);   // structural — FIRST
  if (keys !== null) return { ok: false, detail: keys };
  if (proposal.subjective_selection.kind !== SUBJECTIVE_SELECTION_KIND_SELECTED_V1) {
    return { ok: false, detail: `… PRIMARY_STANCE requires an authoritative … stance` };  // semantic
  }
```

Minimal violating response: keep the shape valid, set `response_semantics = { kind: "PRIMARY_STANCE" }`,
leave `subjective_selection = { kind: "NO_SUBJECTIVE_SELECTION" }`.

With that shape the reproduction is **confirmed on all eight observations**:
valid turn passes → invalid turn fails closed with `SEMANTIC_COMPLETENESS_FAILED` → the index does
not advance → canonical state still advances (rev 6 → 10) → the next valid turn reuses `turn-1` →
ingress `CONFLICT` → the poisoned next turn reproduces.

## 4. RECOVERY PROBE

`probe-recovery.ts` compares the two possible responses to a FAILED turn:

| path | result |
| --- | --- |
| **A** — keep using the session | valid turn **rejected** (`completed = false`) |
| **B** — restore the durable snapshot taken before the failing turn, then submit the same valid turn | valid turn **completed** (`completed = true`) |

**Verdict: `DOCUMENTED_RECOVERY_PATH_WORKS`.** The recovery the runtime's comment prescribes is real
and sufficient. The defect was never a missing rollback; it was a missing host.

## 5. REGRESSION (§14)

`remediation.test.ts`, four tests, all passing, 0 model calls:

| test | what it pins |
| --- | --- |
| **BASELINE** | an unwrapped session poisons itself: the third turn dies with `ingress must record (CONFLICT)` — the defect is real, not theoretical |
| **FIXED (STOP)** | the invalid turn is **still invalid** and fail-closed; the next turn is refused **locally** with `SESSION_REQUIRES_RECOVERY`, and the cognition call count proves no provider call was made |
| **FIXED (RESTORE_AND_CONTINUE)** | the third turn **reaches its normal execution path** and completes; the invalid turn remains on the record as invalid; recovery is visible, never silent |
| **NO COERCION** | the invalid turn exposes no fabricated behaviour and no upgraded commit |

The required VALID → INVALID_SCHEMA → VALID sequence therefore holds, with the second step still
invalid.

## 6. EXISTING DIAGNOSTIC READ BEFORE ANY CHANGE (§6)

`research/experiments/executor-schema-failure-diagnostic-v0/` already classifies this failure:

- taxonomy: `SEMANTIC_COMPLETENESS_FAILED` → `RESPONSE_SEMANTICS_INCOMPLETE`
  (`taxonomy.ts:63`);
- its tests construct exactly the failing shape —
  `proposal["response_semantics"] = { kind: "PRIMARY_STANCE" }` (`diagnostic.test.ts:254, 324`);
- it is explicitly **non-confirmatory**: it "characterizes a FAILURE MECHANISM… not a rate, not a
  p-value and not a confirmatory denominator", and carries `MAX` calls as a ceiling;
- it has **no evidence directory** — it was never executed at scale;
- it is scoped to **`deepseek-flash`**.

**Conclusions drawn, without assuming identical root cause because the names match:**

- This is the **same structural class** — the contract, the rule and the rejection string are
  identical, verified in source, not merely by name.
- Run-1 supplies the **first live instance** of that class, which the existing line never captured.
- It occurred on **`qwen3.5:9b`**, so the class is **not model-specific to `deepseek-flash`** — a
  fact the existing line could not know.
- **n = 1.** This is a mechanism observation. Nothing here converts it into a rate.

## 7. RESIDUAL RISK, STATED PLAINLY

Failure Class A is **not** fixed. A rerun on the same executor can hit it again, and the scientific
policy will then return `INCONCLUSIVE` again. Two things follow:

1. Recovery makes that outcome **clean and cheap to diagnose** rather than a three-turn cascade.
2. If the operator wants a lower probability of Class A, R2 (grammar-constrained decoding) is
   available and specified in `EXECUTOR_ROBUSTNESS_INVARIANT.md §4` — but applying it changes the
   executor's wire bytes and must be declared as a change of conditions.
