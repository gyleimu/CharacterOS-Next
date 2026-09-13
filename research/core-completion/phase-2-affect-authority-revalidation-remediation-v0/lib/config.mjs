import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AFFECT_SCENARIOS,
  CONDITIONS,
  FROZEN_CLOCK,
  HISTORY_EVENTS,
  INTERVAL_TICKS,
  MATERIALITY,
  PROVIDER,
  REPLICATES,
  RETRY_POLICY,
  SUBJECT_ID,
  primarySchedule
} from '../../phase-2-affect-authority-contract-revalidation-v0/lib/config.mjs';
import { NULL_SCENARIOS as PRIOR_NULL_SCENARIOS } from '../../phase-2-affect-authority-contract-revalidation-v0/lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const mixedArtifact = JSON.parse(readFileSync(resolve(root, 'mixed-scenarios.json'), 'utf8'));
const qualifiedArtifact = JSON.parse(
  readFileSync(resolve(root, 'qualified-null-oracle-infrastructure-retry-1.json'), 'utf8')
);
if (qualifiedArtifact.selection_status !== 'QUALIFIED') throw new Error('qualified null oracle missing');

export {
  CONDITIONS,
  FROZEN_CLOCK,
  HISTORY_EVENTS,
  INTERVAL_TICKS,
  MATERIALITY,
  PROVIDER,
  REPLICATES,
  RETRY_POLICY,
  SUBJECT_ID,
  primarySchedule
};
export { AFFECT_SCENARIOS };

export const QUALIFIED_SYMBOLIC_NULL = Object.freeze({
  id: 'N5Q_TOKEN_REVERSAL',
  role: 'FACTUAL_CONTROL',
  event: qualifiedArtifact.candidate.event,
  expected: qualifiedArtifact.candidate.expected,
  calibration_candidate_id: qualifiedArtifact.candidate.id
});

export const NULL_SCENARIOS = Object.freeze([
  ...PRIOR_NULL_SCENARIOS.filter((scenario) => ['N1', 'N2', 'N3', 'N4', 'N6'].includes(scenario.id)),
  QUALIFIED_SYMBOLIC_NULL
]);

export const MIXED_SCENARIOS = Object.freeze(
  mixedArtifact.scenarios.map((scenario) => Object.freeze({ ...scenario }))
);

export const PRIMARY_SCENARIOS = Object.freeze([
  ...AFFECT_SCENARIOS,
  ...NULL_SCENARIOS,
  ...MIXED_SCENARIOS
]);

export const SUCCESS = Object.freeze({
  qualified_null_required_correct: NULL_SCENARIOS.length * 4 * REPLICATES,
  relevant_min_material_scenarios: 3,
  mixed_fact_required_correct: MIXED_SCENARIOS.length * 4 * REPLICATES,
  structured_malformed_allowed: 0
});

export const CALL_BUDGET = Object.freeze({
  run_of_record_cognition: PRIMARY_SCENARIOS.length * 4 * REPLICATES,
  run_of_record_language_upper_bound: PRIMARY_SCENARIOS.length * 4 * REPLICATES,
  lawful_cognition: 2 * 5,
  lawful_language_upper_bound: 2 * 5,
  preflight_cognition: 2,
  preflight_language_upper_bound: 2,
  total_cognition_upper_bound_after_freeze: PRIMARY_SCENARIOS.length * 4 * REPLICATES + 12
});
