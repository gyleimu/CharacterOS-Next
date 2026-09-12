/* globals URL, AbortSignal, structuredClone, performance */
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { resolveProductConfigurationV0, processEnvironmentV0 } from '../../../product/sandbox/dist/product-configuration.js';
import { createProductTransportsV0 } from '../../../product/sandbox/dist/product-providers.js';
import { candidateFromRaw, CANDIDATE_KEYS, equal, expectedWire, hash, requestIdentity } from './identity.mjs';
import { comparePair, preparePair } from './harness.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
const protocol = JSON.parse(readFileSync(join(root, 'protocol.json'), 'utf8'));
const write = (name, value) => writeFileSync(join(root, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sourcePaths = ['identity.mjs', 'harness.mjs', 'collect.mjs', 'research.test.mjs', 'protocol.json'];
const productionPaths = [
  'product/sandbox/src/product-appraisal-provider.ts', 'product/sandbox/src/product-appraisal-prompt.ts',
  'product/sandbox/src/product-providers.ts', 'packages/runtime/src/providers/cognition/ollama-native-cognition-transport.ts',
  'packages/runtime/src/session/interactive-subject-runtime-v0.ts', 'packages/runtime/src/session/explicit-v4-session-authority-v0.ts',
  'packages/runtime/src/factual-event-appraisal/factual-event-appraisal-executor.ts'
];
function codeHashes() {
  return Object.fromEntries([...sourcePaths.map(path => [path, hash(readFileSync(join(root, path), 'utf8'))]), ...productionPaths.map(path => [path, hash(readFileSync(path, 'utf8'))])]);
}
async function metadata() {
  const effective = resolveProductConfigurationV0({ environment: processEnvironmentV0(), default_data_root: 'UNUSED_RESEARCH' });
  const endpoint = effective.endpoint.value.replace(/\/$/, '');
  const url = new URL(endpoint);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password, 'only local unauthenticated Ollama is authorized');
  const requestJson = async (path, init = {}) => {
    const response = await globalThis.fetch(endpoint + path, { ...init, signal: AbortSignal.timeout(10000) });
    assert.ok(response.ok, `metadata ${path}: ${response.status}`); return response.json();
  };
  const tags = await requestJson('/api/tags');
  const version = await requestJson('/api/version');
  const model = tags.models.find(entry => entry.name === effective.model.value);
  assert.ok(model, 'configured model is not installed');
  const show = await requestJson('/api/show', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: effective.model.value }) });
  const modelConfiguration = Object.fromEntries(['template', 'system', 'parameters', 'model_info', 'details', 'capabilities'].map(key => [key, show[key] ?? null]));
  const config = { base_url: endpoint, model: effective.model.value, timeout_ms: effective.timeout_ms.value, num_predict: 256, context_window_tokens: 4096 };
  return { config, provenance: { model: effective.model, endpoint: effective.endpoint, timeout: effective.timeout_ms }, model,
    environment: { provider_implementation: 'OllamaNativeCognitionTransportV0', implementation_source_hash: hash(readFileSync(productionPaths[3], 'utf8')),
      model_digest: model.digest, server_version: version.version, model_configuration: modelConfiguration, timeout_ms: config.timeout_ms,
      response_format: 'ABSENT', unspecified_options: 'Ollama server/model defaults under observed version, digest and /api/show configuration; no seed/format/keep_alive supplied' } };
}

if (process.argv[2] === '--freeze') {
  assert.equal(git('rev-parse', 'HEAD'), protocol.required_baseline);
  assert.equal(git('rev-parse', 'origin/main'), protocol.required_baseline);
  assert.equal(git('branch', '--show-current'), 'main');
  assert.equal(existsSync(join(root, 'calls.jsonl')), false, 'cannot refreeze after any live call');
  const meta = await metadata();
  write('freeze.json', { frozen_at: new Date().toISOString(), baseline: protocol.required_baseline, branch: 'main', origin_main: git('rev-parse', 'origin/main'), initial_worktree: 'CLEAN (verified before research files)', hashes: codeHashes(), metadata: meta, protocol });
  console.log(JSON.stringify({ frozen: true, model: meta.config.model, digest: meta.model.digest, planned_calls: protocol.planned_appraisal_calls }));
} else if (process.argv[2] === '--run') {
  const freeze = JSON.parse(readFileSync(join(root, 'freeze.json'), 'utf8'));
  assert.ok(equal(codeHashes(), freeze.hashes), 'frozen harness/prompt/production hashes changed');
  assert.equal(git('rev-parse', 'HEAD'), protocol.required_baseline);
  assert.equal(existsSync(join(root, 'calls.jsonl')), false, 'collection already started; never silently repeat inference');
  assert.ok(equal((await metadata()).environment, freeze.metadata.environment));
  mkdirSync(evidenceDir, { recursive: true });
  const config = freeze.metadata.config;
  const transports = createProductTransportsV0(config);
  let calls = 0;
  const rows = [];
  const journal = value => appendFileSync(join(root, 'calls.jsonl'), JSON.stringify(value) + '\n');
  let collectionFailure = null;
  for (const sample of protocol.samples) {
    const observations = [];
    try {
      const observedMeta = await metadata();
      assert.ok(equal(observedMeta.environment, freeze.metadata.environment), 'provider configuration changed');
      const pair = await preparePair(sample.text, async (side, request, context) => {
        assert.ok(calls < protocol.planned_appraisal_calls && calls < protocol.absolute_call_ceiling, 'call budget exhausted');
        const callId = `${sample.id}-${side}`;
        calls++;
        const observation = { call_id: callId, ordinal: calls, started_at: new Date().toISOString(), context, request, wire: null, raw_envelope: null, latency_ms: null, response: null, error: null };
        journal({ phase: 'START', call_id: callId, ordinal: calls, started_at: observation.started_at });
        const originalFetch = globalThis.fetch;
        let wireCalls = 0;
        globalThis.fetch = async (endpoint, init) => {
          wireCalls++;
          assert.equal(wireCalls, 1, 'no hidden native retries');
          assert.deepEqual(Object.keys(init).sort(), ['body', 'headers', 'method', 'signal']);
          observation.wire = { endpoint, method: init.method, headers: structuredClone(init.headers), body: JSON.parse(init.body) };
          const response = await originalFetch(endpoint, init);
          const originalJson = response.json.bind(response);
          // Read through, preserving the existing response parser and failure boundary.
          response.json = async () => { const body = await originalJson(); observation.raw_envelope = structuredClone(body); return body; };
          return response;
        };
        const start = performance.now();
        try { observation.response = await transports.appraisal.complete(request); }
        catch (error) { observation.error = { message: error.message, code: error.code ?? null }; throw error; }
        finally {
          observation.latency_ms = performance.now() - start;
          globalThis.fetch = originalFetch;
          observation.trace = transports.lastAppraisalTrace();
          observation.wire_calls = wireCalls;
          if (observation.wire) observation.identity = requestIdentity(observation.wire, freeze.metadata.environment);
          observations.push(observation);
          write(`evidence/${callId}.json`, observation);
          journal({ phase: 'END', call_id: callId, ordinal: calls, latency_ms: observation.latency_ms, error: observation.error });
        }
        assert.ok(equal(observation.wire, expectedWire(request, config)), 'actual request differs from complete declared identity');
        assert.equal(observation.trace.request_hash, hash(JSON.stringify(observation.wire.body)), 'wire hash must equal native terminal trace');
        return observation.response.content;
      }, `reuse-${sample.id.toLowerCase()}`);
      assert.ok(equal((await metadata()).environment, freeze.metadata.environment), 'provider changed during the pair');
      const [a, b] = observations;
      assert.ok(equal(a.identity, b.identity), 'exact request identity mismatch');
      const candidateA = await candidateFromRaw(a.response.content, a.context);
      const candidateB = await candidateFromRaw(b.response.content, b.context);
      const comparison = await comparePair(pair);
      writeFileSync(join(evidenceDir, `${sample.id}-state.json.gz`), gzipSync(JSON.stringify({ pair, comparison })), { flag: 'wx' });
      const fields = Object.fromEntries(CANDIDATE_KEYS.map(key => [key, { A: candidateA[key], B: candidateB[key], equal: candidateA[key] === candidateB[key], absolute_difference: key === 'attribution' ? null : Math.abs(candidateA[key] - candidateB[key]) }]));
      const row = { id: sample.id, category: sample.category, request_equal: equal(a.identity, b.identity), fingerprint_A: a.identity.fingerprint, fingerprint_B: b.identity.fingerprint,
        candidate_A: candidateA, candidate_B: candidateB, candidate_exact_equal: equal(candidateA, candidateB), fields,
        latency_A_ms: a.latency_ms, latency_B_ms: b.latency_ms, tokens_A: a.trace.ollama, tokens_B: b.trace.ollama,
        control_validation: comparison.control.status, reuse_validation: comparison.shadow.status,
        authority: comparison.authorityEqual ? 'AUTHORITY_EQUIVALENT' : 'AUTHORITY_DIVERGENT', canonical_equal: comparison.canonicalEqual,
        affect_equal: comparison.affectEqual, classification: comparison.classification, downstream: comparison.projectionEqual ? 'DOWNSTREAM_INPUT_IDENTICAL' : 'DOWNSTREAM_INPUT_DIFFERENT',
        pre_second_state_hash: comparison.control.preHash, canonical_control_hash: hash(comparison.control.after), canonical_shadow_hash: hash(comparison.shadow.after),
        projection_control_hash: hash(comparison.control.projection), projection_shadow_hash: hash(comparison.shadow.projection),
        canonical_differences: comparison.canonicalDiff, projection_differences: comparison.projectionDiff };
      write(`evidence/${sample.id}-result.json`, row); rows.push(row);
      console.log(JSON.stringify({ sample: sample.id, calls, candidate_equal: row.candidate_exact_equal, canonical_equal: row.canonical_equal, downstream: row.downstream, B_ms: row.latency_B_ms }));
    } catch (error) {
      collectionFailure = { sample: sample.id, message: error.message, calls };
      write(`evidence/${sample.id}-failure.json`, collectionFailure);
      console.log(JSON.stringify({ stopped: collectionFailure })); break;
    }
  }
  const actualCallFiles = readdirSync(evidenceDir).filter(name => /^S\d\d-[AB]\.json$/.test(name));
  assert.equal(actualCallFiles.length, calls, 'every attempted inference has durable terminal evidence');
  write('collection.json', { completed_at: new Date().toISOString(), planned_pairs: protocol.planned_pairs, calls, completed_pairs: rows.length, collection_failure: collectionFailure, samples: rows });
} else { throw new Error('Use --freeze (metadata only) then --run (at most 20 native inferences; no resume retries).'); }
