import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const qualification = JSON.parse(await readFile(resolve(here, 'qualification-summary.json'), 'utf8'));
if (qualification.all_qualification_passed) {
  throw new Error('formal collector intentionally refuses implicit execution; qualification passed and requires the frozen full collector');
}
const artifact = {
  schema_version: 'affect-cognition-c2-formal-collection-v0', status: 'NOT_RUN_QUALIFICATION_GATE_FAILED',
  qualification_freeze_hash: qualification.freeze_hash, qualification_passed: `${qualification.passed}/${qualification.total}`,
  formal_cognition_calls: 0, formal_language_calls: 0, reason: 'The frozen protocol requires all 65 qualification records to pass before any P/N/Z/A formal cell.'
};
await writeFile(resolve(here, 'formal-collection.json'), `${JSON.stringify(artifact, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);

