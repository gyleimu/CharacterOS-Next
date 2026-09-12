/* globals URL */
/** Compute the frozen-protocol hash and harness file digests → freeze.json. */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './lib/hash.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const files = ['protocol.json', 'lib/config.mjs', 'lib/ablation.mjs', 'lib/proposal.mjs', 'lib/appraisal.mjs', 'lib/transports.mjs', 'lib/hash.mjs', 'grow.mjs', 'phase-a.mjs', 'run.mjs', 'realize.mjs', 'analyze.mjs', 'research.test.mjs'];

const freeze = {
  schema_version: 'non-memory-ablation-freeze-v0',
  experiment_id: 'NON_MEMORY_STATE_VALUE_ABLATION_V0',
  repository_head_at_freeze: '7999f6a01538888e714b1f350d93ff48f0239efc',
  protocol_sha256: sha256(readFileSync(join(root, 'protocol.json'), 'utf8')),
  files: Object.fromEntries(files.map((file) => [file, sha256(readFileSync(join(root, file), 'utf8'))]))
};

writeFileSync(join(root, 'freeze.json'), `${JSON.stringify(freeze, null, 2)}\n`);
console.log(`freeze: protocol ${freeze.protocol_sha256}`);
