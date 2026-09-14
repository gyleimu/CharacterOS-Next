/**
 * Choice applicability + reference fidelity review — FORENSICS (zero model calls).
 *
 * Re-derives every claim in DECISION.md from the frozen C4.3 (and C4.2) evidence:
 *   - N1-N6 applicability forensics (why N6 differs)
 *   - R3 ref forensics (the exact malformation, across replicates, vs C4.2)
 *   - ref fidelity across all 65 cells (exact / corrupted / invented / omitted)
 *   - long-vs-short ref fidelity
 *   - RF-E feasibility (can the host infer a source from claim text?)
 *
 * Run: node forensics.mjs   (writes forensics.json)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const c43 = resolve(here, '../phase-2-affect-cognition-c4-3-contract-legibility-and-grounding-v0');
const c42 = resolve(here, '../phase-2-affect-cognition-c4-2-subjective-basis-and-stance-grounding-v0');
const readRows = (dir) => readFileSync(resolve(dir, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
const rows = readRows(c43);
const userOf = (row) => row.raw_cognition_request.messages.find((m) => m.role === 'user').content;
const REF_TOKEN = /[a-z][a-z0-9_-]*:[A-Za-z0-9_.-]{4,}/g;

function listBlock(user, header, endMarker) {
  const lines = user.split('\n');
  const start = lines.findIndex((l) => l.startsWith(header));
  const end = lines.findIndex((l) => l.startsWith(endMarker));
  return lines.slice(start, end).map((l) => l.replace(/^-\s*/, '').trim()).filter((l) => l.includes(':'));
}
const citeableOf = (user) => new Set(listBlock(user, 'CITEABLE CONTEXT REFS', '[ALLOWED ACTION SPACE]'));
/** Longest common prefix length, and the divergence windows. */
function divergence(cited, lawful) {
  let i = 0;
  while (i < Math.min(cited.length, lawful.length) && cited[i] === lawful[i]) i += 1;
  return {
    common_prefix: i,
    cited_from_divergence: cited.slice(i, i + 16),
    lawful_from_divergence: lawful.slice(i, i + 16),
    cited_length: cited.length,
    lawful_length: lawful.length,
    delta: cited.length - lawful.length
  };
}

// ---- 1. N-cell applicability forensics -------------------------------------------
const nCells = {};
for (const id of ['N1', 'N2', 'N3', 'N4', 'N5Q', 'N6']) {
  const row = rows.find((r) => r.scenario === id);
  const user = userOf(row);
  nCells[id] = {
    context_line: (user.split('\n').find((l) => l.startsWith('[context]')) ?? '').slice(0, 300),
    current_intent: row.current_intent,
    subjective_choice: row.subjective_choice,
    claim_count: (row.factual_assessment?.claims ?? []).length,
    delivered: row.final_behavior,
    applicability: row.classification.applicability,
    pass: row.classification.pass
  };
}

// ---- 2. R3 ref forensics ---------------------------------------------------------
const r3 = rows.filter((r) => r.scenario === 'R3');
const r3Lawful = [...citeableOf(userOf(r3[0]))].filter((r) => r.startsWith('episode:'));
const r3Detail = r3.map((row) => {
  const user = userOf(row);
  const citeable = citeableOf(user);
  const tokens = [...new Set((row.raw_cognition_response ?? '').match(REF_TOKEN) ?? [])];
  const unlawful = tokens.filter((t) => !citeable.has(t));
  return {
    replicate: row.replicate,
    status: row.status,
    cited_unlawful: unlawful,
    exact_in_prompt: unlawful.map((t) => user.includes(t)),
    divergence_from_lawful: unlawful.map((t) => {
      const lawful = r3Lawful.find((c) => c.startsWith(t.slice(0, 30))) ?? r3Lawful[0];
      return divergence(t, lawful);
    }),
    failure_detail: (row.failure_detail ?? '').slice(0, 220)
  };
});
const identicalAcrossReplicates = new Set(r3Detail.flatMap((d) => d.cited_unlawful)).size === 1;

// ---- 2b. the same scenario in C4.2 (which passed) --------------------------------
const rows42 = readRows(c42);
const c42R3 = rows42.filter((r) => r.scenario === 'R3').map((row) => {
  const citeable = citeableOf(userOf(row));
  const tokens = [...new Set((row.raw_cognition_response ?? '').match(REF_TOKEN) ?? [])];
  return { replicate: row.replicate, status: row.status, all_citeable: tokens.every((t) => citeable.has(t)), cited_episode_count: tokens.filter((t) => t.startsWith('episode:')).length };
});

// ---- 3. ref fidelity across all 65 ------------------------------------------------
const stats = { exact: 0, corrupted: 0, invented: 0, omitted: 0, per_kind: {}, per_length_band: {}, anomalies: [] };
const anomalousCells = new Set();
for (const row of rows) {
  const user = userOf(row);
  const citeable = citeableOf(user);
  const tokens = [...new Set((row.raw_cognition_response ?? '').match(REF_TOKEN) ?? [])];
  for (const token of tokens) {
    const kind = token.split(':')[0];
    const band = token.length > 40 ? 'long(>40)' : token.length > 20 ? 'medium(21-40)' : 'short(<=20)';
    stats.per_kind[kind] = stats.per_kind[kind] ?? { exact: 0, corrupted: 0, invented: 0 };
    stats.per_length_band[band] = stats.per_length_band[band] ?? { exact: 0, corrupted: 0, invented: 0 };
    if (citeable.has(token)) {
      stats.exact += 1; stats.per_kind[kind].exact += 1; stats.per_length_band[band].exact += 1;
      continue;
    }
    // A one- or two-character edit of a lawful ref is a transcription corruption; anything
    // else is an invented ref. Distinguish by longest-common-prefix coverage.
    const near = [...citeable].find((c) => c.startsWith(token.slice(0, 30)) || token.startsWith(c.slice(0, 30)));
    if (near !== undefined) {
      stats.corrupted += 1; stats.per_kind[kind].corrupted += 1; stats.per_length_band[band].corrupted += 1;
      stats.anomalies.push({ scenario: row.scenario, replicate: row.replicate, kind, verdict: 'CORRUPTED', cited: token, lawful: near, ...divergence(token, near) });
    } else {
      stats.invented += 1; stats.per_kind[kind].invented += 1; stats.per_length_band[band].invented += 1;
      stats.anomalies.push({ scenario: row.scenario, replicate: row.replicate, kind, verdict: 'INVENTED', cited: token, lawful: null });
    }
    anomalousCells.add(row.scenario);
  }
  // omission: a claim with no source, or a cognition ref array missing a cited source
  for (const claim of row.factual_assessment?.claims ?? []) {
    if ((claim.source_refs ?? []).length === 0) stats.omitted += 1;
  }
  if (row.classification.citation_binding === 'CITATION_UNBOUND') stats.omitted += 1;
}

// ---- 4. RF-E feasibility: do claim texts appear verbatim in a lawful source? -----
const rfeProbe = r3.map((row) => {
  const claims = (row.factual_assessment?.claims ?? []).map((c) => c.text);
  const user = userOf(row);
  const memoryBlock = /\[PRIOR FACTUAL MEMORY[\s\S]*?\[END HISTORICAL FACTUAL CONTENT\]/.exec(user)?.[0] ?? '';
  const observationText = user.split('\n').find((l) => l.startsWith('[context]')) ?? '';
  return {
    replicate: row.replicate,
    claims_verbatim_in_memory: claims.map((c) => memoryBlock.includes(c)),
    claims_verbatim_in_observation: claims.map((c) => observationText.includes(c)),
    claim_kinds: (row.factual_assessment?.claims ?? []).map((c) => c.kind)
  };
});

const artifact = {
  schema_version: 'choice-applicability-and-ref-fidelity-forensics-v0',
  model_calls: 0,
  repository_head: readFileSync(resolve(here, 'HEAD.txt'), 'utf8').trim(),
  n_cell_forensics: nCells,
  r3_ref_forensics: {
    lawful_episode_refs_in_turn: r3Lawful,
    replicates: r3Detail,
    identical_malformation_across_replicates: identicalAcrossReplicates,
    c4_2_same_scenario: c42R3
  },
  ref_fidelity_all_65: stats,
  anomalous_cells: [...anomalousCells],
  rf_e_feasibility: rfeProbe
};
writeFileSync(resolve(here, 'forensics.json'), `${JSON.stringify(artifact, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  n_cells: Object.fromEntries(Object.entries(nCells).map(([id, v]) => [id, { applicability: v.applicability, claims: v.claim_count, stance: v.subjective_choice?.stance ?? null }])),
  r3: { identical_malformation: identicalAcrossReplicates, pattern: r3Detail[0]?.divergence_from_lawful, in_prompt: r3Detail.map((d) => d.exact_in_prompt), c42_all_citeable: c42R3.map((d) => d.all_citeable) },
  ref_fidelity: { totals: { exact: stats.exact, corrupted: stats.corrupted, invented: stats.invented, omitted: stats.omitted }, per_kind: stats.per_kind, per_length_band: stats.per_length_band, anomalous_cells: [...anomalousCells] },
  rf_e_feasible: rfeProbe.map((p) => ({ replicate: p.replicate, verbatim_in_memory: p.claims_verbatim_in_memory, verbatim_in_observation: p.claims_verbatim_in_observation }))
}, null, 2)}\n`);
