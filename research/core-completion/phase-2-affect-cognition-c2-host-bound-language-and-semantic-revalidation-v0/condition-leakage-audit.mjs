/* globals URL */
/**
 * AFFECT_COGNITION_C2 — deterministic condition-leakage audit (ZERO model calls).
 *
 * Scans every PRESERVED model-visible request (qualification cognition requests,
 * lawful cognition requests, and any language request) for experimental labels,
 * and checks the opaque session ids used for request identity. It does not
 * regenerate or replace evidence.
 *
 * Usage: node condition-leakage-audit.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const SCENARIO_IDS = ['S1', 'S2', 'S3', 'S4', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'M1', 'M2'];
const FORBIDDEN_PHRASES = [
  'CONDITION_',
  'AFFECT_ABSENT',
  'POSITIVE_AFFECT',
  'NEGATIVE_AFFECT',
  'NEUTRAL_AFFECT',
  'TEST_BRANCH',
  'experiment_condition',
  'qualification',
  'formal_matrix',
  'run_of_record'
];
const FORBIDDEN_REGEXES = [
  { name: 'replicate_label', re: /\breplicate\b/i },
  { name: 'condition_assignment', re: /\bcondition\s*[:=]\s*[PNZA]\b/ },
  { name: 'condition_word', re: /\bcondition\b/i }
];

function scanText(text) {
  const found = [];
  for (const token of SCENARIO_IDS) {
    if (new RegExp(`(^|[^A-Za-z0-9])${token}([^A-Za-z0-9]|$)`).test(text)) found.push(token);
  }
  for (const phrase of FORBIDDEN_PHRASES) if (text.includes(phrase)) found.push(phrase);
  for (const { name, re } of FORBIDDEN_REGEXES) if (re.test(text)) found.push(name);
  return found;
}

function requestsOf(record) {
  const out = [];
  if (record.raw_cognition_request?.messages) {
    out.push({ kind: 'cognition', text: record.raw_cognition_request.messages.map((m) => m.content).join('\n') });
  }
  if (record.raw_language_request?.messages) {
    out.push({ kind: 'language', text: record.raw_language_request.messages.map((m) => m.content).join('\n') });
  }
  return out;
}

const findings = [];
let scannedRequests = 0;

// Qualification preserved records.
if (readFileSync(join(root, 'qualification-raw.jsonl'), 'utf8').trim() !== '') {
  const qualification = readFileSync(join(root, 'qualification-raw.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
  for (const record of qualification) {
    for (const request of requestsOf(record)) {
      scannedRequests += 1;
      const found = scanText(request.text);
      if (found.length > 0) findings.push({ source: 'qualification', scenario: record.scenario, condition: record.condition, request: request.kind, found });
    }
  }
}

// Lawful preserved records.
const lawful = JSON.parse(readFileSync(join(root, 'lawful-confirmation.json'), 'utf8'));
for (const [stateId, state] of Object.entries(lawful.states)) {
  for (const record of state.records) {
    for (const request of requestsOf(record)) {
      scannedRequests += 1;
      const found = scanText(request.text);
      if (found.length > 0) findings.push({ source: stateId, scenario: record.scenario, condition: record.condition, request: request.kind, found });
    }
  }
}

// Opaque session ids: must not embed a scenario id or condition letter.
const freezeFiles = ['qualification-freeze.json', 'formal-freeze.json', 'lawful-freeze.json'];
const sessionIdChecks = [];
for (const file of freezeFiles) {
  let freeze;
  try {
    freeze = JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch {
    continue;
  }
  const ids = freeze.opaque_session_ids ?? freeze.session_ids ?? null;
  if (ids === null) {
    sessionIdChecks.push({ file, present: false });
    continue;
  }
  const violations = [];
  for (const [scenario, list] of Object.entries(ids)) {
    for (const id of list) {
      if (scenario !== 'generic' && String(id).includes(scenario)) violations.push({ scenario, id, reason: 'embeds scenario id' });
      if (/[PNZA]/.test(String(id).replace(/[0-9a-f]/gi, ''))) violations.push({ scenario, id, reason: 'contains a condition-like letter outside hex' });
    }
  }
  sessionIdChecks.push({ file, present: true, entries: Object.keys(ids).length, violations });
}

const ok = findings.length === 0 && sessionIdChecks.every((check) => !check.present || check.violations.length === 0);
const report = {
  schema_version: 'affect-cognition-c2-condition-leakage-audit-v0',
  method: 'deterministic scan of preserved model-visible requests and opaque session ids; zero model calls',
  scanned_requests: scannedRequests,
  forbidden_tokens: [...SCENARIO_IDS, ...FORBIDDEN_PHRASES, ...FORBIDDEN_REGEXES.map((r) => r.name)],
  findings,
  session_id_checks: sessionIdChecks,
  ok
};
writeFileSync(join(evidenceDir, 'condition-leakage-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ scanned_requests: scannedRequests, findings: findings.length, session_id_checks: sessionIdChecks, ok }, null, 2));
if (!ok) process.exit(1);
