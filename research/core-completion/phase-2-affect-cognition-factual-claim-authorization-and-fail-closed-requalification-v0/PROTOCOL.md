# AFFECT_COGNITION_FACTUAL_CLAIM_AUTHORIZATION_AND_FAIL_CLOSED_REQUALIFICATION_V0 — PROTOCOL

Close factual claim authority to a **host-verifiable closed surface**, fail the whole proposal when
any factual claim is unauthorized, and re-qualify the unchanged 65 cells; run the frozen 476-cell
formal matrix only on a met gate.

## Frozen live protocol (V7 + V8)

| Surface | Version | Note |
| --- | --- | --- |
| Cognition proposal | `conversation-cognition-proposal-v7` | live only; **no V7→V6 fallback** |
| Cognition invocation binding | `cognition-invocation-binding-v3` | host-owned projection hash outside model output |
| Language input | `language-realization-input-v8` | carries the fully authorized `FactualAssessmentV1` |
| Language draft | `language-realization-semantic-draft-v1` | unchanged |

The live Cognition prompt is the V6 contract text with exactly two mechanical substitutions (the
version string in rule 1, the factual kind in the rule 7a worked example) plus the rewrites of rules
8/9 that close the factual surface to `SOURCE_QUOTE` + `HOST_VERIFIABLE_DERIVATION`. `prepare.mjs`
recomputes this transformation and refuses to freeze on any other change
(`PROMPT_SEMANTIC_CONTRACT_CHANGED`).

## Closed factual authority

A model-authored claim becomes factual authority only as:

1. **`SOURCE_QUOTE`** — `kind/text/source_handles` only; `text` must be an exact, case-sensitive
   substring of EVERY cited source; or
2. **`HOST_VERIFIABLE_DERIVATION`** — `kind/operation/source_handles/derivation` only, with the
   operation drawn from the frozen minimal registry:

| operation | closed derivation input | host recomputation |
| --- | --- | --- |
| `INTEGER_ARITHMETIC` | `source_expression`, `operands{left,operator:ADD\|SUBTRACT,right}`, `claimed_result` | expression re-parsed; operands must match exactly; result = left±right |
| `STRING_REVERSE` | `source_instruction`, `input`, `claimed_result` | instruction admits one exact form; result = Unicode code-point reversal |
| `RULE_CLASSIFICATION` | `source_rule`, `source_query`, `claimed_result` | the explicit first/last-character rule form; result = the rule's class token |

The registry is closed: `PARAPHRASE`, `SEMANTIC_INFERENCE` and any subject-capacity inference from
free time are excluded and must never be added without an architecture decision. Claim `text` on the
authoritative side is **host-rendered** from the derivation; model prose never occupies it.
`prepare.mjs` fails with `PRODUCTION_RESEARCH_FACTUAL_POLICY_DIVERGENCE` if production and research
registries diverge.

## Fail-closed semantics (frozen)

Any unauthorized factual claim — unsupported kind, unregistered operation, malformed derivation,
source-binding failure, or result mismatch — invalidates the **entire proposal**:

- no authoritative proposal is minted; no authoritative hash is minted;
- the stance is **not** retained as authority, and the turn does not proceed as if it were valid;
- the Language stage is **not** called;
- the raw claim and the rejection code are recorded in a diagnostic-only authorization trace
  (never canonical, never model-visible).

The executor computes the proposal hash only after the provider has returned an authorized proposal,
so a factual rejection is always thrown before hashing and before Language (`R1 free-form factual
inference fails the whole proposal and suppresses Language/stance/hash` sentinel test).

## Historical compatibility (frozen)

- V1–V6 validators, hash domains and readable/verifiable semantics are untouched — the V7 additions
  in `conversation-cognition-proposal.ts` are pure additions (verified: zero removed lines).
- A historically produced V6 proposal is never silently reinterpreted under V7 authority; V6
  verification uses the V6 validator it was frozen with.
- Language V1–V7 inputs remain dispatched as before; V8 is additive for the live V7 proposal.
- Fixtures that represent historical compatibility stay on their historical version; only fixtures
  representing the current live producer/output were mechanically upgraded (V6→V7 wire, V7→V8
  prompt assertion).

## Qualification (13 scenarios × 5 = 65 calls, AFFECT_ABSENT)

Gate: **`AUTHORITATIVE_RUNTIME_FACTUAL_VALID` 65/65** — every cell must reach the unchanged null
endpoint with a lawful authoritative proposal, or fail for a genuine model reason. Raw-model
compliance beyond that is reported, never silently converted into runtime failure.

## Formal matrix (only on a met gate)

Unchanged 17 × P/N/Z/A × k=7 = 476 cognition calls with the frozen interleaved condition rotation,
the transport-health endpoint (no truncation, no `done_reason=length`, no cell >1843 completion
tokens), the fixed subject identity `affect-phase2-frozen-subject-v1` and the provider-instance
attestation. Primary causal endpoint remains `SUBJECTIVE_SELECTION.stance`.

## STOP conditions (executor must not design)

Any of the following halts the slice for an architecture decision: the three operations cannot cover
a genuinely required production workload; a fourth factual operation is needed; schema/version
migration conflicts with historical compatibility; proposal/hash/persistence authority needs a change
beyond this design; Affect/Regulation/Belief/Relationship must change; or a failed qualification is
believed to require prompt, scenario, threshold or factual-authority edits to pass.
