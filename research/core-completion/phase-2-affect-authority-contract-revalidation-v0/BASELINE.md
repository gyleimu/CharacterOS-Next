# BASELINE — AFFECT_COGNITION_AUTHORITY_CONTRACT_AND_REVALIDATION_V0

## Repository baseline

| Field | Value |
|---|---|
| Branch | `main` |
| HEAD at slice start | `dda1e16a692af30e5f9046756bd67f488a5a169a` (Phase 2 research) |
| Worktree at slice start | clean |
| Phase 2 verdict (source of this slice) | `AFFECT_CAUSES_UNHELPFUL_BIAS` |
| GPT-6 architecture decision | KEEP_ALWAYS_ON_BUT_TIGHTEN_COGNITION_CONTRACT (Family C) |

## What Phase 2 established (and what it did not)

Phase 2 proved canonical Affect causally changes cognition/behavior (large, repeated,
deterministic) but ALSO materially disturbed the objective arithmetic control (neutral Z refused
to answer while P/N/A answered). The lawful-positive confirmation in the Phase 2 report is
CORRECTED here: those 5/5 runs contained illegal episode refs and would fail full production
executor validation. Phase 2's lawful confirmation therefore validated parser-level parsing,
not production admissibility.

## Production change in this slice

- New `ConversationCognitionProposalV2` with a structural `ClarificationBasisV0`
  (`current_observation_ref` bound to the current projection observation, `missing_information`,
  `needed_for`, ≤256 code points each, closed schema, fail closed).
- CLARIFY ⇒ basis non-null; REALIZE ⇒ basis exactly null. No directive kind added.
- New V2 hash domain binding cognition + directive + basis (including null).
- New V3 language input binding the V2 REALIZE proposal; language still receives no raw Affect.
- V2 model-facing usage contract: subject state describes the subject, cannot create/negate a
  factual conclusion or prove missing information; Memory lacking an answer does not mean the
  answer cannot be derived from the current observation.
- Language prompt distinguishes current input / factual Memory evidence / derived result /
  subjective intent and forbids inventing history.
- Scene/task rendered with JSON escaping.
- Unchanged: canonical Affect, validator, AffectApplication, recovery, timing, persistence,
  restore, Appraisal, Memory, Belief, Relationship, Personality, CognitionProposalV0,
  CommunicationDirectiveV0. Model call count unchanged (1 cognition + 0/1 language).

## Baseline gates (before this slice's revalidation)

Full suite 184 files / 2350 tests; typecheck, build, lint, governance green; pre-existing
auxiliary TS2883 only.
