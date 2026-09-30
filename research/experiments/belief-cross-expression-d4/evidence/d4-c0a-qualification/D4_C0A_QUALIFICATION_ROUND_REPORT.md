# D4-C0a INSTRUMENT QUALIFICATION — ROUND REPORT

**`D4_C0A_INSTRUMENT_QUALIFIED`**
**`D4_C0A_NOISE_STABILITY_IMPLEMENTATION_AUTHORISED`**
**`D4_C0A_TARGET_NOT_EXECUTED`** · **`D4_C0B_NOT_PREREGISTERED`** · **`LINK_4_REMAINS_LOCKED`** · **`CHARACTEROS_UNMODIFIED`**
**`D4_MODEL_CALLS = 9`** (exactly nine: no retry, no replacement, no tenth call) · noise calls 0 · target calls 0 · `git status packages/` empty.

**Budget line: `D4_C0A_QUALIFICATION_DATASET_SHA256 = sha256:frozen before scoring`, independently recomputed.**

---

## 1. A PREREGISTRATION GAP FOUND BY THIS ROUND'S OWN §1, AND CLOSED AT 0 CALLS

§1 required the implementation to use a name taken from the frozen contract. **No transformer contract
existed**: revisions 0 and 1 froze the base text, the contract text, the schema, the anchors, the
vocabulary, the binding renderer and the normalisation — every byte of the payload — but never a
**name**, an explicit substitution/append rule, or a fail-closed list.

It is a **documentation gap, not scientific freedom**, and the payload was already determined by frozen
text: the base text says *"The user message states: …"*, fixing the binding block to the user message; the
contract text opens with *"The output-format rules above are SUPERSEDED for this invocation"*,
presupposing it is appended after output-format rules. Nothing about the construct was undecided.

`contract-rev2-transformer.ts` freezes `D4C0A_TRANSFORMER_CONTRACT` (name
`buildD4C0AStanceTransferRequestV0`, append point, substitution, six fail-closed conditions, six
prohibitions) at `model_calls_before_amendment = 0`, with `qualification_outputs_seen_before_amendment:
false` and `target_outputs_seen_before_amendment: false`. Revision 0 and 1 hashes preserved;
`scientific_content_unchanged: true`.

## 2. TWO BUGS IN MY OWN CONFORMANCE HARNESS, CAUGHT BY THE GATES THEMSELVES

**(a) The mutation harness was not mutating.** Five of the fifteen identity checks reported "not
falsifiable" because my mutations passed plain **strings** where `{role, content}` message objects were
required, so the mutated user content was `undefined` and the check compared against `""`. A sixth used
`String.replace` with a string, which replaces only the **first** occurrence — and `OPPOSES_B` appears
twice in the system message. The checks were fine; my mutations were fake. The falsifiability gate caught
exactly that, which is what it is for.

**(b) A check that could never pass.** `contract_rendered_exactly_once` counted the bare marker
`D4-C0A STANCE TRANSFER CONTRACT`, which the frozen contract text contains **twice** — its opening and its
END line — so the check could never be satisfied. Corrected to count the contract's opening header line.
The **baseline assertion** caught this one, which is why it exists alongside the mutation test: one gate
catches a check that never fails, the other catches a check that never passes.

**(c) One implementation decision, stated rather than buried.** The frozen contract says the schema is
*"replaced … exactly once"*, which requires the base to carry something else — and the base text's own
"output-format rules above are SUPERSEDED" presupposes an output-format declaration above it. So
`buildD4C0ABaseRequestV0` carries a minimal placeholder `{type: "object"}` and the transformer substitutes
the frozen schema. The placeholder carries no semantics and is replaced before any call.

## 3. OFFLINE CONFORMANCE — 0 CALLS

**Transformer** `D4_C0A_TRANSFORMER_CONFORMANT`: all fifteen baseline checks true; **six fail-closed
conditions exercised and all triggered** — transformer-on-transformer, already-transformed schema,
wrong message count, non-frozen system text, missing binding line, foreign research contract present.

**Mutation falsifiability** `D4_C0A_IDENTITY_CHECKS_ARE_FALSIFIABLE`: **15 of 15** checks were made false
by a real mutation, so no identity check is a tautology.

**State-blindness** `D4_C0A_REQUEST_MATERIAL_IS_STATE_BLIND`: zero hits over 14 forbidden substrings,
re-audited on the full material — base, contract, both target arms and all three fixtures.

**SUPPORT/OPPOSE isolation** `D4_C0A_SUPPORT_OPPOSE_ISOLATION_HOLDS`: system messages **identical**,
user content differing on **exactly one line** (`SUBJECT STANCE TOWARD A:`), byte-identical after the
frozen sentinel normalisation, **zero** forbidden leakage. **Neither target request was called.**

**Frozen target scorer regression** `D4_C0A_TARGET_SCORER_UNCHANGED_AND_ENFORCING`: eleven synthetic cases
reproduce, and **`predicted_count >= 4` genuinely participates in the positive predicate** — the 3-2-1 row
returns `meets: false`, so the requirement is not merely described in prose. Scorer not modified.

## 4. IMPLEMENTATION IDENTITIES FROZEN BEFORE THE FIRST CALL

| | |
| --- | --- |
| transformer | `buildD4C0AStanceTransferRequestV0` |
| transformer source hash | `sha256:90d2228cea253f5a…` |
| transformer contract hash | `sha256:a1818bc23b5adab1…` |
| qualification scorer source hash | `sha256:57708a5e5bc7dbde…` |
| target scorer | unchanged from revision 1 |
| `qualification_outputs_seen_before_implementation_freeze` | `false` |
| `target_outputs_seen_before_implementation_freeze` | `false` |

No implementation was modified after the first call.

## 5. THE NINE CALLS

Three fixtures built **once** each and reused for their three replicates: three distinct request hashes
across nine trials, so no replicate ordinal entered a payload.

| # | fixture | rep | token | ms |
| --- | --- | --- | --- | --- |
| 1–3 | `D4C0A-QF-A-SUPPORT-TRANSFER` | 1–3 | `SUPPORTS_B` ×3 | 866 / 950 / 486 |
| 4–6 | `D4C0A-QF-B-OPPOSE-TRANSFER` | 1–3 | `OPPOSES_B` ×3 | 758 / 816 / 893 |
| 7–9 | `D4C0A-QF-C-NO-TRANSFER` | 1–3 | `UNCERTAIN_B` ×3 | 745 / 824 / 722 |

Planned 9 / records 9 / duplicate 0 / fixture identities exact / request hashes exact / invalid **0** /
transport failures **0**. The dataset was written with `scored: false` and hashed **first**, and only then
was the frozen `scoreD4C0AQualificationV0` **called** — on the re-read frozen bytes.

## 6. QUALIFICATION OUTCOME

Every fixture's modal token equals its pre-registered expected token, and the third fixture — the
**internal negative control**, an unrelated pair where no transfer is defined — correctly produced
`UNCERTAIN_B` three times, which is what makes the instrument's third token real rather than decorative.

**What this proves:** only that the frozen measurement contract can report an explicitly given stance
using its pre-registered three-token vocabulary on state-blind synthetic fixtures.
**What it does not prove:** cross-expression composition, treatment sensitivity, or any CharacterOS claim.
Qualification is instrument validation, not the C0a scientific target.

## 7. ARTIFACTS

`research/experiments/belief-cross-expression-d4/evidence/d4-c0a-qualification/` —
`state-blindness-report.json`, `transformer-conformance-report.json`,
`mutation-falsifiability-audit.json`, `support-oppose-isolation-audit.json`,
`frozen-target-scorer-regression-audit.json`, `implementation-manifest.json`,
`qualification-fixture-manifest.json`, `qualification-request-manifest.json`,
`qualification-request-{A,B,C}.json`, `trial-001..009.json`, `collection-integrity-report.json`,
`qualification-dataset.json` (`scored: false`), `qualification-dataset-hash.json`,
`qualification-scorer-output.json`, `D4_C0A_QUALIFICATION_MANIFEST.json`

Prior evidence recomputes (D2-A0 `eb8be177…`, D2-A1 `2cacbf01…`, D3-B target `8fee6b26…`); the
revision chain is intact (rev2 preserves rev1 `66afec1d…` and rev0 `5bac6aa4…`). `tsc -p
tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS; no credential in
any artifact.

**Stopped here.** The next authorised step is the **noise/stability implementation** — not its execution.
No noise call was made, no target call was made, C0b was not designed, and the positive claim remains
scoped to `PREREGISTERED POLAR STANCE COMPOSITION` for the future target only.
