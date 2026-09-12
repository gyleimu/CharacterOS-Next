/* globals URL, AbortSignal, performance, structuredClone */
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { resolveProductConfigurationV0, processEnvironmentV0 } from '../../../product/sandbox/dist/product-configuration.js';
import { createProductTransportsV0 } from '../../../product/sandbox/dist/product-providers.js';
import { CANDIDATE_KEYS, equal, expectedWire, hash, requestIdentity } from '../appraisal-exact-input-reuse-shadow-v0/identity.mjs';
import { candidateCheck, comparePair, runBaselinePair } from './harness.mjs';

const root = fileURLToPath(new URL('./', import.meta.url)), priorRoot = fileURLToPath(new URL('../appraisal-exact-input-reuse-shadow-v0/', import.meta.url));
const read = name => JSON.parse(readFileSync(join(root, name), 'utf8'));
const write = (name, value) => writeFileSync(join(root, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const zipped = (name, value) => writeFileSync(join(root, name), gzipSync(JSON.stringify(value)), { flag: 'wx' });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const protocol = read('protocol.json');
const productionPaths = ['product/sandbox/src/product-appraisal-provider.ts', 'product/sandbox/src/product-appraisal-prompt.ts', 'product/sandbox/src/product-providers.ts', 'packages/runtime/src/providers/cognition/ollama-native-cognition-transport.ts', 'packages/runtime/src/session/interactive-subject-runtime-v0.ts', 'packages/runtime/src/session/explicit-v4-session-authority-v0.ts', 'packages/runtime/src/factual-event-appraisal/factual-event-appraisal-executor.ts'];
function sourceHashes() {
  return Object.fromEntries([...['protocol.json', 'harness.mjs', 'research.test.mjs', 'collect.mjs'].map(p => [p, hash(readFileSync(join(root, p), 'utf8'))]), ...productionPaths.map(p => [p, hash(readFileSync(p, 'utf8'))])]);
}
async function metadata() {
  const effective = resolveProductConfigurationV0({ environment: processEnvironmentV0(), default_data_root: 'UNUSED_RESEARCH' });
  const endpoint = effective.endpoint.value.replace(/\/$/, ''), url = new URL(endpoint);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password);
  const request = async (path, init = {}) => { const res = await globalThis.fetch(endpoint + path, { ...init, signal: AbortSignal.timeout(10000) }); assert.ok(res.ok); return res.json(); };
  const tags = await request('/api/tags'), version = await request('/api/version');
  const model = tags.models.find(m => m.name === effective.model.value); assert.ok(model, 'local configured model unavailable');
  const show = await request('/api/show', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: effective.model.value }) });
  const config = { base_url: endpoint, model: effective.model.value, timeout_ms: effective.timeout_ms.value, num_predict: 256, context_window_tokens: 4096 };
  return { config, model, provenance: { model: effective.model, endpoint: effective.endpoint, timeout: effective.timeout_ms }, environment: {
    provider_implementation: 'OllamaNativeCognitionTransportV0', implementation_source_hash: hash(readFileSync(productionPaths[3], 'utf8')),
    model_digest: model.digest, server_version: version.version,
    model_configuration: Object.fromEntries(['template', 'system', 'parameters', 'model_info', 'details', 'capabilities'].map(key => [key, show[key] ?? null])),
    timeout_ms: config.timeout_ms, response_format: 'ABSENT',
    unspecified_options: 'Ollama server/model defaults under observed version, digest and /api/show configuration; no seed/format/keep_alive supplied'
  } };
}
function assertBaseline() {
  assert.equal(git('rev-parse', 'HEAD'), protocol.baseline); assert.equal(git('branch', '--show-current'), 'main');
  assert.equal(git('diff', protocol.baseline, '--name-only', '--', 'packages', 'product', 'research/experiments/appraisal-exact-input-reuse-shadow-v0'), '');
}
if (process.argv[2] === '--freeze') {
  assertBaseline(); assert.equal(existsSync(join(root, 'calls.jsonl')), false);
  const prior = JSON.parse(readFileSync(join(priorRoot, 'evidence/S06-A.json'), 'utf8'));
  const failure = await candidateCheck(prior.response.content, prior.context);
  assert.equal(failure.valid, false); assert.equal(prior.response.content, prior.raw_envelope.message.content);
  assert.ok(prior.request.messages[0].content.includes('goal_congruence'));
  const observed = await metadata();
  const v0Freeze = JSON.parse(readFileSync(join(priorRoot, 'freeze.json'), 'utf8'));
  assert.ok(equal(observed.environment, v0Freeze.metadata.environment), 'main V1 provider must match the V0 observed provider/configuration');
  write('freeze.json', { frozen_at: new Date().toISOString(), baseline: protocol.baseline, branch: 'main', origin_main: git('rev-parse', 'origin/main'), starting_worktree: 'CLEAN before V1 creation', source_hashes: sourceHashes(), v0_tree: git('rev-parse', `${protocol.baseline}:research/experiments/appraisal-exact-input-reuse-shadow-v0`), metadata: observed, v0_failure_classification: 'MODEL_SCHEMA_VIOLATION', v0_failure_parse: failure, protocol });
  console.log(JSON.stringify({ frozen: true, target_pairs: 15, max_calls: 40, model: observed.config.model, V0_unchanged: true }));
} else if (process.argv[2] === '--run') {
  assertBaseline(); const freeze = read('freeze.json');
  assert.ok(equal(sourceHashes(), freeze.source_hashes)); assert.equal(existsSync(join(root, 'calls.jsonl')), false, 'collection already started: never repeat inference');
  mkdirSync(join(root, 'evidence'), { recursive: true });
  const transport = createProductTransportsV0(freeze.metadata.config);
  const rows = []; let calls = 0, completed = 0, stop = null;
  const journal = value => appendFileSync(join(root, 'calls.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n');
  for (const sample of protocol.samples) {
    if (completed >= protocol.target_completed_valid_pairs) { stop = { kind: 'TARGET_COMPLETE', completed }; break; }
    if (calls + 2 > protocol.maximum_appraisal_inferences) { stop = { kind: 'BUDGET_BOUNDARY', calls }; break; }
    const observations = [];
    try {
      assert.ok(equal((await metadata()).environment, freeze.metadata.environment), 'provider configuration drift');
      const pair = await runBaselinePair(sample, async (side, request, context) => {
        const id = `${sample.id}-${side}`;
        assert.ok(calls < protocol.maximum_appraisal_inferences);
        calls++;
        const observation = { id, ordinal: calls, started_at: new Date().toISOString(), request, context, wire: null, raw_envelope: null, response: null, error: null };
        journal({ phase: 'INFERENCE_START', id, ordinal: calls });
        const originalFetch = globalThis.fetch; let wireCalls = 0, overhead = 0;
        globalThis.fetch = async (endpoint, init) => {
          const beforeCapture = performance.now();
          wireCalls++; assert.equal(wireCalls, 1); assert.deepEqual(Object.keys(init).sort(), ['body', 'headers', 'method', 'signal']);
          observation.wire = { endpoint, method: init.method, headers: structuredClone(init.headers), body: JSON.parse(init.body) };
          overhead += performance.now() - beforeCapture;
          const response = await originalFetch(endpoint, init), originalJson = response.json.bind(response);
          response.json = async () => { const body = await originalJson(); const beforeCopy = performance.now(); observation.raw_envelope = structuredClone(body); overhead += performance.now() - beforeCopy; return body; };
          return response;
        };
        const started = performance.now();
        try { observation.response = await transport.appraisal.complete(request); }
        catch (error) { observation.error = { name: error.name, code: error.code ?? null, message: error.message }; throw error; }
        finally {
          observation.client_latency_ms = performance.now() - started;
          globalThis.fetch = originalFetch;
          observation.instrumentation_measured_ms = overhead;
          observation.latency_ms = Math.max(0, observation.client_latency_ms - overhead);
          observation.trace = transport.lastAppraisalTrace(); observation.wire_calls = wireCalls;
          if (observation.wire) observation.identity = requestIdentity(observation.wire, freeze.metadata.environment);
          observations.push(observation); write(`evidence/${id}.json`, observation);
          journal({ phase: 'INFERENCE_END', id, ordinal: calls, latency_ms: observation.latency_ms, error: observation.error });
        }
        assert.ok(equal(observation.wire, expectedWire(request, freeze.metadata.config)));
        assert.equal(observation.trace.request_hash, hash(JSON.stringify(observation.wire.body)));
        return observation.response.content;
      }, async state => {
        zipped(`evidence/${sample.id}-S.json.gz`, state);
        journal({ phase: 'PRE_B_STATE_PERSISTED', id: sample.id, state_hash: hash(state) });
      });
      zipped(`evidence/${sample.id}-baseline.json.gz`, pair);
      assert.ok(equal((await metadata()).environment, freeze.metadata.environment), 'provider drift during sample');
      const a = observations[0], b = observations[1] ?? null;
      const checkedA = a.response ? await candidateCheck(a.response.content, a.context) : { valid: false, candidate: null, error: a.error };
      const checkedB = b?.response ? await candidateCheck(b.response.content, b.context) : { valid: false, candidate: null, error: b?.error ?? 'NOT_REACHED' };
      const row = { id: sample.id, category: sample.category, stage: pair.beforeSecond ? 'PAIRED_EVALUATION' : 'FIRST_INFERENCE_FAILED',
        candidate_A: checkedA, candidate_B: checkedB, transport_error_A: a.error, transport_error_B: b?.error ?? null,
        request_equal: b ? equal(a.identity, b.identity) : null, event_identities_differ: b ? a.context.factual_event_ref !== b.context.factual_event_ref : null,
        fingerprint_A: a.identity?.fingerprint, fingerprint_B: b?.identity?.fingerprint ?? null,
        latency_A_ms: a.latency_ms, latency_B_ms: b?.latency_ms ?? null, tokens_A: a.trace.ollama, tokens_B: b?.trace.ollama ?? null,
        semantic_entries: pair.semanticEntries, baseline_status: pair.second.status, baseline_failure: pair.second.failure,
        completed_valid_pair: false, candidate_exact_equal: null, fields: null, authority_equal: null, canonical_equal: null, affect_equal: null, downstream: null, classifications: [], material: false };
      if (b) {
        assert.ok(row.request_equal && row.event_identities_differ, 'request/event identity failure');
        const comparison = await comparePair(pair, a.identity);
        zipped(`evidence/${sample.id}-comparison.json.gz`, comparison);
        row.completed_valid_pair = checkedA.valid && checkedB.valid;
        row.candidate_exact_equal = row.completed_valid_pair ? equal(checkedA.candidate, checkedB.candidate) : false;
        row.fields = row.completed_valid_pair ? Object.fromEntries(CANDIDATE_KEYS.map(key => [key, { A: checkedA.candidate[key], B: checkedB.candidate[key], equal: checkedA.candidate[key] === checkedB.candidate[key], absolute_difference: key === 'attribution' ? null : Math.abs(checkedA.candidate[key] - checkedB.candidate[key]) }])) : null;
        Object.assign(row, { authority_equal: comparison.authorityEqual, canonical_equal: comparison.canonicalEqual, affect_equal: comparison.affectEqual, downstream: comparison.projectionEqual ? 'DOWNSTREAM_EQUIVALENT' : 'DOWNSTREAM_DIVERGENT', classifications: comparison.classifications, material: comparison.material,
          validation_control: comparison.control.validations, validation_reuse: comparison.shadow.validations,
          control_status: comparison.control.status, shadow_status: comparison.shadow.status, pre_state_hash: comparison.control.preHash,
          canonical_differences: comparison.canonicalDiff, projection_differences: comparison.projectionDiff });
        if (row.completed_valid_pair) completed++;
      } else { assert.equal(checkedA.valid, false); assert.equal(pair.second.status, 'FAILED'); }
      write(`evidence/${sample.id}-result.json`, row); rows.push(row);
      console.log(JSON.stringify({ id: sample.id, calls, completed_pairs: completed, stage: row.stage, candidate_equal: row.candidate_exact_equal, material: row.material, B_ms: row.latency_B_ms }));
      if (row.material) { stop = { kind: 'MATERIAL_PAIRED_DIVERGENCE', sample: sample.id, classifications: row.classifications }; break; }
      if (a.error || b?.error) { stop = { kind: 'PROVIDER_INFRASTRUCTURE_FAILURE', sample: sample.id }; break; }
    } catch (error) {
      stop = { kind: 'INFRASTRUCTURE_OR_IDENTITY_FAILURE', sample: sample.id, message: error.message, calls };
      write(`evidence/${sample.id}-fatal.json`, stop); console.log(JSON.stringify(stop)); break;
    }
  }
  if (!stop) stop = { kind: completed >= protocol.target_completed_valid_pairs ? 'TARGET_COMPLETE' : 'FIXED_POOL_EXHAUSTED', completed };
  assert.equal(readdirSync(join(root, 'evidence')).filter(name => /^V1\d\d-[AB]\.json$/.test(name)).length, calls);
  assertBaseline();
  write('collection.json', { completed_at: new Date().toISOString(), calls, completed_valid_pairs: completed, evaluated_pairs: rows.filter(r => r.stage === 'PAIRED_EVALUATION').length, started_samples: rows.length, stop, samples: rows });
  console.log(JSON.stringify({ completed: true, calls, valid_pairs: completed, stop }));
} else { throw new Error('Use --freeze, then --run. Never repeat or overwrite started collection.'); }
