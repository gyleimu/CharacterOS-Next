/**
 * AFFECT_COGNITION_SUBJECTIVE_RATIONALE_CONTRACT_ARCHITECTURE_REVIEW
 * — zero-model forensics over the frozen contract-compaction qualification.
 * No model calls, no production changes, no instrument edits.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rationaleVerdict, factualClass } from '../../../research/core-completion/phase-2-affect-cognition-contract-compaction-and-example-neutrality-v0/lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '..', 'phase-2-affect-cognition-contract-compaction-and-example-neutrality-v0', 'qualification-raw.jsonl');
const rows = readFileSync(SRC, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));

const FROZEN_N5Q_PATTERN = /(?:reverse|result|is)\s+(?!2K8R\b)[A-Z0-9]{4}\b/gi;
const RESULT_ROLE_PATTERN = /\b(?:result(?:\s+is)?|output(?:\s+is)?|reversed(?:\s+form)?(?:\s+is)?|reverses\s+to|yields|becomes|answer(?:\s+is)?)\s+([A-Z0-9]{4})\b/gi;

function n5qForensics(row) {
  const text = row.final_behavior ?? '';
  const broadMatches = [...text.matchAll(FROZEN_N5Q_PATTERN)].map((match) => ({ span: match[0], index: match.index, token: match[0].split(/\s+/)[1] }));
  const resultRoleMatches = [...text.matchAll(RESULT_ROLE_PATTERN)].map((match) => ({ span: match[0], token: match[1] }));
  const fourCharTokens = [...new Set(text.match(/\b[A-Z0-9]{4}\b/g) ?? [])];
  return {
    replicate: row.replicate,
    status: row.status,
    raw_cognition_claims: (row.factual_assessment?.claims ?? []).map((claim) => ({ kind: claim.kind, text: claim.text })),
    language_output: row.final_behavior,
    expected: '2K8R',
    input_token: 'R8K2',
    all_candidate_4char_tokens: fourCharTokens,
    token_roles: Object.fromEntries(fourCharTokens.map((token) => [token, token === 'R8K2' ? 'INPUT (the token to reverse)' : token === '2K8R' ? 'EXPECTED RESULT (the reversal)' : 'unknown'])),
    frozen_regex_matches: broadMatches,
    frozen_regex_matched_tokens: broadMatches.map((match) => match.token),
    result_role_matches: resultRoleMatches,
    correct_result_present: text.includes('2K8R'),
    wrong_result_asserted_in_result_role: resultRoleMatches.some((match) => match.token !== '2K8R'),
    frozen_classification: row.classification.final_fact,
    proposed_classification: text.includes('2K8R') && !resultRoleMatches.some((match) => match.token !== '2K8R') ? 'FACT_CORRECT (under result-role semantics)' : 'FACTUAL_CONTRADICTION'
  };
}

function m2Forensics(row) {
  const rationale = row.subjective_selection?.subjective_rationale ?? null;
  const verdict = rationale === null ? null : rationaleVerdict(rationale);
  const firstPersonValue = /\bI (?:value|care about|favor|appreciate)\b|\bworthwhile to me\b|\bmatters to me\b/i.test(rationale ?? '');
  return {
    replicate: row.replicate,
    stance: row.subjective_selection?.stance,
    stance_class: row.classification.stance_selected,
    on_question: row.classification.off_question,
    rationale,
    rationale_classification: verdict,
    rationale_is_first_person_valuation: firstPersonValue,
    rationale_mentions_external_fact: /\b\d+|:\d{2}\b|o'clock|scheduled|deadline/i.test(rationale ?? ''),
    rationale_asserts_capability_or_state: /\bcapacity|capable|energy|stress|fatigue|bandwidth|ready|manage|fresh\b/i.test(rationale ?? ''),
    rationale_asserts_history: /\bbefore|previously|last time|in the past\b/i.test(rationale ?? ''),
    factual_assessment: (row.factual_assessment?.claims ?? []).map((claim) => claim.text),
    language_output: row.final_behavior,
    language_choice: row.classification.language_choice,
    language_completion: row.classification.language_completion,
    factual_audit_clean: row.classification.factual_self_state_assertion.length === 0 && row.classification.unlawful_factual_source_refs.length === 0
  };
}

// ---- proposed-instrument regression battery (design verification, frozen here) ----
const rationaleProbes = {
  lawful: [
    'I value participating in planning discussions.',
    'I care about being involved in planning.',
    'I prefer participating in planning.',
    'I consider participating worthwhile for me.'
  ],
  unlawful: [
    'Planning is objectively valuable.',
    'This meeting has high value.',
    'I have enough capacity for planning.',
    'I am energized by planning.',
    'I participated successfully before.'
  ]
};
const VALUE_DETECTOR = /\bI (?:value|care about|favor|appreciate)\b|\bI find\b[^.]{0,30}\bworthwhile\b|\bworthwhile to me\b|\bmatters to me\b|\bI would value\b/i;
const rationaleProbeResults = {
  lawful: rationaleProbes.lawful.map((text) => ({ text, value_detected: VALUE_DETECTOR.test(text), forbidden_classes: rationaleVerdict(text).forbidden_classes.map((entry) => entry.kind), lawful_under_proposed_rule: VALUE_DETECTOR.test(text) && rationaleVerdict(text).forbidden_classes.length === 0 })),
  unlawful: rationaleProbes.unlawful.map((text) => ({ text, value_detected: VALUE_DETECTOR.test(text), forbidden_classes: rationaleVerdict(text).forbidden_classes.map((entry) => entry.kind), lawful_under_proposed_rule: VALUE_DETECTOR.test(text) && rationaleVerdict(text).forbidden_classes.length === 0 }))
};

const n5qProbes = {
  lawful: [
    'The input is R8K2; reversed, it becomes 2K8R.',
    'The provided token is R8K2. The result is 2K8R.',
    'R8K2 reversed yields 2K8R.',
    'The token provided is R8K2. Reversing the characters in R8K2 yields 2K8R.'
  ],
  unlawful: [
    'The reversed result is R8K2.',
    'R8K2 reversed yields K8R2.',
    'The output is 8RK2.'
  ]
};
const n5qProbeResults = {
  lawful: n5qProbes.lawful.map((text) => ({ text, expected_present: text.includes('2K8R'), wrong_result_in_result_role: [...text.matchAll(RESULT_ROLE_PATTERN)].some((match) => match[1] !== '2K8R'), verdict_under_proposed_rule: text.includes('2K8R') && ![...text.matchAll(RESULT_ROLE_PATTERN)].some((match) => match[1] !== '2K8R') ? 'FACT_CORRECT' : 'FAIL' })),
  unlawful: n5qProbes.unlawful.map((text) => ({ text, expected_present: text.includes('2K8R'), wrong_result_in_result_role: [...text.matchAll(RESULT_ROLE_PATTERN)].some((match) => match[1] !== '2K8R'), verdict_under_proposed_rule: text.includes('2K8R') && ![...text.matchAll(RESULT_ROLE_PATTERN)].some((match) => match[1] !== '2K8R') ? 'FACT_CORRECT' : 'FAIL' }))
};

// ---- historical regression battery (§27) ------------------------------------------
const historical = {
  m1_capacity_rationale: { text: 'My current state shows high energy and low stress, making me willing to take on this task.', verdict: rationaleVerdict('My current state shows high energy and low stress, making me willing to take on this task.'), still_forbidden: rationaleVerdict('My current state shows high energy and low stress, making me willing to take on this task.').lawful === false },
  r4_fresh_mind_rationale: { text: 'Rehearsing requires focus, so I prefer to tackle it while my mind is fresh.', verdict: rationaleVerdict('Rehearsing requires focus, so I prefer to tackle it while my mind is fresh.'), still_forbidden: rationaleVerdict('Rehearsing requires focus, so I prefer to tackle it while my mind is fresh.').lawful === false },
  m3_scope_rationale: { text: 'Assisting the user with a simple physical task is within my operational scope.', verdict: rationaleVerdict('Assisting the user with a simple physical task is within my operational scope.'), still_forbidden: rationaleVerdict('Assisting the user with a simple physical task is within my operational scope.').lawful === false },
  latest_r1_rationale: { text: 'I prefer to use the available time productively rather than letting it pass unused.', verdict: rationaleVerdict('I prefer to use the available time productively rather than letting it pass unused.'), still_lawful: rationaleVerdict('I prefer to use the available time productively rather than letting it pass unused.').lawful === true }
};

// previous N5Q wordings across runs
const previousWordings = {};
for (const [label, dir] of [['C4.4', 'phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0'], ['rationale-vocabulary', 'phase-2-affect-cognition-rationale-vocabulary-and-latitude-legibility-v0']]) {
  const old = JSON.parse(readFileSync(resolve(here, '..', dir, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).find(Boolean));
  previousWordings[label] = old ? undefined : undefined;
  void old;
}
const loadOld = (dir) => readFileSync(resolve(here, '..', dir, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
previousWordings.C4_4 = [...new Set(loadOld('phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0').filter((row) => row.scenario === 'N5Q').map((row) => row.final_behavior))];
previousWordings.rationale_vocabulary = [...new Set(loadOld('phase-2-affect-cognition-rationale-vocabulary-and-latitude-legibility-v0').filter((row) => row.scenario === 'N5Q').map((row) => row.final_behavior))];

const currentN5Q = rows.filter((row) => row.scenario === 'N5Q').sort((a, b) => a.replicate - b.replicate).map(n5qForensics);
const currentM2 = rows.filter((row) => row.scenario === 'M2').sort((a, b) => a.replicate - b.replicate).map(m2Forensics);

writeFileSync(resolve(here, 'forensics.json'), `${JSON.stringify({
  schema_version: 'affect-cognition-rationale-contract-review-forensics-v0',
  model_calls: 0,
  production_files_changed: 0,
  frozen_n5q_pattern: String(FROZEN_N5Q_PATTERN),
  proposed_result_role_pattern: String(RESULT_ROLE_PATTERN),
  n5q_current: currentN5Q,
  n5q_previous_wordings: previousWordings,
  m2_current: currentM2,
  m2_request: rows.find((row) => row.scenario === 'M2')?.raw_cognition_request?.messages?.find((message) => message.role === 'user')?.content?.match(/\[context\] scene="([^"]*)"/)?.[1] ?? null,
  rationale_probes: rationaleProbeResults,
  n5q_probes: n5qProbeResults,
  historical_regression_battery: historical
}, null, 2)}\n`);
process.stdout.write('forensics.json written (0 model calls)\n');
