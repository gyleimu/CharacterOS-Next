# SUBJECTIVE RATIONALE CONTRACT + EVALUATOR SCOPE + REPRODUCIBILITY — ARCHITECTURE DECISION

Read-only adjudication of the four issues left by
`AFFECT_COGNITION_EVALUATOR_V2_RATIONALE_ALIGNMENT_REQUALIFICATION_V0`
(`AFFECT_COGNITION_RATIONALE_CONTRACT_FAILED`, 50/65, formal matrix not run): the M2 rationale
positive-space failure, the R3 choice-classifier scope failure, the R4 genuine contract violation,
and the cross-round output divergence. Repository truth verified at HEAD `452d4ae` (`origin/main`
identical, clean worktree, model digest unchanged, Ollama 0.34.0).

**Zero production files changed. Zero instrument edits.** Evidence: `forensics.mjs` →
`forensics.json` (frozen records of the two most recent rounds), plus a controlled 9-call
diagnostic (`diagnostic.mjs` → `diagnostic-calls.jsonl`, `diagnostic-summary.json`) recorded
separately from qualification evidence and executed solely to resolve the reproducibility
mechanics the frozen records could not settle.

---

## Principal Root Cause

`MULTIPLE_INTERACTING_ISSUES`

Four independent, separately evidenced issues:

1. **Rationale positive space under-specified** — the bounded lexical allowlist has now failed two
   consecutive lawful paraphrases ("I value…", then "I find … useful"), while the rationale's
   architectural role needs only the forbidden boundary plus a subjectivity marker.
2. **Choice-classifier scope too broad** — the frozen choice semantics run over the *whole*
   delivered prose, so a hedge inside the rationale clause reclassifies the selected action.
3. **A genuine model contract violation** — R4's "while my energy is high" narrates subject state,
   which the frozen contract clearly forbids; this is model-compliance evidence, not evaluator noise.
4. **A slice-scaffolding input drift misdiagnosed as provider nondeterminism** — the per-slice
   subject-id rename changes every derived ref and the projection hash, and greedy sampling at
   temperature 0 flips wording on that context change; the previously reported "run-to-run
   non-reproducibility" is hereby **corrected**: given identical provider-boundary bytes, generation
   reproduces byte-exactly.

## Rationale Architecture Status

`MINIMAL_SUBJECTIVE_FRAME_PLUS_FORBIDDEN_BOUNDARY_REQUIRED`

## R3 Evaluator Status

`CHOICE_CLASSIFIER_SCOPE_TOO_BROAD`

## R4 Status

`R4_GENUINE_MODEL_CONTRACT_VIOLATION`

## Reproducibility Status

`CURRENT_EXECUTION_VARIANCE_ACCEPTABLE` — with two mandatory controls: freeze the subject id across
slices (it is an input), and record provider-instance identity; no seed control is possible or
needed (seeds are inert at temperature 0).

## Principal Architecture Verdict

`REFINE_INSTRUMENTS_AND_ADD_MATCHED_REPRODUCIBILITY_CONTROL` — refine the rationale validator
(minimal subjective frame + forbidden boundary) and the choice-fidelity evaluator (authoritative
stance primary + delivery-side contradiction detector, scoped to the stance realization), and add a
*matched* reproducibility control that is instance-and-input matched (never seed-matched, because
seeds are proven inert). Do not touch the production prompt, scenarios, model, settings or Affect.

## Executive Decision

Three of this review's four issues are tooling/measurement problems with precise, bounded fixes,
and one is a real model violation that must be recorded as such rather than tuned away. The
rationale validator should stop policing membership in an ever-growing synonym list and instead
enforce the actual architecture: a subject-relative evaluative frame plus the byte-unchanged
forbidden boundary. The choice-fidelity evaluator should take the authoritative stance as primary
and detect only real mutation of the action. R4 stays a failure class: the contract already names
"energy" in the latent-state prohibition; a future review may examine state-visibility pressure, but
this slice recommends no prompt change. The reproducibility finding removes a phantom risk and
replaces it with a concrete control: keep the subject id byte-stable across slices so reruns are
input-identical, and record the provider instance alongside the freeze. Then re-qualify 65 cells
under the refined instruments — and only on 65/65 run the formal matrix with the frozen
interleaved condition schedule.

## Repository Truth

`main` at `452d4ae`, clean, `origin/main` identical, ahead/behind 0/0. Frozen evidence: round A
(contract-compaction, 55/65) and round B (evaluator-v2, 50/65) `qualification-raw.jsonl`, their
freezes (`sha256:84685193…`, `sha256:74e98202…`), verdicts, and the transport source
(`ollama-native-cognition-transport.ts`). Provider `qwen3.5:9b` digest `6488c96f…ea7`, Ollama
0.34.0 both rounds. This review adds `forensics.json`, 9 diagnostic calls, `diagnostic-summary.json`
(0 production changes).

## Evidence Reviewed

All M2/R3/R4 rows of both rounds (raw requests, raw cognition responses, raw language responses,
classifications); the per-line request diff across rounds; the transport request builder; the
formal collector's condition schedule; both freezes' provider/generation/prompt digests; the
diagnostic replays.

## What Latest Slice Proved

Evaluator v2 works where its family reaches: N5Q 5/5 `FACT_CORRECT` on the exact wording the old
regex misjudged; value probes and historical regression battery green; prompt/scenarios byte-stable;
transport health green (max 543/2048, 0 truncations); example copying 0/35; handles and
applicability perfect.

## What Latest Slice Did Not Prove

A 65/65 gate. It surfaced the three failure families above, plus a reproducibility question now
answered in this review: the divergence was input-driven, not provider nondeterminism.

## M2 Raw Forensics

Round A rationale: "I value participating in planning discussions to ensure alignment on upcoming
tasks." Round B rationale: "I find structured planning sessions useful for aligning on upcoming
tasks." Both are first-person, turn-local, on-question, non-factual, non-history, non-capability,
non-subject-state; zero forbidden classes in either. Round A's wording is also the replay-verified
deterministic output of round A's exact request (see Cross-Run Divergence Table).

## Is "find useful" Lawful?

**Yes.** It is the same semantic act as "value": a turn-local subjective valuation of an option the
subject is choosing. It asserts nothing about the world, history, capability or state; it explains
the selected stance. It is lawful under the architecture's own rationale definition (rule 5) and is
unlawful only under the instrument's bounded verb list — a measurement gap, not a contract violation.

## Why Current Allowlist Failed Twice

The positive allowlist is a finite lexicon standing in for a semantic space. Two consecutive rounds
produced lawful paraphrases outside successive bounded families ("value" was outside v1's list;
"find … useful" is outside v2's "find … worthwhile"). The model paraphrases; the list does not. The
architecture's own asymmetry (concrete forbidden families vs an open-ended positive space) makes
enumeration the wrong device.

## RC-A — CURRENT POSITIVE LEXICAL ALLOWLIST

Rejected. Two consecutive misses are decisive evidence of positive-space under-specification; each
"fix" has moved the synonym problem one level outward.

## RC-B — EXPAND SEMANTIC FAMILIES

Rejected as the primary remedy: broadening lexical realizations within six named categories still
requires enumerating realizations; it relocates the same failure. Useful only as documentation of
the categories for the research record, not as the validator's mechanism.

## RC-C — FIELD AUTHORITY + FORBIDDEN-BOUNDARY ONLY

Rejected as too permissive, with concrete counterexamples: "This improves productivity." has no
forbidden class (EXTERNAL_FACT's frozen patterns cover time/deadline/resources/probability/
environment only) and would be accepted as a "rationale"; "I have plenty of bandwidth." relies on
`bandwidth` being in the capacity pattern — a synonym the pattern misses (e.g. "I have plenty of
room tonight") would pass. Field authority alone cannot carry the boundary.

## RC-D — MINIMAL SUBJECTIVE FRAME + FORBIDDEN BOUNDARY

**Adopted.** The validator requires (i) zero forbidden-class evidence and (ii) a deterministically
checkable subject-relative evaluative frame: a first-person evaluative construction — `I` + attitude
or choice verb (value, care about, favor, appreciate, prefer, prioritize, avoid, want, choose, be
willing, find/consider … <evaluative adjective>), or a `… to me` / `matters to me` evaluative
construction. "This improves productivity." has no first-person frame → rejected. "The subject has
capacity." is third-person → rejected plus capacity pattern. "I prefer the quieter option." →
accepted (as today). Deterministically feasible: a bounded structural pattern, not a synonym
ontology.

## RC-E — STRUCTURED RATIONALE KIND FROM MODEL

Rejected. It adds a model self-classification surface and a protocol field for a non-causal,
non-canonical, optional explanation field; no evidence justifies that cost.

## Recommended Rationale Validation

RC-D. `rationaleVerdict` keeps the byte-unchanged forbidden families as the hard boundary and
replaces the enumerated positive list with the minimal subjective-frame test. Lawfulness requires:
`forbidden_classes.length === 0` **and** `subjective_frame === true`. Category remains
`PURE_PREFERENCE` for frame-only hits (no new top-level class); the existing named categories can
still be reported descriptively when their patterns match.

## Exact Allowed Principle

> A rationale is lawful iff (1) it contains no forbidden semantic class, and (2) it carries a
> subject-relative evaluative frame: the subject's own attitude, valuation, preference, priority,
> aversion, willingness or strategy, expressed in the first person or as an evaluative relation to
> the subject ("… matters to me").

## Exact Forbidden Principle

> Byte-unchanged: `RAW_SELF_STATE_DESCRIPTION`, `NAMED_PSYCHOLOGICAL_STATE`, `INFERRED_CAPACITY`,
> `EXTERNAL_FACT`, `HISTORY_CLAIM` — including unsupported world/history assertions and any
> situational fact restated as a subject property.

## Does UNCLASSIFIED Remain A Failure?

**No — the category changes meaning.** Under RC-D the failure condition is "no subjective frame or
any forbidden class". Text with a lawful frame and no forbidden evidence passes; text without a
frame (e.g. a bare fact plus action) fails as `NO_SUBJECTIVE_FRAME`; forbidden text fails as today.
The fail-safe principle is preserved in substance (unbounded free text still cannot pass) while
lawful paraphrases stop being punished for lexicon gaps.

## R3 Raw Forensics

Delivered: "I would perform the extra polish pass. I prefer to utilize the available time for a task
that is explicitly offered as optional and beneficial, even if its specific benefit is unmeasured."
Authoritative stance: "I would perform the extra polish pass." (on-question `FIRST_OPTION`). The
Language input handed off that exact selection and Language preserved it
(`LANGUAGE_CHOICE_PRESERVED`, `SEMANTICALLY_COMPLETED_BY_LANGUAGE = 0`, 0 added decision tokens).

## HEDGE Match Span

The frozen `HEDGE` pattern matches exactly one span: the `if` inside "**even if** its specific
benefit is unmeasured" — located in the *rationale clause*, after the stance sentence.

## Does Hedge Scope Over Choice?

**No.** The condition scopes the rationale's premise ("beneficial even if unmeasured"), not the
action. The delivered choice sentence is identical to the handed-off stance; no alternative stance
is introduced (verified: no "instead / rather than / or keep" constructions outside the rationale).

## Does Hedge Scope Only Over Rationale Premise?

**Yes** — the match's local context is the rationale clause; the stance sentence is hedge-free.

## Existing Language Completion Result

`PRESERVED` — the dedicated fidelity instrument says the choice was neither completed, changed nor
dropped. That is the semantically correct answer for R3.

## Instrument Conflict

Real and direct: `language_completion = PRESERVED` while the whole-text choice classifier says
`LANGUAGE_CHOICE_CHANGED`. The conflict is resolved by scope: the completion instrument measures the
right region (delivery additions vs handed-off content); the choice classifier measures the wrong
region (all prose). The completion instrument has semantic priority for fidelity; the choice
classifier should be re-scoped and then must agree with it.

## CF-A — WHOLE DELIVERED TEXT LEXICAL CLASSIFICATION

Rejected — current behavior; one hedge in a reason flips the action class.

## CF-B — AUTHORITATIVE STANCE PRIMARY + CONTRADICTION DETECTOR

**Adopted as the principle.** The Cognition stance is choice authority; Language passes iff it
preserves the selected stance and does not negate it, replace it, condition the action itself, or
introduce another option.

## CF-C — SENTENCE/CLAUSE SCOPED CHOICE CLASSIFIER

**Adopted as the deterministic implementation** of CF-B: classify the choice from the stance
realization — the delivered text's first sentence, with a fallback to the whole text only when the
first sentence yields `NO_CHOICE` (so a choice expressed later is never lost). Rationale-side hedges
cannot reclassify the action; a genuine conditional choice ("I would attend if it is not
cancelled.") keeps its condition in the stance sentence and is still detected.

## CF-D — LANGUAGE STRUCTURED REALIZATION

Rejected — a new protocol field for a measurement problem solvable by scoping; not justified.

## Recommended Choice-Fidelity Evaluator

CF-B implemented per CF-C, with probes: R3's exact delivered form must be `PRESERVED`; "I would
attend if the meeting is confirmed." must be `CONDITIONAL`; "I would attend, but I might not." must
remain a detected mutation; "I would not attend." must remain a detected negation.

## R4 Raw Forensics

Round B rationale: "I prefer to tackle the more expressive task **while my energy is high**, leaving
the inspection of the backup plan for later." — 5/5 identical. Round A rationale on the same
scenario, same prompt: "I prefer to secure the core communication flow before verifying the
supporting details." — no state narration. Stance, factual assessment and Language were correct in
both rounds; the only failing field is the rationale.

## Where "energy" Originates

(1) The supplied subject state: the rendered `[regulation] energy=1 stress=0 arousal=0.5 fatigue=0`
line — visible context, by design; (2) the system prompt's prohibition vocabulary (rule 5d's
never-assert list and rule 10's subject-state list, 2 occurrences) — no longer present in any
example sentence after the compaction.

## Was "energy" User-Supplied?

**No** — the user's message contains no energy information (the count of user-material occurrences
excluding the regulation line is 0).

## Was "energy" Regulation-Supplied?

**Yes** — `energy=1` is rendered in the visible `[regulation]` line of the subject data. This is
intended visibility: state may shape the choice but must stay latent.

## Was "energy" Prompt-Primed?

**Partially, by prohibition vocabulary only** — "energy" appears in the rule 5d/10 prohibition
lists (naming the forbidden vocabulary) and in no example sentence. There is no demonstrated
priming mechanism analogous to the historical "capacity" example-copying; the round-A/B contrast
(same prompt, different compliance) shows the prompt alone does not determine the violation.

## R4 Contract Clear Enough?

**Yes.** Rule 5d names "energy" among never-assert subject-side conditions and requires state to
stay latent; rule 10 repeats it for claims. The model's sentence violates a clearly stated,
non-ambiguous rule. No architecture-level contract defect is demonstrated.

## Should Prompt Change?

**NO.** Per §34/§42: the contract is clear, so R4 is model capability/compliance evidence. The
production prompt is preserved byte-identically. If R4 recurs systematically across future rounds,
the correct next step is a dedicated read-only review of state-visibility pressure — not another
wording tweak.

## Cross-Run Request Identity

Per-line diff of the two rounds' rendered requests (M2 shown; same shape for all scenarios): the
system prompt and the structured schema are **byte-identical**; the user content differs exactly in
the subject-id line and every subject-id-derived value: `subject_id`, the two `episode:` refs, their
`experience_ref`/`event_ref` companions, the `F1/F2/C3` handle bindings, and therefore the
`projection_hash`. No other difference exists.

## Model Digest Identity

Identical: `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` in both rounds and in
this review.

## Provider Setting Identity

Identical: temperature 0, think false, stream false, num_ctx 8192, num_predict 2048, timeout
240000, native structured output.

## Runtime/Ollama Version Identity

Ollama **0.34.0** recorded in both freezes; model digest identical; no version change occurred
between rounds or during this review.

## Seed Currently Sent?

**No.** The transport's request builder sends
`options: { temperature: 0, num_predict, num_ctx }` and no `seed` (verified in
`ollama-native-cognition-transport.ts`).

## Seed Supported?

The Ollama chat API accepts a `seed` option; the diagnostic sent `seed: 42` three times and the
outputs were **byte-identical to the unseeded calls** — at temperature 0 the sampler is greedy, so
the seed is inert. Seed-based control cannot influence this pipeline; CharacterOS does not expose a
seed setting.

## Qualification Run Ordering

Reported: scenario-major, replicate-minor, single condition `AFFECT_ABSENT` — 13 scenarios × 5
replicates in fixed order.

## Formal Planned Ordering

Already interleaved per replicate: for each scenario, for each replicate, the four conditions run
consecutively in a rotated schedule (`conditionSchedule` = round-robin `P,N,A,Z` rotated by
replicate). Conditions therefore share the nearest-possible execution context, and the paired
structure P_j/N_j/Z_j/A_j is a matched quartet. No change required; recommended as-is.

## Cross-Run Divergence Table

| item | round A | round B | replay A (×3) | replay B (×3) |
| --- | --- | --- | --- | --- |
| request bytes | subject-id A | subject-id B (differs only in id-derived refs) | exact A bytes | exact B bytes |
| cognition output | A wording | B wording | **A wording, byte-exact 3/3** | **B wording, byte-exact 3/3** |
| M2 rationale | "I value participating…" | "I find structured planning sessions useful…" | reproduced exactly | reproduced exactly |

The divergence is **input-driven**; the replay proves the provider reproduces each round's exact
output from that round's exact bytes.

## Within-Run Replicate Identity

Both rounds: every scenario 5/5 identical stance, rationale and delivered text. Under determinism
this is expected: the five replicates of a cell differ only in the opaque *session id*, which is
never model-visible, so their provider-boundary bytes are identical.

## Is Temperature Zero Sufficient?

**Yes, with one caveat.** For a fixed request and a live provider instance, generation is
bit-reproducible (9/9 replays, two distinct requests, exact historical reproduction hours later).
The caveat is not nondeterminism but *sensitivity*: greedy sampling flips wording on small context
changes — including our own slice-scaffolding rename of the subject id. Control the inputs, and the
outputs are deterministic.

## RD-A — CURRENT SETTINGS ACCEPTABLE

**Adopted, with input-identity controls.** Determinism was demonstrated; no additional randomness
control is needed. The controls are: (i) freeze the subject id across slices — it is an input;
(ii) record the provider instance (already partly done via version/digest; add instance identity at
freeze time); (iii) keep conditions interleaved (already true).

## RD-B — FIX ONE GLOBAL SEED

Rejected: seeds are inert at temperature 0 (empirically byte-identical).

## RD-C — MATCHED PER-REPLICATE SEEDS

Rejected on evidence: seed variation cannot produce replicate diversity at greedy sampling, and
per-replicate seeds would create the illusion of stochastic replication while changing nothing.

## RD-D — RANDOMIZED / INTERLEAVED CONDITION ORDER ONLY

Already implemented (interleaved, rotated); randomization beyond the frozen rotation is unnecessary
and would break the frozen comparability.

## RD-E — MATCHED SEEDS + INTERLEAVED CONDITION ORDER

Rejected (seed half inert); the interleaving half is already in place and the matched quartet is
the recommended pairing.

## Recommended Reproducibility Control

Instance-and-input matched: freeze the subject id across slices; record an instance identity block
in each freeze (Ollama version, model digest, server start time or an equivalent instance marker);
keep the existing interleaved condition schedule; treat the five replicates as determinism checks of
one input, not as stochastic samples.

## Seed Derivation

`NONE` — no seed is sent, none can be usefully sent at temperature 0, and no condition may ever
enter any seed-like derivation.

## Condition Ordering

Unchanged: qualification single-condition A in fixed scenario order; formal keeps
scenario-major, replicate-minor, four conditions consecutive per replicate in the frozen rotation.

## Replicate Meaning

Under the demonstrated determinism, `replicate` = repeated execution of an identical input. The five
(future seven) replicas verify stability/reproducibility of that input's outcome; they do **not**
represent independent stochastic samples. This must be stated wherever k is interpreted. If genuine
stochastic robustness is ever wanted, it requires a temperature change — a frozen-settings decision
outside this review.

## Impact On Existing TVD/JS Criteria

None, and the criteria remain coherent: identical replicates give within-condition split-half
TVD = 0, so `between-condition TVD > within-condition TVD` reduces to `between-condition TVD > 0`
while the absolute floors (TVD ≥ 0.28, JS ≥ 0.05, ≥6/7 class consistency) keep their meaning. The
criterion becomes *stricter*, not looser, because between-condition differences cannot be attributed
to noise. No threshold change is recommended.

## Does Qualification Need A New Freeze?

**Yes** — a new qualification freeze is required, binding the refined rationale validator and the
re-scoped choice evaluator (new instrument versions), the unchanged prompt/scenarios/settings, the
frozen subject id, and the instance identity block.

## Does Formal Need A New Freeze?

**Yes** — the formal freeze must bind the same refined instruments and the reproducibility control
block; one instrument version per run, formal only after a fresh 65/65.

## New Canonical State?

`NO`.

## Affect Semantics Changed?

`NO`. ## Applicability Changed? `NO`. ## Ref Handles Changed? `NO`. ## Family D Justified? `NO`.

## Additional Model Calls

`9` controlled diagnostic calls (the §27 allowance), all on the frozen M2 scenario, recorded
separately in `diagnostic-calls.jsonl` and used only to resolve reproducibility mechanics. No
tuning purpose; no qualification evidence altered.

## Can Qualification Be Re-run After One Implementation Slice?

`YES` — one instrument-alignment slice (rationale validator per RC-D, choice evaluator per CF-B/C,
probe suites and regression batteries frozen before calls, subject id frozen, instance block in the
freeze), then the unchanged 65 cells.

## Can Formal Run Immediately After 65/65?

**Only if the reproducibility controls are frozen first** — the refined instruments, the frozen
subject id and the instance identity block must all be in the formal freeze. With those in place,
the 476-cell matrix runs unchanged.

## Can Affect Phase 2 Close After One More Implementation Slice?

`YES, conditionally` — one slice can align the instruments, re-qualify, and on 65/65 run the frozen
formal matrix plus lawful POS/NEG; closure depends on the matrix meeting its frozen criteria.

## Can Relationship Phase 3 Begin Now?

`NO`.

## Recommended Next Slice

**`AFFECT_COGNITION_INSTRUMENT_ALIGNMENT_AND_INPUT_STABILITY_V0`** — implement RC-D (minimal
subjective frame + byte-unchanged forbidden boundary) and CF-B/C (authoritative stance primary +
stance-scoped choice detection) as versioned research instruments, with N5Q/choice/rationale probe
suites and the historical regression battery frozen and green before any call; freeze the subject
id across slices and add the instance identity block to both freezes; re-qualify the unchanged 65
cells under the unchanged production prompt and settings; run the frozen 476-cell formal matrix only
on 65/65. No prompt change, no scenario change, no threshold change, no Affect change, no seed
control.

## Production Files Changed

`NO`.

## Confidence

**High** on reproducibility: byte-exact replay of two distinct historical requests, 9/9 calls, seed
inertness demonstrated, and a per-line input diff that fully accounts for the divergence —
including the correction of the earlier misdiagnosis, which is made explicitly rather than quietly.
**High** on R3: the hedge span, location, stance identity and the conflicting instruments are all
directly observable. **High** on RC-D's necessity (two consecutive lawful-paraphrase failures) and
**medium-high** on its sufficiency (structural frame tests can still miss unusual phrasings, but the
failure mode becomes "no first-person frame", which is the architecture's actual boundary).
**Medium** on R4: a genuine violation is proven; whether regulation visibility materially raises its
probability cannot be separated from basin-level context sensitivity without a dedicated
experiment, and no prompt change is proposed on this evidence.

## Largest Remaining Uncertainty

Whether the minimal-subjective-frame validator, once implemented, admits any undesirable phrasing
its structural test cannot see — controlled by the frozen probe suite and the byte-unchanged
forbidden boundary, and disclosed here as the design's known residual risk. Secondarily, whether R4
recurs under the next qualification: if it does, that is model-compliance evidence that should be
reported as such, prompting a state-visibility review rather than another prompt iteration.

STOP. No recommendation implemented.
