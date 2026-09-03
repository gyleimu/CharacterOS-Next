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
  SubjectStateV0
} from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import { isReservedRelationshipCoreDimensionIdV0 } from "@characteros-next/subject-core";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { TransitionCapabilities } from "../../ports/subject-core-port.js";
import { deriveInteractionFamiliarityReadProjectionV0 } from "../../transitions/relationship/relationship-interaction-familiarity-read-projection.js";
import { deriveInteractionFamiliarityCognitionInfluencesV0 } from "../../transitions/relationship/relationship-interaction-familiarity-cognition-influence.js";
import {
  actionIntentAllowed,
  allowedEvidenceSet,
  BELIEF_COGNITION_MAX_ITEMS,
  cognitiveProjectionHash,
  findUnsupportedEvidenceRef,
  validateCognitionProposal,
  type BeliefStanceProjectionV0,
  type CognitiveContextProjectionV0,
  type CognitionActionInputV0,
  type CognitionProposalV0
} from "./types.js";
import { anchorContext, stageFailure, TransitionStageFailure } from "../common.js";

export interface CognitionActionExecutionResultV0 {
  /** Canonical outcome: a durable zero-delta NO_OP on success. */
  readonly outcome: CommitReservedOutcome;
  /** The validated provider proposal (workflow-level; never canonical). */
  readonly cognition: CognitionProposalV0;
  /** The exact projection the provider answered (audit/replay evidence). */
  readonly projection: CognitiveContextProjectionV0;
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

/** Builds the frozen controlled projection from the authoritative snapshot. */
export async function buildCognitiveContextProjection(
  snapshot: SubjectStateV0
): Promise<CognitiveContextProjectionV0> {
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
    recent_retrieval_refs: [...snapshot.memory_state.recent_retrieval_trace] as string[],
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
  const projectionHash = await cognitiveProjectionHash(projectionBody);
  const projection: CognitiveContextProjectionV0 = {
    schema_version: "cognitive-context-projection-v0",
    ...projectionBody,
    allowed_actions: [],
    projection_hash: projectionHash
  } as unknown as CognitiveContextProjectionV0;
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
    // The action space is bound into the projection AFTER hashing the body: the
    // space is host-supplied per cycle, the hash covers the state evidence.
    const projectionWithSpace: CognitiveContextProjectionV0 = {
      ...projection,
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
    if (proposal.projection_hash !== projection.projection_hash) {
      throw stageFailure(
        "OBSERVATION",
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        "cognition proposal answers a different projection (stale or foreign projection_hash)"
      );
    }

    // ---- evidence grounding (§15): memory/context refs must come from the projection
    const allowed = allowedEvidenceSet(projection);
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
      projectionHash: projection.projection_hash,
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

    return { outcome, cognition: proposal, projection: projectionWithSpace };
  }
}
