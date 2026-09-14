# CONTRACT SIZE + EXAMPLE NEUTRALITY — ARCHITECTURE DECISION

Read-only adjudication of the two failure questions left by
`AFFECT_COGNITION_RATIONALE_VOCABULARY_AND_LATITUDE_LEGIBILITY_V0`
(`AFFECT_COGNITION_IMPLEMENTATION_FAILED`, 60/65, formal matrix not run): the M3 ×5 output-truncation
failure and the AFFECT_ABSENT stance shift. Repository truth verified at HEAD `34bdf84`
(`origin/main` identical, clean worktree).

**Zero production files changed. Zero model calls.** All numbers are re-derived from the two frozen
qualification records by `forensics.mjs` → `forensics.json` (transport final traces carry
`prompt_eval_count` / `eval_count` / `done_reason` for every cell).

---

## Principal Root Cause

`MULTIPLE_INTERACTING_ISSUES`

Two independent, independently-evidenced mechanisms:

1. **M3 truncation = completion-side generation degeneracy, not capacity pressure.** The current
   run's 60 completed cells produced 305–572 completion tokens (max 27.9 % of the 2048 budget).
   C4.4's lawful M3 output was **414 tokens**. Current M3 hit **exactly 2048 in all 5 replicates** —
   ≥3.6× the run max and ~5× C4.4's lawful M3 output. Prompt growth (+429 prefill tokens) cannot
   cause this: `num_predict` is a hard independent cap, and `prompt_eval 3684 + 2048 = 5732 < 8192`,
   so the context window was not binding either. A ~5× deterministic output explosion on exactly one
   scenario, with the body discarded fail-closed, is the signature of degenerate repetition in that
   specific prompt state — not of lawful proposals outgrowing the budget.
2. **Example imitation has become the model's rationale strategy, with polarity consequences.** In
   the current run, **25 of 30 completed choice cells copied a prompt example verbatim** as
   `subjective_rationale` — 20× the aversion example *"I'd rather avoid extra work whose benefit is
   unknown."* and 5× *"I'd rather help."* C4.4 had **zero** verbatim copies. The stance shifts
   (M1, R1, R2: FIRST → SECOND) all carry the copied aversion rationale, whose polarity (decline /
   avoid-extra-work) matches the new stance class; M2 copied the accept-polar example and stayed
   accept. The distribution now largely reflects **which examples the prompt ships**, not latent
   choice — for the formal P-vs-N stance endpoint this makes the example set part of the
   experimental intervention.

## Output-Budget Status

`CURRENT_2048_BUDGET_ADEQUATE_AFTER_COMPACTION`

No observed lawful proposal in either run exceeded 572 tokens (27.9 % of budget); C4.4's M3 needed
414. Raising the ceiling would not fix a repetition loop (the loop runs to whatever the cap is,
`done_reason=length` again, with 1.5–2× latency) and would hide the pathology. What must change is
the contract text that (a) plausibly triggers the M3 loop and (b) ships polarity-bearing examples —
i.e. compaction + neutralization, not a bigger bucket. `num_predict = 2048` stays.

## Example-Neutrality Status

`OUT_OF_DOMAIN_EXAMPLES_REQUIRED`

Verbatim copying is now proven (25/30), so whatever examples the contract ships **will** be echoed
as rationales. Any example containing accept/decline/try/keep/stop/attend/carry vocabulary injects
that polarity into the stance baseline — and the *pre-existing* examples already do ("I'd rather
avoid extra work…" = R1/R2/R3 vocabulary; "I'd rather stop here." = R3; "I prefer the reversible
option." = R2). The new decline example was not itself copied; the mechanism is copying-as-strategy
plus a polarity-skewed example set. Examples must be concrete (abstract placeholders risk recreating
R1) but drawn from outside every experimental scenario's action vocabulary.

## Principal Architecture Verdict

`COMPACT_CONTRACT_AND_NEUTRALIZE_EXAMPLES`

One prompt-only change, two goals served by the same edit: replace the rule-5a lawful examples with
out-of-domain polarity-neutral ones, and compact the newest dense enumerations (rules 2, 5b, 10) by
deduplicating the availability≠capacity mappings and example lists. Keep `num_predict = 2048`, keep
every frozen semantic obligation (§30 checklist below), preregister output-headroom tracking and an
example-vocabulary audit, then re-qualify the unchanged 65 cells; formal matrix only on 65/65.

## Executive Decision

Both defects trace to the same root event: the R1 repair made worked examples the contract's
dominant teaching device, and the model now (i) copies them verbatim — importing their polarity into
the stance baseline — and (ii) in one scenario-specific prompt state (M3, the carry/capability case,
whose theme is exactly the capability vocabulary rules 5b/10 enumerate) degenerates into ~5×
output explosion and truncation. The remedy is a single, carefully bounded contract revision —
fewer, shorter, out-of-domain, polarity-neutral examples; tightened enumeration prose; no semantic
deletion; no budget change; no scenario change — followed by the full re-qualification with
headroom and anchor preregistrations. Do not raise `num_predict`; do not counterbalance; do not
touch schemas, validators, scenarios, the classifier, or Affect.

## Repository Truth

Branch `main`, HEAD `34bdf84`, worktree clean, `origin/main` identical. Frozen evidence: the C4.4
and rationale-vocabulary `qualification-raw.jsonl` records (transport traces with per-call
`eval_count`, `prompt_eval_count`, `done_reason`), the rationale-vocabulary freeze
(`sha256:f0ac4080…`), formal freeze (`sha256:db93a6e6…`), model `qwen3.5:9b` digest
`6488c96f…ea7`. This review adds `forensics.mjs` → `forensics.json` (0 model calls, 0 production
changes).

## Evidence Reviewed

Both frozen qualification records (65 + 65 rows), all transport final traces, the M3 wrapper errors,
the current and C4.4 cognition system prompts (6551 → 8714 chars), the production validator bounds
(`conversation-cognition-proposal.ts`), the C4.4 and current rule-5a example sets, and the stance /
rationale strings of every completed choice cell in both runs.

## What Latest Slice Proved

R1 vocabulary repair works: R1 5/5 with lawful aversion-frame rationales, fact-relative latitude
claims, 0 forbidden classes, 0 subject-property claims. N1–N6 5/5 each (N6 5/5 as required). M1, M2,
R2–R4 5/5. Handles 65/65 `HANDLE_BOUND`. Rationale violations 0, subject-property claims 0 among
evaluable cells, Language 60/60 `PRESERVED`, leakage 0, Family-D not triggered.

## What Latest Slice Did Not Prove

That the refined contract is deliverable within the frozen transport envelope (M3 ×5 truncated), and
that the qualification's stance baseline is free of example-induced directional pressure (25/30
verbatim example copies; 3 deterministic FIRST→SECOND shifts). The formal Affect matrix remains
unrun; no causal claim exists.

## M3 Truncation Forensics

Per cell (all five identical, temperature 0): `prompt_eval_count = 3684`, `eval_count = 2048`,
`done_reason = length`, `request_bytes = 16962`, raw output body **NOT RETAINED** (the transport
fails closed and discards truncated content), `num_ctx = 8192`, `num_predict = 2048`,
`prompt + output = 5732 < 8192` (context not binding; the output cap bound). 0 language calls.
Because the body is discarded, the truncation point inside the JSON, last complete field, first
incomplete field, completed claim count, emitted handle count and the intent/stance/rationale
lengths of the truncated output are **not measurable from frozen evidence** — reported as such
rather than estimated. What is measurable: all five truncations are byte-identical in structure
(same request bytes, same token counts), so the five cells truncate at the same deterministic
generation state.

## M3 Truncation Point

NOT RETAINED (see above). The only structural statement available: generation was cut by the
provider token budget mid-JSON, so the object could not parse and the host refused before semantic
evaluation.

## M3 Current vs C4.4

| measure | C4.4 M3 (COMPLETE) | current M3 (FAILED ×5) |
| --- | --- | --- |
| prompt_eval_count | 3255 | 3684 (+429 = system prompt +2163 chars) |
| eval_count | **414** (done_reason=stop) | **2048** (done_reason=length) |
| raw output | 1439 chars | not retained (≥ ~7000 chars equivalent) |
| claims | 2 (109 chars total, longest 78) | unknown (truncated) |
| factual_assessment | 241 chars | unknown |
| current_intent | 99 chars | unknown |
| stance / rationale | 43 / 33 chars | unknown |
| considered / evidence / memory handles | 6 / 1 / 3 | unknown |

What specifically increased: **completion length alone** (414 → ≥2048, ~5×). Prompt growth (+429
prefill tokens) did not reduce completion space (`num_predict` is independent; context had 2460
tokens spare). The causal mechanism is therefore a completion-side generation pathology —
degenerate repetition/looping in the M3 prompt state — whose onset is plausibly invited by the
refined contract's dense capability-vocabulary enumerations (rules 5b/10), which overlap M3's theme
("willing to carry it upstairs" vs the forbidden "I can manage it / capable"). This remains a
plausibility claim, honestly labelled: the discarded body prevents direct confirmation.

## Qualification Completion-Token Distribution

Current run, 60 completed cells: min 305, median 418, p75 485, p90 498, p95 572, max 572
(27.9 % of 2048); **0 cells >80 %, 0 >90 %**. C4.4, 65 cells: min 316, median 406, p75 414, p90 450,
p95 499, max 499 (24.4 %); 0 >80 %, 0 >90 %. M3 current: 2048 (truncated, reported separately).

## Is M3 Unique?

**Yes — uniquely pathological.** The gap between M3's ≥2048 and the run max 572 is ≥3.6×; no other
scenario in either run exceeds 572. The issue is scenario-local degeneracy, not a systemic approach
to the cliff: no cell in 125 across two runs sits near 2048 except the five truncated ones.

## Prompt Length vs Completion Length

System prompt 6551 → 8714 chars (+2163 ≈ +429 prefill tokens; confirmed by
`prompt_eval_count` 3255 → 3684). Completion budget (`num_predict`) is a hard cap independent of
prefill; `num_ctx = 8192` was not binding (2460 tokens spare at truncation). The truncation was
caused by output growth, not input growth.

## Output Inflation Source

Quantified where measurable: ordinary cells *grew only mildly* (C4.4 max 499 → current max 572;
median 406 → 418), so general verbosity (longer claims, longer rationales) is NOT the driver —
current completed cells' profiles are comparable to C4.4's. The entire anomaly is M3's ≥5× jump.
Among §6's candidates, the evidence supports **model repetition/looping** (deterministic 5×
explosion on one prompt state, truncated body discarded) with **example imitation** separately
confirmed for rationales (25/30 verbatim copies) — the latter is a stance-baseline issue, not a
length issue (examples are one short sentence).

## Current Schema Bounds

From the production validator: factual claims ≤ 8 per proposal; claim text ≤ 512 code points;
`source_handles` non-empty and unique per claim; advertised handles ≤ 64 per namespace; stance ≤ 256
code points; `subjective_rationale` ≤ 256; clarification basis text ≤ 256; **`current_intent` and
`reasoning_summary` have NO length bound** (non-empty + canonical-text + prefix checks only).

Is the host already bounding output tightly enough? **Not fully** — a worst-case lawful JSON
(8 × 512-char claims + 256 + 256 + unbounded intent/reasoning + structure) could reach roughly
1700–2000 tokens at the observed ~3.5 chars/token, i.e. the schema does not *guarantee* fit under
2048. But this is distinct from the observed failure: no lawful output ever exceeded 572 tokens, and
C4.4's lawful M3 was 414. The M3 event is not "valid semantic output simply needs >2048 tokens" —
it is degenerate generation. The missing structural bounds (intent/reasoning length caps) are a real
but secondary gap; adding them is semantically justifiable (both fields are one-short-sentence by
contract) but is NOT required to fix M3 and should not be smuggled into the next slice as a fix for
a pathology it cannot prevent.

## Is 2048 Fundamentally Too Small?

**No.** Two runs, 125 cells, zero lawful completions above 572 tokens (27.9 %). Raising the cap
would not convert a repetition loop into a lawful proposal; it would only prolong it.

## OB-A — KEEP 2048, COMPACT CONTRACT

Viable and recommended (with neutralization). The compaction target is the newest, densest,
scenario-adjacent enumeration text (rules 2/5b/10 + the example lists), which is both the plausible
loop trigger and the polarity source. No schema change.

## OB-B — KEEP CONTRACT, INCREASE NUM_PREDICT

Rejected. A repetition loop consumes whatever budget exists; 3072/4096 would raise latency 1.5–2×
on the pathological scenario and still end in `done_reason=length`. It would also mask the
degeneracy instead of removing it, and would break generation-setting comparability with C2–C4 for
no semantic gain.

## OB-C — STRUCTURALLY BOUND MODEL OUTPUT

Partially justified, not as the M3 fix. Bounding `current_intent` and `reasoning_summary` (e.g. 256
code points, matching stance/rationale/clarification) closes the only unbounded fields and makes the
worst-case lawful JSON comfortably fit the budget — semantically defensible on its own terms. But
host bounds do not stop a loop mid-generation (the truncation happens before validation), so this
alone would not have prevented M3. Optional secondary hardening, explicitly not required.

## OB-D — COMPACT CONTRACT + MODEST OUTPUT-BUDGET INCREASE

Rejected: the measured data gives no budget shortfall to fix (max lawful 572 / 2048).

## OB-E — SPLIT COGNITION

Rejected. §33 applies: an output-ceiling truncation is not evidence that single-stage cognition is
semantically insufficient. Family D remains unjustified.

## Recommended Output-Budget Design

**OB-A**, with `num_predict = 2048` unchanged.

## Exact Contract Compaction

Or `NONE` — not `NONE`. Scope (prompt-only, rules 2/5a/5b/6/10 of
`conversation-cognition-provider-v6.ts`), preserving every frozen obligation:

- **Rules merged / collapsed:** fold the availability≠capacity mappings in rule 5b (currently four
  "free time → X / low stress → Y" restatements plus four "≠" restatements in prose) into a single
  sentence; collapse rule 10's five unlawful claim examples and rule 5b's four unlawful rationale
  examples into two each (keep "I have enough capacity." and "I'm capable of doing it." — the two
  historically emitted shapes); merge the fact-plus-action sentence into rule 5a instead of rule 5b.
- **Examples removed/replaced:** every lawful example with experimental action vocabulary
  ("I'd rather help.", "I prefer to use the free time to help.", "I'd be willing to spend the
  available time on the review.", "I'd prefer to decline.", and the pre-existing "I'd rather stop
  here.", "I prefer the reversible option.", "I'd rather avoid extra work whose benefit is
  unknown.") is REPLACED by the out-of-domain set below — not deleted (R1 legibility needs concrete
  lawful anchors).
- **Duplicate authority wording removed:** rule 2's latitude restatement and rule 10's claim-side
  rule currently repeat the subject-property prohibition in three places (2, 5b, 10); state it once
  in 5b, cross-reference by number elsewhere.
- **Unchanged bytes:** rules 1, 3, 4, 7, 7a, 7b, 8, 9, 11–16 (handles, citation binding, schema,
  directive, clarification, Language boundary).

Every frozen obligation remains represented (§30 audit): latitude discriminator (rule 2, retained),
availability ≠ capacity (5b, compacted), subject state latent-only (5b/5c), rationale preference
framing (5a with new examples), factual source authority (7/7b), handle selection (7), citation
binding (7a), choice authority (4/15), Language boundary (unchanged Language prompt).

## Recommended num_predict

`UNCHANGED` (2048).

## Expected Headroom

With the observed lawful maximum at 572 tokens and the pathological scenario's trigger text removed,
expected max completion ≤ ~600 tokens (≤ 30 % of budget), headroom ≥ 3.4×. The preregistered
criterion (below) is the enforcement mechanism, not this estimate.

## Latency Impact

Slightly lower prefill (−~2000 chars); per-cell latency unchanged to slightly improved. OB-B was
rejected partly for its 1.5–2× worst-case latency cost.

## Comparability Impact

`num_predict`, `num_ctx`, temperature, model and digest unchanged → generation-setting comparability
with C2–C4 preserved. The prompt digest changes, so qualification and formal freezes are re-minted
at the new committed HEAD (established pattern; no protocol version bump).

## Current Positive Examples

Lawful (current contract): "I'd rather stop here.", "I prefer the reversible option.", "I'd rather
avoid extra work whose benefit is unknown.", "I'd rather help.", "I prefer to use the free time to
help.", "I'd be willing to spend the available time on the review.", "I'd prefer to decline."
Unlawful: "I have enough capacity", "I am capable", "within my operational scope", "I can manage
it", "I have available capacity.", "My energy is high enough.", "My mind is fresh.", "I can manage
the workload."

## Current Stance Distribution vs C4.4

| scenario | C4.4 class | current class | current stance (5/5 identical) |
| --- | --- | --- | --- |
| M1 | FIRST | **SECOND** | "I would decline to volunteer for the review." |
| M2 | FIRST | FIRST | "I would prefer to attend the meeting." |
| M3 | FIRST | unevaluable ×5 (truncated) | — |
| R1 | FIRST | **SECOND** | "I would decline to volunteer for the review." |
| R2 | FIRST | **SECOND** | "I would keep the current approach." |
| R3 | SECOND | SECOND | "I would stop now." |
| R4 | FIRST | FIRST | "I will rehearse the presentation first." |

Replicate consistency: 5/5 identical in every scenario, both runs (temperature 0).

## Directional Shift Audit

FIRST → SECOND: **3** (M1, R1, R2). SECOND → FIRST: **0**. Unchanged: 3 (M2 FIRST, R3 SECOND, R4
FIRST). M3: unevaluable. **All three changes point toward the decline/aversion direction — the
polarity of the most-copied example.** R4 (an ordering question with no accept/decline polarity)
did not move; M2/R3 did not move. The shift is unidirectional, deterministic, and aligned with the
shipped example polarity — reported as prompt-induced baseline shift, not sampling noise (§15).

## Lexical Anchor Audit

Verbatim rationale copying: current run 25/30 choice cells copy a prompt example word-for-word
(20× "I'd rather avoid extra work whose benefit is unknown.", 5× "I'd rather help."); C4.4: 0/35.
Every shifted cell (M1, R1, R2) carries the copied aversion rationale whose decision polarity
(decline/avoid) matches its new SECOND class; M2 carries the copied accept rationale ("I'd rather
help.") and stays FIRST; R3 (already decline) copies the aversion example; R4 (no polarity) copies
nothing. Exact phrase reuse is therefore near-total, and it correlates with stance class. Per §14
this is evidence, not proof of causation — but combined with determinism (§15) and unidirectionality
(§13), the case is strong.

## Is Example Anchoring Plausible?

**YES** — with one honest refinement: the *new* decline example was not itself copied; the anchor is
the copying strategy the refined contract established plus the polarity skew of the example set as a
whole (the pre-existing aversion example carries R1/R2/R3 vocabulary and dominates copying 20:25).
The baseline is now example-determined regardless of which specific example anchors.

## EN-A — CURRENT EXAMPLES

Rejected: proven to be copied verbatim and polarity-skewed; leaves the causal endpoint
example-determined.

## EN-B — POLARITY-NEUTRAL PLACEHOLDER EXAMPLES

Rejected as sole measure: "I prefer the option I selected…" is abstract; C4.4's abstract-only
allowed classes are exactly what failed R1. A 9B model demonstrably needs concrete anchors — it
copied concrete examples 25/30 times.

## EN-C — OUT-OF-DOMAIN CONCRETE EXAMPLES

**Recommended.** Concrete (copiable) but drawn from outside every experimental scenario's action
vocabulary, so a verbatim copy cannot match any frozen stance class or import directional pressure.

## EN-D — COUNTERBALANCED PAIRS

Rejected: symmetric examples still get copied asymmetrically (copy frequency is scenario-driven,
not count-driven — the aversion example won 20:5 against a 4-example field), it doubles example
surface (prompt size, the very thing being compacted), and it ships both experimental answer
patterns into the contract. Symmetry is not neutrality.

## EN-E — NO POSITIVE EXAMPLES

Rejected: recreates C4.4's R1 failure mode (abstract allowed classes + concrete forbidden examples
is the asymmetry the vocabulary review diagnosed as the primary root cause).

## EN-F — FORM-ONLY CONTRASTS WITHOUT CHOICE DIRECTION

**Adopted as the design principle** governing the EN-C set: teach the lawful form (preference frame
referencing the supplied situation) against the unlawful form (subject-property assertion) with zero
experimental action vocabulary in the lawful side.

## Recommended Example Design

EN-C + EN-F: keep the forbidden examples concrete (they carry no stance polarity — capacity/energy
statements are directionless — and the classifier polices copies of them), replace every lawful
example with an out-of-domain concrete preference frame, and prune both lists for compaction.

## Exact Neutral Examples

If adopted (design only, NOT implemented):

- LAWFUL: "I prefer the quieter option."
- LAWFUL: "I'd rather spend the available time reading."
- LAWFUL: "I'd be willing to spend the available time on it."
- UNLAWFUL (retained, pruned to two): "I have enough capacity.", "I'm capable of doing it."
- Fact-plus-action note retained once: a bare "I have time available, so I would help." is a fact
  plus an action, not a rationale.

Each lawful example is a preference/willingness frame, references supplied-situation availability in
the abstract, and contains none of the §18 vocabulary.

## Forbidden Experiment-Endpoint Vocabulary In Examples

Excluded from lawful examples: volunteer, decline, try, keep, stop, continue, rehearse, inspect,
attend, carry, first, second, review (as task), polish, extra work. The retained unlawful examples
contain none of these either (they are property statements). A zero-model textual audit (§20 design,
below) enforces this list against the final prompt before freezing.

## R1 Legibility Preserved?

**Yes, by design requirement.** The lawful side keeps a concrete preference-frame-referencing-
situation anchor (the exact form R1 now produces); the unlawful side keeps concrete subject-property
examples; the availability≠capacity sentence stays. The zero-model probe suite re-runs unchanged
against the compacted contract text (its assertions check the *semantic content*, and its prompt
string assertions must be updated to the new example wording in the same commit that changes the
prompt — before any model call), and the historical C4.4 rationale must still classify
`INFERRED_CAPACITY`.

## New Canonical State?

`NO`.

## Affect Changes?

`NONE`.

## Applicability Changes?

`NONE`.

## Ref Handle Changes?

`NONE`.

## Language Changes?

`NONE`.

## Family D Justified?

`NO` (§33).

## Next Qualification Design

One slice (`AFFECT_COGNITION_CONTRACT_COMPACTION_AND_EXAMPLE_NEUTRALITY_V0`), in the established
shape: compact+neutralize the contract text; update probe/sentinel string assertions to the new
wording; run the unchanged zero-model probe suite + historical R1 replay + sentinel green and hash
them before any model call; run all engineering gates; commit; re-mint BOTH freezes at the new HEAD;
re-qualify the byte-identical 65 cells (M3, R1, N6 retained — §35) with 0 retries; analyze with the
frozen classifier; formal 476 + lawful POS/NEG only on 65/65.

Two new preregistered descriptive endpoints, frozen before the calls:

- **Output-headroom endpoint (§36/§37):** per-cell completion tokens (already in the transport
  traces) reported as min/median/p75/p90/p95/max plus cells >80 % (>1638) and >90 % (>1843) of
  `num_predict`. Proposed frozen success criterion: **no completed cell exceeds 90 % of
  `num_predict`**. Justification: the observed lawful p95 is 572 (27.9 %), so the 90 % line leaves
  >3× margin over anything ever produced lawfully while making truncation-risk visible; it is a
  transport-health criterion, applied to this and future qualifications only, never retroactively
  to historical verdicts.
- **Example-anchor audit (§38):** before calls, freeze the final example strings and verify (textual
  audit) that they contain zero §18 endpoint tokens; after calls, report the stance distribution and
  the verbatim-copy census. The pass criterion is semantic validity + absence of directional example
  content — **not** "same distribution as C4.4" (§24: old stance direction is not ground truth).

## Output Headroom Endpoint

As above: max ≤ 90 % of 2048 (≤ 1843 tokens) across 65/65 completed cells; expected observed max
≤ ~600.

## Semantic Endpoint

Unchanged frozen set: 30/30 null `NO_SUBJECTIVE_SELECTION`; 35/35 choice `SUBJECTIVE_SELECTION`
on-question; M3 5/5 delivered; R1 5/5 lawful; rationale violations 0; subject-property claims 0;
handles 65/65; Language faithful; leakage 0; false CLARIFY 0.

## Rationale Endpoint

0 forbidden-class cells across 65; null cells remain `ABSENT`; verbatim-copy census reported
descriptively (copies of out-of-domain examples are lawful rationales and do not fail anything).

## Applicability Endpoint

`SELECTION_APPLICABILITY_CORRECT` 65/65; no regression versus C4.4/rationale-vocabulary properties.

## Ref Endpoint

65/65 `HANDLE_BOUND`; 0 unknown/malformed/escalating; 65/65 canonicalized.

## Language Endpoint

`PRESERVED` on all delivered cells; 0 completions, 0 mutations, 0 invented preferences.

## Formal Gate

65/65 qualification, then the re-minted formal freeze binds the final compacted prompt digest,
`num_predict = 2048`, schemas, model digest, final example strings, classifier and all thresholds;
476 cells run without intervention; lawful POS×5 / NEG×5 after, per the frozen sequence.

## Can Formal Matrix Run After One More Qualification?

`YES` — conditional on that qualification reaching 65/65 including M3 5/5 delivered and the
headroom criterion met, under the final compacted contract.

## Can Affect Phase 2 Close After One More Slice?

`YES, conditionally` — one more slice can close Phase 2 if it re-qualifies 65/65 and the frozen
476-cell matrix plus lawful POS/NEG meet their criteria. The stance-anchoring repair is what makes
the causal endpoint interpretable at all.

## Can Relationship Phase 3 Begin Now?

`NO`.

## Recommended Next Slice

**`AFFECT_COGNITION_CONTRACT_COMPACTION_AND_EXAMPLE_NEUTRALITY_V0`** — implement the compaction and
out-of-domain example replacement exactly as scoped, with the two preregistered descriptive
endpoints, re-qualify, and run the formal matrix only on 65/65. This is a contract-text repair
within the already-adjudicated vocabulary scope — not a new vocabulary rewrite, not a scenario
change, not a generation-setting change.

## Real Diagnostic Model Calls

`0`. Both frozen qualifications' transport traces and records answered every quantitative question;
the truncated M3 body is unrecoverable and was reported as NOT RETAINED rather than re-run.

## Production Files Changed

`NO`.

## Confidence

**High** on the output-budget question: 125 cells of token evidence, M3 isolated as a 5× outlier,
context window proven non-binding, C4.4's lawful M3 at 414 tokens. **High** on the copying
mechanism: 25/30 verbatim copies vs 0/35 is not ambiguous. **Medium-high** on the remedy: removing
the example polarity and compacting the enumerations directly addresses both mechanisms, but the
M3 loop trigger is inferred from prompt-state overlap, not observed in a retained body.

## Largest Remaining Uncertainty

Whether the M3 degeneration is actually triggered by the capability-vocabulary enumerations (rules
5b/10 overlapping M3's carry theme) or by something subtler in the prompt state — the discarded body
makes the loop site unobservable. If the compacted contract still truncates on M3, the honest next
step is a transport-level diagnostic capture of the truncated body (a read-only infrastructure
change to retain failed output for diagnosis, not a semantic change), not another prompt edit.

STOP. No recommendation implemented.
