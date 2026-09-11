/**
 * P2-next — CognitionActionTransitionExecutor V0 (transition-contracts §16).
 *
 * Pipeline: SubjectState → controlled projection → CognitionProviderV0 →
 * validate (schema / projection binding / evidence grounding / action space)
 * → ZERO-DELTA durable canonical NO_OP (transition_type "CognitionAction").
 *
 * Canonical authority:
 *  - SubjectCore remains the ONLY canonical mutator; the executor orchestrates
 *    the frozen two-call protocol and never assigns canonical state.
 *  - The V0 field-ownership matrix authorizes CognitionAction to write only
 *    regulation/context; V0 defines no cognitive persistence, so the canonical
 *    footprint is a zero-delta durable NO_OP — NO_ACTION and ActionIntent are
 *    both legal, both leave canonical state byte-unchanged (+0 revision, +0
 *    trace beyond the journal record, +0 memory, +0 affect).
 *  - CognitionAction never advances logical time (§12: occurrence == current).
 *  - ActionIntent is a typed declarative proposal — never an Outcome, never a
 *    memory write, never an affect/belief/relationship mutation.
 *
 * Failure semantics (all BEFORE the canonical reservation, canonical +0):
 *  - provider failure     → SERVICE_UNAVAILABLE / FAIL-SERVICE-001
 *  - schema violation     → INVALID_SCHEMA / SS-SCHEMA-001
 *  - stale projection     → INVALID_SCHEMA / SS-SCHEMA-001
 *  - unsupported evidence → UNSUPPORTED_EVIDENCE_REF / LLM-EVID-001
 *  - action not allowed   → INVALID_SCHEMA / SS-SCHEMA-001
 *
 * Identity/idempotency: deterministic transition id over
 * {subject, revision, occurrence, cause_refs, projection_hash, allowed
 * actions}; same identity + same fingerprint ⇒ durable replay (+0);
 * changed fingerprint ⇒ TRANSITION_ID_REUSE fail closed (journal-owned).
 */

import type {
  CanonicalRefV0,
  CanonicalTransitionProposalV1,
  CommitReservedOutcome,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0,
  TransitionIdV0,
  SubjectStateV0,
  SubjectStateV4
} from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import { isReservedRelationshipCoreDimensionIdV0, refKind } from "@characteros-next/subject-core";
import type {
  FactualMemoryEvidenceBundleV0,
  FactualMemoryEvidenceResolverV0
} from "./factual-memory-evidence.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { TransitionCapabilities } from "../../ports/subject-core-port.js";
import { deriveInteractionFamiliarityReadProjectionV0 } from "../../transitions/relationship/relationship-interaction-familiarity-read-projection.js";
import { deriveInteractionFamiliarityCognitionInfluencesV0 } from "../../transitions/relationship/relationship-interaction-familiarity-cognition-influence.js";
import {
  buildInteractionFamiliarityCounterpartQueryV0,
  orchestrateInteractionFamiliarityRetrievalV0,
  type InteractionFamiliarityRetrievalOrchestrationV0
} from "../../transitions/relationship/relationship-interaction-familiarity-retrieval-orchestration.js";
import {
  actionIntentAllowed,
  allowedEvidenceSet,
  BELIEF_COGNITION_MAX_ITEMS,
  cognitiveProjectionHash,
  findUnsupportedEvidenceRef,
  validateCognitionProposal,
  COGNITIVE_CONTEXT_PROJECTION_V2_SCHEMA_VERSION,
  type BeliefStanceProjectionV0,
  type CognitiveContextProjectionAnyVersion,
  type CognitiveContextProjectionV0,
  type CognitiveContextProjectionV1,
  type CognitiveContextProjectionV2,
  type CognitionActionInputV0,
  type CognitionProposalV0
} from "./types.js";
import { anchorContext, stageFailure, TransitionStageFailure } from "../common.js";
import { projectCanonicalAffectForCognitionV0 } from "./canonical-affect-cognition-projection-v0.js";

export interface CognitionActionExecutionResultV0 {
  /** Canonical outcome: a durable zero-delta NO_OP on success. */
  readonly outcome: CommitReservedOutcome;
  /** The validated provider proposal (workflow-level; never canonical). */
  readonly cognition: CognitionProposalV0;
  /** The exact projection the provider answered (audit/replay evidence). */
  readonly projection: CognitiveContextProjectionAnyVersion;
  /**
   * RELATIONSHIP_FAMILIARITY_RETRIEVAL_ORCHESTRATION_V0 — deterministic
   * observation-only trace of the AUTOMATIC familiarity-priority retrieval
   * performed inside normal execution from the frozen influence artifacts
   * (zero attempts under BASIC_CONTEXT_FIRST / no influence). NOT an authority;
   * selected refs are canonical episode refs already validated by the existing
   * Memory retrieval law.
   */
  readonly interaction_familiarity_retrieval?: InteractionFamiliarityRetrievalOrchestrationV0;
}

export const COGNITION_ACTION_TRANSITION_ID_PROJECTION =
  "characteros-next/runtime/cognition-action-transition-id/v1" as const;

/** Deterministic transition id over the EXACT input tuple (no wall clock). */
export async function cognitionActionTransitionId(params: {
  readonly subjectId: string;
  readonly stateRevision: number;
  readonly occurrenceLogicalTime: number;
  readonly causeRefs: readonly string[];
  readonly projectionHash: string;
  readonly allowedActions: readonly { action_type: string; target_ref: string | null }[];
}): Promise<TransitionIdV0> {
  const digest = await hashEnvelope(COGNITION_ACTION_TRANSITION_ID_PROJECTION, {
    subject_id: params.subjectId,
    expected_state_revision: params.stateRevision,
    occurrence_logical_time: params.occurrenceLogicalTime,
    cause_refs: [...params.causeRefs],
    projection_hash: params.projectionHash,
    allowed_actions: params.allowedActions.map((a) => ({
      action_type: a.action_type,
      target_ref: a.target_ref
    }))
  });
  return `t-cog-${digest.replace(/^sha256:/, "")}` as TransitionIdV0;
}

/**
 * The exact canonical zero-delta proposal (single source of truth shared with
 * host capability minting). occurrence == current logical time — this
 * transition never advances logical time.
 */
export async function buildCognitionActionProposal(params: {
  readonly subjectId: string;
  readonly stateRevision: number;
  readonly occurrenceLogicalTime: number;
  readonly causeRefs: readonly CanonicalRefV0[];
  readonly projectionHash: string;
  readonly allowedActions: readonly { action_type: string; target_ref: string | null }[];
}): Promise<CanonicalTransitionProposalV1> {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: await cognitionActionTransitionId({
      subjectId: params.subjectId,
      stateRevision: params.stateRevision,
      occurrenceLogicalTime: params.occurrenceLogicalTime,
      causeRefs: params.causeRefs,
      projectionHash: params.projectionHash,
      allowedActions: params.allowedActions
    }),
    subject_id: params.subjectId as IdentifierV0,
    transition_type: "CognitionAction",
    expected_state_revision: params.stateRevision as StateRevisionV0,
    time_input: {
      kind: "OCCURRENCE",
      occurrence_logical_time: params.occurrenceLogicalTime as LogicalTimeV0
    },
    cause_refs: [...params.causeRefs],
    domain_deltas: [],
    external_refs: []
  };
}

/**
 * Builds the frozen controlled projection from the authoritative snapshot.
 *
 * PUBLIC TRUST BOUNDARY (EVIDENCE_AUTHORITY_BOUNDARY): this function accepts
 * EXACTLY the authoritative snapshot — no caller-supplied ref arrays. The
 * citeable-evidence augmentation used by the automatic familiarity-priority
 * retrieval lives in the module-private
 * buildCognitiveContextProjectionInternal and is populated ONLY by the trusted
 * executor from refs that already passed the existing
 * validateMemoryRetrievalResult law (SERIALIZED_REF != EVIDENCE_AUTHORITY;
 * CALLER_REF != VALIDATED_MEMORY_EVIDENCE).
 */
export async function buildCognitiveContextProjection(
  snapshot: SubjectStateV0
): Promise<CognitiveContextProjectionV0> {
  return buildCognitiveContextProjectionInternal(snapshot, null) as Promise<CognitiveContextProjectionV0>;
}

/**
 * CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — the explicit-v4 projection
 * build: RAW_CANONICAL_VA replaces the legacy Affect/Mood sections. Fail
 * closed on wrong v4 pairing or malformed affect.
 */
export async function buildCognitiveContextProjectionV2ForExplicitV4(
  snapshot: SubjectStateV4
): Promise<CognitiveContextProjectionV2> {
  return buildCognitiveContextProjectionInternal(snapshot as unknown as SubjectStateV0, null) as Promise<CognitiveContextProjectionV2>;
}

/**
 * EXPERIENCE_MEMORY_FUTURE_COGNITION_INTEGRATION_V0 — explicit versioned
 * cognition input: the V0 factual/context surface PLUS resolved factual memory
 * evidence. The evidence joins the hashed body; never a silent V0 rehash.
 */
export async function buildCognitiveContextProjectionV1(
  snapshot: SubjectStateV0,
  additionalRecentRetrievalRefs: readonly CanonicalRefV0[] | null,
  factualEvidence: FactualMemoryEvidenceBundleV0
): Promise<CognitiveContextProjectionV1> {
  const projection = await buildCognitiveContextProjectionInternal(
    snapshot,
    additionalRecentRetrievalRefs,
    factualEvidence
  );
  return projection as CognitiveContextProjectionV1;
}

/**
 * CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — the explicit-v4 projection body:
 * the V1 factual/context/evidence surface with the legacy Affect/Mood sections
 * REPLACED by the exact committed CanonicalAffectV0 raw values. Fail closed on
 * wrong v4 pairing (§12) or malformed affect; no rounding; no history; no
 * dynamics config; no named emotions; no Mood.
 */
async function buildExplicitV4CognitiveContextProjection(
  snapshot: SubjectStateV4,
  factualEvidence: FactualMemoryEvidenceBundleV0 | null
): Promise<CognitiveContextProjectionV2> {
  const profile = (snapshot.mechanism_config as { affect_profile?: { profile_id?: string; timebase?: string } })
    .affect_profile;
  if (profile?.profile_id !== "BOUNDED_AFFECT_DYNAMICS_V0" || profile?.timebase !== "tick") {
    throw new Error(
      "cognitive context projection: v4 affect profile pairing mismatch — BOUNDED_AFFECT_DYNAMICS_V0/tick required"
    );
  }
  const interactionFamiliarity = await Promise.all(
    [...snapshot.relationships.counterparts]
      .sort((a, b) => (a.counterpart_ref < b.counterpart_ref ? -1 : a.counterpart_ref > b.counterpart_ref ? 1 : 0))
      .map(async (counterpart) => {
        const derived = await deriveInteractionFamiliarityReadProjectionV0({
          subjectState: snapshot as unknown as SubjectStateV0,
          counterpart_ref: counterpart.counterpart_ref as never
        });
        if (!derived.ok) {
          throw new Error(
            `cognitive context projection: interaction familiarity read projection failed (${derived.code}: ${derived.detail})`
          );
        }
        return derived.projection;
      })
  );
  const projectionBody = {
    subject_id: snapshot.identity.subject_id as string,
    current_logical_time: snapshot.runtime_metadata.logical_time as number,
    state_revision: snapshot.runtime_metadata.state_revision as number,
    traits_dimensions: { ...snapshot.traits_seed.dimensions } as Record<string, number>,
    // PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0: CURRENT acquired Personality
    // P(t) — canonical numeric values, deterministically ordered. Distinct from
    // the immutable genesis prior above.
    personality_dimensions: Object.fromEntries(
      [...snapshot.personality.dimensions]
        .sort((a, b) => (a.dimension_id < b.dimension_id ? -1 : a.dimension_id > b.dimension_id ? 1 : 0))
        .map((dimension) => [dimension.dimension_id as string, dimension.value as number])
    ) as Record<string, number>,
    // RAW_CANONICAL_VA: exact committed values, no transform (fail closed on
    // malformed shapes; no affect_profile, no history, no named emotions).
    canonical_affect: projectCanonicalAffectForCognitionV0(snapshot.affect),
    regulation: {
      energy: snapshot.regulation.energy as number,
      stress: snapshot.regulation.stress as number,
      arousal: snapshot.regulation.arousal as number,
      fatigue: snapshot.regulation.fatigue as number
    },
    context: { ...snapshot.context },
    memory_working_refs: [...snapshot.memory_state.working_refs] as string[],
    recent_retrieval_refs: [...snapshot.memory_state.recent_retrieval_trace] as string[],
    belief_item_count: snapshot.beliefs.items.length,
    belief_items: snapshot.beliefs.items
      .map(
        (item): BeliefStanceProjectionV0 => ({
          proposition_id: item.proposition_id,
          proposition_label: item.proposition_label,
          credence: item.credence
        })
      )
      .sort((a, b) =>
        a.proposition_id < b.proposition_id ? -1 : a.proposition_id > b.proposition_id ? 1 : 0
      )
      .slice(0, BELIEF_COGNITION_MAX_ITEMS),
    relationship_counterpart_count: snapshot.relationships.counterparts.length,
    relationship_dimensions: snapshot.relationships.counterparts
      .flatMap((counterpart) =>
        counterpart.dimensions
          .filter((dimension) => !isReservedRelationshipCoreDimensionIdV0(dimension.dimension_id))
          .map((dimension) => ({
            counterpart_ref: counterpart.counterpart_ref as string,
            dimension_id: dimension.dimension_id as string,
            value: dimension.value as number
          }))
      )
      .sort(
        (a, b) =>
          (a.counterpart_ref < b.counterpart_ref ? -1 : a.counterpart_ref > b.counterpart_ref ? 1 : 0) ||
          (a.dimension_id < b.dimension_id ? -1 : a.dimension_id > b.dimension_id ? 1 : 0)
      ),
    interaction_familiarity: interactionFamiliarity,
    interaction_familiarity_cognition_influences: deriveInteractionFamiliarityCognitionInfluencesV0({
      familiarityProjections: interactionFamiliarity,
      activeEntityRefs: snapshot.context.active_entity_refs as never
    }),
    allowed_actions: [] as { action_type: string; target_ref: string | null }[]
  };
  const projectionHash = await cognitiveProjectionHash(
    factualEvidence === null ? projectionBody : { ...projectionBody, factual_memory_evidence: factualEvidence }
  );
  const projection =
    factualEvidence === null
      ? ({
          schema_version: COGNITIVE_CONTEXT_PROJECTION_V2_SCHEMA_VERSION,
          ...projectionBody,
          allowed_actions: [],
          projection_hash: projectionHash
        } as unknown as CognitiveContextProjectionV2)
      : ({
          schema_version: COGNITIVE_CONTEXT_PROJECTION_V2_SCHEMA_VERSION,
          ...projectionBody,
          factual_memory_evidence: factualEvidence,
          allowed_actions: [],
          projection_hash: projectionHash
        } as unknown as CognitiveContextProjectionV2);
  deepFreeze(projection);
  return projection;
}

/**
 * MODULE-PRIVATE validated-evidence augmentation: NOT exported, NOT reachable
 * from the runtime root or any product surface. `additionalRecentRetrievalRefs`
 * is populated exclusively by the trusted executor from refs that already
 * passed validateMemoryRetrievalResult inside the same execution.
 */
async function buildCognitiveContextProjectionInternal(
  snapshot: SubjectStateV0,
  additionalRecentRetrievalRefs: readonly CanonicalRefV0[] | null,
  factualEvidence: FactualMemoryEvidenceBundleV0 | null = null
): Promise<CognitiveContextProjectionV0 | CognitiveContextProjectionV1 | CognitiveContextProjectionV2> {
  // CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — explicit schema-version
  // dispatch: v4 builds the RAW_CANONICAL_VA projection; the v3 path below is
  // byte/behavior unchanged. Unknown schemas fail closed.
  if ((snapshot as { schema_version?: string }).schema_version === "subject-state-v4") {
    return buildExplicitV4CognitiveContextProjection(snapshot as unknown as SubjectStateV4, factualEvidence);
  }
  if ((snapshot as { schema_version?: string }).schema_version !== "subject-state-v3") {
    throw new Error(
      `cognitive context projection: unsupported subject-state schema ${String((snapshot as { schema_version?: unknown }).schema_version)}`
    );
  }
  // Interaction Familiarity Read Projection V0: the exact admitted governed
  // feature's semantic state surface per registered counterpart. Pure
  // derivation from the authoritative snapshot; a malformed canonical
  // familiarity state FAILS CLOSED (no projection is built at all).
  const interactionFamiliarity = await Promise.all(
    [...snapshot.relationships.counterparts]
      .sort((a, b) => (a.counterpart_ref < b.counterpart_ref ? -1 : a.counterpart_ref > b.counterpart_ref ? 1 : 0))
      .map(async (counterpart) => {
        const derived = await deriveInteractionFamiliarityReadProjectionV0({
          subjectState: snapshot,
          counterpart_ref: counterpart.counterpart_ref as never
        });
        if (!derived.ok) {
          throw new Error(
            `cognitive context projection: interaction familiarity read projection failed (${derived.code}: ${derived.detail})`
          );
        }
        return derived.projection;
      })
  );
  const projectionBody = {
    subject_id: snapshot.identity.subject_id as string,
    current_logical_time: snapshot.runtime_metadata.logical_time as number,
    state_revision: snapshot.runtime_metadata.state_revision as number,
    traits_dimensions: { ...snapshot.traits_seed.dimensions } as Record<string, number>,
    affect_channels: snapshot.affect.active_channels.map((channel) => ({
      channel: channel.channel_id as string,
      strength: channel.intensity as number
    })),
    mood_baseline: snapshot.mood.baseline as number,
    regulation: {
      energy: snapshot.regulation.energy as number,
      stress: snapshot.regulation.stress as number,
      arousal: snapshot.regulation.arousal as number,
      fatigue: snapshot.regulation.fatigue as number
    },
    context: { ...snapshot.context },
    memory_working_refs: [...snapshot.memory_state.working_refs] as string[],
    recent_retrieval_refs:
      additionalRecentRetrievalRefs === null || additionalRecentRetrievalRefs.length === 0
        ? [...snapshot.memory_state.recent_retrieval_trace]
        : // Validated familiarity-priority evidence joins the EXISTING recent
          // retrieval evidence context: deduplicated + raw-ASCII sorted per
          // current conventions (never overwriting ordinary Memory context).
          [...new Set<string>([
            ...(snapshot.memory_state.recent_retrieval_trace as readonly string[]),
            ...(additionalRecentRetrievalRefs as readonly string[])
          ])].sort() as string[],
    belief_item_count: snapshot.beliefs.items.length,
    // Belief → Cognition Read Projection V0: COPIED stance surface from the
    // authoritative canonical snapshot — raw-ASCII proposition_id ascending,
    // bounded to the first 64, exact credence copy (no rounding). The copy
    // joins the hash body BEFORE cognitiveProjectionHash, so the existing
    // projection_hash binds belief ids/labels/exact credence/total count.
    belief_items: snapshot.beliefs.items
      .map(
        (item): BeliefStanceProjectionV0 => ({
          proposition_id: item.proposition_id,
          proposition_label: item.proposition_label,
          credence: item.credence
        })
      )
      .sort((a, b) =>
        a.proposition_id < b.proposition_id ? -1 : a.proposition_id > b.proposition_id ? 1 : 0
      )
      .slice(0, BELIEF_COGNITION_MAX_ITEMS),
    relationship_counterpart_count: snapshot.relationships.counterparts.length,
    relationship_dimensions: snapshot.relationships.counterparts
      .flatMap((counterpart) =>
        counterpart.dimensions
          // Reserved governed relationship_core_* dimensions are NEVER exposed
          // raw: governed features project their own exact semantic surfaces
          // (interaction_familiarity below). Generic opaque dims are unchanged.
          .filter((dimension) => !isReservedRelationshipCoreDimensionIdV0(dimension.dimension_id))
          .map((dimension) => ({
            counterpart_ref: counterpart.counterpart_ref as string,
            dimension_id: dimension.dimension_id as string,
            value: dimension.value as number
          }))
      )
      .sort(
        (a, b) =>
          (a.counterpart_ref < b.counterpart_ref ? -1 : a.counterpart_ref > b.counterpart_ref ? 1 : 0) ||
          (a.dimension_id < b.dimension_id ? -1 : a.dimension_id > b.dimension_id ? 1 : 0)
      ),
    // Interaction Familiarity Read Projection V0: the exact admitted governed
    // feature's semantic state surface per registered counterpart (derived
    // above; malformed canonical familiarity state FAILS CLOSED).
    interaction_familiarity: interactionFamiliarity,
    // Interaction Familiarity Cognition Influence V0: the fixed feature policy
    // applied to the read projections for ACTIVE counterparts only.
    interaction_familiarity_cognition_influences: deriveInteractionFamiliarityCognitionInfluencesV0({
      familiarityProjections: interactionFamiliarity,
      activeEntityRefs: snapshot.context.active_entity_refs as never
    }),
    allowed_actions: [] as { action_type: string; target_ref: string | null }[]
  };
  // EXPERIENCE_MEMORY_FUTURE_COGNITION_INTEGRATION_V0: the V1 projection adds
  // the resolved factual memory evidence to the hashed body — the projection
  // hash covers the FULL evidence content and authoritative hashes. The V0
  // path (no evidence) stays byte-identical to the frozen schema.
  const projectionHash = await cognitiveProjectionHash(
    factualEvidence === null ? projectionBody : { ...projectionBody, factual_memory_evidence: factualEvidence }
  );
  const projection =
    factualEvidence === null
      ? ({
          schema_version: "cognitive-context-projection-v0",
          ...projectionBody,
          allowed_actions: [],
          projection_hash: projectionHash
        } as unknown as CognitiveContextProjectionV0)
      : ({
          schema_version: "cognitive-context-projection-v1",
          ...projectionBody,
          factual_memory_evidence: factualEvidence,
          allowed_actions: [],
          projection_hash: projectionHash
        } as unknown as CognitiveContextProjectionV1);
  // Frozen read-only view: the provider can inspect but never mutate it.
  deepFreeze(projection);
  return projection;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

export class CognitionActionTransitionExecutor {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async execute(
    ctx: RuntimeContext,
    input: CognitionActionInputV0,
    capabilities: TransitionCapabilities
  ): Promise<CognitionActionExecutionResultV0> {
    // ---- wiring gate -------------------------------------------------------------
    const provider = this.deps.cognitionProvider;
    if (provider === null) {
      throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "cognition provider not wired");
    }

    // ---- authoritative anchor ------------------------------------------------------
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw stageFailure("OBSERVATION", "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    const anchored = anchorContext(ctx, snapshot, "OBSERVATION");

    // ---- controlled projection (frozen; answers WHO/WHAT/REMEMBER/FEEL/BELIEVE/SPACE)
    const projection = await buildCognitiveContextProjection(snapshot);

    // ---- RELATIONSHIP_FAMILIARITY_RETRIEVAL_ORCHESTRATION_V0 (Layer B, automatic) ----
    // Normal execution derives the retrieval decision itself from the frozen
    // cognition influence artifacts already carried by the projection — the
    // caller supplies no familiarity value, strategy, query or counterpart
    // instruction. BASIC_CONTEXT_FIRST / no influence → ZERO extra retrieval
    // calls; COUNTERPART_CONTEXT_SEARCH_FIRST → EXACTLY ONE exact-counterpart
    // attempt through the EXISTING retrieval seam and validation law (host-owned
    // query construction; no scoring changes; no duplication of the policy
    // threshold; empty results never invent context). The deterministic trace is
    // an observation on the execution result — never an authority.
    const interactionFamiliarityRetrieval = await orchestrateInteractionFamiliarityRetrievalV0({
      influences: projection.interaction_familiarity_cognition_influences,
      retrieval: this.deps.retrieval,
      buildCounterpartQuery: (ref) => buildInteractionFamiliarityCounterpartQueryV0(snapshot, ref)
    });

    // ---- RELATIONSHIP_FAMILIARITY_RETRIEVED_EVIDENCE_COGNITION_INTEGRATION_V0 ----
    // Validated selected Memory evidence from the automatic familiarity-priority
    // retrieval joins the SAME cognition provider context through the EXISTING
    // recent-retrieval evidence path (dedup + raw-ASCII sort). Only selected
    // VALIDATED Memory evidence becomes citeable — never familiarity itself,
    // never receipt/authority refs. With no selected refs the provider context
    // is byte-identical to the pre-slice behavior (BASIC/empty compatibility).
    const familiaritySelectedRefs = interactionFamiliarityRetrieval.attempts.flatMap((attempt) =>
      attempt.outcome === "ATTEMPTED_WITH_USABLE_EVIDENCE" ? attempt.selected_memory_refs : []
    );
    const evidenceProjection =
      familiaritySelectedRefs.length > 0
        ? await buildCognitiveContextProjectionInternal(snapshot, familiaritySelectedRefs)
        : projection;

    // ---- EXPERIENCE_MEMORY_FUTURE_COGNITION_INTEGRATION_V0 ------------------------
    // Factual evidence resolution BEFORE provider invocation. Inputs are ONLY the
    // canonical working refs and the already-validated retrieval selections this
    // projection carries — never caller-supplied experience refs. With no
    // resolver wired the input is byte-identical to the pre-slice V0 behavior;
    // V1 is used ONLY when at least one factual evidence entry resolved (never
    // default/fake evidence). Repository payload remains authority: the resolver
    // fails closed on any malformed Experience episode.
    let cognitionInputProjection: CognitiveContextProjectionAnyVersion = evidenceProjection;
    const factualResolver: FactualMemoryEvidenceResolverV0 | null = this.deps.factualEvidenceResolver;
    if (factualResolver !== null) {
      const candidateRefs = [...new Set<string>([
        ...(evidenceProjection.memory_working_refs as readonly string[]),
        ...(evidenceProjection.recent_retrieval_refs as readonly string[])
      ])]
        .filter((ref) => refKind(ref as CanonicalRefV0) === "episode")
        .sort() as CanonicalRefV0[];
      const factualBundle = await factualResolver.resolve({
        repository_revision: snapshot.memory_state.repository_revision,
        episode_refs: candidateRefs
      });
      if (factualBundle.entries.length > 0) {
        cognitionInputProjection = await buildCognitiveContextProjectionInternal(
          snapshot,
          familiaritySelectedRefs.length > 0 ? familiaritySelectedRefs : null,
          factualBundle
        );
      }
    }

    // The action space is bound into the projection AFTER hashing the body: the
    // space is host-supplied per cycle, the hash covers the state evidence.
    const projectionWithSpace: CognitiveContextProjectionAnyVersion = {
      ...cognitionInputProjection,
      allowed_actions: input.allowed_actions
    };

    // ---- provider proposal (failure ⇒ canonical +0; nothing reserved yet) ----------
    let draft: unknown;
    try {
      draft = await provider.propose(projectionWithSpace);
    } catch (error) {
      throw new TransitionStageFailure(
        "OBSERVATION",
        "SERVICE_UNAVAILABLE",
        "FAIL-SERVICE-001",
        "cognition provider failed (fail closed)",
        { cause: error }
      );
    }

    // ---- schema + projection binding ------------------------------------------------
    const checked = validateCognitionProposal(draft);
    if (!checked.ok) {
      throw stageFailure("OBSERVATION", "INVALID_SCHEMA", "SS-SCHEMA-001", checked.error.detail);
    }
    const proposal = checked.value;
    if (proposal.projection_hash !== cognitionInputProjection.projection_hash) {
      throw stageFailure(
        "OBSERVATION",
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        "cognition proposal answers a different projection (stale or foreign projection_hash)"
      );
    }

    // ---- evidence grounding (§15): memory/context refs must come from the projection
    const allowed = allowedEvidenceSet(cognitionInputProjection);
    const unsupported = findUnsupportedEvidenceRef(
      [...proposal.evidence_refs, ...proposal.relevant_memory_refs, ...proposal.considered_context_refs],
      allowed
    );
    if (unsupported !== null) {
      throw stageFailure(
        "OBSERVATION",
        "UNSUPPORTED_EVIDENCE_REF",
        "LLM-EVID-001",
        `cognition proposal cites ${unsupported} outside the allowed evidence set`
      );
    }

    // ---- action space (§19): typed intent must fit the supplied allowed actions ------
    if (proposal.action_intent !== null && !actionIntentAllowed(proposal.action_intent, input.allowed_actions)) {
      throw stageFailure(
        "OBSERVATION",
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        `action intent ${proposal.action_intent.action_type} is not in the supplied allowed action space`
      );
    }

    // ---- canonical boundary: ZERO-DELTA durable NO_OP (two-call protocol) ------------
    const canonicalProposal = await buildCognitionActionProposal({
      subjectId: anchored.subject_id as string,
      stateRevision: anchored.state_revision as number,
      occurrenceLogicalTime: anchored.current_logical_time as number,
      causeRefs: [...input.cause_refs],
      projectionHash: cognitionInputProjection.projection_hash,
      allowedActions: input.allowed_actions
    });

    const reserved = await this.deps.subjectCore.reserveAndRoute(canonicalProposal);
    let outcome: CommitReservedOutcome;
    switch (reserved.kind) {
      case "CONTINUE":
        outcome = await this.deps.subjectCore.terminalizeReservedNoOp({
          proposal: canonicalProposal,
          continuation: reserved.continuation,
          producerAuthorization: this.deps.producerAuthorizationIssuer.issue([]),
          preparedBinding: capabilities.preparedBinding
        });
        break;
      case "ALREADY_COMMITTED":
        outcome = { kind: "COMMITTED", bundle: reserved.bundle, result: reserved.bundle.canonical_result };
        break;
      case "TERMINAL_NO_OP":
        outcome = { kind: "NO_OP" };
        break;
      case "REUSE_CONFLICT":
        outcome = {
          kind: "REJECTED",
          failure: {
            error_code: "TRANSITION_ID_REUSE",
            reason: "IDEM-REUSE-001",
            detail: "transition id reuse with changed payload"
          }
        };
        break;
    }

    return {
      outcome,
      cognition: proposal,
      projection: projectionWithSpace,
      interaction_familiarity_retrieval: interactionFamiliarityRetrieval
    };
  }
}
