# D2 A1 INSTRUMENT QUALIFICATION — ROUND REPORT

**`D2_A1_INSTRUMENT_QUALIFIED`**
**`D2_A1_NEUTRAL_PILOT_AUTHORISED`**
**`D2_A1_STATE_EXPERIMENT_NOT_STARTED`**
**`D2_MODEL_CALLS = 36`** (9 this round; zero retries, zero replacements, no tenth call)

---

## 1. THE TRANSFORMER, IMPLEMENTED BEFORE ANY CALL

`transformer-a1.ts` realises `buildD2SemanticReadoutRequestV0` against the REV1.1c specification. It
decides nothing scientific: the token vocabulary, anchors, paraphrase literal, schema, lexical laws,
fixtures, expected-token map, invalid rule and prediction are all read from the frozen module. It also
fails closed on a request that already carries **any** measurement contract — A1's, A0's, B's or
DecisionProbeV2's — so transformer-on-transformer cannot happen by accident.

Implementation identity, frozen **before** the first call (0 A1 outputs seen at freeze time):

| Field | Value |
| --- | --- |
| transformer source hash | `sha256:628c5094deee14de…` |
| A1 contract hash | `sha256:6c0498dd0c51f67d…` |
| A1 schema hash | `sha256:6d3e1924c890a35a…` |
| anchors hash | `sha256:37553dd7593ea846…` |
| paraphrase hash | `sha256:99e07b1fea44e9df…` |
| `a1_outputs_seen_before_implementation_freeze` | `false` |

## 2. THE CONFORMANCE GATE FAILED ONCE, AND THE FAILURE WAS IN MY CHECK

The first offline run emitted `D2_A1_TRANSFORMER_IMPLEMENTATION_NONCONFORMANT` with
`action_token_hits: ["choose"]` — **0 model calls spent**, because the gate runs before the executor.

The occurrence was in the production system prompt, which reads *"only when you choose CLARIFY"*. That
prompt is byte-exactly preserved by contract and is not ours to sanitise; `D2A1_LEXICAL_LAWS` binds the
A1 **measurement contract**, not the inherited production frame. My check had scanned the whole final
system message, which is both too broad (it fails on inherited vocabulary, making the transformer
unimplementable) and, in the other direction, not the sharpest available test.

It was replaced with the two falsifiable forms of each lexical law:

1. **the A1-attributable text** (the appended contract) must be clean — contract hits for
   `ACCEPT/VERIFY/REJECT/proceed/choose/decide` are all **0**, and for `HIGH/LOW/NEUTRAL` all **0**;
2. **the transformer must introduce none of it** — per-token counts in the final system message equal
   those in the pristine one, so every `introduced` delta is **0**.

Checking (1) alone would miss a leak introduced elsewhere; checking the whole message alone fails on
production vocabulary. Both now hold, on all three fixtures.

Remaining conformance results, all green: accepts a pristine production V8 request; production prefix
byte-identical; V8 structured output replaced exactly once with exactly the frozen A1 schema; A1
contract appended exactly once with an exact literal hash; the frozen paraphrase appears exactly once;
the frozen anchors appear exactly; no DecisionProbeV2, no A0 and no B contract; the belief block is the
only substituted region; user content untouched by the transformer; already-transformed input rejected;
second application rejected; no experimental credence values; no mapping hint for 0.80/0.20; 4-gram
overlap with the canonical CAUTION label = 0.

## 3. THE NINE TRIALS

Fixtures read only from REV1.1c — ids, bytes, credences `0.95 / 0.49 / 0.06` and the expected-token map
unchanged. No experimental credence (0.80 / 0.20 / 0.50) and no CharacterOS canonical state appears
(`uses_characteros_canonical_state: false`, `contains_treatment: false`). Each fixture built **one**
request, reused for its three replicates; three distinct request hashes across the nine trials, so the
replicate ordinal never entered the payload.

| # | Fixture | rep | Token | ms |
| --- | --- | --- | --- | --- |
| 001–003 | `A1-QF-A-SUPPORT` | 1–3 | `SUPPORTS_PARAPHRASED_PRINCIPLE` ×3 | 868 / 373 / 414 |
| 004–006 | `A1-QF-B-UNCERTAIN` | 1–3 | `UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE` ×3 | 487 / 385 / 407 |
| 007–009 | `A1-QF-C-OPPOSE` | 1–3 | `OPPOSES_PARAPHRASED_PRINCIPLE` ×3 | 363 / 450 / 883 |

Invalid trials **0**; transport failures **0**; the frozen invalid rule
(`any_invalid_qualification_trial_fails_that_instrument_qualification`) was not triggered, and the
denominator stayed the planned 9. Raw dataset written trial-by-trial, marked `scored: false`, frozen at
`sha256:d6e446c6da48a137…` and independently recomputed before scoring; counts derived by re-reading
those frozen bytes. Every fixture's modal equals its pre-registered expected token — exact token match,
no tolerance and no similarity substitution.

## 4. WHAT THIS DOES AND DOES NOT ESTABLISH

**It establishes:** the A1 semantic-readout measurement instrument, against the frozen contract and on
state-blind fixtures outside CharacterOS, can realise its own three-token vocabulary — support,
uncertainty and opposition each read correctly, three times out of three.

**It does not establish anything about CharacterOS**, and one structural reason deserves to be stated
rather than buried: in these fixtures the frozen paraphrase appears **both** in the stimulus belief line
and in the contract as the PRINCIPLE. That is the frozen design — `proposition_is_the_frozen_paraphrase:
true`, and `D2_QUALIFICATION.purpose` is only *"to check that the instrument can realise its own
construct vocabulary"* — but it means a qualification pass is reachable by matching two identical
strings. **The real A1 state experiment is where the shortcut is unavailable**: there the subject data
carries the canonical CAUTION proposition, the paraphrase appears only in the contract, and the executor
must transfer an endorsement across two different wordings. Qualification is necessary for that
experiment; it is not evidence about it.

Nothing here licenses a claim of CharacterOS proposition semantic uptake, canonical CAUTION semantic
transfer, cognition use, appraisal effect or behavioural effect. A qualification PASS says the
instrument works; a qualification FAIL would only have said the instrument is unqualified and could not
have localised any causal breakpoint.

## 5. ARTIFACTS

`evidence/run-001/a1-instrument-qualification/` — `transformer-conformance-report.json`,
`A1_TRANSFORMER_IMPLEMENTATION_MANIFEST.json`, `qualification-fixture-manifest.json`,
`fixture-{A,B,C}-request.json`, `trial-001..009.json`, `qualification-dataset.json` (`scored: false`),
`qualification-dataset-hash.json`, `qualification-counts.json`, `qualification-modal-report.json`,
`qualification-verdict.json`, `A1_QUALIFICATION_MANIFEST.json`

**Stopped here.** The A1 neutral pilot was not run, the A1 HIGH/LOW state experiment was not run, D2-B
was not touched, and no D1 or D2-A stage was re-run.

Verified after the fact: the three frozen A0 request hashes and the A0 state dataset hash still
recompute; D1 is untouched (`02bd7e31…`). No credential appears in any artifact (scanned).
`tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.
