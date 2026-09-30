# D2 A1 PREREQUISITE AUDIT — ROUND REPORT

**`D2_A1_PREREQUISITES_FROZEN`**
**`D2_A1_QUALIFICATION_AUTHORISED`**
**`D2_A1_STATE_EXPERIMENT_NOT_STARTED`**
**`D2_MODEL_CALLS = 27`** (unchanged — **0 calls this round**)

A1 was **not** executable as preregistered. The audit found five missing prerequisites; the round
froze all five instead of writing stimuli at execution time, and made zero calls.

---

## 1. THE AUDIT WAS MECHANICAL, NOT PROSE

`a1-prerequisites-audit.ts` introspects the exported values of every D2 contract module rather than
grepping and reading. It found **5 gaps**:

| # | Prerequisite | Finding |
| --- | --- | --- |
| 1 | literal A1 qualification fixture bytes | only KINDS existed (`["obvious support of the paraphrased principle", "obvious uncertainty about it", "obvious opposition to it"]`); no object anywhere carries an `A1-*` fixture id or a belief line under an A1 name |
| 2 | fixture → expected-token map | no export is keyed by an A1 fixture id and no A1 fixture carries its own expected token |
| 3 | callable `buildD2SemanticReadoutRequestV0` | named in `D2_TRANSFORMER_LAWS.new_transformers`, exported as a function **nowhere**; no input contract, output schema or contract hash |
| 4 | frozen qualification invalid rule | no exported value in any D2 contract mentions invalids at all |
| 5 | frozen A1 token anchors | `D2A1_ANCHORS` does not exist (while `D2A0_ANCHORS` does); `D2A1_TOKENS` lists names, and a name is not an anchor |

**The first run of this audit reported only 3 gaps, and that was my bug.** Two checks were too weak:
"does anything export an `expected_token`" was satisfied by the **A0** qualification fixtures, and
"does anything mention an A1 token" was satisfied by the **token-name list** `D2A1_TOKENS`. Both would
have produced a false `present` and let the round proceed on prerequisites that did not exist. The
checks were tightened to "is any export keyed by an `A1-*` fixture id" and "does any export map every
A1 token name to a meaning string", after which the audit reports the 5 gaps. The weak-check run is not
preserved as an artifact; the corrected run is the record.

That failure mode is the whole reason this round exists: an audit whose checks are satisfied by *any*
similar-looking artifact will clear a stage that has no fixtures, no answer key, no instrument and no
failure rule.

## 2. WHAT WAS FROZEN — `contract-rev1-1c-a1-prerequisites.ts`

Additive and immutable; REVISION 1 / 1.1 / 1.1a / 1.1b hashes preserved
(`revision_1_1b_manifest_hash_preserved: sha256:f40d1f56b52b213e09a9a85d0892f29a4870f5c5b3ac8792775314177bcd230a`).

- **Fixture literals** — three state-blind belief lines whose proposition IS the frozen paraphrase, at
  credences **0.95 / 0.49 / 0.06** (the experimental values 0.80 / 0.20 / 0.50 never appear):

| fixture_id | expected token |
| --- | --- |
| `A1-QF-A-SUPPORT` | `SUPPORTS_PARAPHRASED_PRINCIPLE` |
| `A1-QF-B-UNCERTAIN` | `UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE` |
| `A1-QF-C-OPPOSE` | `OPPOSES_PARAPHRASED_PRINCIPLE` |

- **Expected-token map** — `D2A1_EXPECTED_TOKEN_MAP`, explicit and machine-readable; the runner may not
  infer it from the stimuli.
- **A1 anchors** (gap 5) — token *meanings*, state-blind: they say what each token means, never which
  credence maps to it, never a HIGH/LOW word. These did not exist before; they are authored here with
  0 A1 calls and no A1 output seen.
- **A1 transformer contract** — `D2A1_TRANSFORMER_CONTRACT`, with `implementation_status_at_freeze_time:
  "NOT YET IMPLEMENTED"` recorded honestly rather than papered over.
- **Invalid rule** — `any_invalid_qualification_trial_fails_that_instrument_qualification`, with the
  invalid classes enumerated (parser rejection, stance outside the closed set, empty/malformed output,
  transport failure), denominator fixed at the full nine, no retry/replacement/deletion, and
  `verdict_if_any_invalid: D2_INSTRUMENT_UNQUALIFIED`. Applies to A1 and B, **not** retroactively to A0
  (A0 qualified with 0 invalid trials, so nothing past changes).

Contract text hash `sha256:6c0498ddc0c51f67…`; manifest hash `sha256:170a97cea01727b5…`.

**Mechanical law checks on the frozen text, all zero-cost and all passing:** 4-gram overlap with the
canonical CAUTION label = **0** (for both the contract text and the paraphrase), credence numbers
present = 0, action tokens = 0, arm words = 0, contains the canonical proposition = false, three tokens
each expected exactly once = true, every fixture carries the frozen paraphrase = true, experimental
credences absent from fixtures = true.

## 3. §4 — THE A1 MECHANISM IS AS PREREGISTERED, NOT CHANGED

A1 does **not** remove the canonical credence from the request; it must stay, or the HIGH/LOW causal
manipulation would not exist. What A1 removes is the **measurement-side numeric shortcut**, and
`D2A1_LEXICAL_LAWS` already froze exactly that: the contract carries no credence number, no mapping
hint, no HIGH/LOW, no arm word, no canonical proposition, no action token, and shares no four-word
sequence with the canonical label. This round verified those laws mechanically rather than restating
them.

## 4. §6 — SCOPE REMAINS FROZEN

The paraphrase literal is byte-identical to `D2A1_PARAPHRASE`
(`the view that a finding depending mainly on secondhand report is to be held with reserve`) — recorded
as `paragraph_unchanged` in the manifest. Claim scope unchanged: a positive licenses
`CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE_ON_PREREGISTERED_PARAPHRASE` only, and a null means
semantic uptake was not established **for this preregistered near-semantic-transfer probe** — it may not
be widened to global proposition unreadability.

## 5. WHY ZERO CALLS — §8 APPLIED LITERALLY

§8 permits the nine A1 qualification calls **only** when every prerequisite was already frozen *and* the
transformer implementation is conformance-qualified. The audit found prerequisites missing and the
implementation absent, so no call was authorised. The next round's first steps are the same as A0's:
implement `buildD2SemanticReadoutRequestV0` against the now-frozen contract, run its offline conformance
gate at 0 calls, and only then spend the nine qualification calls.

The amendment also records `amendment_uses_a0_token_pattern: false` — the only A0 fact it uses is the
preregistered one that A1 is unlocked. It does not read, depend on, or derive anything from A0's token
pattern.

## 6. ARTIFACTS

`evidence/run-001/a1-prerequisites-audit/` — `a1-prerequisite-audit.json` (the five findings with their
mechanical evidence), `contract-rev1-1c-manifest.json`, `A1_PREREQUISITES_MANIFEST.json`

Verified after the fact: the three frozen A0 request hashes and the A0 state dataset hash all still
recompute to their frozen values, so nothing in this round disturbed the frozen A0 evidence. D1 is
untouched (`02bd7e31…`). No credential appears anywhere in the research tree (scanned).
`tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.
