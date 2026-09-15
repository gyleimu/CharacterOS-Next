/**
 * AFFECT_COGNITION_LANGUAGE_COMPLETION_AND_REQUEST_IDENTITY_ARCHITECTURE_REVIEW
 * — zero-model forensics over the frozen V7/V8 qualification evidence.
 * No model calls, no production changes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '..', 'phase-2-affect-cognition-factual-claim-authorization-and-fail-closed-requalification-v0', 'qualification-raw.jsonl');
const rows = readFileSync(SRC, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const short = (value) => sha(value).slice(0, 16);

// ---- M1 forensics -----------------------------------------------------------------
function m1Forensics(row) {
  const user = row.raw_cognition_request.messages.find((message) => message.role === 'user').content;
  const sceneLine = user.split('\n').find((line) => line.startsWith('[context] scene=')) ?? '';
  const sceneRaw = /^\[context\] scene="([\s\S]*)" task=/.exec(sceneLine)?.[1] ?? '';
  // decode the JSON-string escaping the renderer used, to recover the exact source bytes
  const sceneDecoded = sceneRaw.replace(/\\"/g, '"').replace(/\\n/g, '\n');
  const rawClaim = row.raw_model_factual_assessment?.claims?.[0] ?? null;
  const quote = rawClaim?.text ?? null;
  const quoteInDecoded = quote !== null && sceneDecoded.includes(quote);
  const quoteWithoutClosing = quote !== null && sceneDecoded.includes(quote.replace(/"$/, ''));
  return {
    replicate: row.replicate,
    canonical_source_line: sceneLine.slice(0, 400),
    canonical_source_decoded: sceneDecoded.slice(0, 400),
    raw_quote: quote,
    quote_is_exact_substring: quoteInDecoded,
    quote_matches_without_trailing_quote: quoteWithoutClosing,
    source_contains_attribution_frame: sceneDecoded.includes('Alice says: "The code review deadline is Thursday.'),
    rejection: (row.factual_authorization_trace ?? []).map((entry) => ({ status: entry.status, code: entry.rejection_code })),
    language_calls: row.language_calls,
    authoritative_hash_minted: row.authoritative_proposal_hash_minted,
    authoritative_proposal_minted: row.authoritative_proposal_minted,
    stance_scored: row.classification.applicability,
    status: row.status
  };
}

// ---- N6 forensics -----------------------------------------------------------------
function n6Forensics(row) {
  const claims = (row.raw_model_factual_assessment?.claims ?? []).map((claim) => ({ kind: claim.kind, operation: claim.operation ?? null, text: (claim.text ?? '').slice(0, 120) }));
  const authoritative = (row.authoritative_factual_assessment?.claims ?? []).map((claim) => ({ kind: claim.kind, operation: claim.operation ?? null, text: (claim.text ?? '').slice(0, 120) }));
  const languageUser = row.raw_language_request?.messages?.find((message) => message.role === 'user')?.content ?? '';
  const requestId = /"response_request_id":\s*"([^"]+)"/.exec(languageUser)?.[1] ?? null;
  return {
    replicate: row.replicate,
    raw_claims: claims,
    authoritative_claims: authoritative,
    rule_classification_present: claims.some((claim) => claim.operation === 'RULE_CLASSIFICATION'),
    directive: row.directive,
    current_intent: row.current_intent ?? row.raw_cognition_wire?.cognition?.current_intent ?? null,
    language_request_id: requestId,
    language_request_sha256: row.raw_language_request === null ? null : short(JSON.stringify(row.raw_language_request.messages)),
    language_response_sha256: row.raw_language_response === null ? null : short(row.raw_language_response),
    final_behavior: row.final_behavior,
    completion: row.classification.language_completion,
    completion_tokens: row.classification.language_completion_tokens,
    final_fact: row.classification.final_fact,
    reasoning_like_text_present: /wait|re-read|let me|hmm|actually/i.test(row.final_behavior ?? ''),
    pass: row.classification.pass
  };
}

const m1 = rows.filter((row) => row.scenario === 'M1').sort((a, b) => a.replicate - b.replicate).map(m1Forensics);
const n6 = rows.filter((row) => row.scenario === 'N6').sort((a, b) => a.replicate - b.replicate).map(n6Forensics);

// ---- request identity across replicates -------------------------------------------
const identity = {};
for (const id of ['M1', 'N6']) {
  const cells = rows.filter((row) => row.scenario === id).sort((a, b) => a.replicate - b.replicate);
  identity[id] = {
    cognition_request_hashes: cells.map((row) => short(JSON.stringify(row.raw_cognition_request.messages))),
    cognition_response_hashes: cells.map((row) => short(row.raw_cognition_response ?? '')),
    language_request_hashes: cells.map((row) => row.raw_language_request === null ? null : short(JSON.stringify(row.raw_language_request.messages))),
    language_response_hashes: cells.map((row) => row.raw_language_response === null ? null : short(row.raw_language_response)),
    unique_language_requests: new Set(cells.map((row) => row.raw_language_request === null ? null : JSON.stringify(row.raw_language_request.messages))).size,
    unique_language_responses: new Set(cells.map((row) => row.raw_language_response)).size
  };
}

// ---- language request byte diff: which fields differ? -----------------------------
function languageDiff() {
  const cells = rows.filter((row) => row.scenario === 'N6' && row.raw_language_request !== null);
  const a = cells[0].raw_language_request.messages.map((m) => m.content);
  const differing = [];
  for (const cell of cells.slice(1)) {
    const b = cell.raw_language_request.messages.map((m) => m.content);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      const x = (a[i] ?? '').split('\n'); const y = (b[i] ?? '').split('\n');
      for (let j = 0; j < Math.max(x.length, y.length); j += 1) {
        if (x[j] !== y[j]) differing.push({ message: i, line: j, base: (x[j] ?? '').slice(0, 120), other: (y[j] ?? '').slice(0, 120) });
      }
    }
  }
  const fields = [...new Set(differing.map((entry) => (/"([^"]+)":/.exec(entry.base) ?? [])[1] ?? '?'))];
  return { differing_fields: fields, samples: differing.slice(0, 4) };
}

writeFileSync(resolve(here, 'forensics.json'), `${JSON.stringify({
  schema_version: 'affect-cognition-language-completion-request-identity-review-forensics-v0',
  model_calls: 0, production_files_changed: 0,
  m1, n6, identity, language_byte_diff: languageDiff(),
  production_language_boundary: {
    draft_validator: 'validateLanguageRealizationDraftV0 — closed schema + canonical text only',
    provider_gates: 'raw-size gate, strict JSON, closed draft schema, input_hash echo, evidence_refs allowlist',
    semantic_content_gate: 'NONE — production has no check that delivered text contains only authorized propositions'
  },
  response_request_id_source: 'session runtime: `${session_id}-${tag}` (per-cell opaque id) → V8 payload.response_request_id → serialized into the model-facing language content'
}, null, 2)}\n`);
process.stdout.write('forensics.json written (0 model calls)\n');
