/* globals structuredClone */
import { createHash } from 'node:crypto';
import { createProductAppraisalProviderV0 } from '../../../product/sandbox/dist/product-appraisal-provider.js';
import { validateFactualEventAppraisalProposalV0 } from '../../../packages/appraisal/dist/index.js';

export const CANDIDATE_KEYS = ['relevance', 'goal_congruence', 'attribution', 'controllability', 'uncertainty', 'intensity', 'assessment_confidence'];
export const FIXED_CANDIDATE = Object.freeze({ relevance: 0.6, goal_congruence: 0.5, attribution: 'other', controllability: 0.5, uncertainty: 0.5, intensity: 0.4, assessment_confidence: 0.6 });
export function normalized(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(normalized).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${normalized(value[key])}`).join(',')}}`;
}
export const hash = value => `sha256:${createHash('sha256').update(typeof value === 'string' ? value : normalized(value)).digest('hex')}`;
export const equal = (a, b) => normalized(a) === normalized(b);

// Wire data, plus effective implementation/server/model configuration, not event metadata.
export function requestIdentity(wire, environment, fingerprint = hash) {
  const identity = normalized({ domain: 'appraisal-exact-input-reuse-shadow-v0/request/1', ...environment, request: wire });
  return Object.freeze({ fingerprint: fingerprint(identity), normalized_identity: identity });
}
export function expectedWire(request, config) {
  return { endpoint: `${config.base_url.replace(/\/$/, '')}/api/chat`, method: 'POST', headers: { 'content-type': 'application/json' }, body: {
    model: config.model, messages: request.messages.map(({ role, content }) => ({ role, content })),
    think: false, stream: false, options: { temperature: 0, num_predict: 256, num_ctx: 4096 }
  } };
}
export function adapterForRaw(raw) {
  return createProductAppraisalProviderV0({ transport: { complete: async () => ({ content: raw, model: 'research-replay' }) } }).provider;
}
export async function candidateFromRaw(raw, context) {
  // Reuse the actual product closed JSON parser AND the canonical range/enum validator.
  const proposal = await adapterForRaw(raw).proposeFactualEventAppraisal(context);
  const checked = validateFactualEventAppraisalProposalV0(proposal);
  if (!checked.ok || checked.value.status !== 'APPRAISED') throw new Error(`candidate invalid: ${checked.error?.detail ?? 'not APPRAISED'}`);
  return Object.freeze(Object.fromEntries(CANDIDATE_KEYS.map(key => [key, key === 'assessment_confidence' ? checked.value.assessment_confidence : checked.value.dimensions[key]])));
}

// Research-only, single-use, transient slot. No serialization or persistent lookup API.
export class TurnSlot {
  #scope;
  #entry = null;
  #closed = false;
  constructor(scope) { this.#scope = normalized(scope); }
  async offer(identity, raw, context) {
    this.#entry = null;
    if (this.#closed) return false;
    try {
      const candidate = await candidateFromRaw(raw, context);
      this.#entry = { ...identity, candidate };
      return true;
    } catch { return false; }
  }
  get(scope, identity) {
    const e = this.#entry;
    if (this.#closed || !e || this.#scope !== normalized(scope) || e.fingerprint !== identity.fingerprint || e.normalized_identity !== identity.normalized_identity) return null;
    return structuredClone(e.candidate);
  }
  close() { this.#entry = null; this.#closed = true; }
}

export async function inferIntoSlot(slot, identity, context, infer) {
  try { return await slot.offer(identity, (await infer()).content, context); }
  catch { slot.close(); return false; }
}
