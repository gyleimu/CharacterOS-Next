/**
 * C4.3 — contract-legibility audit (ZERO model calls).
 *
 * Compares every host-enforced semantic obligation in the production V5 path
 * against what the model-facing Cognition prompt / JSON schema actually states.
 * Reproducible: the host obligations are located by reading the production source,
 * and prompt coverage is tested by marker phrases in the sent prompt.
 *
 * Verdict: ADDITIONAL_CONTRACT_LEGIBILITY_DEFECT_FOUND if any material obligation
 * is unstated; otherwise CONTRACT_LEGIBILITY_OK.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONVERSATION_COGNITION_SYSTEM_PROMPT_V5, CONVERSATION_COGNITION_PROPOSAL_V5_JSON_SCHEMA } from '../../../packages/runtime/dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const prompt = CONVERSATION_COGNITION_SYSTEM_PROMPT_V5;
const schema = JSON.stringify(CONVERSATION_COGNITION_PROPOSAL_V5_JSON_SCHEMA);
const proposalSource = readFileSync(resolve(repo, 'packages/runtime/src/transitions/conversation/conversation-cognition-proposal.ts'), 'utf8');
const cognitionSource = readFileSync(resolve(repo, 'packages/runtime/src/transitions/cognition-action/types.ts'), 'utf8');
// The FACTUAL SOURCE REFS header is rendered into the USER request data, not the system prompt.
const requestRenderSource = [
  readFileSync(resolve(repo, 'packages/runtime/src/providers/behavior/conversation-cognition-provider-v2.ts'), 'utf8'),
  readFileSync(resolve(repo, 'packages/runtime/src/providers/behavior/conversation-cognition-provider-v3.ts'), 'utf8')
].join('\n');

/** Each entry: the host obligation, the host evidence, and prompt/schema coverage. */
const obligations = [
  {
    id: 'factual_source_legality',
    host_obligation: 'every claim source ref must be a lawful FACTUAL SOURCE REF (inspectable content; subject/entity/environment are never factual sources)',
    host_evidence: proposalSource.includes('is not a lawful FACTUAL SOURCE REF') && proposalSource.includes('const lawful = allowedEvidenceSetForFactualAssessment(projection)'),
    prompt_marker: 'every ref must appear in FACTUAL SOURCE REFS',
    schema_marker: 'source_refs'
  },
  {
    id: 'factual_claim_source_binding',
    host_obligation: 'every claim source ref must appear in BOTH cognition.considered_context_refs AND cognition.evidence_refs',
    host_evidence: proposalSource.includes('!considered.has(ref) || !evidence.has(ref)'),
    prompt_marker: 'must ALSO be listed in cognition.considered_context_refs AND in cognition.evidence_refs',
    schema_marker: null
  },
  {
    id: 'factual_source_inspectable',
    host_obligation: 'the cited ref must have inspectable source content',
    host_evidence: proposalSource.includes('has no inspectable source content'),
    prompt_marker: 'each carries inspectable factual source content',
    schema_marker: null
  },
  {
    id: 'source_quote_verbatim',
    host_obligation: 'SOURCE_QUOTE text must be an exact substring of each cited source',
    host_evidence: proposalSource.includes('SOURCE_QUOTE is not an exact substring of'),
    prompt_marker: 'SOURCE_QUOTE text must occur verbatim',
    schema_marker: 'SOURCE_QUOTE'
  },
  {
    id: 'claim_bounds',
    host_obligation: 'at most 8 claims, each text non-empty and at most 512 code points, source_refs non-empty/unique/sorted',
    host_evidence: proposalSource.includes('FACTUAL_ASSESSMENT_MAX_CLAIMS_V0') && proposalSource.includes('FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0'),
    prompt_marker: 'at most 8 claims',
    schema_marker: 'maxItems'
  },
  {
    id: 'cognition_array_hygiene',
    host_obligation: 'relevant_memory_refs / considered_context_refs / evidence_refs must be sorted and unique',
    host_evidence: cognitionSource.includes('cognition proposal.considered_context_refs') && cognitionSource.includes('{ sorted: true }'),
    prompt_marker: 'Refs in all cognition arrays must be exact, unique and sorted',
    schema_marker: null
  },
  {
    id: 'unit_intervals',
    host_obligation: 'confidence and uncertainty are numbers in [0,1]',
    host_evidence: cognitionSource.includes('cognition proposal.confidence: [0,1] required'),
    prompt_marker: null,
    schema_marker: 'minimum'
  },
  {
    id: 'action_intent_null',
    host_obligation: 'cognition.action_intent must be null for the text-response path',
    host_evidence: proposalSource.includes('must be null for text-response path'),
    prompt_marker: 'cognition.action_intent is null',
    schema_marker: 'action_intent'
  },
  {
    id: 'projection_hash_ownership',
    host_obligation: 'the model must not emit projection_hash; the host injects the authoritative value',
    host_evidence: proposalSource.includes('COGNITION_SEMANTIC_KEYS_V0') && !proposalSource.includes('"projection_hash",\n  "reasoning_summary"'),
    prompt_marker: 'Do NOT output any projection hash',
    schema_marker: 'additionalProperties'
  },
  {
    id: 'clarification_basis_binding',
    host_obligation: 'CLARIFY requires a non-null basis whose current_observation_ref appears in considered_context_refs; REALIZE requires exactly null',
    host_evidence: proposalSource.includes('must appear in considered_context_refs') && proposalSource.includes('REALIZE requires exactly null'),
    prompt_marker: 'must also appear in considered_context_refs',
    schema_marker: null
  },
  {
    id: 'choice_applicability',
    host_obligation: 'subjective_choice is a tagged object; NOT_APPLICABLE admits only {kind}; SELECTED requires {kind, stance, subjective_rationale}',
    host_evidence: proposalSource.includes('SUBJECTIVE_CHOICE_NOT_APPLICABLE_KEYS_V1') && proposalSource.includes('SUBJECTIVE_CHOICE_SELECTED_KEYS_V1'),
    prompt_marker: 'subjective_choice IS TAGGED',
    schema_marker: 'NOT_APPLICABLE'
  },
  {
    id: 'stance_and_rationale_bounds',
    host_obligation: 'stance and rationale are canonical text, non-empty, at most 256 code points; stance must not be a directive enum or an unresolved placeholder',
    host_evidence: proposalSource.includes('SUBJECTIVE_CHOICE_STANCE_MAX_CODE_POINTS_V0') && proposalSource.includes('directive enum echo is not a subject choice'),
    prompt_marker: 'ONE short sentence stating the choice itself',
    schema_marker: null,
    coverage_gap:
      'THE NUMERIC 256-CODE-POINT BOUND IS IMPLIED BY "ONE SHORT SENTENCE" BUT NOT STATED; assessed as LOW MATERIALITY (never observed to bind in C3/C4/C4.2) and deliberately NOT changed in this slice'
  },
  {
    id: 'cognition_ref_membership',
    host_obligation: 'every ref in evidence_refs ∪ relevant_memory_refs ∪ considered_context_refs must be inside allowedEvidenceSet(projection) (§15 evidence grounding, LLM-EVID-001)',
    host_evidence: readFileSync(resolve(repo, 'packages/runtime/src/transitions/cognition-action/cognition-action-transition-executor.ts'), 'utf8').includes('outside the allowed evidence set'),
    prompt_marker: 'only the exact refs listed below may appear in relevant_memory_refs, considered_context_refs, or evidence_refs',
    schema_marker: null
  },
  {
    id: 'rationale_factual_authority',
    host_obligation: 'the rationale carries no factual authority (host: no refs, no evidence channel; language input marks it non-factual)',
    host_evidence: proposalSource.includes('validateSubjectiveRationaleV1'),
    prompt_marker: 'It carries NO factual authority',
    schema_marker: 'subjective_rationale'
  }
];

const results = obligations.map((entry) => {
  const promptCovered = entry.prompt_marker === null ? false : (prompt.includes(entry.prompt_marker) || requestRenderSource.includes(entry.prompt_marker));
  const schemaCovered = entry.schema_marker === null ? false : schema.includes(entry.schema_marker);
  return {
    ...entry,
    covered_in_prompt: entry.prompt_marker === null ? 'not-applicable' : promptCovered,
    covered_in_schema: entry.schema_marker === null ? 'not-applicable' : schemaCovered,
    covered: promptCovered || schemaCovered,
    material: entry.coverage_gap === undefined
  };
});

const uncoveredMaterial = results.filter((entry) => entry.material && entry.covered !== true && entry.prompt_marker !== null);
const artifact = {
  schema_version: 'affect-cognition-c4-3-contract-legibility-audit-v0',
  model_calls: 0,
  method: 'host obligations read from the production validator source; prompt coverage tested by marker phrases in the sent production prompt',
  repaired_defect: 'factual_claim_source_binding (the only material unstated obligation found in C4.2)',
  obligations: results,
  uncovered_material_obligations: uncoveredMaterial.map((entry) => entry.id),
  known_minor_gap: results.find((entry) => entry.coverage_gap !== undefined)?.coverage_gap ?? null,
  verdict: uncoveredMaterial.length === 0 ? 'CONTRACT_LEGIBILITY_OK' : 'ADDITIONAL_CONTRACT_LEGIBILITY_DEFECT_FOUND'
};
writeFileSync(resolve(here, 'contract-legibility-audit.json'), `${JSON.stringify(artifact, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ verdict: artifact.verdict, uncovered_material: artifact.uncovered_material_obligations, obligations: results.map((entry) => `${entry.id}:${entry.covered}`) }, null, 2)}\n`);
