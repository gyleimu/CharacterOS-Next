# BASELINE — AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0

## Repository baseline

| Field | Value |
|---|---|
| Branch | `main` |
| HEAD at slice start | `1bfb42d24aaafb4e026725903e1bb79cf89216ed` |
| `origin/main` at slice start | `1bfb42d24aaafb4e026725903e1bb79cf89216ed` (0/0) |
| Worktree | clean |
| Previous C2 verdict | `AFFECT_COGNITION_C2_REVALIDATION_INCONCLUSIVE` |

## Why a new slice exists

The previous C2 qualification run was invalidated BEFORE transport by a research
wrapper `ReferenceError` (`removed_indices` instead of `variant.removedIndices`):
65 records written, 0 real provider calls, 0 Language calls. That is a harness
defect, not a C2 semantic result. Its evidence is preserved unmodified in
`../phase-2-affect-cognition-c2-host-bound-language-and-semantic-revalidation-v0/`
and was NOT re-run or replaced.

## Inheritance from C2 (frozen, unchanged here)

`ConversationCognitionProposalV3`, `factual_assessment` with
`SOURCE_QUOTE`/`DERIVED_RESULT`, `ClarificationBasis` cross-binding,
`LanguageRealizationInputV4`, `LanguageRealizationSemanticDraftV1`, host-owned
integrity binding, native structured output, V1/V2/V3 compatibility. Canonical
Affect and every psychological domain are unchanged.

## The one prior finding this slice had to fix first

Previous lawful forensics: the prompt advertised `subject:…` in CITEABLE CONTEXT
REFS, the model used it as a `factual_assessment` source, and the host then
rejected it because subject state has no inspectable factual source content (all
10 lawful cases failed uniformly). Frozen decision: subject state is not factual
evidence, so it must not be ADVERTISED as a factual source. Fixed before this
slice's freeze by one shared authority used for both prompt rendering and
validation (see PROTOCOL).

## Baseline gates (before this slice)

Full suite 2388 passed / 3 skipped / 0 failed (189 files); workspaces typecheck
pass; build pass; lint 0; governance PASS; `git diff --check` clean; auxiliary
typecheck fails only with the pre-existing TS2883 in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts`.
