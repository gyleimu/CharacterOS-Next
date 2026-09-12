/* globals URL */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('./', import.meta.url));
const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const collection = read('collection.json'), verification = read('verification.json');
function statistics(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length, sum = values.reduce((a, b) => a + b, 0);
  return { count: n, min: sorted[0], median: n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2, mean: sum / n, max: sorted.at(-1), total: sum };
}
const rows = collection.samples;
const aPaired = statistics(rows.map(row => row.latency_A_ms));
const b = statistics(rows.map(row => row.latency_B_ms));
const failed = read('evidence/S06-A.json');
const aAll = statistics([...rows.map(row => row.latency_A_ms), failed.latency_ms]);
const inputTokens = statistics(rows.map(row => row.tokens_B.prompt_eval_count));
const outputTokens = statistics(rows.map(row => row.tokens_B.eval_count));
const aggregate = {
  verdict: 'APPRAISAL_EXACT_INPUT_REUSE_REQUIRES_MORE_EVIDENCE', productionize: 'MORE_EVIDENCE_REQUIRED',
  recommended_next_slice: 'APPRAISAL_EXACT_INPUT_REUSE_SHADOW_VALIDATION_V1',
  planned_pairs: 10, completed_eligible_pairs: rows.length, all_model_inferences: collection.calls,
  exact_request_matches: rows.filter(row => row.request_equal).length,
  candidate_exact_equal: rows.filter(row => row.candidate_exact_equal).length,
  candidate_divergence: rows.filter(row => !row.candidate_exact_equal).length,
  candidate_equality_rate: rows.filter(row => row.candidate_exact_equal).length / rows.length,
  authority_equivalence_rate: rows.filter(row => row.authority === 'AUTHORITY_EQUIVALENT').length / rows.length,
  canonical_equivalence_rate: rows.filter(row => row.canonical_equal).length / rows.length,
  affect_equivalence_rate: rows.filter(row => row.affect_equal).length / rows.length,
  downstream_input_equivalence_rate: rows.filter(row => row.downstream === 'DOWNSTREAM_INPUT_IDENTICAL').length / rows.length,
  live_candidate_validity: { valid: 10, invalid: 1, malformed_sample: 'S06-A', cause: 'goal_conguence instead of goal_congruence; strict product parser rejects', B_not_reached: true },
  latency_ms: { paired_A: aPaired, all_A_including_invalid: aAll, redundant_B: b },
  actual_redundant_B_tokens: { input: inputTokens, output: outputTokens },
  estimated_full_turn_impact: { historical_user_reported_range_s: [30, 55], measurement_status: 'ESTIMATED_NOT_FULL_TURN_BENCHMARK', median_B_s: b.median / 1000, median_contribution_percent_range: [100 * b.median / 55000, 100 * b.median / 30000], net_speedup_measured: false },
  counters: verification.counters,
  gates: { A: 'PASS_FOR_FIVE_OBSERVED_PAIRS', B: 'PASS_RESEARCH_AUTHORITY_AND_FAILURE_CONTROLS', C: 'UNKNOWN_INCOMPLETE_SAMPLE', D: 'MEASURED_LOCAL_VALUE_WORTH_FURTHER_VALIDATION' },
  confidence: 'LOW', limitation: 'Preregistered stop on malformed A at sample 6 leaves low-information/counterpart/positive-salient/practical-uncertain categories unrun, emotionally salient category without a valid pair. Five successes do not establish broad behavioral equivalence.',
  benchmark_table: rows.map(row => ({ id: row.id, request_equal: row.request_equal, latency_A_s: row.latency_A_ms / 1000, latency_B_s: row.latency_B_ms / 1000, candidate_exact_equal: row.candidate_exact_equal, dimension_divergence: Object.entries(row.fields).filter(([,field]) => !field.equal).map(([key, field]) => ({ key, ...field })), control: row.control_validation, reuse: row.reuse_validation, canonical_equal: row.canonical_equal, downstream: row.downstream }))
};
writeFileSync(join(root, 'aggregate.json'), JSON.stringify(aggregate, null, 2) + '\n');
console.log(JSON.stringify({ verdict: aggregate.verdict, pairs: rows.length, calls: collection.calls, latency_ms: aggregate.latency_ms, tokens: aggregate.actual_redundant_B_tokens, estimated_full_turn_impact: aggregate.estimated_full_turn_impact }, null, 2));
