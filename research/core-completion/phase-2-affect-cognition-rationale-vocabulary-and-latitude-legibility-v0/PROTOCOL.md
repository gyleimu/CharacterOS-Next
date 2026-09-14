# AFFECT_COGNITION_RATIONALE_VOCABULARY_AND_LATITUDE_LEGIBILITY_V0 — PROTOCOL

One frozen vocabulary-legibility correction to the model-facing cognition contract, a preregistered
zero-model probe suite, then the unchanged 65-cell qualification, and — ONLY on 65/65 — the frozen
476-cell formal matrix plus lawful POS/NEG confirmation. Final allowed vocabulary/prompt refinement
for Affect Phase 2.

## The repair (production change `7042202`, prompt-only)

`packages/runtime/src/providers/behavior/conversation-cognition-provider-v6.ts`, cognition rules
2, 5a, 5b, 6, 10 only. No schema, wire key, validator, canonicalization, executor, Language or
Affect change; no protocol version bump; the frozen CognitionProposalV0 body is untouched.

- **Rule 2 (latitude is fact-relative):** latitude is a relation between the SUPPLIED facts/rules
  and the available responses — never a newly inferred property of the subject. Lawful form:
  "the supplied facts permit either volunteering or declining". Forbidden:
  "the subject has capacity for either response", "the subject is capable of either response",
  "the subject can manage either response".
- **Rule 5a (positive worked examples):** the allowed classes now carry concrete lawful examples,
  including "I'd rather help.", "I prefer to use the free time to help.",
  "I'd be willing to spend the available time on the review.", "I'd prefer to decline."
- **Rule 5b (forbidden forms + availability ≠ capacity):** adds "I have available capacity.",
  "My energy is high enough.", "My mind is fresh.", "I can manage the workload."; states that a
  fact plus an action is not a rationale ("I have time available, so I would help."); states
  AVAILABILITY IS NOT CAPACITY — a supplied availability fact establishes only that fact and no
  mapping (free time → capacity/capability/energy, low stress → capability) may be made; forbids
  restating a situational fact as a subject property (free slot ≠ subject capacity, no conflict ≠
  subject capability, available time ≠ subject bandwidth, 20-minute fit ≠ subject energy).
- **Rule 6:** the rationale may reference an external premise only INSIDE a preference frame.
- **Rule 10 (subject-property prohibition):** claims may state situation-side facts ("The scenario
  provides a free 30-minute slot.", "The supplied facts leave both volunteering and declining
  feasible.") and may never assert subject-side properties ("The subject has capacity.",
  "The subject is capable.", "The subject is ready.", "The subject has enough energy.",
  "The subject has sufficient workload tolerance.").

## Frozen unchanged

Affect semantics (valence/activation/recovery/timing/persistence/restore); `SubjectiveSelectionV1`
and both tokens; the ref-handle wire protocol, host canonicalization and canonical ref authority;
factual source authority; CommunicationDirective / ClarificationBasis; Language authority; the 13
qualification and 17 formal scenarios byte-identical; all thresholds; classifier
`lib/classify.mjs` byte-identical to C4.4 (`harness.classifier_unchanged_from_c4_4 = true`);
model `qwen3.5:9b` digest `6488c96f…ea7`; generation settings (temperature 0, think false, stream
false, num_ctx 8192, num_predict 2048, timeout 240000, native structured output).

## Zero-model probes (frozen before any model call)

`probes.mjs` + `probes.test.mjs`: 27 cases across rationale-lawful (5), rationale-forbidden (10),
fact-plus-action-not-a-rationale (1), claim-lawful availability (3), claim-forbidden subject
property (4), latitude lawful/forbidden/not-a-rationale (3), historical replay (1). Results hashed
into the freeze (`harness.probe_results_sha256`); no editing after seeing qualification results.
One lenient instrument-coverage gap is declared, not repaired: the frozen classifier does not
police "workload tolerance" in claims (`FU-4`); no instrument change is permitted.

Historical regression: the frozen C4.4 rationale "I prefer to utilize my available capacity to
assist with the task." still classifies `INFERRED_CAPACITY` — old evidence is not made green.

## Qualification

Unchanged set: N1–N6, M1–M3, R1–R4 × 5 replicates, `AFFECT_ABSENT`, 65 cells, no retry, no
replacement. Gate 65/65 with R1 5/5 lawful. Formal matrix only on 65/65, from a re-minted formal
freeze at the committed HEAD (the Cognition prompt digest changed).

## Failure routing

If qualification is not 65/65: STOP, preserve evidence, no v0.1/C4.5/another-word repair; route the
remaining failure class to a read-only architecture review. Rationale is not the causal endpoint;
only the stance class counts in the formal matrix.
