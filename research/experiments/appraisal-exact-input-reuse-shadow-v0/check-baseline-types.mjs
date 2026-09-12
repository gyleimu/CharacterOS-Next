/* globals URL */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// Read-only attribution of the auxiliary gate failure. No alternative compiler
// settings, source repair, declaration suppression or baseline artifact edits.
const root = fileURLToPath(new URL('./', import.meta.url));
const parsed = ts.getParsedCommandLineOfConfigFile('tsconfig.auxiliary.json', {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')); } });
assert.ok(parsed);
const includedExperimentFiles = parsed.fileNames.filter(path => path.replaceAll('\\', '/').includes('/appraisal-exact-input-reuse-shadow-v0/'));
assert.deepEqual(includedExperimentFiles, []);
const filesToCheck = ['research/experiments/familiarity-causal-behavior-v1/preflight.ts', 'tsconfig.auxiliary.json', 'tsconfig.base.json'];
const unchanged = filesToCheck.map(path => {
  const baseline = execFileSync('git', ['show', `ea7eb4b:${path}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
  const current = readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
  assert.equal(current, baseline); return { path, identical_to_required_HEAD: true };
});
const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ({
  code: d.code, file: d.file ? relative(process.cwd(), d.file.fileName).replaceAll('\\', '/') : null,
  line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
  message: ts.flattenDiagnosticMessageText(d.messageText, '\n')
}));
assert.equal(diagnostics.length, 3);
assert.ok(diagnostics.every(d => d.code === 2883 && d.file === filesToCheck[0] && d.line === 74));
const proof = { result: 'BASELINE_AUXILIARY_FAILURE_CONFIRMED', compiler: ts.version, new_experiment_files_in_typecheck_program: includedExperimentFiles, unchanged, diagnostics, production_source_changes: execFileSync('git', ['diff', '--name-only', '--', 'packages', 'product'], { encoding: 'utf8' }).trim() };
assert.equal(proof.production_source_changes, '');
writeFileSync(join(root, 'baseline-types.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ result: proof.result, diagnostics: diagnostics.length, new_experiment_files_in_typecheck_program: 0 }));
