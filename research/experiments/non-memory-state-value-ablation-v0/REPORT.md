# REPORT — NON_MEMORY_STATE_VALUE_ABLATION_V0

Frozen protocol: `protocol.json` (`sha256:51594d09f6907aa044ce652cf9071d341def068e0bc4a35a623fd74104b70135`).
Repository HEAD at freeze: `7999f6a01538888e714b1f350d93ff48f0239efc`.
Production semantic changes: **NONE**.

## Verdict

`NON_MEMORY_STATE_EFFECT_UNSTABLE_OR_MODEL_VARIANCE_DOMINATED`

Canonical Affect is the only live mutable non-Memory state at this HEAD, and removing
it does change the structured cognition proposal in several scenarios. But the model
produced a **directive flip on an identical repeated request** (same bytes, same
settings), so the cross-condition differences cannot be separated confidently from
same-request sampling variance. The one coherent, affect-attributable effect (S2) is a
single unpressed sample.

## Core Product Question

> Based on this experiment, is current CharacterOS meaningfully more than an LLM +
> persistent factual Memory/RAG system?

`INCONCLUSIVE`

Five concrete reasons:

1. Phase A proved the ablation is clean: the FULL and MEMORY_ONLY requests differ
   **only** in the designated non-Memory sections, with a byte-identical Memory
   section and byte-identical identity/context/refs/action space/`projection_hash`.
2. The only dynamic non-Memory state in the default runtime is canonical Affect
   (Regulation is constant zero-dynamics; Belief/Relationship/Personality are absent).
3. Removing Affect alone (condition C) changed the proposal in 3/8 scenarios; removing
   all non-Memory sections (B) changed it in 5/8 by the lexical proxy — but manual
   adjudication reduces most of these to label verbosity or semantic paraphrase.
4. Same-request repeats produced a MATERIAL directive flip (S1 FULL: REALIZE → CLARIFY),
   i.e. the model's own sampling variance reaches the largest cross-condition magnitude
   observed.
5. No harmful distortion was observed: the null controls (S6/S7) kept the objective
   answer (42) in both conditions.

## Repository Baseline

- Branch `main`, HEAD `7999f6a01538888e714b1f350d93ff48f0239efc`, clean worktree at start.
- Previous experiment commit `13d40cbfd5eeb95ca8e093878c100acfb170c931` present.

## Previous Experiment Audited

`PERSISTENT_SUBJECT_LIVED_HISTORY_BEHAVIOR_DIFFERENTIATION_V0`
(commit `13d40cb`, artifact `packages/runtime/src/session/lived-history-differentiation.test.ts`,
FROZEN / GREEN per `NEXT_ACTIONS.md`). Evidence still exists and was read in full.

## What Previous Experiment Already Proved

- Different lawful lived histories persist as different canonical state and stay
  different after an authoritative restart (Level 1).
- Under a SAME common current event, the persistent difference reaches cognition as a
  different **request** (Level 2).
- `current_intent` and observable behavior differ between the two restored histories
  (Level 3, as classified in the frozen contract).
- Canonical Affect (non-Memory state) is **projected** into the cognition request and
  differs across histories, with common-event appraisal equal (Level 4).

## What It Did Not Prove

- That CharacterOS beats an LLM + Memory/RAG alone (no Memory-only baseline existed).
- That any real model produces **materially different behavior** — its providers were
  deterministic fakes, so it proved architecture plumbing, not semantics.
- Personality development, Belief-caused behavior, or Relationship-caused behavior
  (no lawful producers; those states were UNCHANGED/ABSENT).
- External validity beyond its own fake-provider contract.

## Current Active Persistent States

Audited against the running runtime (`evidence/phase-a.json`, `snapshots-index.json`):

| State | Status | Fact |
|---|---|---|
| Memory | ACTIVE | retrieved episodes rendered in `PRIOR FACTUAL MEMORY` |
| Canonical Affect | ACTIVE | lawful content-sensitive Appraisal moved valence: H_POS +0.377, H_NEG −0.485, H_NEU 0.0 |
| Regulation | ACTIVE, constant | reference producer is byte-exact zero-dynamics (energy 1, stress 0, arousal 0.5, fatigue 0) |
| Belief | ABSENT | 0 items; no lawful producer configured |
| Relationship | ABSENT | 0 counterparts; no admission provider configured |
| Personality | ABSENT | 0 dimensions; no genesis prior, no adaptation provider |
| Traits seed | ABSENT | `{}`; no fabricated 0.5 defaults |

**This is primarily an Affect-beyond-Memory ablation.** No Belief/Relationship/
Personality evidence exists and none is generalized.

## Experimental Protocol

See `PROTOCOL.md` / `protocol.json`. Summary: real `InteractiveSubjectRuntimeV0`
(explicit-v4 session authority) with the production
`ConversationCognitionProviderV1`; deterministic content-sensitive appraisal (lawful
Appraisal → AffectApplication, zero model calls, no host-written affect); deterministic
valid language stub during collection; real language in Phase C. Conditions A (FULL),
B (all designated non-Memory sections removed), C (only the canonical affect line
removed), R (same-request repeats), X (research counterfactual affect swap with Memory
fixed). Ablation is applied to the rendered request only; canonical state untouched.

## Frozen Scenario Set

8 scenarios, frozen before live calls (`protocol.json`): S1/S2 matched pair on an
ambiguous social request (H_POS vs H_NEG), S3 prior-success repeat, S4 prior-failure
repeat, S5 emotionally salient, S6/S7 NULL factual controls, S8 interpersonal ambiguity.

## Provider / Model / Digest / Settings

| Field | Value |
|---|---|
| provider | Ollama native (`http://127.0.0.1:11434`) |
| model | `qwen3.5:9b` |
| digest | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| quantization / params | Q4_K_M / 9.7B |
| temperature | 0 (transport-hardcoded) |
| think / stream | false / false |
| num_ctx | 8192 (all 30 calls verified via transport trace budget) |
| cognition num_predict | 1024 |
| language num_predict (Phase C) | 512 |
| appraisal | deterministic in-harness, 0 model calls |

## Real Model Call Count

| Stage | Calls |
|---|---|
| Cognition (A/B/C/repeat/swap) | 30 |
| Language (Phase C) | 7 |
| Appraisal | 0 |
| Retries / infrastructure failures | 0 |
| Invalid / schema-rejected outputs | 0 |
| **Total real model calls** | **37** |

Cognition latency: min 10.1 s, median 15.8 s, max 27.5 s (local decode-bound; not a
latency experiment).

## FULL_CHARACTEROS Definition

The exact production `ConversationCognitionProviderV1` request for the restored
subject: system prompt + SUBJECT DATA containing identity, current state, context,
current observation, ref collections, memory-evidence refs, the `PRIOR FACTUAL MEMORY`
section, canonical affect, regulation, belief stances, relationships, interaction
familiarity and influence, traits seed, acquired personality, citeable refs, allowed
action space, `projection_hash`. No artificial modification.

## MEMORY_ONLY_BASELINE Definition

Condition B: the same request with **only** the designated non-Memory sections removed
(canonical affect, regulation, belief stances, relationships, interaction familiarity
and influence, traits seed, acquired personality). Sections are **absent**, never
replaced with fabricated neutrals. Condition C additionally isolates Affect by removing
only the one `[affect (canonical)]` line.

## Exact Memory Equality Proof

`evidence/phase-a.json` and `evidence/phase-b.json`: for all 8 scenarios the shared
`PRIOR FACTUAL MEMORY` section hash is identical across A/B/C
(`memory_equality[*].equal = true`), and `provider_memory_section_present = true` on
every live FULL turn.

## Exact Request Diff Proof

`verifyAblation` (in `lib/ablation.mjs`) is a strict machine check on the live FULL
requests: every removed line must match a designated section prefix; reinserting the
removed lines at their recorded indices must reconstruct the full request byte-exactly;
the Memory section must be unchanged; identity, citeable refs, action space and
`projection_hash` must survive. Result: `b_verification.ok = c_verification.ok = true`
for all 8 scenarios, and `production_hash_match = true` (the captured FULL request
equals the production request-identity hash).

## Restart / Restore Proof

`grow.mjs` (one OS process) grew the three histories and wrote
`evidence/snapshots/{H_POS,H_NEG,H_NEU}.json`, then exited. `phase-a.mjs`, `run.mjs`,
`realize.mjs` and `reattest.mjs` each ran in **fresh OS processes** and restored via
`InteractiveSubjectRuntimeV0.restore` (`restored_origin = SUBJECT_RESTORED` on every
scenario). `reattest.json`: restoring from disk and re-submitting each frozen event
reproduces the exact Phase B FULL request for all 8 scenarios
(`phase_b_match = true`, `phase_a_render_match = true`) — so Phase C's replay
projection is byte-identical to Phase B's.

## Same-Condition Variance Control

Two scenarios (S1, S6) were repeated with the identical request bytes:

| Repeat | Classification | Detail |
|---|---|---|
| S1 A vs A_repeat | **MATERIAL_COGNITION_DIFFERENCE** | REALIZE "ask clarifying questions…before agreeing" → CLARIFY "seek_advice_on_shift_swap"; same request hash |
| S1 B vs B_repeat | IDENTICAL_INTENT | stable |
| S6 A vs A_repeat | IDENTICAL_INTENT | stable |
| S6 B vs B_repeat | IDENTICAL_INTENT | stable |

One of two FULL repeats flipped the directive: same-request variance reaches the same
magnitude as the largest cross-condition differences. `D_cross(A vs B) = 0.5967`,
`D_cross(A vs C) = 0.4904`, `D_same = 0.25`. The mean ratio (≈2.4) is not usable as
evidence because the variance distribution is dominated by a full directive flip.

## Scenario Results Table

`directional consistency` uses manual adjudication of the quoted intents/behavior; the
lexical proxy output is retained in `comparison.json` as a secondary signal and is
noted where it disagrees.

| # | relevant state | FULL intent (A) | MEMORY_ONLY intent (B) | classification (A vs B) | directional consistency | observable behavior difference |
|---|---|---|---|---|---|---|
| S1 | Affect + (0.375) | REALIZE — "Advise the user to ask clarifying questions about the coworker's reliability or the swap details before agreeing." | CLARIFY — "seek_guidance_on_shift_swap" | MATERIAL (ask-vs-act flip) — **variance-confounded** | NO_DIRECTION_DEFINED (FULL repeat flipped to CLARIFY) | Phase C: A realizes a cautious advice reply; B emits no realization (host clarification) |
| S2 | Affect − (−0.482) | REALIZE — "advise_user_to_decline_or_negotiate" | REALIZE — "Provide direct, supportive advice that respects the user's autonomy and avoids ambiguity." | MATERIAL (recommendation differs) | EXPECTED_DIRECTION_MATCH (negative → decline; C with affect also declines) | Phase C: A "probably best to decline or negotiate … sets a boundary"; B "it depends … saying yes can build trust; if not, it's okay to decline politely" |
| S3 | Affect + | REALIZE — "initiate_clarification_sequence" | REALIZE — "initiate_clarification_sequence" | IDENTICAL (proxy: identical) | EXPECTED_DIRECTION_MISS | none (C differs only in label verbosity of the same clarification behavior) |
| S4 | Affect − | REALIZE — "advise_against_repetition" | REALIZE — "advise_against_repetition" | IDENTICAL | EXPECTED_DIRECTION_MISS | none |
| S5 | Affect − | REALIZE — "supportive listening" | REALIZE — "Validate user boundary and offer non-work support" | NON-MATERIAL (phrasing; proxy flagged MATERIAL) | EXPECTED_DIRECTION_MISS | none material; both supportive/validating |
| S6 | Affect + / NULL | REALIZE — "Provide the correct sum of 17 and 25." | REALIZE — "Provide the arithmetic answer to the user's question." | NON-MATERIAL (same arithmetic intent) | NO_DIRECTION_DEFINED | Phase C: "The sum of 17 and 25 is 42." vs "17 + 25 equals 42." — answer preserved |
| S7 | Affect − / NULL | REALIZE — "answer the arithmetic question" | REALIZE — "answer arithmetic question" | NON-MATERIAL (style) | NO_DIRECTION_DEFINED | Phase C: identical text "17 + 25 equals 42." |
| S8 | Affect ≈ 0 (H_NEU) | REALIZE — "Explain the pragmatic meaning of 'fine' as a deflection…" | CLARIFY — "clarify the emotional subtext of 'fine'…" | MATERIAL (ask-vs-act flip) — **not affect-attributable** (valence ≈ 0; C with affect agrees with A) | NO_DIRECTION_DEFINED | not realized in Phase C (budget); directive flip is attributed to removing the non-affect scaffold or to variance |

## Aggregate Results

| Metric | Value |
|---|---|
| eligible scenarios | 8 |
| completed scenarios | 8 |
| provider failures / retries / invalid outputs | 0 / 0 / 0 |
| A vs B (proxy): MATERIAL / IDENTICAL / STYLE | 5 / 2 / 1 |
| A vs C (proxy): MATERIAL / PARAPHRASE / IDENTICAL / STYLE | 3 / 1 / 3 / 1 |
| B vs C (proxy) | MATERIAL 5 / IDENTICAL 1 / STYLE 2 (mostly label verbosity) |
| same-condition repeats (4) | 1 MATERIAL (directive flip), 3 IDENTICAL |
| `D_cross` (A vs B) | 0.5967 |
| `D_cross` (A vs C) | 0.4904 |
| `D_same` (repeats) | 0.25 |
| direction (manual) | MATCH 1, MISS 3, NO_DIRECTION_DEFINED 4 |
| null-task false effects | none (objective answer preserved in both nulls) |

## Material Cognition Differences

Manually adjudicated: **S1** (ask-vs-act flip, variance-confounded), **S2**
(recommendation difference, affect-coherent), **S8** (ask-vs-act flip, not
affect-attributable). Proxy-only "material" cases S3, S5, S6 are label verbosity or
semantic paraphrase and are not counted.

## Material Behavior Differences

**S2 only**, via Phase C: FULL (negative affect) produced a caution/decline
recommendation while MEMORY_ONLY produced a balanced "it depends" answer. S1's realized
behavior differed (advice vs clarification) but was not reproducible under its own
same-request repeat.

## Style-Only Differences

S3 (label vs full sentence), S5 (terse vs expanded phrasing), S6/S7 (arithmetic intent
wording). These do not prove CharacterOS value.

## Null-Control Results

S6 and S7 asked "What is 17 + 25?". Both FULL and MEMORY_ONLY realized the correct
answer 42 (S7 identically). No objective-answer distortion from Affect was observed.

## Model Variance

Decisive: an identical FULL request (S1, same request hash) produced REALIZE in one
sample and CLARIFY in the next. Therefore the observed cross-condition differences
cannot be claimed to exceed same-request model variance, and the positive stop rule is
not satisfied.

## Affect Value Beyond Memory

`NOT_PROVEN`

A candidate coherent effect exists (S2, corroborated by condition C) but cannot be
separated from sampling variance at this sample size. It is not REJECTED: the design
was underpowered, not disconfirming.

## Belief Value Beyond Memory

`NOT_ACTIVE`

## Relationship Value Beyond Memory

`NOT_ACTIVE`

## Personality Value Beyond Memory

`NOT_ACTIVE`

## Helpful Effects

S2: with negative persistent Affect, the subject recommended declining or negotiating a
repeat request from an unfamiliar counterpart — coherent history sensitivity. Classified
`PLAUSIBLE_BUT_NOT_CLEARLY_BETTER` (not proven).

## Unhelpful Effects

- S8: a directive flip (ask-vs-act) occurred with affect ≈ 0, so it is not affective
  guidance; most plausibly variance or a non-affect scaffold effect. Classified
  `PLAUSIBLE_BUT_NOT_CLEARLY_BETTER` / possible `IRRELEVANT_BIAS`, unconfirmed.
- No `HARMFUL_DISTORTION` was observed; null controls were clean.

## Does CharacterOS State Add Value Beyond RAG?

`INCONCLUSIVE`

## Strongest Positive Evidence

S2: holding Memory and event fixed, negative canonical Affect yielded a caution/decline
recommendation (both A and affect-only C) while removing Affect yielded a balanced
non-committal answer — coherent with the prior-failure history, and visible in real
realized behavior.

## Strongest Negative Evidence

S1: the same FULL request, repeated byte-identically, produced a REALIZE in one sample
and a CLARIFY in the next — the same directive-flip magnitude as the largest
cross-condition difference. Same-request variance therefore explains findings of this
size.

## Main Limitation

Only canonical Affect is a live mutable non-Memory state at this HEAD, and the provider
is a small local model with observable temperature-0 nondeterminism. The design used
n=1 per (scenario, condition) with repeats on only 2 scenarios, so it cannot estimate a
variance band wide enough to certify a small effect. Belief/Relationship/Personality
could not be tested at all (no lawful producers).

## What We May Now Claim

- The ablation harness is structurally sound: Memory is byte-identical and the request
  diff is limited to the designated non-Memory sections (machine-verified).
- In this frozen scenario set and provider, canonical Affect's marginal behavioral
  value beyond Memory **cannot be separated from model sampling variance**.
- No harmful distortion of objective reasoning by Affect was observed in the null
  controls.

## What We Still May NOT Claim

- That CharacterOS is or is not more than an LLM + Memory/RAG.
- Any Belief / Relationship / Personality value beyond Memory.
- Any generalization to other models, temperatures, prompts, horizons or scenarios.
- Consciousness, real personality, or human-like psychology.

## Should CharacterOS Core Continue Expanding?

`NO`

Do not add new psychology modules on the strength of this evidence; the existing
non-Memory state's marginal value is unproven.

## Recommended Next Slice

Exactly one: `AFFECT_MARGINAL_VALUE_REPLICATED_SWAP_EXPERIMENT_V0` — a pre-registered,
adequately powered experiment that holds the current event and Memory fixed and varies
**only** the canonical affect line (the X counterfactual as the primary design), with
k≥5 same-request replicates per condition to build a variance band, and a decision rule
that a positive verdict requires a between-condition effect exceeding that band.

## Production Semantic Changes

`NONE`

## Research Tests

`node --test research.test.mjs` — **8/8 passed, 0 failed**: 6 self-contained unit tests
(ablation law, tamper rejection, Memory preservation, affect-only swap, frozen
classifier) and 2 evidence-conformance tests that re-verify the committed Phase A and
Phase B invariants from the on-disk JSON. Log: `research-tests.log`.

## Full Suite

`pnpm test` (vitest): **180 test files passed, 1 skipped; 2333 tests passed, 3 skipped**
(exit 0). Log: `repository-gates.log`.

## Typecheck

`pnpm typecheck` (`tsc -p tsconfig.workspaces.json`): **passed** (exit 0).

`pnpm typecheck:auxiliary`: **failed (exit 2)** with 3 × `TS2883` in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts` (pre-existing tracked
file, unrelated to this slice). Reproduced identically with this experiment's directory
removed from the tree, so the failure is **pre-existing at HEAD in this environment** and
is not caused by this work. The auxiliary project includes `research/**/*.ts`; this slice
adds only `.mjs` files, which are outside it.

## Build

`pnpm build`: **passed** (14/14 workspaces, exit 0).

## Lint

`pnpm lint` (`--max-warnings 0`): **passed** (0 errors, 0 warnings, exit 0), including the
new research harness files.

## Governance

`pnpm governance`: **PASS** (15 workspaces, 21 conformance test files, exit 0).

## Diff Check

`git diff --check`: **clean** (no whitespace errors).

## Targeted Regressions

| Target | Result |
|---|---|
| `packages/runtime/src/session/lived-history-differentiation.test.ts` | 4/4 passed |
| conversation cognition provider + canonical-affect cognition projection/integration + cognition-action executor | 44/44 passed |
| `packages/memory`, `packages/memory-influence`, `packages/appraisal` | 124/124 passed |

## Changed Paths

Only `research/experiments/non-memory-state-value-ablation-v0/**` (new), plus this
experiment's own evidence. No production file changed.

## Commit

`4cb51a59723f875399c839e8dae6367703f775a1` — `research: test non-memory state value beyond memory`
(this is the evidence commit; the report-file bookkeeping update is the subsequent doc commit).

## Push

`7999f6a..4cb51a5 main -> main` (normal fast-forward push, no force).

## HEAD

`4cb51a5` at the evidence commit (full SHA above). `origin/main` matches it.

## origin/main

`4cb51a59723f875399c839e8dae6367703f775a1`

## Worktree

Clean after the evidence commit; only this experiment's new directory is added. No
production file changed.

## Disclosed Harness Defects

1. `realize.mjs`'s in-run `projected_cognition_request_matches_phase_b` field used
   `sha256(JSON.stringify(request))` instead of the production request-identity hash, so
   it recorded `false` in `phase-c.json`. The raw evidence was not rewritten; the defect
   is superseded by the zero-call `reattest.json`, which proves byte-identical Phase C
   replay projections for all 8 scenarios with the correct hash method.
2. `grow.mjs`'s direct-execution guard assumed `process.argv[1]` exists; hardened. No
   captured evidence affected.

These are harness-code fixes made after live collection; no protocol threshold,
scenario, ablation rule or captured response was changed.
