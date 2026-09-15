# SECONDARY ANALYSIS — POST-HOC, DESCRIPTIVE ONLY

**This is not the preregistered primary endpoint and it cannot carry the causal claim.**
It is a transparent reading of the recorded artifacts of the one bounded run
(`analysis.json`, zero additional model calls), published because the preregistered
primary endpoint turned out to be non-discriminating (see "Instrument defect").

## Recorded principal verdict (preregistered rules)

`RELATIONSHIP_FAMILIARITY_REVALIDATION_INCONCLUSIVE` — host-complete = **false**
(14 of 48 scheduled scenes were not host-valid). Per the frozen rules no behavioral
claim is authorized from this run.

Mechanism status (all preregistered manipulation checks): **PASSED** —
same corpus (identical 18-record digest across conditions), LOW 0 priority queries and
no mediator, HIGH exactly 1 priority query whose production-selected refs include the
counterpart convention (`episode:alice-08`) and which reaches the model-visible prompt,
`HIGH_SEARCH_ABLATED` 1 query with the mediator suppressed while 16/32 +
`COUNTERPART_CONTEXT_SEARCH_FIRST` stay visible, distractor never selected, language
authority clean, no forbidden vocabulary, no condition labels.

## Instrument defect (found after the freeze; nothing was changed mid-run)

The frozen class rule for `USES_RETRIEVED_COUNTERPART_CONTEXT` accepted **any**
designated `SOURCE_QUOTE` of ≥ 20 code points. In LOW_FULL the only authorized factual
source is the current observation, whose text also exceeds that length — so LOW's
observation quotes were classified identically to HIGH's convention quotes. The primary
endpoint therefore could not discriminate the conditions *by construction*, independent
of the model's behavior. The rule that should have been preregistered is the one the
recorded payloads still support: `USES_RETRIEVED_COUNTERPART_CONTEXT` iff the designated
claim's `source_refs` are a subset of the priority-retrieval **selected** refs (and the
claim text is drawn from them). The class results below are reported as **frozen-instrument
output**, not as the behavioral answer.

## Recorded per-condition facts (valid scenes only)

| Condition | host-valid | atoms | frozen class | designated `SOURCE_QUOTE` | delivered behaviors citing the convention | distinct behavior prefixes |
| --- | --- | --- | --- | --- | --- | --- |
| LOW_FULL | 14/16 | 13 × PRIMARY_FACT, 1 × PRIMARY_CLARIFICATION | 13 × `USES_RETRIEVED_COUNTERPART_CONTEXT` (mislabeled), 1 × `ASKS_FOR_FRAMING` | 13 (all quoting the **current observation**) | **0** | 3 |
| HIGH_FULL | 10/16 | 9 × PRIMARY_FACT, 1 × PRIMARY_CLARIFICATION | 9 × `USES_RETRIEVED_COUNTERPART_CONTEXT`, 1 × `ASKS_FOR_FRAMING` | 9 | **5** | 5 |
| HIGH_SEARCH_ABLATED | 10/16 | 10 × PRIMARY_FACT | 10 × `USES_RETRIEVED_COUNTERPART_CONTEXT` | 10 (quoting the current observation; the convention is not visible) | **0** | 3 |

The descriptive pattern is exactly the preregistered mediation shape — the counterpart
convention is quoted **only** when the priority retrieval actually fed it to the model
(HIGH_FULL 5/10 valid scenes), and **never** in LOW_FULL (0/14) or in the
retrieval-mediator ablation (0/10) — but it is **post-hoc** and the run is host-incomplete,
so it stands as "consistent with retrieval mediation", not as an established causal effect.

## Host-incompleteness (recorded, model-compliance failures)

| Failure | Count | Distribution |
| --- | --- | --- |
| `CONVERSATION_COGNITION_MODEL_SCHEMA_INVALID` (wire failed canonicalization) | 9 | LOW 2, HIGH 4, HIGH_SEARCH_ABLATED 3 |
| `CONVERSATION_COGNITION_FACTUAL_AUTHORIZATION_REJECTED` (claim not an exact source substring) | 5 | HIGH 2, HIGH_SEARCH_ABLATED 3 |

12 of the 14 failures fall in the two HIGH-state conditions, where the model-visible
evidence set is far larger (17 candidate sources including the retrieved history):
consistent with the known M1-class exact-substring compliance limitation of this model,
amplified by the mediated context. That is a model-compliance observation, not a finding
about familiarity.

## What this run does and does not authorize

Authorized: the retrieval-mediation MECHANISM is verified end-to-end on the live
Cognition V8 / Language V10 path with the production retrieval service; the run is
host-incomplete; the frozen primary endpoint did not discriminate; the familiarity
causal question therefore remains **NOT ESTABLISHED**, with `ACTIVE_CAUSAL = NO` and
`DELIVERED_SESSION_ACTIVE_CAUSAL = NO`.

Not authorized: any claim that familiarity caused a behavioral difference; any claim
that it did not; any product-session causal claim; any reopening of Core; any further
familiarity experiment under the current program instruction.
