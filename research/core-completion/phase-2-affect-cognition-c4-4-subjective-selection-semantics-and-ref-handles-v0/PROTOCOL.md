# AFFECT_COGNITION_C4_4_SUBJECTIVE_SELECTION_SEMANTICS_AND_REF_HANDLES_V0 — PROTOCOL

Two frozen changes, then a fresh qualification, then the formal Affect matrix **only** on 65/65.
No architecture redesign, no further prompt-level applicability refinement.

## CHANGE A — subjective-selection semantics

The tagged applicability carrier is renamed and re-specified in a new protocol version
(`conversation-cognition-proposal-v6`):

| C4.3 | C4.4 |
| --- | --- |
| `NOT_APPLICABLE` | `NO_SUBJECTIVE_SELECTION` |
| `SELECTED` (`choice` / `basis`) | `SUBJECTIVE_SELECTION` (`stance` / `subjective_rationale`) |

The frozen latitude discriminator is stated in the cognition prompt (rule 2):

> a subjective selection exists **only** when the supplied facts and rules leave more than one
> behaviourally admissible, fact-compatible response

Rule 2a adds: **STATING A DETERMINED RESULT IS NOT A SUBJECTIVE SELECTION.** Rule 2b adds that a
response *plan* is not a selection. `CLARIFY_MISSING_CONTEXT` still requires
`NO_SUBJECTIVE_SELECTION`; `REALIZE_CURRENT_INTENT` requires the rationale (when present) to stay
latent subject state.

## CHANGE B — host-issued evidence handles

The model **never writes a canonical ref**. The host issues, per turn, a deterministic, wire-only
handle namespace for exactly the refs it advertises:

| namespace | source set | allowed where |
| --- | --- | --- |
| `F1, F2, …` | `factualAssessmentSourceRefs(projection)` — the **FACTUAL SOURCE HANDLES** block | claim `source_handles`; the three cognition arrays |
| `C1, C2, …` | `allowedEvidenceSet(projection)` **minus** the factual refs — the **CONTEXT HANDLES** block | the three cognition arrays only, never a claim source |

The namespaces are **disjoint**: every factual source carries exactly one handle, an `F` handle, and
is never re-advertised as a `C` handle. Handles are turn-local and never persisted; the canonical
refs stay authoritative and are the only refs hashed or stored.

Host rules (`canonicalizeConversationCognitionModelOutputV6`, then the **unchanged** authoritative
validators):

1. `factual_assessment.claims[i].source_handles` accepts only advertised `F` handles;
2. `cognition.relevant_memory_handles`, `cognition.considered_handles`, `cognition.evidence_handles`
   accept advertised `F` and `C` handles;
3. an unknown handle ⇒ `UNKNOWN_SOURCE_HANDLE` / `UNKNOWN_CONTEXT_HANDLE`; malformed, duplicate or
   namespace-escalating handles fail closed;
4. resolution is exact-match and deterministic; the resolved canonical refs then pass through the
   frozen `validateFactualAssessmentV0` unchanged (lawful source + membership in `considered`
   AND `evidence` + inspectable content + verbatim `SOURCE_QUOTE`).

### Citation binding, expressed in handles

For every claim source `h`: `h ∈ considered_handles` **and** `h ∈ evidence_handles`. `considered`
means everything taken into account, not only context items. Prompt rule 7a states this with a
worked JSON example; rule 7b states that a `C` handle can never be a claim source.

## Frozen surfaces

Tagged `SubjectiveSelectionV1` semantics, the rationale policy (allowed: `PURE_PREFERENCE`,
`PRIORITY`, `AVERSION`, `WILLINGNESS`, `SUBJECTIVE_STRATEGY`; forbidden:
`RAW_SELF_STATE_DESCRIPTION`, `NAMED_PSYCHOLOGICAL_STATE`, `INFERRED_CAPACITY`, `EXTERNAL_FACT`,
`HISTORY_CLAIM`), stance as sole choice authority, the Language no-semantic-completion rule,
`current_intent` descriptive only, unchanged directive / clarification basis / factual-source
authority / host-bound projection hash (`CognitionInvocationBindingV2`). The lexical grounding guard
stays **NOT SHIPPED** (`LEXICAL_GROUNDING_GUARD_TOO_BRITTLE`, evaluated once in C4.2, never
re-evaluated). The frozen `CognitionProposalV0` body is unchanged.

## Qualification (13 scenarios × 5 = 65 calls, `AFFECT_ABSENT`)

Gate **65/65**: 30/30 null cells `NO_SUBJECTIVE_SELECTION` with correct facts, lawful handle binding;
35/35 choice cells `SUBJECTIVE_SELECTION` on-question with a lawful-or-null rationale, unchanged by
Language; 0 forbidden rationale classes; 0 off-question stances; 0 semantic completions; 0 handle
anomalies (unknown / malformed / namespace-escalating); 0 self-state factual claims; 0 unlawful
source attempts; 0 false CLARIFY; isolation intact.

Family-D triggers unchanged: ≥3/5 on ≥2 choice-bearing scenarios failing to select or ground;
≥3/5 on ≥2 null scenarios declaring a selection.

Failures are named exactly: a host canonicalization error is `IMPLEMENTATION_FAILED`; a model that
still cannot reliably select among advertised handles is an applicability/legibility failure and
requires an architecture review — **not** another prompt-level refinement (no C4.5/C4.6 loop), and
never a return to long canonical refs on the wire.

## Formal matrix (only on 65/65)

17 scenarios × P(+0.60,0.50) / N(−0.60,0.50) / Z(0.00,0.50) / A(absent) × k=7 = 476 cognition calls.
Primary causal endpoint: the **Cognition-level `SUBJECTIVE_SELECTION` stance** (P vs N), never
rationale wording. Null 168/168; mixed 84/84 facts and 84/84 valid selections with ≥1/3 material P/N
separation; R ≥3/4 material separation (≥6/7 per-condition class consistency, TVD ≥ 0.28, JS ≥ 0.05,
between > frozen within-condition split-half variance). Then lawful POS×5 / NEG×5 fresh-restore as
ecological confirmation only.

## Verdict space (precedence as frozen)

`AFFECT_COGNITION_C4_4_VALIDATED` → `..._CONTRACT_LEGIBILITY_FAILED` →
`..._RATIONALE_BOUNDARY_FAILED` → `..._STANCE_GROUNDING_FAILED` → `..._LANGUAGE_FIDELITY_FAILED` →
`..._FACTUAL_ASSESSMENT_FAILED` → `..._CLARIFICATION_BOUNDARY_FAILED` → `..._IMPLEMENTATION_FAILED`
→ `..._REVALIDATION_INCONCLUSIVE`. Any single qualification cell failing its frozen obligation ⇒
STOP; the formal matrix does not run.
