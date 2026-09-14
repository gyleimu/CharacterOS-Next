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
import { allowedEvidenceSet, validateCognitionProposal } from "../cognition-action/types.js";
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

// ---------------------------------------------------------------------------
// AFFECT_COGNITION_C3_REVALIDATION_V0 — Family C3 explicit subjective choice.
//
// Facts constrain the lawful response space; persistent subject state may
// influence the subject's CHOICE within that space. The choice is an explicit,
// turn-local protocol field — never canonical state, never persisted, and never
// a second factual-claim channel. Model output carries semantics only: identity
// and integrity metadata (the projection hash) are host-bound outside it.
// ---------------------------------------------------------------------------

export const CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V4 =
  "conversation-cognition-proposal-v4" as const;

export const CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V4 =
  "characteros-next/runtime/conversation-cognition-proposal/v4" as const;

/** Frozen bound for the stance text. */
export const SUBJECTIVE_CHOICE_STANCE_MAX_CODE_POINTS_V0 = 256 as const;

/**
 * A turn-local, already-selected, fact-compatible subject stance. It is a model
 * PROPOSAL for this turn only: not canonical, not persisted, not a Goal/Need/
 * Desire/Commitment/Action/Relationship state, and it needs no factual evidence
 * of its own (any factual premise it rests on must be established separately by
 * `factual_assessment`).
 */
export interface SubjectiveChoiceV0 {
  readonly stance: string;
}

/** Closed V4 conversation cognition proposal (CognitionProposalV0 unchanged). */
export interface ConversationCognitionProposalV4 {
  readonly schema_version: typeof CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V4;
  readonly factual_assessment: FactualAssessmentV0;
  readonly cognition: CognitionProposalV0;
  readonly subjective_choice: SubjectiveChoiceV0 | null;
  readonly communication_directive: CommunicationDirectiveV0;
  readonly clarification_basis: ClarificationBasisV0 | null;
}

const OUTER_KEYS_V4: readonly string[] = [
  "schema_version",
  "factual_assessment",
  "cognition",
  "subjective_choice",
  "communication_directive",
  "clarification_basis"
];
const SUBJECTIVE_CHOICE_KEYS: readonly string[] = ["stance"];

/**
 * Directive enum tokens. A stance equal to one of these is the observed
 * enum-copy failure (`current_intent = "REALIZE_CURRENT_INTENT"`), rejected
 * structurally rather than by wording.
 */
const DIRECTIVE_ENUM_TOKENS_V0: readonly string[] = ["REALIZE_CURRENT_INTENT", "CLARIFY_MISSING_CONTEXT"];

/**
 * Non-choice placeholders. A stance that defers the selection is not a stance:
 * the subject must state the choice (a conditional stance states its condition)
 * or use lawful CLARIFY when information is genuinely required.
 */
const UNRESOLVED_STANCE_PREFIXES_V0: readonly string[] = [
  ...UNRESOLVED_INTENT_PREFIXES_V0,
  "choose an option",
  "select an option"
];

export function validateSubjectiveChoiceV0(
  value: unknown
): { ok: true; choice: SubjectiveChoiceV0 } | { ok: false; detail: string } {
  const detail = "subjective_choice";
  if (!isRecord(value)) return { ok: false, detail: `${detail}: expected object` };
  const keyFailure = exactClosedKeys(value, SUBJECTIVE_CHOICE_KEYS, detail);
  if (keyFailure !== null) return { ok: false, detail: keyFailure };
  const textCheck = validateCanonicalText(value["stance"], `${detail}.stance`);
  if (!textCheck.ok) return { ok: false, detail: textCheck.error.detail };
  const stance = textCheck.value;
  if (stance.trim().length === 0) return { ok: false, detail: `${detail}.stance: must be non-empty` };
  if ([...stance].length > SUBJECTIVE_CHOICE_STANCE_MAX_CODE_POINTS_V0) {
    return { ok: false, detail: `${detail}.stance: exceeds ${SUBJECTIVE_CHOICE_STANCE_MAX_CODE_POINTS_V0} code points` };
  }
  const normalized = stance.trim().toLocaleUpperCase("en-US");
  if (DIRECTIVE_ENUM_TOKENS_V0.includes(normalized)) {
    return { ok: false, detail: `${detail}.stance: directive enum echo is not a subject choice` };
  }
  const lowered = stance.trim().toLocaleLowerCase("en-US");
  if (UNRESOLVED_STANCE_PREFIXES_V0.some((prefix) => lowered.startsWith(prefix))) {
    return { ok: false, detail: `${detail}.stance: states no selected choice` };
  }
  return { ok: true, choice: Object.freeze({ stance }) };
}

/**
 * CognitionProposalV0 keys minus `projection_hash`: for V4 the model proposes
 * SEMANTICS ONLY. The authoritative projection hash is host-bound from the exact
 * in-flight invocation and injected by the host before the frozen
 * CognitionProposalV0 validator runs, so a model that echoes (or mis-formats)
 * integrity metadata can no longer fail or forge the turn.
 */
export const COGNITION_SEMANTIC_KEYS_V0: readonly string[] = [
  "schema_version",
  "reasoning_summary",
  "relevant_memory_refs",
  "considered_context_refs",
  "current_intent",
  "confidence",
  "uncertainty",
  "action_intent",
  "evidence_refs"
];

/**
 * Strict C3 validation. `authoritativeProjectionHash` MUST come from the exact
 * outstanding cognition invocation captured by the host before the call — never
 * from the model output and never from a re-read of "the current" projection.
 */
export function validateConversationCognitionProposalV4(
  value: unknown,
  projection: CognitiveContextProjectionAnyVersion,
  authoritativeProjectionHash: HashV1
): { ok: true; proposal: ConversationCognitionProposalV4 } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "conversation proposal: expected object" };
  const keyFailure = exactClosedKeys(value, OUTER_KEYS_V4, "conversation proposal");
  if (keyFailure !== null) return { ok: false, detail: keyFailure };
  if (value["schema_version"] !== CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V4) {
    return { ok: false, detail: "conversation proposal.schema_version: expected conversation-cognition-proposal-v4" };
  }
  const directiveCheck = validateCommunicationDirectiveV0(value["communication_directive"]);
  if (!directiveCheck.ok) return { ok: false, detail: `conversation proposal.communication_directive: ${directiveCheck.detail}` };
  const directive = directiveCheck.directive as CommunicationDirectiveV0;

  // Model cognition = semantics only. A model-emitted projection_hash is an
  // unknown key here and fails closed; the host injects the authoritative one.
  const cognitionValue = value["cognition"];
  if (!isRecord(cognitionValue)) return { ok: false, detail: "conversation proposal.cognition: expected object" };
  const cognitionKeyFailure = exactClosedKeys(cognitionValue, COGNITION_SEMANTIC_KEYS_V0, "conversation proposal.cognition");
  if (cognitionKeyFailure !== null) return { ok: false, detail: cognitionKeyFailure };
  const cognitionCheck = validateCognitionProposal({ ...cognitionValue, projection_hash: authoritativeProjectionHash });
  if (!cognitionCheck.ok) return { ok: false, detail: `conversation proposal.cognition: ${cognitionCheck.error.detail}` };
  const cognition = cognitionCheck.value as CognitionProposalV0;
  if (cognition.action_intent !== null) {
    return { ok: false, detail: "conversation proposal.cognition.action_intent: must be null for text-response path" };
  }

  const factualCheck = validateFactualAssessmentV0(value["factual_assessment"], projection, cognition);
  if (!factualCheck.ok) return { ok: false, detail: `conversation proposal.${factualCheck.detail}` };

  let subjectiveChoice: SubjectiveChoiceV0 | null = null;
  if (value["subjective_choice"] !== null && value["subjective_choice"] !== undefined) {
    const choiceCheck = validateSubjectiveChoiceV0(value["subjective_choice"]);
    if (!choiceCheck.ok) return { ok: false, detail: `conversation proposal.${choiceCheck.detail}` };
    subjectiveChoice = choiceCheck.choice;
  }

  let clarificationBasis: ClarificationBasisV0 | null = null;
  if (directive.kind === "CLARIFY_MISSING_CONTEXT") {
    // Nothing is selected while clarifying.
    if (subjectiveChoice !== null) {
      return { ok: false, detail: "conversation proposal.subjective_choice: CLARIFY requires exactly null" };
    }
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
  } else if (value["clarification_basis"] !== null) {
    return { ok: false, detail: "conversation proposal.clarification_basis: REALIZE requires exactly null" };
  }

  return {
    ok: true,
    proposal: Object.freeze({
      schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V4,
      factual_assessment: factualCheck.assessment,
      cognition,
      subjective_choice: subjectiveChoice,
      communication_directive: directive,
      clarification_basis: clarificationBasis
    })
  };
}

/** Distinct C3 hash domain covering every V4 field, including both nulls. */
export async function deriveConversationCognitionProposalHashV4(
  proposal: ConversationCognitionProposalV4
): Promise<HashV1> {
  return hashEnvelope(CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V4, {
    schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V4,
    factual_assessment: proposal.factual_assessment,
    cognition: proposal.cognition,
    subjective_choice: proposal.subjective_choice,
    communication_directive: proposal.communication_directive,
    clarification_basis: proposal.clarification_basis
  });
}

/**
 * Revalidates an ALREADY host-bound V4 proposal (the value produced by the V4
 * provider, whose `cognition.projection_hash` was injected by the host). Used by
 * downstream derivation boundaries (Language V5) so a validated proposal can be
 * re-checked without pretending it is the raw model shape. The declared hash
 * MUST equal the authoritative projection hash, so a swapped proposal fails closed.
 */
export function validateHostBoundConversationCognitionProposalV4(
  value: unknown,
  projection: CognitiveContextProjectionAnyVersion
): { ok: true; proposal: ConversationCognitionProposalV4 } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "conversation proposal: expected object" };
  const cognition = value["cognition"];
  if (!isRecord(cognition)) return { ok: false, detail: "conversation proposal.cognition: expected object" };
  const declared = cognition["projection_hash"];
  if (typeof declared !== "string" || declared !== projection.projection_hash) {
    return {
      ok: false,
      detail: "conversation proposal.cognition.projection_hash: does not match the authoritative projection binding"
    };
  }
  const { projection_hash: _ignored, ...semanticCognition } = cognition as Record<string, unknown>;
  void _ignored;
  return validateConversationCognitionProposalV4(
    { ...(value as Record<string, unknown>), cognition: semanticCognition },
    projection,
    projection.projection_hash
  );
}

// ---------------------------------------------------------------------------------
// C4 (AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0)
// ---------------------------------------------------------------------------------

export const CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V5 =
  "conversation-cognition-proposal-v5" as const;
export const CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V5 =
  "characteros-next/runtime/conversation-cognition-proposal/v5/v1" as const;
export const SUBJECTIVE_RATIONALE_MAX_CODE_POINTS_V1 = 256 as const;

export const SUBJECTIVE_CHOICE_KIND_NOT_APPLICABLE_V1 = "NOT_APPLICABLE" as const;
export const SUBJECTIVE_CHOICE_KIND_SELECTED_V1 = "SELECTED" as const;

/**
 * C4 choice applicability. The tag answers ONE question — "did the subject make a
 * turn-local subjective selection?" — and lives only on this field. It is NOT a
 * response-mode enum and carries no task taxonomy: a mixed turn is naturally
 * `factual_assessment` plus a `SELECTED` choice.
 *
 * `subjective_rationale` expresses preference, priority, aversion, willingness or
 * subjective strategy. It carries ZERO factual authority: no evidence refs, no
 * persistence, no canonical state, and nothing about the world, history, time,
 * resources or the subject's own condition may be established by it.
 */
export type SubjectiveChoiceV1 =
  | {
      readonly kind: typeof SUBJECTIVE_CHOICE_KIND_NOT_APPLICABLE_V1;
    }
  | {
      readonly kind: typeof SUBJECTIVE_CHOICE_KIND_SELECTED_V1;
      readonly stance: string;
      readonly subjective_rationale: string | null;
    };

/** Closed C4 conversation cognition proposal (CognitionProposalV0 unchanged). */
export interface ConversationCognitionProposalV5 {
  readonly schema_version: typeof CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V5;
  readonly factual_assessment: FactualAssessmentV0;
  readonly cognition: CognitionProposalV0;
  readonly subjective_choice: SubjectiveChoiceV1;
  readonly communication_directive: CommunicationDirectiveV0;
  readonly clarification_basis: ClarificationBasisV0 | null;
}

const OUTER_KEYS_V5: readonly string[] = [
  "schema_version",
  "factual_assessment",
  "cognition",
  "subjective_choice",
  "communication_directive",
  "clarification_basis"
];
const SUBJECTIVE_CHOICE_NOT_APPLICABLE_KEYS_V1: readonly string[] = ["kind"];
const SUBJECTIVE_CHOICE_SELECTED_KEYS_V1: readonly string[] = ["kind", "stance", "subjective_rationale"];

/** The frozen C3 stance rules, carried over unchanged to the C4 carrier. */
function validateStanceTextV1(
  value: unknown,
  detail: string
): { ok: true; stance: string } | { ok: false; detail: string } {
  const textCheck = validateCanonicalText(value, `${detail}.stance`);
  if (!textCheck.ok) return { ok: false, detail: textCheck.error.detail };
  const stance = textCheck.value;
  if (stance.trim().length === 0) return { ok: false, detail: `${detail}.stance: must be non-empty` };
  if ([...stance].length > SUBJECTIVE_CHOICE_STANCE_MAX_CODE_POINTS_V0) {
    return { ok: false, detail: `${detail}.stance: exceeds ${SUBJECTIVE_CHOICE_STANCE_MAX_CODE_POINTS_V0} code points` };
  }
  const normalized = stance.trim().toLocaleUpperCase("en-US");
  if (DIRECTIVE_ENUM_TOKENS_V0.includes(normalized)) {
    return { ok: false, detail: `${detail}.stance: directive enum echo is not a subject choice` };
  }
  const lowered = stance.trim().toLocaleLowerCase("en-US");
  if (UNRESOLVED_STANCE_PREFIXES_V0.some((prefix) => lowered.startsWith(prefix))) {
    return { ok: false, detail: `${detail}.stance: states no selected choice` };
  }
  return { ok: true, stance };
}

/** Bounded, canonical, non-authoritative subjective basis (null is lawful). */
function validateSubjectiveRationaleV1(
  value: unknown,
  detail: string
): { ok: true; rationale: string | null } | { ok: false; detail: string } {
  if (value === null) return { ok: true, rationale: null };
  const textCheck = validateCanonicalText(value, `${detail}.subjective_rationale`);
  if (!textCheck.ok) return { ok: false, detail: textCheck.error.detail };
  const rationale = textCheck.value;
  if (rationale.trim().length === 0) {
    return { ok: false, detail: `${detail}.subjective_rationale: must be non-empty` };
  }
  if ([...rationale].length > SUBJECTIVE_RATIONALE_MAX_CODE_POINTS_V1) {
    return { ok: false, detail: `${detail}.subjective_rationale: exceeds ${SUBJECTIVE_RATIONALE_MAX_CODE_POINTS_V1} code points` };
  }
  return { ok: true, rationale };
}

/** Closed C4 choice validation: the applicability tag decides the branch. */
export function validateSubjectiveChoiceV1(
  value: unknown
): { ok: true; choice: SubjectiveChoiceV1 } | { ok: false; detail: string } {
  const detail = "subjective_choice";
  if (!isRecord(value)) return { ok: false, detail: `${detail}: expected object` };
  const kind = value["kind"];
  if (kind === SUBJECTIVE_CHOICE_KIND_NOT_APPLICABLE_V1) {
    const keyFailure = exactClosedKeys(value, SUBJECTIVE_CHOICE_NOT_APPLICABLE_KEYS_V1, detail);
    if (keyFailure !== null) return { ok: false, detail: keyFailure };
    return { ok: true, choice: Object.freeze({ kind: SUBJECTIVE_CHOICE_KIND_NOT_APPLICABLE_V1 }) };
  }
  if (kind === SUBJECTIVE_CHOICE_KIND_SELECTED_V1) {
    const keyFailure = exactClosedKeys(value, SUBJECTIVE_CHOICE_SELECTED_KEYS_V1, detail);
    if (keyFailure !== null) return { ok: false, detail: keyFailure };
    const stanceCheck = validateStanceTextV1(value["stance"], detail);
    if (!stanceCheck.ok) return { ok: false, detail: stanceCheck.detail };
    const rationaleCheck = validateSubjectiveRationaleV1(value["subjective_rationale"], detail);
    if (!rationaleCheck.ok) return { ok: false, detail: rationaleCheck.detail };
    return {
      ok: true,
      choice: Object.freeze({
        kind: SUBJECTIVE_CHOICE_KIND_SELECTED_V1,
        stance: stanceCheck.stance,
        subjective_rationale: rationaleCheck.rationale
      })
    };
  }
  return {
    ok: false,
    detail: `${detail}.kind: expected ${SUBJECTIVE_CHOICE_KIND_NOT_APPLICABLE_V1} or ${SUBJECTIVE_CHOICE_KIND_SELECTED_V1}`
  };
}

/**
 * Strict C4 validation. `authoritativeProjectionHash` MUST come from the exact
 * outstanding cognition invocation captured by the host before the call.
 *
 * CLARIFY ⇒ the choice must be `NOT_APPLICABLE` (nothing is selected while
 * clarification is unresolved). REALIZE ⇒ either branch is structurally lawful;
 * WHICH branch should apply is not knowable by the host from natural language and
 * is enforced by experiment qualification (no production task taxonomy).
 */
export function validateConversationCognitionProposalV5(
  value: unknown,
  projection: CognitiveContextProjectionAnyVersion,
  authoritativeProjectionHash: HashV1
): { ok: true; proposal: ConversationCognitionProposalV5 } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "conversation proposal: expected object" };
  const keyFailure = exactClosedKeys(value, OUTER_KEYS_V5, "conversation proposal");
  if (keyFailure !== null) return { ok: false, detail: keyFailure };
  if (value["schema_version"] !== CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V5) {
    return { ok: false, detail: "conversation proposal.schema_version: expected conversation-cognition-proposal-v5" };
  }
  const directiveCheck = validateCommunicationDirectiveV0(value["communication_directive"]);
  if (!directiveCheck.ok) return { ok: false, detail: `conversation proposal.communication_directive: ${directiveCheck.detail}` };
  const directive = directiveCheck.directive as CommunicationDirectiveV0;

  const cognitionValue = value["cognition"];
  if (!isRecord(cognitionValue)) return { ok: false, detail: "conversation proposal.cognition: expected object" };
  const cognitionKeyFailure = exactClosedKeys(cognitionValue, COGNITION_SEMANTIC_KEYS_V0, "conversation proposal.cognition");
  if (cognitionKeyFailure !== null) return { ok: false, detail: cognitionKeyFailure };
  const cognitionCheck = validateCognitionProposal({ ...cognitionValue, projection_hash: authoritativeProjectionHash });
  if (!cognitionCheck.ok) return { ok: false, detail: `conversation proposal.cognition: ${cognitionCheck.error.detail}` };
  const cognition = cognitionCheck.value as CognitionProposalV0;
  if (cognition.action_intent !== null) {
    return { ok: false, detail: "conversation proposal.cognition.action_intent: must be null for text-response path" };
  }

  const factualCheck = validateFactualAssessmentV0(value["factual_assessment"], projection, cognition);
  if (!factualCheck.ok) return { ok: false, detail: `conversation proposal.${factualCheck.detail}` };

  const choiceCheck = validateSubjectiveChoiceV1(value["subjective_choice"]);
  if (!choiceCheck.ok) return { ok: false, detail: `conversation proposal.${choiceCheck.detail}` };
  const subjectiveChoice = choiceCheck.choice;

  let clarificationBasis: ClarificationBasisV0 | null = null;
  if (directive.kind === "CLARIFY_MISSING_CONTEXT") {
    if (subjectiveChoice.kind !== SUBJECTIVE_CHOICE_KIND_NOT_APPLICABLE_V1) {
      return { ok: false, detail: "conversation proposal.subjective_choice: CLARIFY requires NOT_APPLICABLE" };
    }
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
  } else if (value["clarification_basis"] !== null) {
    return { ok: false, detail: "conversation proposal.clarification_basis: REALIZE requires exactly null" };
  }

  return {
    ok: true,
    proposal: Object.freeze({
      schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V5,
      factual_assessment: factualCheck.assessment,
      cognition,
      subjective_choice: subjectiveChoice,
      communication_directive: directive,
      clarification_basis: clarificationBasis
    })
  };
}

/** Distinct C4 hash domain covering every V5 field, including the tagged choice. */
export async function deriveConversationCognitionProposalHashV5(
  proposal: ConversationCognitionProposalV5
): Promise<HashV1> {
  return hashEnvelope(CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V5, {
    schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V5,
    factual_assessment: proposal.factual_assessment,
    cognition: proposal.cognition,
    subjective_choice: proposal.subjective_choice,
    communication_directive: proposal.communication_directive,
    clarification_basis: proposal.clarification_basis
  });
}

/**
 * Revalidates an ALREADY host-bound V5 proposal (the value produced by the V5
 * provider, whose `cognition.projection_hash` was injected by the host).
 */
export function validateHostBoundConversationCognitionProposalV5(
  value: unknown,
  projection: CognitiveContextProjectionAnyVersion
): { ok: true; proposal: ConversationCognitionProposalV5 } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "conversation proposal: expected object" };
  const cognition = value["cognition"];
  if (!isRecord(cognition)) return { ok: false, detail: "conversation proposal.cognition: expected object" };
  const declared = cognition["projection_hash"];
  if (typeof declared !== "string" || declared !== projection.projection_hash) {
    return {
      ok: false,
      detail: "conversation proposal.cognition.projection_hash: does not match the authoritative projection binding"
    };
  }
  const { projection_hash: _ignored, ...semanticCognition } = cognition as Record<string, unknown>;
  void _ignored;
  return validateConversationCognitionProposalV5(
    { ...(value as Record<string, unknown>), cognition: semanticCognition },
    projection,
    projection.projection_hash
  );
}

// ---------------------------------------------------------------------------------
// C4.4 (AFFECT_COGNITION_C4_4_SUBJECTIVE_SELECTION_SEMANTICS_AND_REF_HANDLES_V0)
//
// CHANGE A — applicability semantics. The tag names the CATEGORY ("subjective
// selection"), not the carrier. A subjective selection exists ONLY when the
// supplied facts and rules leave more than one behaviourally admissible,
// fact-compatible response and the subject selects among them; stating,
// reporting, calculating, extracting, reversing or classifying a determined
// result is NOT a subjective selection.
//
// CHANGE B — model-wire reference handles. The model SELECTS advertised items by
// short host-issued handle; the host owns canonical identity and resolves exact
// handles to canonical refs before the (unchanged) validators run. Canonical refs
// remain the authoritative stored representation.
// ---------------------------------------------------------------------------------

export const CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V6 =
  "conversation-cognition-proposal-v6" as const;
export const CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V6 =
  "characteros-next/runtime/conversation-cognition-proposal/v6/v1" as const;

export const SUBJECTIVE_SELECTION_KIND_NO_SELECTION_V1 = "NO_SUBJECTIVE_SELECTION" as const;
export const SUBJECTIVE_SELECTION_KIND_SELECTED_V1 = "SUBJECTIVE_SELECTION" as const;

export const SUBJECTIVE_SELECTION_MAX_CODE_POINTS_V1 = 256 as const;
export const SUBJECTIVE_SELECTION_RATIONALE_MAX_CODE_POINTS_V1 = 256 as const;
export const MAX_ADVERTISED_HANDLES_V0 = 64 as const;

/**
 * C4.4 tagged subjective selection. `NO_SUBJECTIVE_SELECTION` means the supplied
 * facts and rules determine the response content; `SUBJECTIVE_SELECTION` means the
 * subject had behavioural latitude and selected a stance.
 */
export type SubjectiveSelectionV1 =
  | {
      readonly kind: typeof SUBJECTIVE_SELECTION_KIND_NO_SELECTION_V1;
    }
  | {
      readonly kind: typeof SUBJECTIVE_SELECTION_KIND_SELECTED_V1;
      readonly stance: string;
      readonly subjective_rationale: string | null;
    };

/** Closed C4.4 authoritative proposal (canonical refs; CognitionProposalV0 unchanged). */
export interface ConversationCognitionProposalV6 {
  readonly schema_version: typeof CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V6;
  readonly factual_assessment: FactualAssessmentV0;
  readonly cognition: CognitionProposalV0;
  readonly subjective_selection: SubjectiveSelectionV1;
  readonly communication_directive: CommunicationDirectiveV0;
  readonly clarification_basis: ClarificationBasisV0 | null;
}

const OUTER_KEYS_V6: readonly string[] = [
  "schema_version",
  "factual_assessment",
  "cognition",
  "subjective_selection",
  "communication_directive",
  "clarification_basis"
];
const SUBJECTIVE_SELECTION_NO_SELECTION_KEYS_V1: readonly string[] = ["kind"];
const SUBJECTIVE_SELECTION_SELECTED_KEYS_V1: readonly string[] = ["kind", "stance", "subjective_rationale"];

/** Model-wire cognition keys: the three ref arrays become handle arrays. */
const COGNITION_WIRE_KEYS_V6: readonly string[] = [
  "schema_version",
  "reasoning_summary",
  "relevant_memory_handles",
  "considered_context_handles",
  "current_intent",
  "confidence",
  "uncertainty",
  "action_intent",
  "evidence_handles"
];
const CLAIM_WIRE_KEYS_V6: readonly string[] = ["kind", "text", "source_handles"];
const HANDLE_PATTERN_V0 = /^([FC])([1-9][0-9]*)$/;

/** The frozen stance rules, carried over unchanged to the C4.4 carrier. */
function validateStanceTextV6(
  value: unknown,
  detail: string
): { ok: true; stance: string } | { ok: false; detail: string } {
  const textCheck = validateCanonicalText(value, `${detail}.stance`);
  if (!textCheck.ok) return { ok: false, detail: textCheck.error.detail };
  const stance = textCheck.value;
  if (stance.trim().length === 0) return { ok: false, detail: `${detail}.stance: must be non-empty` };
  if ([...stance].length > SUBJECTIVE_SELECTION_MAX_CODE_POINTS_V1) {
    return { ok: false, detail: `${detail}.stance: exceeds ${SUBJECTIVE_SELECTION_MAX_CODE_POINTS_V1} code points` };
  }
  const normalized = stance.trim().toLocaleUpperCase("en-US");
  if (DIRECTIVE_ENUM_TOKENS_V0.includes(normalized)) {
    return { ok: false, detail: `${detail}.stance: directive enum echo is not a subject choice` };
  }
  const lowered = stance.trim().toLocaleLowerCase("en-US");
  if (UNRESOLVED_STANCE_PREFIXES_V0.some((prefix) => lowered.startsWith(prefix))) {
    return { ok: false, detail: `${detail}.stance: states no selected choice` };
  }
  return { ok: true, stance };
}

/** Bounded, canonical, non-authoritative subjective basis (null is lawful). */
function validateSubjectiveRationaleV6(
  value: unknown,
  detail: string
): { ok: true; rationale: string | null } | { ok: false; detail: string } {
  if (value === null) return { ok: true, rationale: null };
  const textCheck = validateCanonicalText(value, `${detail}.subjective_rationale`);
  if (!textCheck.ok) return { ok: false, detail: textCheck.error.detail };
  const rationale = textCheck.value;
  if (rationale.trim().length === 0) return { ok: false, detail: `${detail}.subjective_rationale: must be non-empty` };
  if ([...rationale].length > SUBJECTIVE_SELECTION_RATIONALE_MAX_CODE_POINTS_V1) {
    return { ok: false, detail: `${detail}.subjective_rationale: exceeds ${SUBJECTIVE_SELECTION_RATIONALE_MAX_CODE_POINTS_V1} code points` };
  }
  return { ok: true, rationale };
}

/** Closed C4.4 selection validation: the category tag decides the branch. */
export function validateSubjectiveSelectionV1(
  value: unknown
): { ok: true; selection: SubjectiveSelectionV1 } | { ok: false; detail: string } {
  const detail = "subjective_selection";
  if (!isRecord(value)) return { ok: false, detail: `${detail}: expected object` };
  const kind = value["kind"];
  if (kind === SUBJECTIVE_SELECTION_KIND_NO_SELECTION_V1) {
    const keyFailure = exactClosedKeys(value, SUBJECTIVE_SELECTION_NO_SELECTION_KEYS_V1, detail);
    if (keyFailure !== null) return { ok: false, detail: keyFailure };
    return { ok: true, selection: Object.freeze({ kind: SUBJECTIVE_SELECTION_KIND_NO_SELECTION_V1 }) };
  }
  if (kind === SUBJECTIVE_SELECTION_KIND_SELECTED_V1) {
    const keyFailure = exactClosedKeys(value, SUBJECTIVE_SELECTION_SELECTED_KEYS_V1, detail);
    if (keyFailure !== null) return { ok: false, detail: keyFailure };
    const stanceCheck = validateStanceTextV6(value["stance"], detail);
    if (!stanceCheck.ok) return { ok: false, detail: stanceCheck.detail };
    const rationaleCheck = validateSubjectiveRationaleV6(value["subjective_rationale"], detail);
    if (!rationaleCheck.ok) return { ok: false, detail: rationaleCheck.detail };
    return {
      ok: true,
      selection: Object.freeze({
        kind: SUBJECTIVE_SELECTION_KIND_SELECTED_V1,
        stance: stanceCheck.stance,
        subjective_rationale: rationaleCheck.rationale
      })
    };
  }
  return {
    ok: false,
    detail: `${detail}.kind: expected ${SUBJECTIVE_SELECTION_KIND_NO_SELECTION_V1} or ${SUBJECTIVE_SELECTION_KIND_SELECTED_V1}`
  };
}

// ---------------------------------------------------------------------------------
// Model-wire handles (host-issued, turn-local, exact)
// ---------------------------------------------------------------------------------

export interface SourceHandleMapV0 {
  /** ordered advertised handles, e.g. ["F1","F2"] then ["C1",...] */
  readonly advertised: readonly string[];
  readonly handleToRef: ReadonlyMap<string, string>;
  readonly refToHandle: ReadonlyMap<string, string>;
  readonly factualSourceHandles: readonly string[];
  readonly contextHandles: readonly string[];
}

/**
 * Builds the invocation-local handle map from the EXISTING authority sets, in the
 * frozen deterministic order of those sets (sorted refs), so the same projection
 * always yields the same map. `F*` covers the lawful factual sources, `C*` the
 * citeable evidence set; the namespaces are never interchangeable.
 */
export function buildSourceHandleMapV0(
  projection: CognitiveContextProjectionAnyVersion
): SourceHandleMapV0 {
  const factualRefs = [...new Set<string>(factualAssessmentSourceRefs(projection) as readonly string[])].sort();
  const evidenceRefs = [...new Set<string>(allowedEvidenceSetForHandles(projection) as readonly string[])].sort();
  const handleToRef = new Map<string, string>();
  const refToHandle = new Map<string, string>();
  const factualSourceHandles: string[] = [];
  const contextHandles: string[] = [];
  factualRefs.slice(0, MAX_ADVERTISED_HANDLES_V0).forEach((ref, index) => {
    const handle = `F${index + 1}`;
    handleToRef.set(handle, ref);
    factualSourceHandles.push(handle);
    if (!refToHandle.has(ref)) refToHandle.set(ref, handle);
  });
  const contextOnlyRefs = evidenceRefs.filter((ref) => !factualRefs.includes(ref));
  contextOnlyRefs.slice(0, MAX_ADVERTISED_HANDLES_V0).forEach((ref, index) => {
    const handle = `C${index + 1}`;
    handleToRef.set(handle, ref);
    contextHandles.push(handle);
    if (!refToHandle.has(ref)) refToHandle.set(ref, handle);
  });
  return Object.freeze({
    advertised: Object.freeze([...factualSourceHandles, ...contextHandles]),
    handleToRef,
    refToHandle,
    factualSourceHandles: Object.freeze(factualSourceHandles),
    contextHandles: Object.freeze(contextHandles)
  });
}

/**
 * Resolves one handle array. `allowContext` is false for factual claim sources
 * (namespace escalation is forbidden). Unknown handles fail closed with a
 * structural code; duplication is rejected; the resolved refs are returned in the
 * canonical (lexicographic) order the authoritative validators require.
 */
export function resolveHandleArrayV0(
  value: unknown,
  map: SourceHandleMapV0,
  detail: string,
  allowContext: boolean
): { ok: true; refs: readonly string[] } | { ok: false; detail: string } {
  if (!Array.isArray(value)) return { ok: false, detail: `${detail}: expected array` };
  const refs: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") return { ok: false, detail: `${detail}: handle must be a string` };
    const match = HANDLE_PATTERN_V0.exec(entry);
    if (match === null) return { ok: false, detail: `${detail}: ${entry} is not a valid handle` };
    const isContext = match[1] === "C";
    if (isContext && !allowContext) {
      return { ok: false, detail: `${detail}: ${entry} is a context handle and can never be a factual claim source` };
    }
    const ref = map.handleToRef.get(entry);
    if (ref === undefined) {
      return {
        ok: false,
        detail: isContext
          ? `${detail}: UNKNOWN_CONTEXT_HANDLE ${entry}`
          : `${detail}: UNKNOWN_SOURCE_HANDLE ${entry}`
      };
    }
    if (seen.has(ref)) return { ok: false, detail: `${detail}: duplicate handle for ${ref}` };
    seen.add(ref);
    refs.push(ref);
  }
  return { ok: true, refs: Object.freeze([...refs].sort()) };
}

/** Citeable-evidence set used for the `C*` namespace (same authority as §15). */
function allowedEvidenceSetForHandles(projection: CognitiveContextProjectionAnyVersion): readonly string[] {
  return [...allowedEvidenceSet(projection) as ReadonlySet<string>].sort();
}

/** Renders the two handle blocks appended to the frozen subject-data rendering. */
export function renderHandleBlocksV0(
  projection: CognitiveContextProjectionAnyVersion,
  map: SourceHandleMapV0
): string {
  const factual = map.factualSourceHandles.map((handle) => `- ${handle}: ${map.handleToRef.get(handle)}`).join("\n");
  const context = map.contextHandles.map((handle) => `- ${handle}: ${map.handleToRef.get(handle)}`).join("\n");
  void projection;
  return [
    "FACTUAL SOURCE HANDLES (the ONLY handles allowed in factual_assessment.claims[*].source_handles; each F handle resolves to a host-owned canonical factual source ref):",
    factual.length === 0 ? "(none)" : factual,
    "CONTEXT HANDLES (allowed in relevant_memory_handles, considered_context_handles and evidence_handles; these are visible context and are NEVER factual sources, so a C handle can never be a claim source):",
    context.length === 0 ? "(none)" : context
  ].join("\n");
}

/**
 * Validates the C4.4 MODEL WIRE output (handles), canonicalizes it to authoritative
 * canonical refs, and runs the frozen authoritative validators unchanged. This is
 * the single boundary where identity leaves model authority.
 */
export function canonicalizeConversationCognitionModelOutputV6(
  value: unknown,
  projection: CognitiveContextProjectionAnyVersion,
  authoritativeProjectionHash: HashV1
): { ok: true; proposal: ConversationCognitionProposalV6 } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "conversation proposal: expected object" };
  const keyFailure = exactClosedKeys(value, OUTER_KEYS_V6, "conversation proposal");
  if (keyFailure !== null) return { ok: false, detail: keyFailure };
  if (value["schema_version"] !== CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V6) {
    return { ok: false, detail: "conversation proposal.schema_version: expected conversation-cognition-proposal-v6" };
  }
  const map = buildSourceHandleMapV0(projection);

  const cognitionValue = value["cognition"];
  if (!isRecord(cognitionValue)) return { ok: false, detail: "conversation proposal.cognition: expected object" };
  const cognitionKeyFailure = exactClosedKeys(cognitionValue, COGNITION_WIRE_KEYS_V6, "conversation proposal.cognition");
  if (cognitionKeyFailure !== null) return { ok: false, detail: cognitionKeyFailure };
  const memory = resolveHandleArrayV0(cognitionValue["relevant_memory_handles"], map, "conversation proposal.cognition.relevant_memory_handles", true);
  if (!memory.ok) return memory;
  const context = resolveHandleArrayV0(cognitionValue["considered_context_handles"], map, "conversation proposal.cognition.considered_context_handles", true);
  if (!context.ok) return context;
  const evidence = resolveHandleArrayV0(cognitionValue["evidence_handles"], map, "conversation proposal.cognition.evidence_handles", true);
  if (!evidence.ok) return evidence;

  const assessmentValue = value["factual_assessment"];
  if (!isRecord(assessmentValue)) return { ok: false, detail: "conversation proposal.factual_assessment: expected object" };
  const assessmentKeys = exactClosedKeys(assessmentValue, ["claims"], "conversation proposal.factual_assessment");
  if (assessmentKeys !== null) return { ok: false, detail: assessmentKeys };
  if (!Array.isArray(assessmentValue["claims"])) return { ok: false, detail: "conversation proposal.factual_assessment.claims: expected array" };
  const claims: unknown[] = [];
  for (let index = 0; index < assessmentValue["claims"].length; index += 1) {
    const claim = assessmentValue["claims"][index];
    const detail = `conversation proposal.factual_assessment.claims[${index}]`;
    if (!isRecord(claim)) return { ok: false, detail: `${detail}: expected object` };
    const claimKeys = exactClosedKeys(claim, CLAIM_WIRE_KEYS_V6, detail);
    if (claimKeys !== null) return { ok: false, detail: claimKeys };
    const resolved = resolveHandleArrayV0(claim["source_handles"], map, `${detail}.source_handles`, false);
    if (!resolved.ok) return resolved;
    claims.push({ kind: claim["kind"], text: claim["text"], source_refs: resolved.refs });
  }

  const canonical = {
    schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V6,
    factual_assessment: { claims },
    cognition: {
      schema_version: cognitionValue["schema_version"],
      reasoning_summary: cognitionValue["reasoning_summary"],
      relevant_memory_refs: memory.refs,
      considered_context_refs: context.refs,
      current_intent: cognitionValue["current_intent"],
      confidence: cognitionValue["confidence"],
      uncertainty: cognitionValue["uncertainty"],
      action_intent: cognitionValue["action_intent"],
      evidence_refs: evidence.refs
    },
    subjective_selection: value["subjective_selection"],
    communication_directive: value["communication_directive"],
    clarification_basis: value["clarification_basis"]
  };
  return validateConversationCognitionProposalV6(canonical, projection, authoritativeProjectionHash);
}

/**
 * Strict C4.4 validation of the AUTHORITATIVE (already canonicalized) proposal.
 * Identical obligations to C4/V5: lawful factual sources, citation binding into
 * both cognition arrays, CLARIFY discipline, action_intent null.
 */
export function validateConversationCognitionProposalV6(
  value: unknown,
  projection: CognitiveContextProjectionAnyVersion,
  authoritativeProjectionHash: HashV1
): { ok: true; proposal: ConversationCognitionProposalV6 } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "conversation proposal: expected object" };
  const keyFailure = exactClosedKeys(value, OUTER_KEYS_V6, "conversation proposal");
  if (keyFailure !== null) return { ok: false, detail: keyFailure };
  if (value["schema_version"] !== CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V6) {
    return { ok: false, detail: "conversation proposal.schema_version: expected conversation-cognition-proposal-v6" };
  }
  const directiveCheck = validateCommunicationDirectiveV0(value["communication_directive"]);
  if (!directiveCheck.ok) return { ok: false, detail: `conversation proposal.communication_directive: ${directiveCheck.detail}` };
  const directive = directiveCheck.directive as CommunicationDirectiveV0;

  const cognitionValue = value["cognition"];
  if (!isRecord(cognitionValue)) return { ok: false, detail: "conversation proposal.cognition: expected object" };
  const cognitionKeyFailure = exactClosedKeys(cognitionValue, COGNITION_SEMANTIC_KEYS_V0, "conversation proposal.cognition");
  if (cognitionKeyFailure !== null) return { ok: false, detail: cognitionKeyFailure };
  const cognitionCheck = validateCognitionProposal({ ...cognitionValue, projection_hash: authoritativeProjectionHash });
  if (!cognitionCheck.ok) return { ok: false, detail: `conversation proposal.cognition: ${cognitionCheck.error.detail}` };
  const cognition = cognitionCheck.value as CognitionProposalV0;
  if (cognition.action_intent !== null) {
    return { ok: false, detail: "conversation proposal.cognition.action_intent: must be null for text-response path" };
  }

  const factualCheck = validateFactualAssessmentV0(value["factual_assessment"], projection, cognition);
  if (!factualCheck.ok) return { ok: false, detail: `conversation proposal.${factualCheck.detail}` };

  const selectionCheck = validateSubjectiveSelectionV1(value["subjective_selection"]);
  if (!selectionCheck.ok) return { ok: false, detail: `conversation proposal.${selectionCheck.detail}` };
  const subjectiveSelection = selectionCheck.selection;

  let clarificationBasis: ClarificationBasisV0 | null = null;
  if (directive.kind === "CLARIFY_MISSING_CONTEXT") {
    if (subjectiveSelection.kind !== SUBJECTIVE_SELECTION_KIND_NO_SELECTION_V1) {
      return { ok: false, detail: "conversation proposal.subjective_selection: CLARIFY requires NO_SUBJECTIVE_SELECTION" };
    }
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
  } else if (value["clarification_basis"] !== null) {
    return { ok: false, detail: "conversation proposal.clarification_basis: REALIZE requires exactly null" };
  }

  return {
    ok: true,
    proposal: Object.freeze({
      schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V6,
      factual_assessment: factualCheck.assessment,
      cognition,
      subjective_selection: subjectiveSelection,
      communication_directive: directive,
      clarification_basis: clarificationBasis
    })
  };
}

/** Distinct C4.4 hash domain over the CANONICAL authoritative representation. */
export async function deriveConversationCognitionProposalHashV6(
  proposal: ConversationCognitionProposalV6
): Promise<HashV1> {
  return hashEnvelope(CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V6, {
    schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V6,
    factual_assessment: proposal.factual_assessment,
    cognition: proposal.cognition,
    subjective_selection: proposal.subjective_selection,
    communication_directive: proposal.communication_directive,
    clarification_basis: proposal.clarification_basis
  });
}

/** Revalidates an ALREADY host-bound C4.4 proposal. */
export function validateHostBoundConversationCognitionProposalV6(
  value: unknown,
  projection: CognitiveContextProjectionAnyVersion
): { ok: true; proposal: ConversationCognitionProposalV6 } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "conversation proposal: expected object" };
  const cognition = value["cognition"];
  if (!isRecord(cognition)) return { ok: false, detail: "conversation proposal.cognition: expected object" };
  const declared = cognition["projection_hash"];
  if (typeof declared !== "string" || declared !== projection.projection_hash) {
    return {
      ok: false,
      detail: "conversation proposal.cognition.projection_hash: does not match the authoritative projection binding"
    };
  }
  const { projection_hash: _ignored, ...semanticCognition } = cognition as Record<string, unknown>;
  void _ignored;
  return validateConversationCognitionProposalV6(
    { ...(value as Record<string, unknown>), cognition: semanticCognition },
    projection,
    projection.projection_hash
  );
}
