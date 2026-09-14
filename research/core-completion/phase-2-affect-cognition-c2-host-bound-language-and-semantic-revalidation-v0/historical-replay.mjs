import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { factualClass, choiceClass, unsupportedPremises } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const initialRows = (await readFile(resolve(here, '..', 'phase-2-affect-authority-contract-revalidation-v0', 'evidence', 'raw-cognition.jsonl'), 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const remediationRows = (await readFile(resolve(here, '..', 'phase-2-affect-authority-revalidation-remediation-v0', 'raw-cognition.jsonl'), 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const select = (rows, predicate) => rows.find(predicate);
const hash = select(remediationRows, (r) => r.scenario === 'N6' && r.condition === 'P' && r.replicate === 3);
const contradiction = select(initialRows, (r) => r.scenario === 'N6' && /not a MATCH/i.test(r.final_behavior ?? ''));
const repetition = select(remediationRows, (r) => r.scenario === 'N4' && /What code is printed\?$/i.test(r.final_behavior ?? ''));
const m1 = { final_behavior: 'The code review deadline is Thursday.' };
const m2 = select(remediationRows, (r) => r.scenario === 'M2_TIME_AND_ATTENDANCE' && /express(?:ing)? a preference/i.test(r.current_intent ?? ''));
const s1 = select(remediationRows, (r) => r.scenario === 'S1_AMBIGUOUS_REQUEST' && /capacity|workload/i.test(r.final_behavior ?? ''));
const artifact = {
  schema_version: 'affect-cognition-c2-historical-replay-v0', diagnostic_only: true, historical_outputs_rewritten: false,
  cases: {
    N6_BAD_LANGUAGE_HASH: { source: 'phase-2-affect-authority-revalidation-remediation-v0', original: hash, old_result: 'LANGUAGE_REJECTED_INPUT_HASH', c2_result: 'RENDERED_IMPOSSIBLE_MODEL_HAS_NO_HASH_FIELD' },
    N6_CONTRADICTION: { source: 'phase-2-affect-authority-contract-revalidation-v0', original: contradiction, new_adjudication: factualClass({ id: 'N6', expected: 'MATCH' }, contradiction.final_behavior), c2_result: 'REJECT_AS_FACTUAL_CONTRADICTION_IF_EMITTED' },
    N4_QUESTION_REPETITION: { source: 'phase-2-affect-authority-revalidation-remediation-v0', original: repetition, new_adjudication: factualClass({ id: 'N4', expected: 'K7' }, repetition.final_behavior), c2_result: 'REJECT_AS_QUESTION_REPETITION' },
    M1_FACTUAL_ONLY: { original: m1, new_adjudication: choiceClass('VOLUNTEER', m1.final_behavior), c2_result: 'REJECT_INCOMPLETE_CHOICE' },
    M2_LANGUAGE_SELECTED: { source: 'phase-2-affect-authority-revalidation-remediation-v0', original: m2, new_adjudication: { cognition_choice: choiceClass('ATTEND', m2.current_intent), language_choice: choiceClass('ATTEND', m2.final_behavior) }, c2_result: 'INVALID_UNRESOLVED_V3_INTENT_BEFORE_LANGUAGE' },
    S1_UNSUPPORTED_REASON: { source: 'phase-2-affect-authority-revalidation-remediation-v0', original: s1, new_adjudication: unsupportedPremises(s1.current_intent, s1.final_behavior), c2_result: 'REJECT_AS_UNSUPPORTED_REASON_IF_PRESENT' }
  }
};
await writeFile(resolve(here, 'historical-replay.json'), `${JSON.stringify(artifact, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify(Object.fromEntries(Object.entries(artifact.cases).map(([k, v]) => [k, v.c2_result ?? v.new_adjudication])), null, 2)}\n`);
