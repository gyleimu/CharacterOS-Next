# D3-B INSTRUMENT QUALIFICATION — ROUND REPORT

**`D3_B_INSTRUMENT_QUALIFIED`**
**`D3_B_NOISE_PILOT_AUTHORISED`**
**`D3_B_TARGET_NOT_EXECUTED`**
**`D3_MODEL_CALLS = 9`** (the round budget: 9 of 9, zero retries, zero replacements, no tenth call).

---

## 1. WHAT WAS IMPLEMENTED BEFORE ANY CALL

Three previously description-only rules became callable code, closing the four pending implementations
that revision 2's executability audit identified:

- **`buildD3RelationReadoutRequestV0`** (`transformer-d3b.ts`) — the frozen name from
  `D3B_TRANSFORMER_CONTRACT`.
- **`scoreD3BQualificationV0`**, **`classifyD3BNoisePilotV0`**, **`scoreD3BTargetV0`**
  (`scorers-d3b.ts`) — the qualification scorer, the noise classifier and the target scorer, each
  implementing exactly its frozen decision and reading nothing else.

**One implementation detail that had to be decided, stated plainly.** The frozen contract text is a
literal whose STATEMENT A and STATEMENT B lines hold the *target* pair. Qualification fixtures need the
same contract with a different pair, so the text is rendered by substituting **exactly those two lines**
and nothing else. Two conformance checks make that safe rather than convenient: rendering the target
pair must reproduce `D3B_CONTRACT_TEXT` byte-for-byte, and each fixture's rendered text must differ from
the frozen literal on **exactly lines 6 and 8** — which it does, for all three fixtures.

**The qualification base binding.** D3-B's fixtures must carry no CharacterOS state and no CAUTION
proposition, but production user content *does* carry the CAUTION belief line. So the qualification base
is a real production V8 request with the belief block stripped by the **D1-frozen** `stripBeliefBlockV0`.
This is an implementation-level binding, not a scientific rule, and it is verified mechanically: the
CAUTION label is present before stripping and absent after, and the built fixture requests carry neither
the canonical proposition nor the target paraphrase in their subject data. The D3-B **target** request
was not built, and when it is, it keeps the production subject data untouched.

## 2. OFFLINE CONFORMANCE — 0 CALLS

**Transformer:** accepts a pristine production V8 request; the frozen contract text is reproduced for
the target pair; fixture renders differ only on the two statement lines; the frozen schema is exact; the
contract is appended exactly once; all three anchors are present; the fixture literals are used verbatim;
no DecisionProbeV2, no A0, no A1 and no D2-B contract; the D3-B marker present; subject data carries
neither CAUTION nor the paraphrase; user content untouched; an already-transformed input is rejected.

**Scorers**, called on synthetic inputs rather than re-implemented — all fifteen checks pass:

| check | result |
| --- | --- |
| perfect qualification | `D3_B_INSTRUMENT_QUALIFIED` |
| one invalid qualification trial | `D3_B_INSTRUMENT_UNQUALIFIED` |
| all fixtures answering the same relation | `D3_B_INSTRUMENT_UNQUALIFIED` |
| pilot modal_count 6 / 5 / 4 | `6` / `14` / STOP |
| pilot tie at the top | `D3_B_INCONCLUSIVE_BY_MODAL_TIE_UNDEFINED` |
| pilot with one invalid, and with all invalid | `D3_B_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS`, `modal_count` **null** (never 6) |
| target all-aligned | `PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED` |
| target with one dissenting trial | **NULL**, not positive — unanimity is required |
| target with an invalid trial | INCONCLUSIVE, not null |
| target with an integrity failure | INCONCLUSIVE |
| every outcome | `may_not_reopen_link_4: true` |

## 3. IMPLEMENTATION IDENTITIES, FROZEN BEFORE THE FIRST CALL

| | |
| --- | --- |
| transformer source | `sha256:9daa5521e0105974…` |
| transformer contract | `sha256:b2bbeb6a28ae6a4f…` (unchanged from revision 1) |
| schema | `sha256:a1a9f5c9e325a913…` |
| anchors | `sha256:6382a496178aea7c…` |
| scorers source | `sha256:24eef4995108450d…` |
| `d3_b_outputs_seen_before_implementation_freeze` | `false` |

No implementation was modified after the first call. Had a bug appeared, the whole qualification would
have been stopped — a fixed implementation may not continue the remaining replicates.

## 4. THE NINE TRIALS

Three fixtures built **once** each, each reused for its three replicates: three distinct request hashes
across nine trials, so no replicate ordinal entered a payload.

| # | fixture | rep | relation | ms |
| --- | --- | --- | --- | --- |
| 001–003 | `D3B-QF-A-ALIGNED` | 1–3 | `SEMANTICALLY_ALIGNED` ×3 | 875 / 456 / 518 |
| 004–006 | `D3B-QF-B-UNRELATED` | 1–3 | `SEMANTICALLY_UNRELATED` ×3 | 520 / 410 / 396 |
| 007–009 | `D3B-QF-C-OPPOSED` | 1–3 | `SEMANTICALLY_OPPOSED` ×3 | 508 / 666 / 767 |

Invalid 0; transport failures 0. The dataset was written with `scored: false` and hashed **first**
(`sha256:04f232f3878888…`, independently recomputed), and only then was the frozen
`scoreD3BQualificationV0` called — on the re-read frozen bytes, not on the in-memory array.

Every fixture's modal relation equals its pre-registered expected relation, exactly, with no tolerance
and no similarity substitution: `D3_B_INSTRUMENT_QUALIFIED`.

## 5. SCIENTIFIC BOUNDARY

**Qualification PASS says one thing:** DeepSeek with the frozen D3-B measurement contract can realise its
`SEMANTICALLY_ALIGNED` / `SEMANTICALLY_UNRELATED` / `SEMANTICALLY_OPPOSED` vocabulary on preregistered
state-blind synthetic relation fixtures.

It does **not** establish that the canonical CAUTION proposition and the A1 paraphrase are aligned, nor
CharacterOS semantic integration, cross-wording stance transfer, appraisal or behaviour. The target pair
has not been run, and a qualification failure would equally have said nothing about it — which is why
this round's FAIL branch carried an explicit forbidden interpretation. No D3-A call was made (its
execution path is deleted) and no D2-B call was made (D2-B remains locked absolutely: a D3-B positive
cannot substitute for an A1 positive).

## 6. ARTIFACTS

`evidence/run-001/d3-b-instrument-qualification/` — `transformer-conformance-report.json`,
`scorer-conformance-report.json`, `implementation-manifest.json`, `qualification-fixture-manifest.json`,
`fixture-{A,B,C}-request.json`, `trial-001..009.json`, `qualification-dataset.json` (`scored: false`),
`qualification-dataset-hash.json`, `qualification-counts.json`, `qualification-modal-report.json`,
`qualification-scorer-output.json`, `D3_B_QUALIFICATION_MANIFEST.json`

Verified after: the D3-B qualification dataset recomputes; D2-A0 (`eb8be177…`), D2-A1 (`2cacbf01…`) and
D1 (`02bd7e31…`) are untouched. No credential in any artifact (scanned). `tsc -p
tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.

**Stopped here.** The next authorised step is the D3-B noise pilot (6 byte-identical target calls, then
`r_confirm_B ∈ {6, 14}`); the D3-B target pair itself is not yet authorised.
