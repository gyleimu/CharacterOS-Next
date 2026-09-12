/* globals URL */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('./', import.meta.url));
const v0 = JSON.parse(readFileSync(new URL('../appraisal-exact-input-reuse-shadow-v0/collection.json', import.meta.url), 'utf8'));
const v1 = JSON.parse(readFileSync(join(root, 'collection.json'), 'utf8'));
const verification = JSON.parse(readFileSync(join(root, 'verification.json'), 'utf8'));
export function statistics(values) {
  const a = [...values].sort((x, y) => x - y), n = a.length;
  if (!n) return { count: 0, min: null, p50: null, mean: null, p90: null, max: null, total: 0 };
  const total = a.reduce((x, y) => x + y, 0);
  return { count: n, min: a[0], p50: n % 2 ? a[Math.floor(n / 2)] : (a[n / 2 - 1] + a[n / 2]) / 2, mean: total / n, p90: n >= 10 ? a[Math.ceil(0.9 * n) - 1] : null, max: a.at(-1), total };
}
const v0B = v0.samples.map(r => r.latency_B_ms), v1Paired = v1.samples.filter(r => r.stage === 'PAIRED_EVALUATION'), v1Valid = v1Paired.filter(r => r.completed_valid_pair);
const v1B = v1Paired.filter(r => r.latency_B_ms !== null).map(r => r.latency_B_ms);
const invalidV1 = v1.samples.reduce((n, r) => n + Number(!r.candidate_A.valid && !r.transport_error_A) + Number(r.stage === 'PAIRED_EVALUATION' && !r.candidate_B.valid && !r.transport_error_B), 0);
const summary = {
  V0: { completed_valid_pairs: 5, evaluated_pairs: 5, inferences: 11, exact_request_pairs: 5, candidate_exact_equal: 5, candidate_divergent_valid_pairs: 0, schema_invalid_attempts: 1, authority_equivalent: 5, canonical_equivalent: 5, affect_equivalent: 5, downstream_equivalent: 5, B_latency_ms: statistics(v0B) },
  V1: { completed_valid_pairs: v1Valid.length, evaluated_pairs: v1Paired.length, inferences: v1.calls,
    exact_request_pairs: v1Paired.filter(r => r.request_equal).length, candidate_exact_equal: v1Valid.filter(r => r.candidate_exact_equal).length,
    candidate_divergent_valid_pairs: v1Valid.filter(r => !r.candidate_exact_equal).length, schema_invalid_attempts: invalidV1,
    authority_equivalent: v1Paired.filter(r => r.authority_equal).length, canonical_equivalent: v1Paired.filter(r => r.canonical_equal).length,
    affect_equivalent: v1Paired.filter(r => r.affect_equal).length, downstream_equivalent: v1Paired.filter(r => r.downstream === 'DOWNSTREAM_EQUIVALENT').length,
    B_latency_ms: statistics(v1B), A_latency_ms: statistics(v1.samples.map(r => r.latency_A_ms)), stop: v1.stop },
  combined: {}, token_accounting: {}, counters: verification.counters,
  estimated_turn_impact: { denominator: 'historical user-reported 30-55 seconds, not remeasured', fraction_percent: [statistics(v1B).p50 / 550, statistics(v1B).p50 / 300], actual_end_to_end_comparison: false },
  V0_latency_representative_now: false,
  individual_failures: v1.samples.filter(r => !r.candidate_A.valid || (r.stage === 'PAIRED_EVALUATION' && !r.candidate_B.valid)).map(r => ({ id: r.id, stage: r.stage, A: r.candidate_A.error, B: r.candidate_B.error })),
  paired_differences: v1Paired.filter(r => !r.candidate_exact_equal || r.material).map(r => ({ id: r.id, classifications: r.classifications, fields: r.fields, canonical_differences: r.canonical_differences, projection_differences: r.projection_differences })),
  verdict: null, engineering_judgment: null, productionize: null, recommended_next_slice: null
};
for (const key of ['completed_valid_pairs', 'evaluated_pairs', 'inferences', 'exact_request_pairs', 'candidate_exact_equal', 'candidate_divergent_valid_pairs', 'schema_invalid_attempts', 'authority_equivalent', 'canonical_equivalent', 'affect_equivalent', 'downstream_equivalent']) summary.combined[key] = summary.V0[key] + summary.V1[key];
summary.combined.B_latency_ms = statistics([...v0B, ...v1B]);
const tokens = (rows, key) => rows.map(r => r.tokens_B[key]);
summary.token_accounting = {
  V0_B_prompt: statistics(tokens(v0.samples, 'prompt_eval_count')), V0_B_completion: statistics(tokens(v0.samples, 'eval_count')),
  V1_B_prompt: statistics(tokens(v1Paired, 'prompt_eval_count')), V1_B_completion: statistics(tokens(v1Paired, 'eval_count')),
  combined_B_prompt: statistics([...tokens(v0.samples, 'prompt_eval_count'), ...tokens(v1Paired, 'prompt_eval_count')]),
  combined_B_completion: statistics([...tokens(v0.samples, 'eval_count'), ...tokens(v1Paired, 'eval_count')])
};
if (v1Paired.some(r => r.material)) {
  summary.verdict = 'APPRAISAL_EXACT_INPUT_REUSE_REJECTED_ON_BEHAVIORAL_DIVERGENCE'; summary.engineering_judgment = 'NO'; summary.productionize = 'NO'; summary.recommended_next_slice = 'MODEL_SERVING_LATENCY_RESEARCH_V0';
} else {
  assert.ok(v1Valid.length >= 12 && verification.result === 'PASS', 'a concrete unresolved blocker requires explicit adjudication, not automatic approval');
  assert.equal(summary.V1.exact_request_pairs, v1Paired.length);
  assert.equal(summary.V1.authority_equivalent, v1Paired.length);
  // Engineering judgment: current ~2.65 s local saving is useful for one bounded
  // scoped optimization. This is a recorded judgment, not a universal threshold.
  summary.verdict = 'APPRAISAL_EXACT_INPUT_REUSE_VALIDATED_FOR_PRODUCTIONIZATION'; summary.engineering_judgment = 'YES'; summary.productionize = 'YES'; summary.recommended_next_slice = 'APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0';
}
writeFileSync(join(root, 'aggregate.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
