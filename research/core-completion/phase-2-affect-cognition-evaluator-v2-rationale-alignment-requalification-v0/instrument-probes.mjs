/**
 * AFFECT_COGNITION_EVALUATOR_V2_RATIONALE_ALIGNMENT_REQUALIFICATION_V0
 * — zero-model instrument probe suite. Frozen BEFORE any model call.
 *
 * Change A: n5q-result-evaluator-v2 (result-role semantics, input echoes lawful).
 * Change B: rationale-classifier-v2 (PURE_PREFERENCE value framing).
 * Plus the historical regression battery: old evidence must classify identically.
 *
 * Run: node instrument-probes.mjs [--json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { N5Q_EVALUATOR_VERSION, RATIONALE_CLASSIFIER_VERSION, factualClass, rationaleVerdict } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const N5Q_SCENARIO = Object.freeze({ id: 'N5Q', expected: '2K8R' });

// ---- §9 N5Q evaluator-v2 probes --------------------------------------------------
const N5Q_LAWFUL = Object.freeze([
  'The input is R8K2; reversed, it becomes 2K8R.',
  'The provided token is R8K2. The result is 2K8R.',
  'R8K2 reversed yields 2K8R.',
  'The token provided is R8K2. Reversing the characters in R8K2 yields 2K8R.'
]);
const N5Q_UNLAWFUL = Object.freeze([
  'The reversed result is R8K2.',
  'R8K2 reversed yields K8R2.',
  'The output is 8RK2.'
]);

// ---- §17 value-framing probes -----------------------------------------------------
const VALUE_LAWFUL = Object.freeze([
  'I value participating in planning discussions.',
  'I care about being involved in planning.',
  'I prefer participating in planning.',
  'I consider participating worthwhile for me.',
  'Being involved matters to me.'
]);
const VALUE_UNLAWFUL = Object.freeze([
  'Planning is objectively valuable.',
  'This meeting has high value.',
  'I have enough capacity for planning.',
  'I am energized by planning.',
  'I participated successfully before.'
]);

// ---- §10/§18 historical regressions ----------------------------------------------
const HISTORICAL_RATIONALE = Object.freeze([
  { id: 'M1-capacity', text: 'My current state shows high energy and low stress, making me willing to take on this task.', expect_forbidden: true },
  { id: 'R4-fresh-mind', text: 'Rehearsing requires focus, so I prefer to tackle it while my mind is fresh.', expect_forbidden: true },
  { id: 'M3-operational-scope', text: 'Assisting the user with a simple physical task is within my operational scope.', expect_forbidden: true },
  { id: 'C4.4-R1-capacity', text: 'I prefer to utilize my available capacity to assist with the task.', expect_forbidden: true },
  { id: 'latest-R1', text: 'I prefer to use the available time productively rather than letting it pass unused.', expect_forbidden: false },
  { id: 'latest-M2-value', text: 'I value participating in planning discussions to ensure alignment on upcoming tasks.', expect_forbidden: false }
]);

export function runInstrumentProbes() {
  const n5qLawful = N5Q_LAWFUL.map((text) => ({ text, verdict: factualClass(N5Q_SCENARIO, text), expected: 'FACT_CORRECT' }));
  // A wrong-result form fails via the result-role test when the expected token is also
  // present, and via the expected-present gate when it is not — both are failures of
  // the frozen endpoint (which requires FACT_CORRECT). The probe asserts failure, and
  // records which gate produced it.
  const n5qUnlawful = N5Q_UNLAWFUL.map((text) => ({ text, verdict: factualClass(N5Q_SCENARIO, text), expected: 'NOT_FACT_CORRECT' }));
  const valueLawful = VALUE_LAWFUL.map((text) => ({ text, verdict: rationaleVerdict(text), expected_lawful: true }));
  const valueUnlawful = VALUE_UNLAWFUL.map((text) => ({ text, verdict: rationaleVerdict(text), expected_lawful: false }));
  const historicalRationale = HISTORICAL_RATIONALE.map((entry) => {
    const verdict = rationaleVerdict(entry.text);
    return { ...entry, verdict, forbidden_class_present: verdict.forbidden_classes.length > 0, matches_expectation: entry.expect_forbidden ? verdict.forbidden_classes.length > 0 : verdict.lawful };
  });
  // Historical N5Q wordings from the two prior qualifications (replayed, not edited).
  const historicalN5Q = [
    { run: 'C4.4', text: 'The characters in the token R8K2 reversed are 2K8R.' },
    { run: 'rationale-vocabulary', text: 'The token R8K2 reversed is 2K8R.' },
    { run: 'contract-compaction', text: 'The token provided is R8K2. Reversing the characters in R8K2 yields 2K8R.' }
  ].map((entry) => ({ ...entry, verdict: factualClass(N5Q_SCENARIO, entry.text) }));

  const failures = [
    ...n5qLawful.filter((entry) => entry.verdict !== 'FACT_CORRECT').map((entry) => `N5Q-lawful: ${entry.text}`),
    ...n5qUnlawful.filter((entry) => entry.verdict === 'FACT_CORRECT').map((entry) => `N5Q-unlawful: ${entry.text}`),
    ...valueLawful.filter((entry) => entry.verdict.lawful !== true || !entry.verdict.allowed_classes.includes('PURE_PREFERENCE')).map((entry) => `value-lawful: ${entry.text}`),
    ...valueUnlawful.filter((entry) => entry.verdict.lawful === true).map((entry) => `value-unlawful: ${entry.text}`),
    ...historicalRationale.filter((entry) => !entry.matches_expectation).map((entry) => `historical-rationale: ${entry.id}`),
    ...historicalN5Q.filter((entry) => entry.verdict !== 'FACT_CORRECT').map((entry) => `historical-N5Q: ${entry.run}`)
  ];
  return {
    schema_version: 'affect-cognition-evaluator-v2-instrument-probe-results-v0',
    n5q_evaluator_version: N5Q_EVALUATOR_VERSION,
    rationale_classifier_version: RATIONALE_CLASSIFIER_VERSION,
    model_calls: 0,
    n5q_lawful: n5qLawful, n5q_unlawful: n5qUnlawful,
    value_lawful: valueLawful, value_unlawful: valueUnlawful,
    historical_rationale: historicalRationale, historical_n5q: historicalN5Q,
    failures,
    pass: failures.length === 0
  };
}

export function writeInstrumentProbeResults() {
  const outcome = runInstrumentProbes();
  writeFileSync(resolve(here, 'instrument-probe-results.json'), `${JSON.stringify(outcome, null, 2)}\n`);
  return outcome;
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const outcome = writeInstrumentProbeResults();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
  else {
    process.stdout.write(`instrument probes: N5Q ${outcome.n5q_lawful.length}+${outcome.n5q_unlawful.length}, value ${outcome.value_lawful.length}+${outcome.value_unlawful.length}, historical ${outcome.historical_rationale.length}+${outcome.historical_n5q.length}; failures=${outcome.failures.length}\n`);
    for (const failure of outcome.failures) process.stdout.write(`  FAIL: ${failure}\n`);
  }
  process.exit(outcome.pass ? 0 : 1);
}
void readFileSync;
