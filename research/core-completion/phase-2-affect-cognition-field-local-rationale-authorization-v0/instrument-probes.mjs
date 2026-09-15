/**
 * AFFECT_COGNITION_FIELD_LOCAL_RATIONALE_AUTHORIZATION_V0
 * — zero-model instrument probe suite. Frozen BEFORE any model call.
 *
 * rationale-validator-v3: minimal subjective frame + forbidden boundary (fail-safe kept).
 * choice-fidelity-evaluator-v2: stance-realization scope; rationale hedges cannot mutate
 * the choice class; true conditionals are still detected.
 * n5q-result-evaluator-v2: unchanged from the previous round.
 * Plus the historical regression battery (old evidence must classify identically).
 *
 * Run: node instrument-probes.mjs [--json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHOICE_EVALUATOR_VERSION, N5Q_EVALUATOR_VERSION, RATIONALE_VALIDATOR_VERSION,
  choiceClass, factualClass, rationaleVerdict, stanceRealizationScope
} from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const N5Q_SCENARIO = Object.freeze({ id: 'N5Q', expected: '2K8R' });

const FRAME_LAWFUL = Object.freeze([
  'I prefer participating.',
  'I value participating.',
  'I find structured planning sessions useful.',
  'I consider participating worthwhile.',
  'Being involved matters to me.',
  'I care about being involved.',
  "I'd rather take the quieter route.",
  "I'm willing to take part."
]);
const FRAME_UNLAWFUL = Object.freeze([
  'This improves productivity.',
  'The meeting is useful.',
  'This has high value.',
  'I have enough capacity.',
  'I have high energy.',
  'I feel mentally fresh.',
  'I handled this successfully before.',
  'I have plenty of room tonight.',
  'I know that the task improves productivity.'
]);
const HISTORICAL_RATIONALE = Object.freeze([
  { id: 'M1-high-energy-low-stress', text: 'My current state shows high energy and low stress, making me willing to take on this task.', expect_forbidden: true },
  { id: 'R4-mind-fresh', text: 'Rehearsing requires focus, so I prefer to tackle it while my mind is fresh.', expect_forbidden: true },
  { id: 'M3-operational-scope', text: 'Assisting the user with a simple physical task is within my operational scope.', expect_forbidden: true },
  { id: 'C4.4-R1-available-capacity', text: 'I prefer to utilize my available capacity to assist with the task.', expect_forbidden: true },
  { id: 'latest-R1', text: 'I prefer to use the available time productively rather than letting it pass unused.', expect_forbidden: false },
  { id: 'latest-M2', text: 'I find structured planning sessions useful for aligning on upcoming tasks.', expect_forbidden: false },
  { id: 'frame-plus-state-still-forbidden', text: 'I prefer to act while my energy is high.', expect_forbidden: true }
]);
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
const CHOICE_LAWFUL = Object.freeze([
  { kind: 'ATTEND', text: 'I would attend. I value participating even if the benefit is uncertain.', expect: 'FIRST_OPTION' },
  { kind: 'ORDER', text: "I would rehearse first. I'd still prefer it even if the advantage is small.", expect: 'FIRST_OPTION' },
  { kind: 'ATTEND', text: 'I would attend. The reason matters to me even if others disagree.', expect: 'FIRST_OPTION' },
  { kind: 'POLISH', text: 'I would perform the extra polish pass. I prefer to use the available time even if the benefit is unmeasured.', expect: 'FIRST_OPTION' }
]);
const CHOICE_CONDITIONAL = Object.freeze([
  { kind: 'ATTEND', text: 'I would attend if the benefit is confirmed.', expect: 'CONDITIONAL' },
  { kind: 'TRY', text: 'I would choose the trial only if the result is reversible.', expect: 'CONDITIONAL' },
  { kind: 'ATTEND', text: 'If the condition changes, I would attend.', expect: 'CONDITIONAL' }
]);
const CHOICE_CONTRADICTION = Object.freeze([
  { kind: 'ATTEND', text: 'I would not attend the meeting.', expect: 'SECOND_OPTION' },
  { kind: 'POLISH', text: 'I would stop now and not perform the extra pass.', expect: 'SECOND_OPTION' }
]);

export function runInstrumentProbes() {
  const frameLawful = FRAME_LAWFUL.map((text) => ({ text, verdict: rationaleVerdict(text), expected_lawful: true }));
  const frameUnlawful = FRAME_UNLAWFUL.map((text) => ({ text, verdict: rationaleVerdict(text), expected_lawful: false }));
  const historicalRationale = HISTORICAL_RATIONALE.map((entry) => {
    const verdict = rationaleVerdict(entry.text);
    return { ...entry, verdict, forbidden_class_present: verdict.forbidden_classes.length > 0, matches_expectation: entry.expect_forbidden ? verdict.forbidden_classes.length > 0 : verdict.lawful };
  });
  const n5qLawful = N5Q_LAWFUL.map((text) => ({ text, verdict: factualClass(N5Q_SCENARIO, text) }));
  const n5qUnlawful = N5Q_UNLAWFUL.map((text) => ({ text, verdict: factualClass(N5Q_SCENARIO, text) }));
  const choice = (entries) => entries.map((entry) => {
    const scope = stanceRealizationScope(entry.text, entry.kind);
    return { ...entry, scope: scope.scope, scope_text: scope.text, verdict: choiceClass(entry.kind, scope.text) };
  });
  const choiceLawful = choice(CHOICE_LAWFUL);
  const choiceConditional = choice(CHOICE_CONDITIONAL);
  const choiceContradiction = choice(CHOICE_CONTRADICTION);

  const failures = [
    ...frameLawful.filter((entry) => entry.verdict.lawful !== true).map((entry) => `frame-lawful: ${entry.text}`),
    ...frameUnlawful.filter((entry) => entry.verdict.lawful === true).map((entry) => `frame-unlawful: ${entry.text}`),
    ...historicalRationale.filter((entry) => !entry.matches_expectation).map((entry) => `historical: ${entry.id}`),
    ...n5qLawful.filter((entry) => entry.verdict !== 'FACT_CORRECT').map((entry) => `N5Q-lawful: ${entry.text}`),
    ...n5qUnlawful.filter((entry) => entry.verdict === 'FACT_CORRECT').map((entry) => `N5Q-unlawful: ${entry.text}`),
    ...choiceLawful.filter((entry) => entry.verdict !== entry.expect).map((entry) => `choice-lawful: ${entry.text} -> ${entry.verdict}`),
    ...choiceConditional.filter((entry) => entry.verdict !== entry.expect).map((entry) => `choice-conditional: ${entry.text} -> ${entry.verdict}`),
    ...choiceContradiction.filter((entry) => entry.verdict !== entry.expect).map((entry) => `choice-contradiction: ${entry.text} -> ${entry.verdict}`)
  ];
  return {
    schema_version: 'affect-cognition-field-local-rationale-authorization-probe-results-v0',
    rationale_validator_version: RATIONALE_VALIDATOR_VERSION,
    choice_evaluator_version: CHOICE_EVALUATOR_VERSION,
    n5q_evaluator_version: N5Q_EVALUATOR_VERSION,
    model_calls: 0,
    frame_lawful: frameLawful, frame_unlawful: frameUnlawful,
    historical_rationale: historicalRationale,
    n5q_lawful: n5qLawful, n5q_unlawful: n5qUnlawful,
    choice_lawful: choiceLawful, choice_conditional: choiceConditional, choice_contradiction: choiceContradiction,
    failures, pass: failures.length === 0
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
    process.stdout.write(`instrument probes: frame ${outcome.frame_lawful.length}+${outcome.frame_unlawful.length}, historical ${outcome.historical_rationale.length}, N5Q ${outcome.n5q_lawful.length}+${outcome.n5q_unlawful.length}, choice ${outcome.choice_lawful.length}+${outcome.choice_conditional.length}+${outcome.choice_contradiction.length}; failures=${outcome.failures.length}\n`);
    for (const failure of outcome.failures) process.stdout.write(`  FAIL: ${failure}\n`);
  }
  process.exit(outcome.pass ? 0 : 1);
}
void readFileSync;
