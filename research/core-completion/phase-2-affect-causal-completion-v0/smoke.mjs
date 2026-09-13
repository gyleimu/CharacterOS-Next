/* globals URL */
/**
 * AFFECT_CAUSAL_COMPLETION_V0 — one-call provider smoke check (NOT evidence).
 * Validates transport, prompt shape, parsing and latency before the run of record.
 *
 * Usage: node smoke.mjs
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { PROVIDER } from './lib/config.mjs';
import { parseConversationProposal } from './lib/proposal.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const base = JSON.parse(readFileSync(join(root, 'evidence', 'base-requests.json'), 'utf8'))['S1_AMBIGUOUS_REQUEST'];
const transport = new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url,
  model: PROVIDER.model,
  timeout_ms: PROVIDER.timeout_ms,
  num_predict: PROVIDER.cognition_num_predict,
  context_window_tokens: PROVIDER.context_window_tokens
});

const started = Date.now();
const response = await transport.complete({
  messages: [
    { role: 'system', content: base.systemContent },
    { role: 'user', content: base.variants.P.userContent }
  ]
});
const parsed = parseConversationProposal(response.content, base.projectionHash);
console.log(
  JSON.stringify(
    {
      latency_ms: Date.now() - started,
      schema_valid: parsed.ok,
      directive: parsed.ok ? parsed.proposal.communication_directive.kind : null,
      current_intent: parsed.ok ? parsed.proposal.cognition.current_intent : null,
      parse_error: parsed.ok ? null : parsed.error,
      raw_head: String(response.content).slice(0, 400)
    },
    null,
    2
  )
);
