/* globals URL */
/**
 * Analysis — frozen classification, direction assessment, aggregates.
 *
 * Pure offline: reads evidence/phase-b.json, writes comparison.json and
 * aggregate.json. No model calls. Classifications are applied by the
 * pre-registered classifier in lib/proposal.mjs; raw responses are stored
 * unmodified before interpretation (no post-hoc category invention).
 *
 * Usage: node analyze.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyPair } from './lib/proposal.mjs';
import { SCENARIOS } from './lib/config.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const phaseB = JSON.parse(readFileSync(join(root, 'evidence', 'phase-b.json'), 'utf8'));

const APPROACH = ['yes', 'willing', 'help', 'agree', 'proceed', 'go ahead', 'support', 'cover', 'accept', 'glad', 'happy', 'confident', 'recommend', 'encourage', 'positive'];
const CAUTION = ['decline', 'careful', 'cautious', 'hesitant', 'boundary', 'confirm', 'clarify', 'risk', 'unsure', 'uncertain', 'difficult', 'concern', 'check', 'considerate', 'gently', 'reserved', 'wary', 'limit'];

function lexicalScore(call) {
  const text = `${call.current_intent ?? ''} ${call.reasoning_summary ?? ''}`.toLowerCase();
  const approach = APPROACH.filter((word) => text.includes(word)).length;
  const caution = CAUTION.filter((word) => text.includes(word)).length;
  return { approach, caution, net: approach - caution, text };
}

function direction(scenario, full, baseline, classification, fullRepeatUnstable) {
  if (scenario.expected_direction === 'none — affect must not change the objective answer') {
    return { status: 'NO_DIRECTION_DEFINED', note: 'null control: objective answer assessed in Phase C language realization' };
  }
  if (fullRepeatUnstable) {
    return { status: 'NO_DIRECTION_DEFINED', note: 'FULL same-request repeat diverged; effect not separable from model variance' };
  }
  const positive = scenario.history === 'H_POS';
  const negative = scenario.history === 'H_NEG';
  if (!positive && !negative) return { status: 'NO_DIRECTION_DEFINED', note: 'no interpretable affect expectation' };
  if (classification !== 'MATERIAL_COGNITION_DIFFERENCE' && classification !== 'CONTRADICTORY_BEHAVIOR') {
    return { status: 'EXPECTED_DIRECTION_MISS', note: 'defined affect expectation but no material cognition difference observed' };
  }
  const fullScore = lexicalScore(full);
  const baseScore = lexicalScore(baseline);
  const expectedHigherApproach = positive;
  const delta = fullScore.net - baseScore.net;
  const match = expectedHigherApproach ? delta > 0 : delta < 0;
  return {
    status: match ? 'EXPECTED_DIRECTION_MATCH' : 'EXPECTED_DIRECTION_MISS',
    note: `lexical approach/caution net: FULL=${fullScore.net} baseline=${baseScore.net} delta=${delta}`,
    full_score: fullScore,
    baseline_score: baseScore
  };
}

function toProposal(call) {
  return {
    communication_directive: { kind: call.directive },
    cognition: {
      current_intent: call.current_intent,
      confidence: call.confidence,
      uncertainty: call.uncertainty,
      action_intent: call.action_intent
    }
  };
}

function classifyRecord(scenarioId, a, b) {
  if (!a.schema_valid || !b.schema_valid) {
    return { classification: 'INVALID_CALL', schema_valid: false, a_valid: a.schema_valid, b_valid: b.schema_valid };
  }
  return classifyPair(toProposal(a), toProposal(b));
}

const comparison = { schema_version: 'non-memory-ablation-comparison-v0', pairs: {}, repeats: {}, swaps: {} };

for (const scenario of SCENARIOS) {
  const record = phaseB.scenarios[scenario.id];
  const ab = classifyRecord(scenario.id, record.full, record.b);
  const ac = classifyRecord(scenario.id, record.full, record.c);
  const bc = classifyRecord(scenario.id, record.b, record.c);
  const repeatA = record.repeat_a ? classifyRecord(scenario.id, record.full, record.repeat_a) : null;
  const repeatB = record.repeat_b ? classifyRecord(scenario.id, record.b, record.repeat_b) : null;
  const fullRepeatUnstable = repeatA !== null && repeatA.classification === 'MATERIAL_COGNITION_DIFFERENCE';
  comparison.pairs[scenario.id] = {
    id: scenario.id,
    history: scenario.history,
    category: scenario.category,
    event: scenario.event,
    expected_direction: scenario.expected_direction,
    relevant_state: scenario.relevant_state,
    affect_before_turn: record.affect_before_turn,
    affect_line_at_cognition: record.full.affect_line,
    memory_section_equal_full_vs_b: record.full.memory_section_sha256 === record.b.memory_section_sha256,
    memory_section_equal_full_vs_c: record.full.memory_section_sha256 === record.c.memory_section_sha256,
    full: { directive: record.full.directive, current_intent: record.full.current_intent, confidence: record.full.confidence, uncertainty: record.full.uncertainty, reasoning_summary: record.full.reasoning_summary },
    b: { directive: record.b.directive, current_intent: record.b.current_intent, confidence: record.b.confidence, uncertainty: record.b.uncertainty, reasoning_summary: record.b.reasoning_summary },
    c: { directive: record.c.directive, current_intent: record.c.current_intent, confidence: record.c.confidence, uncertainty: record.c.uncertainty, reasoning_summary: record.c.reasoning_summary },
    A_vs_B: ab,
    A_vs_C: ac,
    B_vs_C: bc,
    full_repeat_unstable: fullRepeatUnstable,
    direction: direction(scenario, record.full, record.b, ab.classification, fullRepeatUnstable)
  };

  if (repeatA !== null) {
    comparison.repeats[scenario.id] = { A_vs_A_repeat: repeatA, B_vs_B_repeat: repeatB };
  }
  if (record.swap) {
    comparison.swaps[scenario.id] = {
      note: record.swap.note,
      original_affect_line: record.swap.original_affect_line,
      replacement_affect_line: record.swap.replacement_affect_line,
      X: { directive: record.swap.directive, current_intent: record.swap.current_intent, confidence: record.swap.confidence, uncertainty: record.swap.uncertainty, reasoning_summary: record.swap.reasoning_summary },
      A_vs_X: classifyRecord(scenario.id, record.full, record.swap)
    };
  }
}

function countBy(list) {
  const counts = {};
  for (const item of list) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
}

const abClasses = Object.values(comparison.pairs).map((pair) => pair.A_vs_B.classification);
const acClasses = Object.values(comparison.pairs).map((pair) => pair.A_vs_C.classification);
const repeatClasses = Object.values(comparison.repeats).flatMap((entry) => [entry.A_vs_A_repeat.classification, entry.B_vs_B_repeat.classification]);

const validAB = Object.values(comparison.pairs).filter((pair) => pair.A_vs_B.classification !== 'INVALID_CALL');
const validAC = Object.values(comparison.pairs).filter((pair) => pair.A_vs_C.classification !== 'INVALID_CALL');
const dCross = validAB.map((pair) => pair.A_vs_B.divergence);
const dCrossC = validAC.map((pair) => pair.A_vs_C.divergence);
const dSame = Object.values(comparison.repeats).flatMap((entry) => [entry.A_vs_A_repeat.divergence, entry.B_vs_B_repeat.divergence]);
const mean = (values) => (values.length === 0 ? null : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)));

const nullScenarios = ['S6', 'S7'];
const nullDistortion = nullScenarios.map((id) => {
  const pair = comparison.pairs[id];
  return {
    id,
    classification: pair.A_vs_B.classification,
    A_vs_C: pair.A_vs_C.classification,
    full_intent: pair.full.current_intent,
    b_intent: pair.b.current_intent
  };
});

const aggregate = {
  schema_version: 'non-memory-ablation-aggregate-v0',
  eligible_scenarios: SCENARIOS.length,
  completed_scenarios: Object.keys(comparison.pairs).length,
  invalid_calls: phaseB.total_cognition_calls - phaseB.valid_calls,
  total_cognition_calls: phaseB.total_cognition_calls,
  valid_cognition_calls: phaseB.valid_calls,
  A_vs_B_classifications: countBy(abClasses),
  A_vs_C_classifications: countBy(acClasses),
  B_vs_C_classifications: countBy(Object.values(comparison.pairs).map((pair) => pair.B_vs_C.classification)),
  repeat_classifications: countBy(repeatClasses),
  material_cognition_differences: {
    A_vs_B: abClasses.filter((value) => value === 'MATERIAL_COGNITION_DIFFERENCE').length,
    A_vs_C: acClasses.filter((value) => value === 'MATERIAL_COGNITION_DIFFERENCE').length
  },
  D_cross_A_vs_B_mean: mean(dCross),
  D_cross_A_vs_C_mean: mean(dCrossC),
  D_same_repeat_mean: mean(dSame),
  effect_vs_variance: {
    D_cross_A_vs_B: mean(dCross),
    D_same: mean(dSame),
    ratio: mean(dSame) === 0 || mean(dSame) === null ? null : Number((mean(dCross) / mean(dSame)).toFixed(4))
  },
  direction_outcomes: countBy(Object.values(comparison.pairs).map((pair) => pair.direction.status)),
  null_control_results: nullDistortion,
  swap_results: comparison.swaps,
  helpful_vs_unhelpful: {
    note: 'assigned in REPORT.md with quoted evidence; raw responses stored unmodified in raw-calls.jsonl'
  }
};

writeFileSync(join(root, 'evidence', 'comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`);
writeFileSync(join(root, 'evidence', 'aggregate.json'), `${JSON.stringify(aggregate, null, 2)}\n`);
console.log(JSON.stringify({ A_vs_B: aggregate.A_vs_B_classifications, A_vs_C: aggregate.A_vs_C_classifications, repeats: aggregate.repeat_classifications, D_cross: aggregate.D_cross_A_vs_B_mean, D_same: aggregate.D_same_repeat_mean, direction: aggregate.direction_outcomes }, null, 2));
