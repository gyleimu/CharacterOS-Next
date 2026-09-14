/**
 * AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0 — deterministic condition-leakage
 * audit (ZERO model calls).
 *
 * Scans every PRESERVED model-visible request (qualification + formal cognition
 * requests, lawful cognition requests, and any language request) for experimental
 * labels, and checks the condition-blind opaque session ids. Never regenerates or
 * replaces evidence.
 *
 * Usage: node condition-leakage-audit.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

const SCENARIO_IDS = ['S1', 'S2', 'S3', 'S4', 'N1', 'N2', 'N3', 'N4', 'N5Q', 'N6', 'M1', 'M2', 'M3', 'R1', 'R2', 'R3', 'R4'];
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
  // Experiment-LABEL usages only. The ordinary English word "condition" inside
  // model-authored content (e.g. an N6 claim about the MATCH rule) is not an
  // experiment-condition leak and must not be reported as one.
  { name: 'condition_label', re: /\bcondition\s*(?:id|name|label)?\s*[:=]\s*[PNZA]\b/i }
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
    out.push({ kind: 'cognition', text: record.raw_cognition_request.messages.map((message) => message.content).join('\n') });
  }
  if (record.raw_language_request?.messages) {
    out.push({ kind: 'language', text: record.raw_language_request.messages.map((message) => message.content).join('\n') });
  }
  return out;
}

const findings = [];
let scannedRequests = 0;
const sources = [];

function scanJsonl(file, label) {
  const path = resolve(root, file);
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8').trim();
  if (text === '') return;
  sources.push(label);
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const record = JSON.parse(line);
    for (const request of requestsOf(record)) {
      scannedRequests += 1;
      const found = scanText(request.text);
      if (found.length > 0) findings.push({ source: label, scenario: record.scenario, condition: record.condition, request: request.kind, found });
    }
  }
}

scanJsonl('qualification-raw.jsonl', 'qualification');
scanJsonl('raw-cognition.jsonl', 'formal');

const lawfulPath = resolve(root, 'lawful-confirmation.json');
if (existsSync(lawfulPath)) {
  sources.push('lawful');
  const lawful = JSON.parse(readFileSync(lawfulPath, 'utf8'));
  for (const [stateId, state] of Object.entries(lawful.states)) {
    for (const record of state.records) {
      for (const request of requestsOf(record)) {
        scannedRequests += 1;
        const found = scanText(request.text);
        if (found.length > 0) findings.push({ source: stateId, scenario: record.scenario, condition: record.condition, request: request.kind, found });
      }
    }
  }
}

// Opaque session ids: must not embed a scenario id or a condition-like letter.
const sessionIdChecks = [];
for (const file of ['qualification-freeze.json', 'formal-freeze.json', 'lawful-freeze.json']) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  const freeze = JSON.parse(readFileSync(path, 'utf8'));
  const ids = freeze.opaque_session_ids ?? freeze.session_ids ?? null;
  if (ids === null) {
    sessionIdChecks.push({ file, present: false });
    continue;
  }
  const violations = [];
  for (const [scenario, list] of Object.entries(ids)) {
    for (const id of list) {
      if (String(id).includes(scenario)) violations.push({ scenario, id, reason: 'embeds scenario id' });
      if (/[PNZA]/.test(String(id).replace(/[0-9a-f]/gi, ''))) violations.push({ scenario, id, reason: 'condition-like letter outside hex' });
    }
  }
  sessionIdChecks.push({ file, present: true, entries: Object.keys(ids).length, violations });
}

const ok = findings.length === 0 && sessionIdChecks.every((check) => !check.present || check.violations.length === 0);
const report = {
  schema_version: 'affect-cognition-c2-condition-leakage-v0',
  method: 'deterministic scan of preserved model-visible requests and condition-blind opaque session ids; zero model calls',
  scanned_sources: sources,
  scanned_requests: scannedRequests,
  forbidden_tokens: [...SCENARIO_IDS, ...FORBIDDEN_PHRASES, ...FORBIDDEN_REGEXES.map((rule) => rule.name)],
  findings,
  session_id_checks: sessionIdChecks,
  pass: ok
};
writeFileSync(resolve(root, 'condition-leakage.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ scanned_sources: sources, scanned_requests: scannedRequests, findings: findings.length, session_id_checks: sessionIdChecks, pass: ok }, null, 2));
if (!ok) process.exit(1);
