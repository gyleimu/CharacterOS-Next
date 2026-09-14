# AFFECT_COGNITION_C4_3_CONTRACT_LEGIBILITY_AND_GROUNDING_V0 — REPORT

## Principal Verdict

```
AFFECT_COGNITION_C4_3_REVALIDATION_INCONCLUSIVE
```

Qualification reached **55/65** (gate 65/65), so the **formal 476-cell matrix was not run** and the
lawful POS/NEG stage was not executed.

The slice's chartered work **succeeded**: the citation-binding contract was restored and
**0 citation-binding violations** occurred in 65 cells, with **N2 5/5** (the exact C4.2 failure) now
bound and fact-correct. The gate failed on two *new, independent* model-compliance families, 5 cells
each, neither of which the frozen verdict space names:

- **N6 ×5 — applicability regression.** On a deterministic classification task the model emitted
  `{"kind":"SELECTED","stance":"I would classify 'abca' as a MATCH."}` and the turn **delivered**
  `"I would classify 'abca' as a MATCH."` This is the C3 Family-A shape (a plan-shaped pseudo-selection
  on a turn that has no selection to make) re-appearing on one scenario. The host accepted it (the tag
  is structurally lawful), so this is a *model* compliance failure, correctly caught by the
  applicability endpoint — but it is the first such regression since C3.
- **R3 ×5 — evidence-ref fidelity.** The model cited
  `episode:858f4cf500a0126c54571327ede96d6fd909b115236159abc014ad1740053` in
  `considered_context_refs`; the lawful ref listed under CITEABLE CONTEXT REFS is
  `…ede96796d6fd…`. The ref differs by one character — a fabricated/near-miss ref — and the host
  correctly failed the turn closed (`UNSUPPORTED_EVIDENCE_REF/LLM-EVID-001`).

Neither family reached the frozen Family-D thresholds (each is 1 scenario: 5/5 N6, 5/5 R3).

## Repository Baseline

`main` at `1db080e`, clean worktree, verified before any change.

## Final HEAD

Production `5721517` (`fix: restore cognition evidence-binding contract`), then the research commit
for this report.

## Worktree

Clean at freeze time except this new research directory; `.partial` evidence renamed to the immutable
`.jsonl` on completion; no historical evidence file modified.

## Model Used

Ollama native `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, Q4_K_M — verified identical to
the C2/C3/C4/C4.2 baselines.

## Architecture Changed?

`NO`

## Canonical Affect Changed?

`NO`

## Contract-Legibility Repair

Cognition prompt rule 2a (CITATION BINDING), and nothing else.

## Exact Host Requirement

For every `factual_assessment.claims[i].source_refs[j] = ref` the host requires: (1) `ref` is in the
advertised FACTUAL SOURCE REFS set; (2) **`ref ∈ cognition.considered_context_refs` AND
`ref ∈ cognition.evidence_refs`**; (3) inspectable source content exists for `ref`; (4) for
`SOURCE_QUOTE`, the claim text is an exact substring of the cited source. Read directly from
`validateFactualAssessmentV0` (plus the §15 evidence-grounding gate
`UNSUPPORTED_EVIDENCE_REF/LLM-EVID-001` requiring every cognition ref to be inside
`allowedEvidenceSet`).

## Exact Prompt Requirement Added

> **2a. CITATION BINDING (C4.3):** every ref you list in any
> `factual_assessment.claims[*].source_refs` must ALSO be listed in
> `cognition.considered_context_refs` AND in `cognition.evidence_refs`. The host binds a cited source
> into BOTH of those cognition arrays; a claim whose source appears only in `factual_assessment`, or
> in only one of the two arrays, is rejected and the whole turn is refused. Cite nothing you have not
> bound in both arrays.

## Host Validator Changed?

`NO` — the prompt was moved to the host contract, never the reverse.

## Additional Hidden Contract Defects Found?

`NO` — audit verdict **`CONTRACT_LEGIBILITY_OK`**, 14/14 host-enforced obligations covered by the
system prompt, the request-rendered data block, or the JSON schema. One **non-material** gap is
recorded and deliberately unchanged: the 256-code-point stance/rationale bound is implied by the
prompt's "ONE short sentence" wording but not stated numerically. The §15 evidence-membership
obligation (which R3 violated) *is* stated to the model, in the data block's CITEABLE CONTEXT REFS
header.

## Lexical Guard Status

`NOT SHIPPED` — `LEXICAL_GROUNDING_GUARD_TOO_BRITTLE`, evaluated once in C4.2, not re-evaluated,
unchanged.

## Choice Applicability Status

**Regressed on N6 ×5**: 25/30 null cells read `NOT_APPLICABLE` (N1–N5 5/5 each), N6 ×5 read
`SELECTED` with a plan-shaped stance. Choice-bearing applicability is intact: 35/35 `SELECTED`.

## Rationale Policy Status

Frozen and clean: 35 `ABSENT`, 30 `PURE_PREFERENCE`, **0 forbidden classes** across the three
forbidden families that C4.2 closed (M1 self-state, M3 capability, R4 freshness).

## Stance Authority Status

35/35 `SELECTED` stances are `ON_QUESTION_STANCE`; stance remains the sole choice authority; rationale
never determines the selected option.

## Language Semantic Completion Status

`0` — 65/65 `PRESERVED` (no decision target supplied by Language anywhere).

## factual_assessment Status

Authority unchanged and uncompromised: 0 self-state claims, 0 unlawful source attempts, 0 unlawful
sources accepted, 0 citation-binding violations. The 5 R3 refusals were a *fabricated ref* error, not
an authority breach.

## projection_hash Status

`HOST_BOUND_PROJECTION_HASH_OUTSIDE_MODEL_OUTPUT`, unchanged (0 model-emitted hashes).

## Production Files Changed

`packages/runtime/src/providers/behavior/conversation-cognition-provider-v5.ts` (rule 2a) and a new
zero-model regression suite `c43-citation-binding.test.ts`. No schema, validator, executor or
hash-domain change.

## Implementation Commit

`5721517` — `fix: restore cognition evidence-binding contract`

## Contract-Legibility Audit

`audit-contract-legibility.mjs` → `contract-legibility-audit.json`. 14 obligations compared:
factual source legality, claim source binding, inspectable source content, SOURCE_QUOTE verbatimness,
claim bounds, cognition array hygiene, unit intervals, `action_intent` null, projection-hash
ownership, clarification-basis binding, choice applicability, stance/rationale bounds,
**cognition ref membership**, rationale factual authority. Verdict
`CONTRACT_LEGIBILITY_OK`; the only coverage gap is the non-material numeric bound noted above.

## Historical N2 Regression

Zero-model regressions in the runtime suite and the research classifier: the prompt states the
contract; a source bound in both arrays passes; the historical N2 shape (missing from
`considered_context_refs`) and the evidence-only variant both fail closed with
`is not bound in cognition considered/evidence refs`.

## Sentinel

`sentinel.test.mjs`, 7 tests, zero model calls, green before the run: the restored citation-binding
rule and the C4.2 policy rules are present in the sent prompt; tagged `NOT_APPLICABLE`/`SELECTED`
paths work; the rationale survives the V6 handoff; malformed choices are refused before Language;
`CLARIFY` requires `NOT_APPLICABLE`; the lexical guard state is explicit; host binding works;
condition-blind ids.

## Qualification Freeze Hash

`sha256:16d0a8e536be618865c41a5ab072702280b4e0eb1164d88ede0bac2fb5acad1b` — it binds HEAD, provider digest/settings, the V5 proposal and
draft-schema digests, **both prompt digests** (`cognition_prompt_sha256`, `language_prompt_sha256`),
the citation-binding contract, the rationale policy, the grounding status, the frozen C4.2
paraphrase result, the 13 scenarios, retry rules, the condition-blind id policy, host binding and the
harness source digests (classifier, pipeline, config, contract audit).

## Model / Digest

`qwen3.5:9b` / `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`

## Qualification Calls

65 cognition + 60 language = 125 invocations; 0 retries, 0 replacements, 0 reruns.

## Per-scenario results

| Scenario | Result | Notes |
| --- | --- | --- |
| N1 | 5/5 | `NOT_APPLICABLE`, correct facts |
| **N2** | **5/5** | **the repaired cell — `CITATION_BOUND`, correct fact, delivered** |
| N3 | 5/5 | |
| N4 | 5/5 | |
| N5Q | 5/5 | |
| **N6** | **0/5** | `SELECTED` plan-shaped stance on a classification task; delivered |
| M1 | 5/5 | `PURE_PREFERENCE` rationale |
| M2 | 5/5 | on-question stance, preserved |
| M3 | 5/5 | rationale absent |
| R1 | 5/5 | |
| R2 | 5/5 | |
| **R3** | **0/5** | host refusal: fabricated `episode:` ref off by one character |
| R4 | 5/5 | |

## Null Aggregate

25/30 `NOT_APPLICABLE` with correct facts and `RATIONALE_ABSENT`; 5/30 (N6) declared a selection.
`NOT_APPLICABLE / 30` is **not** met this run.

## Choice Aggregate

35/35 `SELECTED`, all `ON_QUESTION_STANCE`, 30 lawful `PURE_PREFERENCE` rationales / 5 absent.

## Rationale Violations

`0`

## Off-Question Stances

`0`

## Language Semantic Completions

`0`

## Citation-Binding Violations

`0` — 65/65 `CITATION_BOUND`. **The slice's target defect is closed.**

## Family-D Failure-To-Select

`NOT TRIGGERED` (N6 is a null scenario; no choice-bearing scenario failed to select or ground).

## Family-D Failure-To-Withhold

`NOT TRIGGERED` — the frozen rule needs ≥3/5 cells on ≥2 null scenarios; only N6 (1 scenario) emitted
`SELECTED`. Recorded as an explicit near-miss: 5 cells, one scenario.

## Qualification Passed?

`NO` — 55/65.

## Formal Matrix Run?

`NO` — `run-formal.mjs` refuses with `FORMAL_BLOCKED_QUALIFICATION_GATE: 55/65`; `analyze-formal.mjs`
reports `NOT_RUN`.

## Formal Freeze Hash / Formal Cognition Calls / Null Formal Aggregate / Mixed Formal Aggregate / R1–R4 P/N / Relevant Material Aggregate / TVD / JS

Not applicable — no formal evidence exists. The thresholds remain frozen (`formal-freeze.json` freeze_hash `sha256:9952b8981f0e4f0c6aaf35b48e3a74d906cc2fe7b606270c0a62bcce2fec6e8b`).

## Factual Audit / Rationale Audit / Stance Audit / Language Fidelity Audit / Clarification Audit

Factual: 0 self-state claims, 0 unlawful sources, 0 unbound claim sources · Rationale: 0 forbidden
categories · Stance: 35/35 on-question · Language (delivered cells): 30 withheld + 30 preserved, 0
changed/dropped, 0 invented, 0 completions, 0 fact changes · Clarification: 0 CLARIFY, 0 false.

## Historical S1–S4

Not run (formal stage).

## Condition Leakage

PASS — 0 violations in 65 cells.

## Request Isolation

PASS — all P/N/Z/A derivations attested; only the affect section differs.

## Lawful POS / Lawful NEG / Affect Round-Trip

Not executed.

## Affect Causal Differentiation Established?

`NO` — the formal P/N/Z/A matrix has never run in this programme; no Affect-conditioned evidence
exists at all yet.

## C4.3 Validated?

`NO`

## Can Affect Phase 2 Close?

`NO`

## Can Relationship Phase 3 Begin?

`NO`

## Allowed Affect Claim

Only what earlier slices established (Affect persists, restores, is visible to cognition); this slice
adds no Affect-conditioned claim.

## Forbidden Claims

That C4.3 is validated; that the citation-binding repair failed (it succeeded: 0 violations, N2 5/5);
that the qualified protocol is otherwise unusable (rationale, stance, language and factual endpoints
all passed); that Affect changes the choice.

## Research Tests / Targeted Tests

Research: `deterministic.test.mjs` 9/9, `sentinel.test.mjs` 7/7, contract-legibility audit
`CONTRACT_LEGIBILITY_OK` (all zero-model). Runtime: `c43-citation-binding.test.ts` 4 tests + the C4.2
policy suite 4 tests, all green.

## Full Suite / Typecheck / Auxiliary Typecheck / Build / Lint / Governance / Diff Check

`pnpm test` **2458 passed / 3 skipped / 0 failed** (199 files) · typecheck clean · auxiliary **4 ×
TS2883 pre-existing** (`preflight.ts:74`, baseline-identical) · build clean · lint clean
(`--max-warnings 0`) · governance PASS · `git diff --check` clean.

## Commits

`5721517` (production), research commit for this report.

## Push / HEAD / origin/main / Ahead / Behind / Worktree

Normal push, no amend, no force; HEAD == `origin/main`; worktree clean.

## Recommended Next Slice

Per the brief's §29, **no C4.4 prompt loop**. Two independent model-compliance families now block a
protocol that is otherwise fully green (rationale, stance, language, factual authority, citation
binding), and neither is a wording problem:

`AFFECT_COGNITION_CHOICE_APPLICABILITY_AND_REF_FIDELITY_ARCHITECTURE_REVIEW` (read-only)

The review must explain why, under a prompt that states the rule and a host that rejects violations:
(a) a deterministic-classification turn still gets a plan-shaped `SELECTED` stance — is the
applicability tag genuinely discriminative for "classify X" style tasks, or does the model treat
"state the result" as a selection? and (b) the model fabricates a ref that differs by one character
from a listed one — is ref copying too fragile for long opaque hashes, and should the protocol stop
echoing 64-hex refs through the model at all (e.g. index-based selection)?

Do not tune prompts, do not weaken the host, and do not implement Family D. If the review concludes
the applicability tag cannot be made to discriminate for classification tasks, or that model-side ref
copying cannot be made reliable, that is an architecture finding, not a wording finding.

---

### Evidence index

`PROTOCOL.md` · `BASELINE.md` · `contract-legibility-audit.json` · `qualification-freeze.json` ·
`qualification-raw.jsonl` · `qualification-summary.json` · `qualification-forensics.json` ·
`applicability-audit.json` · `citation-binding-audit.json` · `rationale-audit.json` ·
`stance-grounding-audit.json` · `language-audit.json` · `factual-authority-audit.json` ·
`clarification-audit.json` · `condition-leakage.json` · `family-d-falsification.json` ·
`verdict.json` · `formal-freeze.json` · `deterministic.test.mjs` · `sentinel.test.mjs` ·
`run-formal.mjs` / `analyze-formal.mjs` / `prepare-lawful.mjs` / `lawful.mjs` (written, unexecuted).
