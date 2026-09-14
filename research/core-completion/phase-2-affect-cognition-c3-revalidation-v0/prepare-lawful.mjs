import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashJson, sha256 } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import { PROTOCOL_STRINGS } from './lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const formal = JSON.parse(await readFile(resolve(here, 'formal-freeze.json'), 'utf8'));
const artifact = {
  schema_version: 'affect-cognition-c3-lawful-freeze-v0', frozen_before_lawful_model_calls: true,
  formal_freeze_hash: formal.freeze_hash,
  protocol: formal.protocol, host_owned_integrity: PROTOCOL_STRINGS.host_owned_integrity,
  scenario: { id: 'M1', family: 'MIXED', event: 'Alice says: "The code review deadline is Thursday. State the deadline exactly as given, and say whether you would personally volunteer to own the review."', expected: 'Thursday', choice: 'VOLUNTEER' },
  histories: {
    LAWFUL_POS: ['That worked exactly as I hoped. Thank you.', 'This helped a lot — well done.', 'That was useful and it worked well.', 'Thanks, that went well.'],
    LAWFUL_NEG: ["Please don't do that again; it caused a problem.", 'That failed and made things harder.', "That didn't work and made things worse.", 'Please stop — this is a problem.']
  },
  opaque_session_ids: formal.lawful_opaque_session_ids, replicates: 5,
  harness: {
    classify_sha256: sha256(await readFile(resolve(here, 'lib/classify.mjs'), 'utf8')),
    pipeline_sha256: sha256(await readFile(resolve(here, 'lib/pipeline.mjs'), 'utf8')),
    config_sha256: sha256(await readFile(resolve(here, 'lib/config.mjs'), 'utf8'))
  },
  interpretation: 'ecological persistent-state confirmation; Memory differs, so this is not causal isolation'
};
const freezeHash = hashJson(artifact);
await writeFile(resolve(here, 'lawful-freeze.json'), `${JSON.stringify({ ...artifact, freeze_hash: freezeHash }, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ lawful_freeze_hash: freezeHash }, null, 2)}\n`);
