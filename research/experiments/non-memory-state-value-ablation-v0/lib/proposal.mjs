/**
 * Production-faithful proposal parsing/validation and the frozen A/B
 * classifier. The parser reproduces `parseConversationProposal` from
 * packages/runtime/src/providers/behavior/conversation-cognition-provider.ts
 * (same key set, schema, directive validation, ref canonicalization, cognition
 * validation, projection-hash binding, null action_intent).
 */

import { validateCognitionProposal } from '../../../../packages/runtime/dist/index.js';
import { canonicalizeSetLikeRefFields } from '../../../../packages/runtime/dist/providers/cognition/wire-format-canonicalization.js';
import { validateCommunicationDirectiveV0 } from '../../../../packages/behavior/dist/index.js';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseConversationProposal(content, projectionHash) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return { ok: false, error: `MODEL_SCHEMA_INVALID: not strict JSON (${error.message})` };
  }
  if (!isRecord(parsed)) return { ok: false, error: 'MODEL_SCHEMA_INVALID: expected object' };
  const keys = Object.keys(parsed).sort();
  const expected = ['communication_directive', 'cognition', 'schema_version'].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, error: `MODEL_SCHEMA_INVALID: unexpected keys ${keys.join(',')}` };
  }
  if (parsed.schema_version !== 'conversation-cognition-proposal-v1') {
    return { ok: false, error: 'MODEL_SCHEMA_INVALID: wrong conversation proposal schema_version' };
  }
  const directiveCheck = validateCommunicationDirectiveV0(parsed.communication_directive);
  if (!directiveCheck.ok) return { ok: false, error: `MODEL_SCHEMA_INVALID: directive ${directiveCheck.detail}` };
  const cognitionCheck = validateCognitionProposal(canonicalizeSetLikeRefFields(parsed.cognition));
  if (!cognitionCheck.ok) return { ok: false, error: `MODEL_SCHEMA_INVALID: cognition ${cognitionCheck.error.detail}` };
  const cognition = cognitionCheck.value;
  if (cognition.projection_hash !== projectionHash) {
    return { ok: false, error: 'PROJECTION_HASH_MISMATCH' };
  }
  if (cognition.action_intent !== null) {
    return { ok: false, error: 'MODEL_SCHEMA_INVALID: action_intent must be null' };
  }
  return {
    ok: true,
    proposal: {
      schema_version: 'conversation-cognition-proposal-v1',
      cognition,
      communication_directive: directiveCheck.directive
    }
  };
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'you', 'your', 'their', 'them', 'they',
  'should', 'would', 'could', 'can', 'will', 'about', 'from', 'into', 'not', 'but',
  'are', 'was', 'were', 'have', 'has', 'had', 'its', 'it', 'his', 'her', 'she', 'him',
  'what', 'which', 'when', 'where', 'how', 'why', 'who', 'there', 'here', 'then',
  'than', 'some', 'any', 'all', 'one', 'two', 'out', 'now', 'also', 'just'
]);

export function tokens(text) {
  if (text === null || text === undefined) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

export function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function normIntent(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Frozen classifier. Both inputs are validated proposal objects.
 * Returns { classification, directive_equal, intent_equal, intent_jaccard,
 *           delta_confidence, delta_uncertainty, divergence }.
 */
export function classifyPair(a, b) {
  const directiveEqual = a.communication_directive.kind === b.communication_directive.kind;
  const actionEqual = a.cognition.action_intent === b.cognition.action_intent;
  const intentA = normIntent(a.cognition.current_intent);
  const intentB = normIntent(b.cognition.current_intent);
  const intentEqual = intentA === intentB;
  const intentJaccard = jaccard(tokens(intentA), tokens(intentB));
  const deltaConfidence = Math.abs(a.cognition.confidence - b.cognition.confidence);
  const deltaUncertainty = Math.abs(a.cognition.uncertainty - b.cognition.uncertainty);
  const divergence = directiveEqual ? 1 - intentJaccard : 1;

  // Precedence (explicit in protocol.json `classification_precedence`):
  // MATERIAL first, then IDENTICAL, then STYLE_ONLY, then PARAPHRASE_ONLY.
  let classification;
  if (!directiveEqual || !actionEqual || intentJaccard < 0.3 || deltaConfidence >= 0.25 || deltaUncertainty >= 0.25) {
    classification = 'MATERIAL_COGNITION_DIFFERENCE';
  } else if (intentEqual) {
    classification = 'IDENTICAL_INTENT';
  } else if (intentJaccard >= 0.6) {
    classification = 'STYLE_ONLY_DIFFERENCE';
  } else {
    classification = 'PARAPHRASE_ONLY';
  }

  return {
    classification,
    directive_equal: directiveEqual,
    action_equal: actionEqual,
    intent_equal: intentEqual,
    intent_jaccard: Number(intentJaccard.toFixed(4)),
    delta_confidence: Number(deltaConfidence.toFixed(4)),
    delta_uncertainty: Number(deltaUncertainty.toFixed(4)),
    divergence: Number(divergence.toFixed(4))
  };
}
