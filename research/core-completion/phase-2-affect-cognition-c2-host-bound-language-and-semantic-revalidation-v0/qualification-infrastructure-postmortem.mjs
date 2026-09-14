import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rows = (await readFile(resolve(here, 'qualification-raw.jsonl'), 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const artifact = {
  schema_version: 'affect-cognition-c2-qualification-infrastructure-postmortem-v0', immutable_raw_evidence_preserved: true,
  attempted_runtime_cognition_boundaries: rows.reduce((sum, row) => sum + row.cognition_calls, 0),
  observed_provider_terminal_traces: rows.reduce((sum, row) => sum + row.cognition_trace.length, 0),
  observed_raw_provider_responses: rows.filter((row) => row.raw_cognition_response !== null).length,
  observed_language_calls: rows.reduce((sum, row) => sum + row.language_calls, 0),
  common_failure: [...new Set(rows.map((row) => row.failure_detail))],
  root_cause: 'The frozen research wrapper referenced removed_indices instead of removedIndices while building request attestation. The ReferenceError occurred before the real transport call.',
  diagnostic_reproduction: 'A zero-model-call stub reproduction returned ReferenceError: removed_indices is not defined.',
  disposition: 'The wrapper typo is corrected for future code and lawful confirmation. Qualification is not rerun or replaced because the frozen retry policy is zero; formal matrix remains stopped.',
  principal_effect: 'No qualification semantic evidence exists; revalidation is inconclusive rather than a factual, language-fidelity, subjective, or clarification failure.'
};
await writeFile(resolve(here, 'qualification-infrastructure-postmortem.json'), `${JSON.stringify(artifact, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);

