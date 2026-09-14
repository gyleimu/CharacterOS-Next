/**
 * ConversationCognitionProposalV1 — closed conversation-specific cognition
 * contract (STRUCTURED_COMMUNICATION_DIRECTIVE_V0).
 *
 * Wraps a validated CognitionProposalV0 with a structured CommunicationDirectiveV0
 * chosen by the model in the SAME cognition call. The nested cognition must
 * pass every existing CognitionProposalV0 validation rule. The action space
 * remains empty for the text-response path, so nested action_intent must be null.
 */

import type { CommunicationDirectiveV0 } from "@characteros-next/behavior";
import { validateCommunicationDirectiveV0 } from "@characteros-next/behavior";
import type { CognitiveContextProjectionAnyVersion, CognitionProposalV0 } from "../cognition-action/types.js";
import { validateCognitionProposal } from "../cognition-action/types.js";
import type { CanonicalRefV0, HashV1 } from "@characteros-next/subject-core";
import { hashEnvelope, isRecord, validateCanonicalText, validateRefArray, validateRefElement } from "@characteros-next/subject-core";

export const CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V1 =
  "conversation-cognition-proposal-v1" as const;

/**
 * AFFECT_COGNITION_AUTHORITY_CONTRACT_AND_REVALIDATION_V0 — conversation
 * proposal V2 (GPT-6 Family C).
 *
 * V2 adds a STRUCTURAL clarification basis so that CLARIFY can no longer be
 * used as a generic outlet for subjective reluctance or for "Memory has no
 * answer". CLARIFY requires a non-null basis naming the specific unresolved
 * information dependency and binding it to the CURRENT observation; REALIZE
 * requires exactly `clarification_basis: null`.
 *
 * The basis is a MODEL PROPOSAL, not truth: the host structurally verifies
 * schema, ref identity, subject/turn binding and field relationships only. It
 * does not and cannot prove arbitrary natural-language semantic necessity.
 */
export const CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2 =
  "conversation-cognition-proposal-v2" as const;

/**
 * AFFECT_COGNITION_C2_HOST_BOUND_LANGUAGE_AND_SEMANTIC_REVALIDATION_V0.
 * V3 adds an explicit, turn-local factual handoff. It does not create fact
 * authority or persistence: every claim remains a model proposal bound to the
 * exact cognition projection and its inspectable source material.
 */
export const CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V3 =
  "conversation-cognition-proposal-v3" as const;

export const CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V3 =
  "characteros-next/runtime/conversation-cognition-proposal/v3" as const;

export const FACTUAL_ASSESSMENT_MAX_CLAIMS_V0 = 8 as const;
export const FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0 = 512 as const;

export type FactualAssessmentClaimKindV0 = "SOURCE_QUOTE" | "DERIVED_RESULT";

export interface FactualAssessmentClaimV0 {
  readonly kind: FactualAssessmentClaimKindV0;
  readonly text: string;
  readonly source_refs: readonly CanonicalRefV0[];
}

export interface FactualAssessmentV0 {
  readonly claims: readonly FactualAssessmentClaimV0[];
}

/** Closed C2 conversation cognition proposal. */
export interface ConversationCognitionProposalV3 {
  readonly schema_version: typeof CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V3;
  readonly factual_assessment: FactualAssessmentV0;
  readonly cognition: CognitionProposalV0;
  readonly communication_directive: CommunicationDirectiveV0;
  readonly clarification_basis: ClarificationBasisV0 | null;
}

/** GPT-6 frozen bound for each clarification-basis text field. */
export const CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS = 256 as const;

export const CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V2 =
  "characteros-next/runtime/conversation-cognition-proposal/v2" as const;

/** Structural basis for a CLARIFY_MISSING_CONTEXT directive. */
export interface ClarificationBasisV0 {
  /** The CURRENT cognition projection's authoritative observation ref. */
  readonly current_observation_ref: CanonicalRefV0;
  /** The specific unresolved information dependency (bounded canonical text). */
  readonly missing_information: string;
  /** What completing the selected response needs it for. */
  readonly needed_for: string;
}

/** Closed V2 conversation cognition proposal. */
export interface ConversationCognitionProposalV2 {
  readonly schema_version: typeof CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2;
  readonly cognition: CognitionProposalV0;
  readonly communication_directive: CommunicationDirectiveV0;
  readonly clarification_basis: ClarificationBasisV0 | null;
}

const OUTER_KEYS: readonly string[] = ["schema_version", "cognition", "communication_directive"];
const OUTER_KEYS_V2: readonly string[] = [
  "schema_version",
  "cognition",
  "communication_directive",
  "clarification_basis"
];
const OUTER_KEYS_V3: readonly string[] = [
  "schema_version",
  "factual_assessment",
  "cognition",
  "communication_directive",
  "clarification_basis"
];
const BASIS_KEYS: readonly string[] = ["current_observation_ref", "missing_information", "needed_for"];
const FACTUAL_ASSESSMENT_KEYS: readonly string[] = ["claims"];
const FACTUAL_CLAIM_KEYS: readonly string[] = ["kind", "text", "source_refs"];

/** Exact closed conversation cognition proposal. */
export interface ConversationCognitionProposalV1 {
  readonly schema_version: typeof CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V1;
  readonly cognition: CognitionProposalV0;
  readonly communication_directive: CommunicationDirectiveV0;
}

/**
 * Strict validation of the model-produced conversation proposal:
 * outer closed schema + directive + full nested CognitionProposalV0 validation
 * (including projection binding, evidence grounding and action-space laws).
 */
export function validateConversationCognitionProposalV1(
  v: unknown,
  projection: CognitiveContextProjectionAnyVersion
): { ok: true; proposal: ConversationCognitionProposalV1 } | { ok: false; detail: string } {
  if (!isRecord(v)) return { ok: false, detail: "conversation proposal: expected object" };
  const keys = Object.keys(v).sort();
  const expected = [...OUTER_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, detail: `conversation proposal: unexpected keys; expected exactly ${expected.join(",")}` };
  }
  if (v["schema_version"] !== CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V1) {
    return { ok: false, detail: "conversation proposal.schema_version: expected conversation-cognition-proposal-v1" };
  }
  const directiveCheck = validateCommunicationDirectiveV0(v["communication_directive"]);
  if (!directiveCheck.ok) {
    return { ok: false, detail: `conversation proposal.communication_directive: ${directiveCheck.detail}` };
  }
  const cognitionCheck = validateCognitionProposal(v["cognition"]);
  if (!cognitionCheck.ok) {
    return { ok: false, detail: `conversation proposal.cognition: ${cognitionCheck.error.detail}` };
  }
  const cognition = cognitionCheck.value as CognitionProposalV0;
  if (cognition.projection_hash !== projection.projection_hash) {
    return { ok: false, detail: "conversation proposal.cognition.projection_hash: does not match projection" };
  }
  if (cognition.action_intent !== null) {
    return { ok: false, detail: "conversation proposal.cognition.action_intent: must be null for text-response path" };
  }
  return {
    ok: true,
    proposal: {
      schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V1,
      cognition,
      communication_directive: directiveCheck.directive
    }
  };
}

function validateBoundedCanonicalText(
  v: unknown,
  detail: string
): { ok: true; value: string } | { ok: false; detail: string } {
  const checked = validateCanonicalText(v, detail);
  if (!checked.ok) return { ok: false, detail: checked.error.detail };
  const codePoints = [...checked.value].length;
  if (codePoints === 0) return { ok: false, detail: `${detail}: must be non-empty` };
  if (codePoints > CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS) {
    return {
      ok: false,
      detail: `${detail}: exceeds ${CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS} code points`
    };
  }
  return { ok: true, value: checked.value };
}

/**
 * Structural validation of the clarification basis. The observation ref MUST
 * equal the current cognition projection's authoritative observation ref
 * (rejecting wrong-turn, cross-subject, stale-memory, relationship or arbitrary
 * refs); both text fields are bounded non-empty canonical text; unknown fields
 * fail closed.
 */
function validateClarificationBasisV0(
  v: unknown,
  projection: CognitiveContextProjectionAnyVersion
): { ok: true; basis: ClarificationBasisV0 } | { ok: false; detail: string } {
  const detail = "clarification_basis";
  if (!isRecord(v)) return { ok: false, detail: `${detail}: expected object` };
  const keys = Object.keys(v).sort();
  const expected = [...BASIS_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, detail: `${detail}: unexpected keys; expected exactly [${expected.join(",")}]` };
  }
  const ref = validateRefElement(v["current_observation_ref"], `${detail}.current_observation_ref`, [
    "observation"
  ]);
  if (!ref.ok) return { ok: false, detail: ref.error.detail };
  const authoritative = projection.context.current_observation_ref;
  if (authoritative === null) {
    return { ok: false, detail: `${detail}.current_observation_ref: projection has no current observation` };
  }
  if (ref.value !== authoritative) {
    return {
      ok: false,
      detail: `${detail}.current_observation_ref: does not equal the current projection observation ref`
    };
  }
  const missing = validateBoundedCanonicalText(v["missing_information"], `${detail}.missing_information`);
  if (!missing.ok) return { ok: false, detail: missing.detail };
  const neededFor = validateBoundedCanonicalText(v["needed_for"], `${detail}.needed_for`);
  if (!neededFor.ok) return { ok: false, detail: neededFor.detail };
  return {
    ok: true,
    basis: Object.freeze({
      current_observation_ref: ref.value,
      missing_information: missing.value,
      needed_for: neededFor.value
    })
  };
}

/**
 * Strict validation of the model-produced V2 conversation proposal:
 * outer closed schema + directive + full nested CognitionProposalV0 validation
 * + the CLARIFY/REALIZE clarification-basis structural contract.
 */
export function validateConversationCognitionProposalV2(
  v: unknown,
  projection: CognitiveContextProjectionAnyVersion
): { ok: true; proposal: ConversationCognitionProposalV2 } | { ok: false; detail: string } {
  if (!isRecord(v)) return { ok: false, detail: "conversation proposal: expected object" };
  const keys = Object.keys(v).sort();
  const expected = [...OUTER_KEYS_V2].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, detail: `conversation proposal: unexpected keys; expected exactly ${expected.join(",")}` };
  }
  if (v["schema_version"] !== CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2) {
    return { ok: false, detail: "conversation proposal.schema_version: expected conversation-cognition-proposal-v2" };
  }
  const directiveCheck = validateCommunicationDirectiveV0(v["communication_directive"]);
  if (!directiveCheck.ok) {
    return { ok: false, detail: `conversation proposal.communication_directive: ${directiveCheck.detail}` };
  }
  const cognitionCheck = validateCognitionProposal(v["cognition"]);
  if (!cognitionCheck.ok) {
    return { ok: false, detail: `conversation proposal.cognition: ${cognitionCheck.error.detail}` };
  }
  const cognition = cognitionCheck.value as CognitionProposalV0;
  if (cognition.projection_hash !== projection.projection_hash) {
    return { ok: false, detail: "conversation proposal.cognition.projection_hash: does not match projection" };
  }
  if (cognition.action_intent !== null) {
    return { ok: false, detail: "conversation proposal.cognition.action_intent: must be null for text-response path" };
  }
  const directive = directiveCheck.directive as CommunicationDirectiveV0;
  if (directive.kind === "CLARIFY_MISSING_CONTEXT") {
    if (v["clarification_basis"] === null || v["clarification_basis"] === undefined) {
      return { ok: false, detail: "conversation proposal.clarification_basis: CLARIFY requires a non-null basis" };
    }
    const basisCheck = validateClarificationBasisV0(v["clarification_basis"], projection);
    if (!basisCheck.ok) return { ok: false, detail: `conversation proposal.${basisCheck.detail}` };
    return {
      ok: true,
      proposal: Object.freeze({
        schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2,
        cognition,
        communication_directive: directive,
        clarification_basis: basisCheck.basis
      })
    };
  }
  if (v["clarification_basis"] !== null) {
    return { ok: false, detail: "conversation proposal.clarification_basis: REALIZE requires exactly null" };
  }
  return {
    ok: true,
    proposal: Object.freeze({
      schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2,
      cognition,
      communication_directive: directive,
      clarification_basis: null
    })
  };
}

/**
 * The ONE authoritative V2 proposal hash domain. It binds `clarification_basis`
 * explicitly — including `null` for REALIZE — so a V1 hash domain can never be
 * reused for V2 semantic bytes.
 */
export async function deriveConversationCognitionProposalHashV2(
  proposal: ConversationCognitionProposalV2
): Promise<HashV1> {
  return hashEnvelope(CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V2, {
    schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2,
    cognition: proposal.cognition,
    communication_directive: proposal.communication_directive,
    clarification_basis: proposal.clarification_basis
  });
}

function exactClosedKeys(value: Record<string, unknown>, expectedKeys: readonly string[], detail: string): string | null {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? null
    : `${detail}: unexpected keys; expected exactly [${expected.join(",")}]`;
}

function factualSourceTexts(
  projection: CognitiveContextProjectionAnyVersion,
  ref: CanonicalRefV0
): readonly string[] | null {
  if (projection.context.current_observation_ref === ref) {
    return [projection.context.scene, ...(projection.context.task === null ? [] : [projection.context.task])];
  }
  const bundle = "factual_memory_evidence" in projection ? projection.factual_memory_evidence : undefined;
  const entry = bundle?.entries.find((candidate) => candidate.episode_ref === ref);
  if (entry === undefined) return null;
  return entry.kind === "EPISODE_SCENE"
    ? [entry.scene]
    : [entry.delivered_behavior_text, entry.exact_outcome_text];
}

/**
 * AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0 — THE single authority for refs that
 * may be cited as `factual_assessment` sources.
 *
 * Frozen principle: subject state (affect, beliefs, relationship, personality,
 * regulation) is visible CONTEXT, never factual evidence. Context visibility and
 * factual-source authority are different permissions, so this set contains only
 * refs with genuinely inspectable factual source content under the frozen C2
 * contract: the current observation, and Memory episode refs that are present in
 * the resolved factual-memory evidence bundle.
 *
 * The same function renders the prompt's FACTUAL SOURCE REFS section, so the
 * advertised set and the enforced set can never diverge.
 */
export function factualAssessmentSourceRefs(
  projection: CognitiveContextProjectionAnyVersion
): readonly CanonicalRefV0[] {
  const candidates: readonly CanonicalRefV0[] = [
    ...(projection.context.current_observation_ref !== null
      ? [projection.context.current_observation_ref as CanonicalRefV0]
      : []),
    ...(projection.memory_working_refs as readonly CanonicalRefV0[]),
    ...(projection.recent_retrieval_refs as readonly CanonicalRefV0[])
  ];
  const seen = new Set<string>();
  const refs: CanonicalRefV0[] = [];
  for (const ref of candidates) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    if (factualSourceTexts(projection, ref) === null) continue;
    refs.push(ref);
  }
  return Object.freeze(refs.sort());
}

/**
 * Frozen SOURCE_QUOTE matching rule: exact, case-sensitive NFC code-point
 * substring match against every cited source's trusted, inspectable text.
 * No trimming, case folding, punctuation rewriting or fuzzy matching occurs.
 */
function validateFactualAssessmentV0(
  value: unknown,
  projection: CognitiveContextProjectionAnyVersion,
  cognition: CognitionProposalV0
): { ok: true; assessment: FactualAssessmentV0 } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "factual_assessment: expected object" };
  const keyFailure = exactClosedKeys(value, FACTUAL_ASSESSMENT_KEYS, "factual_assessment");
  if (keyFailure !== null) return { ok: false, detail: keyFailure };
  if (!Array.isArray(value["claims"])) return { ok: false, detail: "factual_assessment.claims: expected array" };
  if (value["claims"].length > FACTUAL_ASSESSMENT_MAX_CLAIMS_V0) {
    return { ok: false, detail: `factual_assessment.claims: exceeds ${FACTUAL_ASSESSMENT_MAX_CLAIMS_V0}` };
  }
  const lawful = allowedEvidenceSetForFactualAssessment(projection);
  const considered = new Set<string>(cognition.considered_context_refs);
  const evidence = new Set<string>(cognition.evidence_refs);
  const claims: FactualAssessmentClaimV0[] = [];
  for (let index = 0; index < value["claims"].length; index += 1) {
    const candidate: unknown = value["claims"][index];
    const detail = `factual_assessment.claims[${index}]`;
    if (!isRecord(candidate)) return { ok: false, detail: `${detail}: expected object` };
    const claimKeys = exactClosedKeys(candidate, FACTUAL_CLAIM_KEYS, detail);
    if (claimKeys !== null) return { ok: false, detail: claimKeys };
    if (candidate["kind"] !== "SOURCE_QUOTE" && candidate["kind"] !== "DERIVED_RESULT") {
      return { ok: false, detail: `${detail}.kind: unsupported kind` };
    }
    const textCheck = validateCanonicalText(candidate["text"], `${detail}.text`);
    if (!textCheck.ok) return { ok: false, detail: textCheck.error.detail };
    if (textCheck.value.trim().length === 0) return { ok: false, detail: `${detail}.text: must be non-empty` };
    if ([...textCheck.value].length > FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0) {
      return {
        ok: false,
        detail: `${detail}.text: exceeds ${FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0} code points`
      };
    }
    const refsCheck = validateRefArray(candidate["source_refs"], `${detail}.source_refs`, { sorted: true });
    if (!refsCheck.ok) return { ok: false, detail: refsCheck.error.detail };
    const refs = candidate["source_refs"] as readonly CanonicalRefV0[];
    if (refs.length === 0) return { ok: false, detail: `${detail}.source_refs: must be non-empty` };
    for (const ref of refs) {
      if (!lawful.has(ref)) {
        return {
          ok: false,
          detail: `${detail}.source_refs: ${ref} is not a lawful FACTUAL SOURCE REF (subject state and non-inspectable context refs are never factual sources)`
        };
      }
      if (!considered.has(ref) || !evidence.has(ref)) {
        return { ok: false, detail: `${detail}.source_refs: ${ref} is not bound in cognition considered/evidence refs` };
      }
      const sourceTexts = factualSourceTexts(projection, ref);
      if (sourceTexts === null) {
        return { ok: false, detail: `${detail}.source_refs: ${ref} has no inspectable source content` };
      }
      if (candidate["kind"] === "SOURCE_QUOTE" && !sourceTexts.some((source) => source.includes(textCheck.value))) {
        return { ok: false, detail: `${detail}.text: SOURCE_QUOTE is not an exact substring of ${ref}` };
      }
    }
    claims.push(Object.freeze({
      kind: candidate["kind"],
      text: textCheck.value,
      source_refs: Object.freeze([...refs])
    }));
  }
  return { ok: true, assessment: Object.freeze({ claims: Object.freeze(claims) }) };
}

function allowedEvidenceSetForFactualAssessment(projection: CognitiveContextProjectionAnyVersion): ReadonlySet<string> {
  // The enforced set IS the advertised set: refs with genuinely inspectable
  // factual source content only. Subject-state / entity / environment context
  // refs remain visible but are never factual sources.
  return new Set<string>(factualAssessmentSourceRefs(projection) as readonly string[]);
}

const UNRESOLVED_INTENT_PREFIXES_V0 = [
  "express a preference",
  "express my preference",
  "decide whether",
  "consider whether",
  "choose whether",
  "determine whether"
] as const;

/** Structural C2 gate: Language cannot be delegated an unresolved stance. */
function validateSelectedIntentV0(intent: string | null): string | null {
  if (intent === null || intent.trim().length === 0) return "REALIZE requires a selected non-empty current_intent";
  const normalized = intent.trim().toLocaleLowerCase("en-US");
  return UNRESOLVED_INTENT_PREFIXES_V0.some((prefix) => normalized.startsWith(prefix))
    ? "REALIZE current_intent delegates an unresolved choice to Language"
    : null;
}

/** Strict C2 validation with source inspection and cross-field binding. */
export function validateConversationCognitionProposalV3(
  value: unknown,
  projection: CognitiveContextProjectionAnyVersion
): { ok: true; proposal: ConversationCognitionProposalV3 } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "conversation proposal: expected object" };
  const keyFailure = exactClosedKeys(value, OUTER_KEYS_V3, "conversation proposal");
  if (keyFailure !== null) return { ok: false, detail: keyFailure };
  if (value["schema_version"] !== CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V3) {
    return { ok: false, detail: "conversation proposal.schema_version: expected conversation-cognition-proposal-v3" };
  }
  const directiveCheck = validateCommunicationDirectiveV0(value["communication_directive"]);
  if (!directiveCheck.ok) {
    return { ok: false, detail: `conversation proposal.communication_directive: ${directiveCheck.detail}` };
  }
  const cognitionCheck = validateCognitionProposal(value["cognition"]);
  if (!cognitionCheck.ok) return { ok: false, detail: `conversation proposal.cognition: ${cognitionCheck.error.detail}` };
  const cognition = cognitionCheck.value as CognitionProposalV0;
  if (cognition.projection_hash !== projection.projection_hash) {
    return { ok: false, detail: "conversation proposal.cognition.projection_hash: does not match projection" };
  }
  if (cognition.action_intent !== null) {
    return { ok: false, detail: "conversation proposal.cognition.action_intent: must be null for text-response path" };
  }
  const factualCheck = validateFactualAssessmentV0(value["factual_assessment"], projection, cognition);
  if (!factualCheck.ok) return { ok: false, detail: `conversation proposal.${factualCheck.detail}` };
  const directive = directiveCheck.directive as CommunicationDirectiveV0;
  let clarificationBasis: ClarificationBasisV0 | null = null;
  if (directive.kind === "CLARIFY_MISSING_CONTEXT") {
    if (value["clarification_basis"] === null || value["clarification_basis"] === undefined) {
      return { ok: false, detail: "conversation proposal.clarification_basis: CLARIFY requires a non-null basis" };
    }
    const basisCheck = validateClarificationBasisV0(value["clarification_basis"], projection);
    if (!basisCheck.ok) return { ok: false, detail: `conversation proposal.${basisCheck.detail}` };
    if (!cognition.considered_context_refs.includes(basisCheck.basis.current_observation_ref)) {
      return {
        ok: false,
        detail: "conversation proposal.clarification_basis.current_observation_ref: must appear in considered_context_refs"
      };
    }
    clarificationBasis = basisCheck.basis;
  } else {
    if (value["clarification_basis"] !== null) {
      return { ok: false, detail: "conversation proposal.clarification_basis: REALIZE requires exactly null" };
    }
    const selectedIntentFailure = validateSelectedIntentV0(cognition.current_intent);
    if (selectedIntentFailure !== null) {
      return { ok: false, detail: `conversation proposal.cognition.current_intent: ${selectedIntentFailure}` };
    }
  }
  return {
    ok: true,
    proposal: Object.freeze({
      schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V3,
      factual_assessment: factualCheck.assessment,
      cognition,
      communication_directive: directive,
      clarification_basis: clarificationBasis
    })
  };
}

/** Distinct C2 hash domain covering every V3 field, including null. */
export async function deriveConversationCognitionProposalHashV3(
  proposal: ConversationCognitionProposalV3
): Promise<HashV1> {
  return hashEnvelope(CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V3, {
    schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V3,
    factual_assessment: proposal.factual_assessment,
    cognition: proposal.cognition,
    communication_directive: proposal.communication_directive,
    clarification_basis: proposal.clarification_basis
  });
}
