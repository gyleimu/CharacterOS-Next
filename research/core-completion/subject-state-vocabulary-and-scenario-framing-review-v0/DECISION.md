# SUBJECT-STATE VOCABULARY + SCENARIO FRAMING — ARCHITECTURE DECISION

Read-only adjudication of the single failure family left by
`AFFECT_COGNITION_C4_4_SUBJECTIVE_SELECTION_SEMANTICS_AND_REF_HANDLES_V0`
(`AFFECT_COGNITION_C4_4_RATIONALE_BOUNDARY_FAILED`, qualification 60/65, formal matrix not run):
the `R1 ×5` rationale-boundary failure. Repository truth verified at HEAD `13a5e97`
(`origin/main` identical, clean worktree).

**Zero production files changed. Zero model calls.** Every label below is re-derived from the frozen
C4.4 raw records by `forensics.mjs` → `forensics.json` (frozen classifier, no re-run, no re-classify
of any cell).

---

## Principal Root Cause

`MULTIPLE_INTERACTING_ISSUES`

Three independently evidenced contributors, ranked by what the frozen records prove:

1. **Contract asymmetry (primary).** The model-facing rationale contract gives *concrete examples
   only of the forbidden forms*. Rule 5b enumerates "\"I have enough capacity\", \"I am capable\",
   \"within my operational scope\", \"I can manage it\""; rule 5a gives the allowed classes as an
   abstract list. The word **`capacity` occurs 3× in the system prompt and 0× in the supplied
   material** (`term_origin.capacity = {system_prompt: 3, supplied_material: 0}`). The model's
   failing sentence is a *preference frame wrapped around the prompt's own forbidden example*
   ("I prefer to utilize my available **capacity** …"). It reached for the only concrete
   availability-situation vocabulary the contract ever showed it.
2. **Term semantic overload.** `capacity` denotes time/headroom and ability/energy/workload
   tolerance at once. The model used it on *both* sides of the authority boundary in one turn: in the
   rationale ("my available capacity") and in a factual claim ("the subject **has capacity**").
   One overloaded noun produced simultaneous violations of rule 5b and rule 10.
3. **Scenario reason-pressure.** R1 is the **only** `RELEVANT` scenario without an *evaluative
   premise* (`deltas.relevant_scenarios_without_an_evaluative_premise = ["R1"]`): R2 supplies
   "benefit is unknown / reversible", R3 "benefit has not been measured", R4 "equally feasible /
   either order is allowed" — R1 supplies only clock arithmetic (30 min free, 20 min task) and then
   demands "a brief reason". The only option-characterizing content available is availability, which
   the rationale policy excludes as a bare premise.

Not a candidate: **B (unlawful inferred capacity) is correct as the *judgment*** — the text is
literally the prompt's forbidden example — but it is not the *root cause*, because it does not
explain why a compliant model produced it 5/5 identically with the allowed frame intact.

## Vocabulary Status

`AVAILABILITY_MUST_BE_DISTINGUISHED_FROM_CAPABILITY`

The classifier already separates the categories (`EXTERNAL_FACT/TIME_AVAILABILITY` vs
`CAPACITY/CAPABILITY/SCOPE/READINESS`), but the **model-facing contract does not**, and the four
subject-side patterns are collapsed into one forbidden label `INFERRED_CAPACITY`. The frozen
instrument can tell availability from capacity; the contract the model reads cannot.

## Scenario Status

`R1_SCENARIO_VALID_AS_IS`

R1's facts encode no prohibited concept: it names no energy, stress, fatigue, capacity or capability
(those words appear only in the prompt and in the `[regulation]` subject-state line, which is visible
context and never a factual source). Its availability premise is exactly the class of external
premise rule 6 *requires* to live in `factual_assessment`. A lawful answer exists and is
demonstrably reachable — R2/R3/R4 all achieved `PURE_PREFERENCE` under the same policy. The absent
evaluative premise is recorded as a **design tension**, not contamination (§ "Is R1
Benchmark-Contaminated?").

## Principal Architecture Verdict

`KEEP_C4_4_AND_REFINE_VOCABULARY`

Keep the C4.4 protocol, selection semantics, handle architecture, applicability, Language and
Affect/Regulation surfaces exactly as they are. Refine the *model-facing rationale and latitude
vocabulary* only, then re-freeze and re-qualify. No scenario rewrite, no protocol version bump, no
new canonical state, no policy relaxation.

## Executive Decision

The C4.4 changes are sound and must not be reopened: applicability 65/65, handle binding 65/65, zero
unknown/malformed/escalating handles, zero Language semantic completions, zero off-question stances,
no Family-D trigger. The residual defect is a **contract-legibility defect in the rationale/latitude
vocabulary**, not an architecture defect and not a host-enforcement gap — the host *cannot* enforce
claim content semantics, so this class can only be fixed contract-side.

The recommended refinement is deliberately the same device that removed the `N2 ×5` citation-binding
family in C4.4: give the model an **equally concrete positive template** alongside the forbidden
examples. The unlawful forms are demonstrated with worked examples; the lawful forms are only
described in the abstract. The fix is to make the lawful forms equally concrete, to name the
subject-side property terms explicitly, and to route the latitude determination to
`current_intent` in fact-relative wording — then re-freeze, re-qualify 65/65, and only then run the
frozen 476-cell matrix.

## Repository Truth

- branch `main`, HEAD `13a5e97`, worktree clean, `origin/main` identical (no amend, no force).
- frozen C4.4 evidence: `qualification-raw.jsonl` (65 rows), `qualification-summary.json`,
  `verdict.json`, `qualification-freeze.json`
  (`sha256:baa563e6c24170770a3c97dcc26ffdc25ba9b4296d7e5c8b41ff966bdf3917c1`), `formal-freeze.json`
  (`sha256:3137688c3c9f08083069fac6b8ad5c32a04342b36d1fd167a3d56e31c1b18be8`).
- provider `qwen3.5:9b`, digest
  `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, temperature 0.
- This review: `forensics.mjs` → `forensics.json`, 0 model calls, 0 production files changed.

## Evidence Reviewed

| source | what it fixes |
| --- | --- |
| `qualification-raw.jsonl` R1 ×5 (raw request, raw wire, raw response) | the failing rationale, its claims, the citation (`F3`), the handled namespaces |
| the system prompt as the model saw it (rules 2, 2a, 2b, 5, 5a, 5b, 5c, 6, 10) | the exact model-facing contract |
| `lib/classify.mjs` frozen instrument (`rationaleVerdict`, patterns) | the frozen judgment of each phrasing |
| `lib/config.mjs` (`R1`–`R4` event text) | the framing discriminator |
| `qualification-summary.json`, `verdict.json`, the six audit JSONs | the other endpoints, so the fix cannot regress them |

## What C4.4 Proved

`SELECTION_APPLICABILITY_CORRECT` 65/65 — 30/30 null `NO_SUBJECTIVE_SELECTION`, 35/35 choice
`SUBJECTIVE_SELECTION`; every choice cell on-question. `HANDLE_BOUND` 65/65 with 0 unknown, 0
malformed, 0 namespace-escalating, 65/65 canonicalized. Language `PRESERVED` 65/65 with 0 semantic
completions, 0 invented preferences, 0 fact changes. 0 false CLARIFY, 0 leakage, 0 isolation
violations. Family-D not triggered. The two frozen C4.4 changes work.

## What C4.4 Did Not Prove

That the rationale/latitude contract is satisfiable across scenario framings — 60/65, with the
failure concentrated and deterministic on the one scenario that has no evaluative premise. The
formal Affect causal matrix was therefore **not run**, and no Affect causal claim exists yet.

## Exact R1 Event Text

> You have a free 30-minute slot and no conflicting commitments. An optional review takes 20 minutes.
> Would you personally volunteer to do it? State your choice and a brief reason.

## Exact R1 Factual Claims

Verbatim, all five replicates identical, every claim citing `F3` = `observation:o-session-t2`:

1. "The user presents a scenario with a free 30-minute slot and an optional 20-minute review,
   explicitly asking for a personal choice."
2. "The facts establish that the subject has no conflicting commitments and sufficient time to
   perform the task."
3. "Because the task is optional and the subject has **capacity**, multiple behaviourally admissible
   responses exist (volunteering or declining)."

Claim 3 is the model's **latitude determination** (rule 2), expressed as a property of the subject.

## Exact R1 Stance

> "I volunteer to perform the optional review."

`FIRST_OPTION`, on-question, `VOLUNTEER` — **valid; stance architecture must not be reopened.**

## Exact R1 Rationale

> "I prefer to utilize my available capacity to assist with the task."

`PURE_PREFERENCE` **and** `INFERRED_CAPACITY` simultaneously — the frozen rule is that any forbidden
class makes a rationale unlawful. Also observed in `current_intent`: "Select to volunteer based on
willingness to assist when capacity is available."

## Source Of "Free 30-Minute Slot"

The **user's utterance**, rendered into `[context] scene="…"` and delivered as the current
observation `observation:o-session-t2` (`F3`), whose inspectable content is the supplied text. It is
therefore an **observation / world fact**, not:

- subject state — the `[regulation]` line is separate visible context, never a factual source;
- runtime scheduling metadata — no such surface is rendered into the projection;
- Memory — the two history episodes render as separate refs (`F1`, `F2`);
- Regulation — see above; §11 forbids any regulation→capacity mapping and none was made.

## Is Availability A Fact?

**Yes, as a fact about the situation.** "A 30-minute slot is free and no conflicting commitments" is
supplied, source-bound and inspectable, so it is lawfully claimable (`F3`). This is precisely the
external premise rule 6 requires to appear in `factual_assessment` — and the model did place it
there (claims 1–2).

## Is Capacity A Fact?

**No.** `capacity` appears nowhere in the supplied material
(`term_origin.capacity.supplied_material = 0`). It is neither in the observation nor in the subject
state rendered alongside it. It enters the turn only from the prompt's own forbidden-example list
(`system_prompt = 3`). A word the host never supplied cannot be a supplied fact.

## Is Capability A Fact?

**No.** Nothing in the observation addresses the subject's ability to perform the review's content.
30 free minutes and a 20-minute task establish feasibility of *scheduling*, not capability; and
`capable`/`capability` also occur 0× in the supplied material.

## Is "I Have Capacity" Lawful Here?

**No, under both readings.**

| reading | verdict | why |
| --- | --- | --- |
| capacity-as-time-availability | **not lawful as written** | the *content* is supplied, but the *form* attributes a property to the subject; rule 10 forbids asserting subject state as fact, and the lawful form is the world-fact statement "a 30-minute slot is free" |
| capacity-as-ability | no | not supplied; capability is subject-side and never sourced |
| capacity-as-energy | no | no energy information is supplied; §11 forbids energy→capacity derivation |
| capacity-as-workload-tolerance | no | requires workload/history data absent from the observation |

## Is "I Have Time Available" Lawful Here?

**As a rationale: no** — `rationaleVerdict("I have time available, so I would help.")` is
`UNCLASSIFIED`, i.e. no allowed class is present, so it is not a rationale at all (it is a fact).
**As a factual claim: yes** — it restates the supplied observation and belongs in
`factual_assessment`.
**Inside a preference frame: yes** — the frozen instrument accepts
`"I prefer to use the free time to help."` as `PURE_PREFERENCE` (lawful). The availability
*reference* is not the problem; the missing preference frame is. This single probe result is why
Candidate B is unnecessary rather than wrong.

## Availability vs Capacity

Availability is a **property of the situation** (a slot is free; commitments do not conflict) and is
supplied, source-bound and lawful as a claim. Capacity is asserted as a **property of the subject**
and is unsupplied. The observation licenses "the situation permits this"; it does not license "the
subject has room to do it". One is a world fact; the other is a subject attribute.

## Capacity vs Capability

`capacity` is overloaded across time-room, ability, energy and workload tolerance; `capability` is
purely subject-side ability. The frozen instrument collapses `CAPACITY`, `CAPABILITY`, `SCOPE` and
`READINESS` into the single forbidden family `INFERRED_CAPACITY`, so the family name cannot tell the
reviewer *which* reading was attempted — the per-pattern `detail` can, and it says `CAPACITY`. That
is a naming gap in the audit label, not a gap in the verdict.

## Willingness vs Capacity

Willingness is one of the five allowed rationale classes and requires no factual proof — the model
used the word in `current_intent` ("based on willingness to assist"). Capacity is a factual-sounding
subject attribute and is forbidden in rationale and in claims. The model had the lawful word
available and chose the forbidden one, which is what makes this a vocabulary-legibility failure
rather than an ignorance failure.

## Preference vs Availability

Preference is subject-side and authoritative for the choice; availability is world-side and
authoritative for feasibility. Rule 6 already divides them: external premises (time, deadline,
reversibility, resources, history, measured benefit, environment) go to `factual_assessment`;
subject-side premises go to `subjective_rationale`. The observed rationale *converted* the external
premise into a subject-side one — the exact inversion rule 6 forbids.

## Does R1 Encourage The Model To Infer Capacity?

**Yes, weakly and structurally — not lexically.** R1 is the only `RELEVANT` scenario with no
evaluative premise, so once the model has placed the availability facts in `factual_assessment`
(correctly), the remaining "brief reason" has no option-characterizing content to draw on except
that same availability. The scenario supplies the *motive* to reach for availability; it never
supplies the *word* `capacity`. The word came from the prompt.

## Is R1 Benchmark-Contaminated?

**No, but it carries a recorded design tension.** Against the §6 test — "does the benchmark embed
wording that pressures the model toward an architecture-prohibited inference and then count that
inference as model failure":

- the scenario names no capacity, energy, stress or fatigue concept and encodes none;
- the availability premise is architecturally sanctioned (rule 6 names "time" as an external
  premise) and the model handled it correctly in R3 ("the time for the optional polish pass is
  available") while still producing a lawful `PURE_PREFERENCE` rationale;
- a lawful answer is demonstrably reachable: R2/R3/R4 all achieved it.

What R1 does do is demand a reason while supplying only external/quantitative grounds, so the
*reason* has no lawful non-preference content. That is a tension in the interaction between the
reason-invitation and the rationale restriction, and it is recorded here rather than resolved by
rewriting the scenario (§ "Scenario Change": `NONE`).

## Current INFERRED_CAPACITY Rule

Frozen, byte-identical, and **correct as the judgment of the observed text**: the observed rationale
is unlawful, and it is unlawful for a reason the contract already states (5b) and the host already
states (rule 10). Nothing in this review licenses changing the classifier. Changing the instrument
after seeing the cells would be tuning to green, which §7 and §26 forbid. The instrument's
`detail` sub-pattern (`CAPACITY`) already supplies the extra precision the family name lacks, so no
taxonomy work is required.

## Candidate A

**Keep `INFERRED_CAPACITY` unchanged; R1 remains a failure.** Semantically **correct** — the text is
the prompt's own forbidden example — but insufficient as an architecture response: it leaves
standing the asymmetry that produced it (concrete unlawful examples, abstract lawful classes) and
the priming of the word `capacity`. Verdict: correct judgment, incomplete remedy.

## Candidate B

**Allow any supplied availability fact to be referenced in the rationale; forbid capability
inference.** **Unnecessary rather than harmful.** The probe suite shows the architecture *already*
permits the availability reference inside a preference frame:
`"I prefer to use the free time to help."` → `PURE_PREFERENCE`, lawful. So B would relax a boundary
that did not cause the failure. Rejected as the fix; retained as evidence that the boundary is
workable.

## Candidate C

**Preference-only rationale (the status quo).** **Usable and natural where a subjective hook exists**
(R2/R3/R4 all produced `PURE_PREFERENCE`), **hard where the option pair is characterized only by
feasibility arithmetic** (R1). Keep the rule, fix its legibility: demonstrate the lawful shape with
the same concreteness the forbidden shapes enjoy.

## Candidate D

**Introduce explicit availability/capability structure.** **Rejected.** It is unnecessary ontology
for a lexical-legibility defect, it escalates to the top of the §26 minimality ladder, and any
structural form risks touching canonical state, which the review is required to avoid. The observed
failure needs no new structure — it needs a lawful template for a sentence the model already knows
how to write.

## Candidate E

**Modify R1 so it no longer mentions free time.** **Rejected.** It would hide the semantic question
(§25), remove the very external premise rule 6 expects to see in `factual_assessment`, and destroy
comparability with the frozen C4.4 cells that produced the diagnosis — a reframe-to-green with no
architectural gain. The scenario is not the defect; the contract's asymmetry is.

## Architecture Comparison

| candidate | fixes the observed failure? | preserves the authority boundary? | escalation cost | verdict |
| --- | --- | --- | --- | --- |
| A — keep rule | judgment yes, mechanism no | yes | none | insufficient |
| B — allow availability references | no (not the mechanism) | yes | policy relaxation | unnecessary |
| C — preference-only + legibility | yes | yes | none (contract text only) | **adopted** |
| D — explicit structure | over-engineered | risks it | new structure / canonical state | rejected |
| E — reframe R1 | hides it | yes | reframe + non-comparability | rejected |

## Recommended Semantic Rule

> A rationale states a preference, priority, aversion, willingness or subjective strategy, and may
> mention the supplied situation *within* that frame ("I prefer to use the free time to help."). It
> never states, and never restates, a property of the subject. Subject-side property terms —
> capacity, capability, ability, bandwidth, energy, fatigue, stress, workload tolerance, readiness —
> may not appear in `subjective_rationale` and may not be the subject of any
> `factual_assessment` claim. The latitude determination required by rule 2 is stated relative to
> the facts ("the supplied facts permit either response"), never as a property of the subject.

## Recommended Rationale Rule

Keep the five allowed classes and the forbidden latent-state classes unchanged. Add, in the
model-facing contract:

1. one **positive worked contrast** beside the existing forbidden examples —
   lawful: "I'd rather help." / "I prefer to use the free time to help.";
   unlawful: "I have enough capacity.", "I have time available, so I'd help." (not a rationale),
   "I'm capable of doing it.";
2. the explicit statement that a preference frame is what makes a rationale a rationale, and that
   the supplied situation may be referenced *inside* that frame;
3. the rule-2 latitude sentence template, with a positive example.

## Recommended Factual Rule

Claims may state supplied world facts — including that a slot is free and that no commitments
conflict — sourced to the observation. Claims may **never** assert a subject-side property
(capacity, capability, ability, bandwidth, energy, fatigue, stress, workload tolerance, readiness),
which formalizes rule 10 as an explicitly named, nameable defect. No host validator change: claim
*content* semantics remain prompt-enforced, exactly as today.

## Scenario Change

`NONE`.

## Does This Require Protocol Version Change?

`NO`. No schema, wire key, validator, selection-semantics or Language-input change. As in C4.2, the
refined contract text is bound into the new freeze by **digest**, not by version bump.

## Does This Require New Canonical State?

`NO`.

## Affect Changes

`NONE`.

## Applicability Changes

`NONE`.

## Ref Handle Changes

`NONE`.

## Language Changes

`NONE`. Language reproduced the handed-off selection faithfully (65/65 `PRESERVED`, 0 completions);
the defect is upstream in cognition.

## Family D Justified?

`NO`. The failure is confined to a single cognition-stage vocabulary contract; no second model stage
is indicated and no new evidence requires one.

## Next Qualification Design

One slice, in the established shape:

1. zero-model pre-registration first: a **paraphrase/probe suite** pinning the lawfulness of the
   phrasings in §8 (lawful: bare preference, preference-with-situation-reference, world-fact claim,
   fact-relative latitude statement outside the rationale; unlawful: subject-property rationale,
   subject-property claim, bare availability premise as rationale), frozen and hashed **before**
   any model call — the same discipline C4.2 used for the lexical guard;
2. byte-identical to C4.4 otherwise: same 13 scenarios, same 5 replicates, same `AFFECT_ABSENT`
   condition, same classifier, same endpoints, same provider and digest;
3. re-mint **both** freezes at the new committed HEAD (the formal freeze binds
   `cognition_prompt_sha256`, so a refined contract invalidates it);
4. gate: the full frozen 65/65 set **and** R1 ×5 lawful.

## R1 Endpoint

R1 ×5: `SUBJECTIVE_SELECTION`, on-question `FIRST_OPTION` volunteer stance, `subjective_rationale`
either null or `PURE_PREFERENCE`-class with **zero** forbidden classes, and **zero** subject-state
assertions among the factual claims.

## Rationale Endpoint

Across all 65 cells: forbidden-class rationale cells `= 0`. Non-regression: the 30 null cells remain
`ABSENT`.

## Factual Endpoint

Across all 65 cells: subject-state assertion cells `= 0`; unlawful factual source refs `= 0`;
unbound claim sources `= 0`; handle binding remains 65/65 `HANDLE_BOUND`.

## Scientific Validity

The Affect experiment asks whether Affect changes the selected stance when the facts leave latitude.
R1 supplies genuine latitude (an optional review that fits the free slot: volunteering and declining
are both admissible) without encoding capacity, energy, stress or fatigue. Its only weakness is that
its option pair is characterized by feasibility arithmetic alone, so it stresses the rationale
contract harder than its peers. That is a legitimate stress case, not a contaminated one — but it
must be *declared* as the hardest cell in the set, and the reason-invitation tension must be
recorded in the new freeze so that a future R1 failure cannot be mistaken for an Affect effect.

## Can Formal Matrix Run After One More Clean Qualification?

`YES` — the 476-cell design is unchanged and already frozen in shape. Conditionally: only after a
65/65 qualification at the new committed HEAD with **both** freezes re-minted (the current
`formal-freeze.json` binds the pre-refinement prompt digest and is therefore no longer valid).

## Can Affect Phase 2 Close After One More Slice?

`YES, conditionally` — one more slice can complete the refinement, re-qualify, and, if 65/65, run
the frozen 476-cell matrix plus the lawful POS×5 / NEG×5 confirmation. Phase 2 closes only if that
matrix meets its frozen criteria; the residual risk is that the stance distribution shifts, though
the primary causal endpoint is the selected stance class rather than rationale wording.

## Can Relationship Phase 3 Begin Now?

`NO`.

## Recommended Next Slice

`AFFECT_COGNITION_RATIONALE_VOCABULARY_AND_LATITUDE_LEGIBILITY_V0`

Implement the refined rationale/factual/latitude contract text exactly as scoped above, pre-register
the zero-model probe suite, re-freeze both freezes at the new committed HEAD, re-qualify the frozen
65 cells, and run the frozen 476-cell formal matrix plus the lawful POS/NEG stage **only** on 65/65.
This is a vocabulary-legibility refinement, not the applicability prompt-loop that C4.4 §54
prohibits: applicability passed 65/65 and is not reopened, no scenario text changes, and no protocol
version changes.

## Real Diagnostic Model Calls

`0`. The frozen C4.4 records plus the frozen instrument answered every question in the brief; the
probe suite is deterministic and model-free.

## Production Files Changed

`NO`.

## Confidence

**High** on the diagnosis: 5/5 byte-identical cells, a single forbidden pattern, the offending word
absent from all supplied material, and the lawful alternative demonstrated in the three peer
scenarios. **Medium-high** on remedy efficacy: the C4.4 precedent (a worked example in rule 7a
removed the `N2 ×5` citation-binding family) is the same mechanism, but this defect is a
vocabulary-choice failure rather than a rule-comprehension failure.

## Largest Remaining Uncertainty

Whether a contract that demonstrates the lawful shape just as concretely as the forbidden one
eliminates the subject-side noun **without** perturbing the stance distribution — and whether the
byte-identical `INFERRED_CAPACITY` family remains the right instrument once the contract names those
terms explicitly. Both must be controlled by the pre-registered zero-model probe suite, fixed before
the run, so that a green result cannot be produced by instrument drift.

STOP. No recommendation implemented.
