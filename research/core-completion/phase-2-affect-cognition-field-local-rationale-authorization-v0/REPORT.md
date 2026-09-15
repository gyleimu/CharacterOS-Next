# AFFECT_COGNITION_FIELD_LOCAL_RATIONALE_AUTHORIZATION_V0 — REPORT

**Principal Verdict: `AFFECT_COGNITION_FACTUAL_ASSESSMENT_FAILED`** (frozen analyzer: 5 cells with
a subject-property factual claim; every other audit passes).
**Qualification: 60/65 → authoritative-runtime gate NOT met. Formal 476-cell matrix: NOT RUN.
Lawful POS/NEG: NOT RUN.**

The slice's architecture is IMPLEMENTED, ACTIVE and PROVEN: one shared production/research rationale
authorization policy, field-local null-dropping inside the V6 canonicalization, hash over the
sanitized authoritative rationale, Language membrane intact, and all production tests green. Under
the new input the R4 self-narration attractor did not recur — raw rationale compliance was
**35/35 lawful, 0 rejected, 0 drops** — but R1 ×5 emitted a subject-property **factual claim**
("the subject has capacity"), an authoritative field that this slice is explicitly forbidden to
sanitize (§9). Per §59 the run stops; the failing component routes to a read-only review.

## Principal Verdict

`AFFECT_COGNITION_FACTUAL_ASSESSMENT_FAILED` — the factual-authority audit is the only failing
audit (`subject_state_fact_cells: 5`). The rationale-authorization endpoint passes
(`rationale_authorization_pass: true`, 0 drops needed).

## Repository Baseline

`main` at `24c660c` (the state-visibility adjudication), clean worktree, `origin/main` identical,
ahead/behind 0/0. Production commit for this slice: `ad388bd`.

## Final HEAD

`ad388bd` at freeze and qualification time; research commit follows.

## Worktree

Clean; `HEAD == origin/main` after push.

## Production Safety Gap Closed?

**YES for the rationale field.** Production previously performed no rationale content validation;
now `validateSubjectiveSelectionV1` (V6) runs `authorizeSubjectiveRationaleV0` and the
AUTHORITATIVE selection carries null whenever the raw rationale is unlawful. Verified by 7
production tests and by the live qualification path.

## Rationale Authorization Policy

`subjective-rationale-authorization-policy-v0`
(`packages/runtime/src/transitions/conversation/subjective-rationale-authorization.ts`): deterministic
`authorizeSubjectiveRationaleV0(rationale) → ABSENT | AUTHORIZED | REJECTED{reason}`; forbidden
families always dominate a lawful frame.

## Policy Version / Digest

Version `subjective-rationale-authorization-policy-v0`; module digest bound in the qualification
freeze under `rationale_authorization_policy.digest`, and the freeze refuses to mint if the policy is
inactive or too strict.

## Shared Production/Research Semantics

One implementation: the research adapter (`lib/classify.mjs`) calls the SAME
`authorizeSubjectiveRationaleV0`/`subjectiveFramePresentV0` from the built `dist`. There are no
separate production and research regexes; production never imports research code.

## Forbidden Families

Byte-frozen: `RAW_SELF_STATE_DESCRIPTION`, `NAMED_PSYCHOLOGICAL_STATE`, `INFERRED_CAPACITY`,
`UNSUPPORTED_EXTERNAL_FACT`, `UNSUPPORTED_HISTORY_CLAIM` — plus `NO_SUBJECTIVE_FRAME` as the
frame-side rejection (a frame-less assertion is never authorized).

## Minimal Subjective Frame

First-person evaluative/attitude constructions (preference, valuation, willingness, evaluative
mental frame, priority/aversion/strategy, "… to me" forms) — structural, not a synonym ontology.

## Raw Proposal

Wire payload with handles; `subjective_selection.subjective_rationale` may be any structurally valid
canonical text.

## Authoritative Proposal

After canonicalization: facts/handles/stance/directive/clarification validated as before, and
`subjective_rationale` = `authorizeSubjectiveRationaleV0(raw).authoritative_rationale` — the raw
text when AUTHORIZED, `null` when ABSENT or REJECTED. Raw rejected text is retained only in
diagnostic traces.

## Field-Local Rejection

Proven in production tests: an R4-shaped proposal keeps stance/facts/directive and gets
`rationale: null` with telemetry `REJECTED/RAW_SELF_STATE_DESCRIPTION`; a frame-plus-forbidden
rationale ("I prefer this while my energy is high.") is rejected; lawful and absent rationales are
untouched.

## Whole-Proposal Fail-Closed Non-Regression

Proven: invalid stance (enum echo), unknown handle, unbound claim source and the legacy `SELECTED`
carrier still fail the whole proposal exactly as before. No sanitization was generalized beyond the
rationale field (§9).

## Hash Ordering

Raw proposal → handle canonicalization → structural validation → rationale authorization →
authoritative proposal → authoritative hash. The hash binds the sanitized rationale only.

## Hash Sanitization Test

`deriveConversationCognitionProposalHashV6` returns the SAME hash for raw-forbidden-with-same-stance
and raw-null — the raw rejected rationale cannot determine authoritative identity.

## Raw Trace Preservation

The raw rationale text remains in the frozen research records (`qualification-raw.jsonl`
`subjective_selection`) and in the production diagnostic telemetry accessor
(`lastRationaleAuthorizationV0()`); raw A and raw-null remain distinguishable.

## Language Handoff

`buildLanguageRealizationInputV7` carries `selected_subjective_selection` = the AUTHORITATIVE
selection; a dropped rationale therefore arrives as `rationale: null` with the stance intact.
(Language V7 input contract verified unchanged; carried forward byte-identical.)

## Language Sees Raw Rejected Rationale?

`NO`. ## Language Can Repair Rationale? `NO` — the frozen Language rule (null rationale → never
invent a reason) is untouched; 0 `SEMANTICALLY_COMPLETED_BY_LANGUAGE`, 0 `UNSUPPORTED_REASON_ADDED`
this round.

## Protocol Version Changed? / Schema Changed? / Prompt Changed? / Scenario Changed? / Affect Changed? / Regulation Changed? / New Canonical State?

All `NO` — wire schema already allowed `rationale: null`; prompts and scenarios byte-verified
unchanged against the previous freeze; Regulation/Affect semantics untouched; the policy and its
telemetry are non-canonical.

## Implementation Commit

`ad388bd` `fix: authorize subjective rationale field locally` (policy module, V6 wiring, telemetry
accessor, exports, 7 production tests).

## Qualification Freeze Hash

`sha256:e52d637ff65757d76b4047f73f9d4f9a663dda95e0fd852cc63f17fcfe839d79` — minted at HEAD `ad388bd`
binding the policy identity/digest, frozen subject id, 68 request-identity hashes, provider
instance, matched-quartet attestation, instrument digests and all thresholds.

## Frozen Subject ID

`affect-phase2-frozen-subject-v1` (unchanged; enforced at freeze time).

## Provider Instance

Ollama 0.34.0, `qwen3.5:9b`, digest `6488c96f…ea7`, single instance; start/end attestation stable
(no `RUN_INVALID_PROVIDER_INSTANCE_CHANGED`).

## Qualification Calls

65 cognition calls, 65 language calls; 0 retries/replacements/reruns; every row matched its frozen
rendered-request hash (`INPUT_IDENTITY_MISMATCH` never fired).

## N1 – N6 / M1 – M3 / R1 – R4

N1–N6 5/5 each (30/30 `NO_SUBJECTIVE_SELECTION`); M1/M2/M3 5/5 each (`AUTHORIZED` rationales);
R2/R3/R4 5/5 each; **R1 0/5** — the only failing family (see Aggregate).

## Authoritative Runtime Aggregate

60/65 authoritative cells valid. All 65 cells' authoritative rationales lawful
(`authoritative_rationale_unlawful_cells: 0`); every authoritative proposal was constructed and
delivered; handles 65/65; Language 65/65 `PRESERVED`.

## Raw Rationale Compliance Aggregate

`35/35 lawful, 0 rejected, 30 absent` — raw-model rationale compliance was PERFECT this round; the
R4 attractor did not recur under this input. This is reported, not claimed as a model property.

## Raw Rationale Drops

`0` (no drop was required). Drop codes: `{}`. Drop by scenario: all zero.

## Stance Preserved Across Drops? / Factual Integrity Across Drops? / Language Safety Across Drops?

Not exercised (0 drops). The production unit tests cover the drop path deterministically
(stance/facts preserved, Language receives null).

## Null Aggregate / Choice Aggregate / Handle Aggregate

30/30 null; 35/35 `SUBJECTIVE_SELECTION` on-question; 65/65 `HANDLE_BOUND`.

## Transport Health

max 601/2048 (29.3 %); 0 cells >80/90 %; 0 truncations; no `done_reason=length` → PASS.

## Example Copy Audit

0/35 exact copies.

## Input Identity

PASS — 65/65 rows hash-matched the freeze. **Cross-slice note:** this round's inputs differ from the
previous slice's in `experience_ref`/`event_ref`/`projection_hash` because the production change
alters the snapshot-growth path's delivered behaviors (the stub's selection is a frame-less
"response plan" whose rationale is now REJECTED → authoritative null → different delivered behavior
→ different experience identity). Within this round everything is frozen, verified and internally
consistent; the difference is an expected consequence of the authorized semantic change, disclosed
here rather than hidden.

## Provider Instance Stable?

`YES`.

## Qualification Passed?

`NO` — 60/65. The failing component is the factual-claim boundary, not the rationale authorization.

## Formal Matrix Run?

`NO` (§59).

## Formal Freeze Hash

`sha256:cd628b89ae7a9db5ee70c03ce380d8714740a1a267ea3b4e234462b82b368539` — minted at `ad388bd`
binding the same policy/instruments/prompt/rotation; awaits a qualifying slice.

## Formal Calls

0. All formal sections (authoritative validity, raw compliance, drop rates P/N/Z/A, condition
asymmetry, null/mixed aggregates, P/N separation, TVD/JS, historical S1–S4, lawful POS/NEG):
NOT RUN.

## Factual Audit

`pass: false` — 185 claims, `subject_state_fact_cells: 5`. R1 ×5's claim:
"Because the task is optional and the **subject has capacity**, the facts permit either volunteering
or declining without violating constraints." — the frozen subject-property boundary (prompt rules
5d/10; `INFERRED_CAPACITY`) correctly fires. Claims are AUTHORITATIVE; production validates their
structure only, so this text would be stored, hashed and delivered. This is a genuine model
violation of the frozen claim boundary and a genuine runtime gap, but **outside this slice's
explicitly authorized scope** (§9: do not generalize field-local sanitization beyond rationale).

## Rationale Authorization Audit

`pass: true` — one policy, active, zero unlawful authoritative rationales, zero needed drops.

## Raw Model Compliance Audit

35/35 lawful this round; historical R4 failures remain recorded as raw-compliance evidence and are
not reinterpreted.

## Stance / Handle / Language Fidelity / Clarification Audits

All `pass: true` (0 off-question, 65/65 bound, 65/65 `PRESERVED`, 0 false CLARIFY).

## Request Isolation / Condition Leakage

Attestation-verified (affect-section-only quartet differences) and 0 leakage violations.

## Affect Causal Differentiation Established? / Raw Model Perfect Non-Narration? / CharacterOS Runtime Prevented Forbidden Narration?

Differentiation: `NO` (formal not run). Raw perfect non-narration: `NO` as a general model property —
this round happened to be 35/35 raw-lawful, and the historical R4 failures remain evidence that the
model does not guarantee it. Runtime prevention: **`YES` for the rationale field** (implemented,
tested, active); **not yet for factual claims** (the current gap).

## Affect Phase 2 Closed? / Can Relationship Phase 3 Begin?

`NO` / `NO`.

## Allowed Affect Claim

Only this: CharacterOS now authorizes the subjective rationale field locally — the model proposes,
the host nulls any forbidden or frame-less rationale before hashing and before Language, and the
runtime boundary is proven by production tests and a live 65-cell run with zero unlawful
authoritative rationales. No Affect causal claim.

## Forbidden Claims

That the qualification passed; that raw-model non-narration is achieved (R4 history stands); that
field-local sanitization excuses the R1 subject-property claim (claims are authoritative and
out of this slice's scope); that the policy caused any stance change (it cannot — stance is
validated independently, and the hash test proves identity under sanitization).

## Tests

Production: 7/7 authorization tests (R4 drop, lawful/absent preservation, frame+forbidden rejection,
whole-proposal regressions, hash sanitization, prompt-frozen check). Research zero-model: instrument
probes 0 failures, probes 0 strict divergences, sentinel 8/8, deterministic 9/9 — all green before
any model call.

## Full Suite

`pnpm test`: **2473 passed / 0 failed** (3 skipped).

## Typecheck / Auxiliary Typecheck / Build / Lint / Governance / Diff Check

All clean; governance `PASS`.

## Commits

- `ad388bd` `fix: authorize subjective rationale field locally` (production)
- research commit for this slice's evidence + report (see Push)

## Push / HEAD / origin/main / Ahead-Behind / Worktree

Normal push to `origin/main`; no amend, no force push; HEAD == origin/main after push; ahead/behind
0/0; worktree clean.

## Recommended Next Slice

**`AFFECT_COGNITION_FACTUAL_SUBJECT_PROPERTY_AUTHORIZATION_ARCHITECTURE_REVIEW`** — read-only, zero
model calls, matching the failed frozen component exactly. The review must adjudicate: (1) claims are
AUTHORITATIVE, so the rationale's field-local precedent does not transfer unchanged — the choice is
whole-proposal rejection (consistent with §9's reserved severity for authoritative fields), a
narrowly scoped claim-level authorization, or accepting the violation as raw-model compliance
evidence with its own endpoint; (2) whether production's absent claim-content enforcement is the same
product-safety gap SV-B closed for rationale; (3) what the qualification gate should require for
claim-side subject-property content, given R1 ×5's deterministic reproduction and the fact that the
input changed this round only because the runtime semantics changed. No prompt edit, no scenario
change, no generalization of sanitization inside this slice. STOP. Do not execute the recommended
next slice.
