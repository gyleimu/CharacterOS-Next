/**
 * C4.2 — freeze the paraphrase safety suite (and the guard's token rule) BEFORE
 * the candidate guard is evaluated. Zero model calls.
 *
 * Records the digests of the suite and of the frozen token/stopword rule so the
 * one permitted design evaluation can be audited afterwards.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ACCEPTANCE_STANDARD, INVALID, LAWFUL, LEXICAL_CEILING_DIAGNOSTIC } from './paraphrase-suite.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sha = (value) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(here, '..', '..', '..'), encoding: 'utf8' }).trim();

const suiteSource = await readFile(resolve(here, 'paraphrase-suite.mjs'), 'utf8');
const guardSource = await readFile(resolve(here, 'lib/grounding-guard.mjs'), 'utf8');

const artifact = {
  schema_version: 'affect-cognition-c4-2-paraphrase-suite-freeze-v0',
  frozen_before_guard_evaluation: true,
  repository_head: head,
  model_calls: 0,
  suite: {
    lawful_examples: LAWFUL.length,
    invalid_examples: INVALID.length,
    lexical_ceiling_diagnostic_examples: LEXICAL_CEILING_DIAGNOSTIC.length,
    lawful_categories: [...new Set(LAWFUL.map((entry) => entry.category))],
    invalid_categories: [...new Set(INVALID.map((entry) => entry.category))],
    acceptance_standard: ACCEPTANCE_STANDARD,
    suite_sha256: sha(suiteSource)
  },
  guard_rule_under_evaluation: {
    definition: 'a SELECTED stance is grounded when it shares >= 1 content token with (turn request text UNION lawful claim texts)',
    content_token: 'lowercase [a-z0-9]{4,} run, excluding the frozen stopword/connector list',
    normalization: 'deterministic, no embeddings, no second model, no task taxonomy, no option list',
    guard_source_sha256: sha(guardSource),
    note: 'the rule and its stopword list were frozen together with the suite; no post-hoc tuning is permitted'
  }
};
await writeFile(resolve(here, 'paraphrase-suite-freeze.json'), `${JSON.stringify(artifact, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
