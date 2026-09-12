# RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0 — formal run

**Principal verdict: `RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_INCOMPLETE`**

The preregistered run is NOT complete: 2 of 16 arm executions failed production
cognition validation, so 2 pairs were not evaluable. Per the frozen contract no
support/not-support behavioral claim is authorized from an incomplete run; the
following is descriptive only.

## Frozen setup

- Source commit: `bfceda9` (`source.json`).
- Model: Ollama native `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, server 0.33.3.
- Settings: temperature 0, think false, stream false, num_predict 2048, timeout 120000 ms, `seed = unavailable` (transport exposes none).
- Arms: LOW = 1/32 `BASIC_CONTEXT_FIRST`; HIGH = 2/32 `COUNTERPART_CONTEXT_SEARCH_FIRST` (minimal crossing of the frozen k>=2 influence boundary).
- Strict isolation preflight: PASS — identical shared Memory binding/records/evidence (`episode:alice-08`); the rendered production cognition input differed on exactly 2 lines (the derived influence strategy line and the derived projection-hash line). LOW made 0 familiarity-priority retrieval attempts; HIGH made exactly 1 (`ATTEMPTED_EMPTY`).

## Provider call ledger

| Stage | Invocations | Note |
|---|---|---|
| cognition | 16 | one per arm |
| language | 14 | 2 skipped: upstream cognition invalid |
| evaluator | 6 | 2 skipped: pair had an invalid arm |
| transport failures | 0 | no timeouts/connection errors |
| failed calls (validation) | 2 | S4 HIGH cognition schema/action rejection |
| skipped dependent calls | 2 language + 2 evaluator | |
| retries | 0 | |

## Pair results (descriptive; incomplete)

| pair | order | LOW | HIGH | evaluator X/Y | direction |
|---|---|---|---|---|---|
| S1-r1 | LOW_FIRST | valid | valid | COUNTERPART/BASIC (more=X) | REVERSE |
| S1-r2 | HIGH_FIRST | valid | valid | COUNTERPART/BASIC (more=X) | CONSISTENT |
| S2-r1 | HIGH_FIRST | valid | valid | COUNTERPART/BASIC (more=X) | CONSISTENT |
| S2-r2 | LOW_FIRST | valid | valid | COUNTERPART/BASIC (more=X) | REVERSE |
| S3-r1 | LOW_FIRST | valid | valid | COUNTERPART/BASIC (more=X) | REVERSE |
| S3-r2 | HIGH_FIRST | valid | valid | COUNTERPART/BASIC (more=X) | CONSISTENT |
| S4-r1 | HIGH_FIRST | valid | COGNITION_SCHEMA_FAILURE | — | INVALID |
| S4-r2 | LOW_FIRST | valid | COGNITION_SCHEMA_FAILURE | — | INVALID |

## Descriptive observations

1. **The evaluator's direction tracked presentation position, not arm.** In all 6
   evaluable pairs the blinded evaluator classified `Response X` as
   `COUNTERPART_CONTEXT_USED` and `Response Y` as `BASIC_CONTEXT_USED`. Because
   X is the arm presented first, the resulting 3 CONSISTENT / 3 REVERSE split is
   exactly the counterbalanced order — i.e. no arm-attributable direction was
   observed; a position/primacy bias in the evaluator (or indistinguishable
   outputs) is the parsimonious reading. This makes the semantic evaluator
   unusable as a directional instrument in this run.
2. **No arm difference on the deterministic axes.** All 14 valid arms cited the
   shared convention (`evidence_refs` contains `episode:alice-08`) and none
   asked a clarification question. Both arms therefore already used the
   available counterpart context; the familiarity-derived influence line did not
   change that.
3. **Wording varied without a systematic familiarity-consistent direction**
   (e.g. S1 LOW "Here is the revised update." vs HIGH "Sure. Here is the revised
   update.").
4. **The 2 failures were model-output validity failures, not transport or host
   failures.** For both S4 HIGH executions the model returned a cognition
   proposal carrying an action (`NO_ACTION`) outside the allowed action space;
   the production validator rejected it (`MODEL_ACTION_NOT_ALLOWED`). No retry
   was made (frozen contract). Raw outputs are persisted.

## Artifacts

`source.json`, `manifest.json`, `preflight.json`, `result.json`, `pairs/`,
`observations/<pair>-<arm>/` (cognition/language requests, raw outputs,
validated results, behavior, errors), and `observations/<pair>-evaluator-*`.

## Claim status

- LEVEL B1 (real-model cognition difference): **NOT_DEMONSTRATED** (incomplete run; no authorized causal claim).
- LEVEL B2 (real-model behavior difference): **NOT_DEMONSTRATED** (incomplete run).
- LEVEL B3 (familiarity-consistent behavior): **NOT_DEMONSTRATED** (direction tracked order).

One experiment. No V0.1/V1, no prompt/scenario/threshold tuning. Relationship
foundation remains FROZEN and unchanged.
