/**
 * AFFECT_COGNITION_LANGUAGE_ZERO_FACTUAL_AUTHORITY_ARCHITECTURE_REVIEW
 * — zero-model workload inventory (§25): which existing product/runtime fixtures
 * actually exercise zero-factual-claim REALIZE turns, and what user messages do they use?
 * No model calls, no production changes.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..', '..');

const DIRS = [
  'product/sandbox/src',
  'packages/runtime/src/session',
  'packages/runtime/src/transitions/conversation',
  'packages/runtime/src/transitions/cognition-action'
];

const userMessagePatterns = [
  /\.send\("([^"]{2,80})"\)/g,
  /handleLine\("([^"]{2,80})"\)/g,
  /submitUserText\("([^"]{2,80})"\)/g,
  /event: '([^']{2,80})'/g,
  /event: "([^"]{2,80})"/g
];

const files = [];
for (const dir of DIRS) {
  for (const name of readdirSync(resolve(ROOT, dir))) {
    if (!name.endsWith('.test.ts')) continue;
    files.push(`${dir}/${name}`);
  }
}

const inventory = [];
for (const file of files) {
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  // zero-factual-claim V7/V6 wire fixtures: claims: [] adjacent to a selection
  const zeroClaimSites = [...text.matchAll(/claims:\s*\[\s*\]/g)].length;
  if (zeroClaimSites === 0) continue;
  const v7 = /conversation-cognition-proposal-v7/.test(text);
  const v6 = /conversation-cognition-proposal-v6/.test(text);
  const messages = new Set();
  for (const pattern of userMessagePatterns) {
    for (const match of text.matchAll(pattern)) messages.add(match[1]);
  }
  inventory.push({ file, zero_claim_sites: zeroClaimSites, wire: v7 ? 'v7' : v6 ? 'v6' : 'other/legacy', messages: [...messages].slice(0, 12) });
}

// ---- classify the messages by conversational type --------------------------------
const classify = (message) => {
  const m = message.toLowerCase();
  if (/^(hello|hi|hey|good morning|good evening|你好)/.test(m)) return 'GREETING';
  if (/^(thanks|thank you|okay|ok|got it|noted|sure)/.test(m)) return 'ACKNOWLEDGEMENT';
  if (/^\/|inspect|memory|status|history|state/.test(m)) return 'INSTRUCTIONAL_HOST_COMMAND';
  if (/^(write|tell me|give me|draft|compose|imagine|create)/.test(m)) return 'CREATIVE';
  if (/\?$/.test(message.trim())) return 'QUESTION_MAYBE_FACTUAL';
  return 'OTHER_NONFACTUAL_CONTINUATION';
};
const byType = {};
for (const entry of inventory) {
  entry.message_types = entry.messages.map((message) => ({ message, type: classify(message) }));
  for (const { type } of entry.message_types) byType[type] = (byType[type] ?? 0) + 1;
}

writeFileSync(resolve(here, 'inventory.json'), `${JSON.stringify({
  schema_version: 'zero-factual-authority-review-inventory-v0',
  model_calls: 0,
  scanned_files: files.length,
  files_with_zero_claim_fixtures: inventory.length,
  message_type_counts: byType,
  inventory
}, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ files: inventory.length, message_type_counts: byType }, null, 2)}\n`);
