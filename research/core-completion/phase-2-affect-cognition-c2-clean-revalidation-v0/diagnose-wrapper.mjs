import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUALIFICATION_SCENARIOS } from './lib/config.mjs';
import { runCondition, stubCognitionTransport, stubLanguageTransport } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(await readFile(resolve(here, 'snapshot.json'), 'utf8'));
const freeze = JSON.parse(await readFile(resolve(here, 'qualification-freeze.json'), 'utf8'));
const result = await runCondition({ snapshot, scenario: QUALIFICATION_SCENARIOS[0], conditionId: 'A', cognitionTransport: stubCognitionTransport(), languageTransport: stubLanguageTransport(), sessionId: freeze.opaque_session_ids.N1[0] });
process.stdout.write(`${JSON.stringify({ status: result.status, failure: result.failure_detail, wrapper_error: result.wrapper_error, request: result.raw_cognition_request }, null, 2)}\n`);
