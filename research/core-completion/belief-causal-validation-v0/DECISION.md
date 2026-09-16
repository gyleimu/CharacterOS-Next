# BELIEF_CAUSAL_VALIDATION_V0 — DECISION (READ-ONLY GATE, STOPPED)

Baseline SHA: `35de2cee827f042f1a761f2752c3af02a3740d93` (`main`, clean, HEAD == origin/main).

## Verdict

**`BELIEF_CAUSAL_PATH_NOT_IMPLEMENTED`** — the experiment was **not** run. Protocol §4 required a
read-only audit of the production Belief path before any experiment code; that audit found the
upstream formation path absent, so no honest experiment is constructible and **no state was
fabricated to create one**. Per §4 and §29 nothing was repaired, no production file was touched, and
this record is the deliverable.

## Answering §4 directly: is there a downstream consumer?

**Yes, for cognition — no, for decision.** Both halves were traced to file:line.

### Downstream (belief → cognition): EXISTS

`cognition-action-transition-executor.ts:304-305` and `:436-442` project the canonical belief items:

```
belief_item_count: snapshot.beliefs.items.length,
belief_items: snapshot.beliefs.items
```

`conversation-cognition-provider-v2.ts:273` renders them into the model-facing user turn:

```
[SUBJECTIVE BELIEF STANCES — read-only subject state; persistent subjective epistemic stances that
may be wrong or uncertain; NOT objective world facts; credence is subject endorsement strength,
NOT world truth; proposition IDs are STATE LOCATORS ONLY, never refs]
showing ${belief_item_count} of ${belief_item_count} canonical belief item(s)
<one JSON line per item>
```

So the semantics are already correctly bounded in the model-facing contract: credence is explicitly
**subject endorsement, not world truth**. The live executor imports **no** belief decision module.

### Downstream (belief → decision): ABSENT

`belief-decision-arbitration-policy.ts`, `belief-decision-integration-policy.ts` and
`belief-decision-influence-relation*.ts` have **no production caller**. Their only non-test reference
is a barrel re-export (`index.ts:651`). The frozen `UNIQUE_POSITIVE_MAX` arbitration is a foundation
with no live consumer. This is a second gap, but not the blocking one.

### Upstream (lived evidence → belief): **ABSENT — the blocking gap**

Five independent facts, each verified:

| # | fact | evidence |
| --- | --- | --- |
| 1 | Genesis is permanently empty | `belief-init.ts` returns a frozen `{schema_version, items: EMPTY_ITEMS}`; `subject-state-v4-genesis.ts:117` copies v3 `beliefs` verbatim, so a fresh subject has zero items |
| 2 | The only formation path cannot create a proposition | `belief-plasticity-producer.ts` header: `NEW_PROPOSITION_CANDIDATE` is rejected as `INELIGIBLE_SEMANTIC_KIND` — "a NEW candidate has NO canonical identity authority and can never drive credence" |
| 3 | With an empty catalog the update law can never fire | the same producer handles only `EXISTING_PROPOSITION ± 0.05`; with zero items there is no proposition id to target, so credence can never move |
| 4 | No production module constructs an INSERT | `proposition_key` / `initial_credence` appear only in `belief-mutation-proposal.ts` (validator) and `belief-transition-executor.ts:139-150` (the executor). The semantic provider is explicitly forbidden from emitting them (`belief-semantic-ollama-provider.ts:89`), and `belief-semantic-target-resolution.ts:26` confirms INSERT carries no `proposition_key` and no `initial_credence` |
| 5 | The one lawful INSERT is host-authored, not evidence-derived | `BeliefTransitionExecutor.execute` can commit an INSERT from an explicit `proposition_key` + `initial_credence` supplied by a trusted caller |

Consequence: the canonical belief catalog of any production subject is permanently empty, the
cognition renderer therefore always emits `showing 0 of 0 canonical belief item(s)`, and "different
lived evidence → different governed belief credence" is **not implementable today**.

### Why no experiment was built anyway

§6 enumerates exactly what would otherwise be the only ways to produce a non-empty belief state —
direct Belief object mutation, seeding, fixture write, debug override, prompt narration, fake
history authority — and forbids all of them. Using `BeliefTransitionExecutor`'s INSERT with a
host-invented `proposition_key` and `initial_credence` is *host-authored fixture state*, not formed
by lived evidence, so it would measure a fixture, not Belief causality. Fabricating it would
manufacture precisely the conclusion the north star asks to test. §4 says STOP and list the gap;
§29 says do not turn an experiment need into a production patch. Both were honoured.

## Architecture gap (reported, NOT implemented)

The north star needs, in dependency order:

1. **A lawful evidence→proposition admission path.** Something must be allowed to create the FIRST
   canonical proposition with identity authority derived from admissible evidence — today
   `NEW_PROPOSITION_CANDIDATE` is explicitly denied that authority, and the belief semantic provider
   is forbidden from supplying a key. This is the single blocking gap.
2. **A decision relation, if a decision claim is ever wanted.** Arbitration and the tendency
   projection exist but have no live consumer; §24 forbids inventing a feature/action mapping, so a
   decision-level claim needs its own authorized typed relation.
3. Both are Belief-domain architecture work. Neither is in scope for this slice, and per §4 the
   correct action was to report them rather than implement them.

## What is UNCHANGED and uncontested

- **Frozen Belief semantics were not touched.** Credence remains `subjective endorsement`, not
  objective truth probability; `stance(c) = 2c − 1`; arbitration `UNIQUE_POSITIVE_MAX` (unique
  positive maximum → selection, tie → `NO_SELECTION`, maximum ≤ 0 → `NO_SELECTION`). No 0.5-neutrally
  assumption, no cross-domain numeric mixing, no new arbitration rule.
- **Relationship stage closure stands** (`RELATIONSHIP_FAMILIARITY_STAGE_CLOSED`, decision admission
  still `0`); nothing was reopened.
- `ARCHITECTURE_CHANGES = NONE` — no production file, no Belief module, no Writer Authority, no
  Relationship/Belief/Affect/Memory/persistence change; no experiment code was written because no
  admissible experiment exists.

## Consequence for the roadmap

`BELIEF_CAUSAL_VALIDATION_V0` is **not runnable as specified**. Any future attempt must first be
authorized to change the Belief-domain architecture (gap 1), and that authorization does not exist
in this slice. No `INCONCLUSIVE` was manufactured, no V1/V2/V3 loop was started, and no Belief
decision rule was invented to make the experiment possible.

## Recommended next step (for the operator to decide, not taken here)

Exactly one: an explicit architecture-decision slice for **evidence→proposition admission** in the
Belief domain — deciding whether a governed INSERT may exist at all, what evidence class may
authorize it, and how proposition identity is derived — before any causal experiment is attempted.
Until then the honest status of Belief causality is: **path not implemented, effect untestable.**
