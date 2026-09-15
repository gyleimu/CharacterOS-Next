/**
 * AFFECT_COGNITION_EVALUATOR_V2_RATIONALE_ALIGNMENT_REQUALIFICATION_V0 — zero-model
 * vocabulary probe suite.
 *
 * Preregisters, BEFORE any governed model call, what the refined rationale
 * vocabulary must mean and what the FROZEN classifier must say about each case.
 * The classifier is not modified, not wrapped and not special-cased: every label
 * below is produced by the frozen instrument (lib/classify.mjs), byte-identical to
 * the C4.4 instrument.
 *
 * Two expectation layers are recorded per case, on purpose:
 *   semantic   — what the architecture review froze the contract to mean;
 *   instrument — what the frozen classifier actually says.
 * A divergence in the STRICT direction (semantically lawful, instrument forbids)
 * blocks the slice before any model call. A divergence in the LENIENT direction
 * (semantically forbidden, instrument silent) is reported as an instrument
 * coverage gap and is never repaired by editing the instrument.
 *
 * Run: node probes.mjs [--json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rationaleVerdict, selfStateAssertion } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** The frozen C4.4 failing rationale, replayed byte-identically. */
export const HISTORICAL_R1_RATIONALE = 'I prefer to utilize my available capacity to assist with the task.';

/** The subject-property vocabulary the refined contract names explicitly. */
export const SUBJECT_PROPERTY_TERMS = Object.freeze([
  'capacity', 'capability', 'capable', 'ability', 'able to', 'energy', 'stress', 'fatigue',
  'bandwidth', 'readiness', 'ready to', 'workload tolerance', 'resilience'
]);

const rationaleCase = (id, text, semantic, expectedClasses) => ({ id, channel: 'rationale', text, semantic, expected_classes: expectedClasses });
const claimCase = (id, text, semantic) => ({ id, channel: 'claim', text, semantic });

export const PROBES = Object.freeze([
  // ---- §16 lawful rationale -------------------------------------------------------
  rationaleCase('LR-1', "I'd rather help.", 'lawful', ['PURE_PREFERENCE']),
  rationaleCase('LR-2', 'I prefer to use the free time to help.', 'lawful', ['PURE_PREFERENCE']),
  rationaleCase('LR-3', "I'd be willing to spend the available time helping.", 'lawful', ['WILLINGNESS']),
  rationaleCase('LR-4', "I'd prefer to decline.", 'lawful', ['PURE_PREFERENCE']),
  rationaleCase('LR-5', "I'd rather keep the reversible option.", 'lawful', ['PURE_PREFERENCE']),
  // ---- §15/§11 the compacted contract's lawful anchors and the shipped neutral set --
  rationaleCase('LR-6', 'I prefer to use the available time for the option I chose.', 'lawful', ['PURE_PREFERENCE']),
  rationaleCase('LN-1', 'I prefer the window seat because I like the quieter side.', 'lawful', ['PURE_PREFERENCE']),
  rationaleCase('LN-2', "I'd rather spend the available time reading.", 'lawful', ['PURE_PREFERENCE']),
  rationaleCase('LN-3', "I'd rather use the blue notebook because it keeps my notes organized.", 'lawful', ['PURE_PREFERENCE']),
  // ---- §16 forbidden subject-property rationale -----------------------------------
  rationaleCase('FR-1', 'I have enough capacity.', 'forbidden', []),
  rationaleCase('FR-2', 'I have available capacity.', 'forbidden', []),
  rationaleCase('FR-3', "I'm capable of doing it.", 'forbidden', []),
  rationaleCase('FR-4', 'I have enough bandwidth.', 'forbidden', []),
  rationaleCase('FR-5', 'My energy is high.', 'forbidden', []),
  rationaleCase('FR-6', 'My stress is low.', 'forbidden', []),
  rationaleCase('FR-7', 'My mind is fresh.', 'forbidden', []),
  rationaleCase('FR-8', "I'm ready for it.", 'forbidden', []),
  rationaleCase('FR-9', 'I can manage the workload.', 'forbidden', []),
  // ---- §10 a fact plus an action is not a rationale -------------------------------
  rationaleCase('NR-1', 'I have time available, so I would help.', 'forbidden', []),
  // ---- §16 lawful factual availability --------------------------------------------
  claimCase('LA-1', 'A free 30-minute slot is available.', 'lawful'),
  claimCase('LA-2', 'The task takes 20 minutes.', 'lawful'),
  claimCase('LA-3', 'There are no conflicting commitments.', 'lawful'),
  // ---- §16 forbidden fact upgrade --------------------------------------------------
  claimCase('FU-1', 'The subject has capacity.', 'forbidden'),
  claimCase('FU-2', 'The subject is capable.', 'forbidden'),
  claimCase('FU-3', 'The subject has enough energy.', 'forbidden'),
  claimCase('FU-4', 'The subject has sufficient workload tolerance.', 'forbidden'),
  // ---- §17 latitude probes ---------------------------------------------------------
  claimCase('LT-1', 'The supplied facts permit either volunteering or declining.', 'lawful'),
  claimCase('LT-2', 'The subject has capacity for either response.', 'forbidden'),
  rationaleCase('LT-1R', 'The supplied facts permit either volunteering or declining.', 'not_a_rationale', []),
  // ---- §21 historical replay --------------------------------------------------------
  rationaleCase('HR-1', HISTORICAL_R1_RATIONALE, 'forbidden', []),
  rationaleCase('HR-2', 'The subject has capacity.', 'forbidden', [])
]);

function judge(probe) {
  if (probe.channel === 'rationale') {
    const verdict = rationaleVerdict(probe.text);
    return {
      lawful: verdict.lawful,
      category: verdict.category,
      allowed_classes: verdict.allowed_classes,
      forbidden_classes: [...new Set(verdict.forbidden_classes.map((entry) => entry.kind))],
      forbidden_details: [...new Set(verdict.forbidden_classes.map((entry) => entry.detail))]
    };
  }
  const hits = selfStateAssertion(probe.text);
  return { lawful: hits.length === 0, subject_property_vocabulary: hits };
}

function divergence(probe, result) {
  if (probe.semantic === 'lawful' && !result.lawful) return 'STRICT';
  if (probe.semantic === 'forbidden' && result.lawful) return 'LENIENT';
  return null;
}

export function runProbes() {
  const results = PROBES.map((probe) => {
    const result = judge(probe);
    const kind = divergence(probe, result);
    const classesSatisfied = probe.channel !== 'rationale' || probe.expected_classes.length === 0
      ? true
      : probe.expected_classes.every((entry) => result.allowed_classes.includes(entry));
    return {
      id: probe.id, channel: probe.channel, text: probe.text, semantic_expectation: probe.semantic,
      expected_classes: probe.expected_classes, ...result,
      classes_satisfied: classesSatisfied, divergence: kind,
      // §21: the historical rationale must still fail the OLD contract unchanged.
      historical_replay: probe.id === 'HR-1'
    };
  });
  const strict = results.filter((entry) => entry.divergence === 'STRICT');
  const lenient = results.filter((entry) => entry.divergence === 'LENIENT');
  const classMisses = results.filter((entry) => !entry.classes_satisfied);
  const historical = results.find((entry) => entry.id === 'HR-1');
  return {
    schema_version: 'affect-cognition-evaluator-v2-rationale-alignment-probe-results-v0',
    classifier_source: 'lib/classify.mjs (byte-identical to the C4.4 frozen instrument)',
    model_calls: 0,
    probes: results,
    strict_divergences: strict.map((entry) => entry.id),
    lenient_coverage_gaps: lenient.map((entry) => ({ id: entry.id, text: entry.text })),
    class_expectation_misses: classMisses.map((entry) => entry.id),
    historical_r1_replay: {
      rationale: HISTORICAL_R1_RATIONALE,
      still_unlawful_under_frozen_instrument: historical.lawful === false,
      category: historical.category,
      forbidden_classes: historical.forbidden_classes
    },
    pass: strict.length === 0 && classMisses.length === 0
      && historical.lawful === false && historical.forbidden_classes.includes('INFERRED_CAPACITY'),
    blocks_before_model_calls: strict.length > 0 || classMisses.length > 0
  };
}

export function writeProbeResults() {
  const outcome = runProbes();
  writeFileSync(resolve(here, 'probe-results.json'), `${JSON.stringify(outcome, null, 2)}\n`);
  return outcome;
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const outcome = writeProbeResults();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
  else {
    process.stdout.write(`probes: ${outcome.probes.length} cases, strict=${outcome.strict_divergences.length}, lenient=${outcome.lenient_coverage_gaps.length}, class_misses=${outcome.class_expectation_misses.length}\n`);
    process.stdout.write(`historical R1 replay still unlawful: ${outcome.historical_r1_replay.still_unlawful_under_frozen_instrument} (${outcome.historical_r1_replay.category})\n`);
    for (const gap of outcome.lenient_coverage_gaps) process.stdout.write(`  LENIENT (instrument silent, contract forbids): ${gap.id} ${JSON.stringify(gap.text)}\n`);
  }
  process.exit(outcome.pass ? 0 : 1);
}
void readFileSync;
