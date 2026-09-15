# AFFECT_COGNITION_FACTUAL_CLAIM_AUTHORIZATION_AND_FAIL_CLOSED_REQUALIFICATION_V0 — REPORT

**Principal Verdict: `CURRENT_MODEL_FAILS_STRICT_FACTUAL_AUTHORITY_CONTRACT`**
(co-present: `AFFECT_COGNITION_C4_4_LANGUAGE_FIDELITY_FAILED`)
**Qualification: 58/65 overall; `AUTHORITATIVE_RUNTIME_FACTUAL_VALID` 60/65. Formal 476-cell matrix:
NOT RUN. Lawful POS/NEG: NOT RUN.**

The V7/V8 production wiring is complete, gates are green, and the closed factual authority behaves
exactly as frozen — including the fail-closed path, which is now proven on live cells (5/5 M1 cells:
no authoritative hash, no Language call, no stance authority). The qualification fails on two
model-compliance families under the strict contract: **M1 ×5** misquoted source text
(`REJECTED_SOURCE_BINDING`) and **N6** omitted the required classification derivation, after which
Language over-produced (5/5 completion-flagged, 2/5 fact-contradicted). Per the frozen STOP
conditions, no prompt, scenario, threshold or factual-authority change is proposed; the formal matrix
does not run.

## Repository Baseline

`main` at `24c660c` (state-visibility adjudication), predecessor research commit `b7dba73`
(field-local rationale authorization). Production commit for this slice: **`627b943`**
`fix: close factual claim authority to host-verifiable derivations`.

## Final HEAD

`627b943` at freeze and qualification time; research commit follows.

## Worktree

Clean except this research directory at freeze time; `HEAD == origin/main` after push.

## Production Safety Gap Closed?

**YES.** A model-authored factual claim is no longer authority merely because it parses. The host
accepts exactly two forms — exact `SOURCE_QUOTE` and the three host-recomputable derivations — and
any unauthorized claim invalidates the entire proposal.

## Closed Factual Authority (V7)

`factual-claim-authorization-policy-v0`
(`packages/runtime/src/transitions/conversation/factual-claim-authorization.ts`): closed-key claims
(`SOURCE_QUOTE`: kind/text/source_handles; `HOST_VERIFIABLE_DERIVATION`: kind/operation/
source_handles/derivation), exact-substring binding against every cited source, host recomputation
of every result, and host-rendered authoritative `text` — model prose never occupies it.

## Closed Derivation Registry

`INTEGER_ARITHMETIC` (expression re-parsed; operands must match; left±right),
`STRING_REVERSE` (one admitted instruction form; Unicode code-point reversal),
`RULE_CLASSIFICATION` (the explicit first/last-character rule form; the rule's class token).
`PARAPHRASE`, `SEMANTIC_INFERENCE` and capacity-from-free-time inference are excluded;
`prepare.mjs` refuses to freeze if production and research registries diverge.

## Fail-Closed Proven On Live Cells

M1 ×5: raw claim `"Alice says: \"The code review deadline is Thursday.\""` → authorization trace
`REJECTED / REJECTED_SOURCE_BINDING` → **language_calls 0/5**, **authoritative proposal/hash minted
0/5**, **stance endpoints suppressed 5/5** (`NOT_SCORED`). The rejection is verified correct: the
source text is `The user says: "Alice says: \"The code review deadline is Thursday. State the
deadline exactly as given, …\""` — the model's fabricated closing quote after "Thursday." makes its
string a non-substring. Implementation defect: ruled out.

## Protocol / Schema / History

- Live: `conversation-cognition-proposal-v7` + `cognition-invocation-binding-v3` +
  `language-realization-input-v8`; **no V7→V6 fallback**.
- History: V1–V6 validators and hash domains untouched — the V7 additions in
  `conversation-cognition-proposal.ts` are pure additions (zero removed lines verified); Language V1–V7
  inputs still dispatch; historical V6 fixtures stayed V6; only live-producer fixtures were
  mechanically upgraded (18 sandbox fixtures + 1 prompt assertion + 12 runtime fixtures + the
  familiarity observe.ts narrowing).
- Live prompt = V6 contract text with the frozen mechanical substitutions only, recomputed and
  digest-checked at freeze (`PROMPT_SEMANTIC_CONTRACT_CHANGED` guard).
- Rationale authorization (field-local, frozen in the predecessor slice) unchanged and not
  generalized to claims. Affect / Regulation / Belief / Relationship untouched. No new canonical
  state.

## Gates at `627b943`

`pnpm governance` PASS · `pnpm typecheck` clean · `pnpm build` clean · `pnpm typecheck:auxiliary`
clean · `pnpm lint --max-warnings 0` clean · `pnpm test` **2486 passed / 3 skipped / 0 failed**
(202 files) · `git diff --check` clean. Research zero-model: sentinel 8/8, deterministic 7/7
(including the R1 free-form-inference sentinel that proves whole-proposal rejection suppresses
Language/stance/hash).

## Qualification Freeze Hash

`sha256:d18afa2e0dd6bb1a818f0bef531e2c0b28ff9fb7fdff968ee30c6c0e0fec0217` — minted at HEAD
`627b943` binding the V7/V8 protocols, both policy digests, the registry, schemas, frozen subject id
`affect-phase2-frozen-subject-v1`, request identities, provider instance and thresholds.
Formal freeze (unused): `sha256:9e47b906cbb3b69f80c39a16a9b84d2f75fad001d63fd0c2eeefdff076c9930f`.

## Qualification Calls

65 cognition calls; 60 language calls (M1 ×5 suppressed). 0 retries/replacements/reruns. Transport:
max eval 476/2048, 0 truncations. Handles 65/65 `HANDLE_BOUND`. Rationale: 30 absent, 25
`PURE_PREFERENCE`, 5 `WILLINGNESS`, 0 forbidden; runtime authoritative rationale safe 60/60 reached.

## Per-Scenario

| scenario | result | note |
| --- | --- | --- |
| N1, N2 | 5/5 | `INTEGER_ARITHMETIC` derivations authorized (host recomputed) |
| N3, N4 | 5/5 | `SOURCE_QUOTE` exact |
| N5Q | 5/5 | `STRING_REVERSE` authorized |
| N6 | **3/5** | missing `RULE_CLASSIFICATION`; 2/5 Language-contradicted |
| M1 | **0/5** | `REJECTED_SOURCE_BINDING` → whole-proposal fail-closed |
| M2, M3 | 5/5 | quote + selection lawful |
| R1–R4 | 5/5 | selections lawful; rationale authorized |

## Failure Family A — M1 ×5 Misquote

The model decorated its quote with an attribution frame and a fabricated closing quotation mark
(`Alice says: "…Thursday."`) that does not occur in the source. The host rejects it exactly as the
frozen contract requires. This is genuine model non-compliance with the exact-quote rule, not an
instrument defect; the failure is deterministic (5/5 byte-identical cognition responses).

## Failure Family B — N6 Missing Derivation + Language Over-Production

All five N6 cells emitted only two `SOURCE_QUOTE` claims (rule + query) and **no result claim**; no
`RULE_CLASSIFICATION` was attempted although the model used the other two derivations correctly
elsewhere. With no authorized result, Language improvised: 5/5 cells are flagged
`SEMANTICALLY_COMPLETED_BY_LANGUAGE` (added tokens such as "character", "definition", "wait",
"read"), and 2/5 delivered a fact contradiction — including chain-of-thought wording ("Wait, let me
re-read the rule…") followed by "is not a MATCH". The completion audit correctly caught all five;
the aggregate language endpoint fails (`LANGUAGE_FIDELITY_FAILED`).

## Replicate Variance — Stage-Localized Cause

Cognition is byte-deterministic: all five replicates of every scenario have identical rendered
requests and identical responses. The Language requests, however, differ per cell in exactly one
field — `response_request_id` (`fca-<opaque-session>-t2`) — so greedy decoding can flip the Language
wording between replicates. That is why N6 splits 3/5 vs 2/5 while M1 is uniform 5/5. This is a
host-generated request-identity effect, not provider nondeterminism, and it is recorded for the
architecture record.

## Dual Endpoints

- `AUTHORITATIVE_RUNTIME_FACTUAL_VALID`: **60/65** (M1 ×5 invalid).
- `raw_model_factual_compliant`: **60/65** (identical — no case of raw-noncompliant-but-runtime-valid
  arose, because factual non-compliance rejects the whole turn by design).
- Language suppression on invalid facts: 5/5. Stance suppression: 5/5.

## Constraint Compliance

1. Registry minimal: three operations only, each justified by a real qualification workload
   (N1/N2, N5Q, N6). 2. No operation added; the fourth-operation STOP condition did not arise.
3. Historical V1–V6 read/verify semantics unchanged; no historical proposal reinterpreted.
4. Live path is V7/V8; factual authorization failures fail closed before proposal/hash/Language; no
   fallback. 5. Only live-producer fixtures were upgraded; historical fixtures untouched.
6. Rationale field-local authorization frozen, not generalized. 7. Invalid authoritative factual
   claim ⇒ entire proposal invalid, stance not authority, Language not called, no hash — proven
   5/5 on live cells. 8. See STOP below.

## STOP — No Weakening Proposed

Both failure families are model-compliance failures under the frozen closed contract; the analyzer's
pre-registered verdict names exactly this outcome. Passing them would require prompt, scenario or
factual-authority changes, which the frozen constraints forbid and which this executor does not
propose. The formal matrix does not run. An architecture decision is required on how CharacterOS
should treat a model that satisfies the closed factual surface on four of six task families but
fails exact quotation (M1) and omits the classification derivation (N6) deterministically.

## Commits / Push / State

`627b943` (production, includes the fixture upgrades and the observe.ts narrowing fix) + research
commit for this evidence; normal push, no amend, no force; `HEAD == origin/main`; ahead/behind 0/0;
worktree clean.
