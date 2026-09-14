/**
 * AFFECT_COGNITION_CONTRACT_SIZE_AND_EXAMPLE_NEUTRALITY_ARCHITECTURE_REVIEW
 * — zero-model forensics over the two frozen qualifications (C4.4 and the
 * rationale-vocabulary slice). No model calls, no production changes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const C44 = resolve(here, '..', 'phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0', 'qualification-raw.jsonl');
const CUR = resolve(here, '..', 'phase-2-affect-cognition-rationale-vocabulary-and-latitude-legibility-v0', 'qualification-raw.jsonl');
const load = (path) => readFileSync(path, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const c44 = load(C44);
const cur = load(CUR);

const finalTrace = (row) => (row.cognition_trace ?? []).find((event) => event.schema_version === 'model-transport-trace-v0') ?? null;
const size = (value) => value === undefined || value === null ? null : JSON.stringify(value).length;
const chars = (value) => (typeof value === 'string' ? value.length : null);

function outputProfile(row) {
  const trace = finalTrace(row);
  const proposal = row.raw_cognition_wire;
  const claims = Array.isArray(proposal?.factual_assessment?.claims) ? proposal.factual_assessment.claims : null;
  return {
    scenario: row.scenario, replicate: row.replicate, status: row.status,
    prompt_eval_count: trace?.ollama?.prompt_eval_count ?? null,
    eval_count: trace?.ollama?.eval_count ?? null,
    done_reason: trace?.ollama?.done_reason ?? null,
    request_bytes: trace?.request_bytes ?? null,
    raw_output_chars: chars(row.raw_cognition_response),
    claim_count: claims ? claims.length : null,
    claim_text_chars: claims ? claims.reduce((sum, claim) => sum + claim.text.length, 0) : null,
    longest_claim_chars: claims ? Math.max(...claims.map((claim) => claim.text.length)) : null,
    factual_assessment_chars: size(proposal?.factual_assessment ?? null),
    current_intent_chars: chars(proposal?.cognition?.current_intent),
    reasoning_summary_chars: chars(proposal?.cognition?.reasoning_summary),
    stance_chars: chars(proposal?.subjective_selection?.stance),
    rationale_chars: chars(proposal?.subjective_selection?.subjective_rationale),
    considered_handles: Array.isArray(proposal?.cognition?.considered_handles) ? proposal.cognition.considered_handles.length : null,
    evidence_handles: Array.isArray(proposal?.cognition?.evidence_handles) ? proposal.cognition.evidence_handles.length : null,
    relevant_memory_handles: Array.isArray(proposal?.cognition?.relevant_memory_handles) ? proposal.cognition.relevant_memory_handles.length : null,
    wrapper_error: row.wrapper_error
  };
}

// ---- §3 M3 forensics (current run) -----------------------------------------------
const m3Current = cur.filter((row) => row.scenario === 'M3').sort((a, b) => a.replicate - b.replicate).map(outputProfile);

// ---- §4 M3 vs C4.4 ---------------------------------------------------------------
const m3C44 = c44.filter((row) => row.scenario === 'M3').sort((a, b) => a.replicate - b.replicate).map(outputProfile);

// ---- §5 completion-token distribution, both runs ---------------------------------
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
};
function distribution(rows) {
  const evals = rows.map(outputProfile).filter((profile) => typeof profile.eval_count === 'number').map((profile) => profile.eval_count);
  return {
    n: evals.length,
    min: percentile(evals, 0), median: percentile(evals, 50), p75: percentile(evals, 75),
    p90: percentile(evals, 90), p95: percentile(evals, 95), max: percentile(evals, 100),
    num_predict: 2048,
    cells_over_80pct: evals.filter((value) => value > 0.8 * 2048).length,
    cells_over_90pct: evals.filter((value) => value > 0.9 * 2048).length,
    per_scenario_max: Object.fromEntries([...new Set(rows.map((row) => row.scenario))].map((id) => [
      id, Math.max(...rows.filter((row) => row.scenario === id).map((row) => finalTrace(row)?.ollama?.eval_count ?? 0))
    ]))
  };
}

// ---- §12/13 stance comparison ----------------------------------------------------
const stanceBy = (rows) => {
  const out = {};
  for (const id of ['M1', 'M2', 'M3', 'R1', 'R2', 'R3', 'R4']) {
    const cells = rows.filter((row) => row.scenario === id);
    out[id] = {
      complete: cells.filter((row) => row.status === 'COMPLETE').length,
      classes: [...new Set(cells.map((row) => row.classification.stance_selected))],
      stances: [...new Set(cells.filter((row) => row.status === 'COMPLETE').map((row) => row.subjective_selection?.stance ?? null))],
      rationales: [...new Set(cells.filter((row) => row.status === 'COMPLETE').map((row) => row.subjective_selection?.subjective_rationale ?? null))]
    };
  }
  return out;
};

// ---- §14 lexical anchor audit ----------------------------------------------------
const ADDED_LAWFUL_EXAMPLES = [
  "I'd rather help.",
  'I prefer to use the free time to help.',
  "I'd be willing to spend the available time on the review.",
  'I\'d prefer to decline.'
];
const POLARITY_TOKENS = {
  toward_SECOND_decline: ['decline', 'avoid', 'extra work', 'rather not', 'prefer not', 'not take', 'stop'],
  toward_FIRST_accept: ['volunteer', 'try', 'attend', 'carry', 'help', 'take it on', 'do the extra', 'rehearse']
};
function anchorAudit(rows) {
  const audit = [];
  for (const id of ['M1', 'M2', 'R1', 'R2', 'R3', 'R4']) {
    const cells = rows.filter((row) => row.scenario === id && row.status === 'COMPLETE');
    for (const row of cells) {
      const stance = row.subjective_selection?.stance ?? '';
      const rationale = row.subjective_selection?.subjective_rationale ?? '';
      const text = `${stance} ${rationale}`.toLowerCase();
      audit.push({
        scenario: id, replicate: row.replicate,
        stance_class: row.classification.stance_selected,
        stance, rationale,
        example_phrase_reuse: ADDED_LAWFUL_EXAMPLES.filter((example) => text.includes(example.toLowerCase().replace(/[.']|i'd|i /gi, (match) => match)).length > 0).length,
        decline_vocabulary: POLARITY_TOKENS.toward_SECOND_decline.filter((token) => text.includes(token)),
        accept_vocabulary: POLARITY_TOKENS.toward_FIRST_accept.filter((token) => text.includes(token))
      });
    }
  }
  return audit;
}

const promptGrowth = {
  cognition_system_chars_c44: c44[0].raw_cognition_request.messages.find((m) => m.role === 'system').content.length,
  cognition_system_chars_current: cur[0].raw_cognition_request.messages.find((m) => m.role === 'system').content.length
};
const c44M3PromptEval = m3C44.map((profile) => profile.prompt_eval_count);
const curM1PromptEval = cur.filter((row) => row.scenario === 'M1').map((row) => finalTrace(row)?.ollama?.prompt_eval_count ?? null);

writeFileSync(resolve(here, 'forensics.json'), `${JSON.stringify({
  schema_version: 'affect-cognition-contract-size-example-neutrality-review-forensics-v0',
  model_calls: 0,
  production_files_changed: 0,
  prompt_growth: {
    ...promptGrowth,
    delta_chars: promptGrowth.cognition_system_chars_current - promptGrowth.cognition_system_chars_c44,
    c44_m3_prompt_eval: c44M3PromptEval,
    current_m1_prompt_eval: curM1PromptEval,
    current_m3_prompt_eval: m3Current.map((profile) => profile.prompt_eval_count)
  },
  m3_current: m3Current,
  m3_c44: m3C44,
  completion_distribution_current: distribution(cur.filter((row) => row.scenario !== 'M3')),
  completion_distribution_c44: distribution(c44),
  stance_comparison: { c4_4: stanceBy(c44), current: stanceBy(cur) },
  anchor_audit_current: anchorAudit(cur),
  anchor_audit_c44: anchorAudit(c44)
}, null, 2)}\n`);
process.stdout.write('forensics.json written (0 model calls)\n');
