/**
 * P2.3.3.2 — ObservationTransitionExecutor (orchestration only).
 * Source: p2-runtime-plan.md §8.2–§8.4, §11-P2.3; freeze §7.1–§7.2, §13.3.
 *
 * Pipeline (frozen order):
 *   1. read current snapshot through SubjectCorePort; anchor context (subject /
 *      logical_time / revision consistency — drift rejects);
 *   2. occurrence equality pre-guard (INVALID_LOGICAL_TIME before any producer work);
 *   3. ContextProducerPort → controlled projection (retrieval evidence absent);
 *   4. build deterministic RetrievalQuery → RetrievalPort (evidence/candidates ONLY;
 *      this executor performs NO ranking, NO relevance judgement, NO search);
 *   5. rebuild the projection with retrieval evidence → InterpretationPort (fixed
 *      provider; NO LLM) → draft;
 *   6. AppraisalPort (fixed provider; no psychological model) → proposal draft;
 *   7. AffectProducerPort → affect-domain delta; ContextProducerPort → context delta;
 *   8. assemble ONE sorted CanonicalTransitionProposalV1 (deterministic ids, refs,
 *      order; no random, no wall clock) → SubjectCorePort.commit() verbatim.
 *
 * The executor never mutates SubjectState, never writes memory, never persists
 * workflow state and never calls anything outside the injected dependency container.
 */

import type {
  CommitTransitionInput,
  CommitTransitionOutcome,
  DomainDeltaV0,
  SubjectStateV0
} from "@characteros-next/subject-core";
import type { MemoryRetrievalQueryV0 } from "@characteros-next/memory";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { ObservationInputV0 } from "./types.js";
import { validateObservationInput } from "./types.js";
import type { TransitionSessionFacts } from "../time/time-transition-executor.js";
import { anchorContext, preProposalError } from "../common.js";

export type ObservationExecutionResult = CommitTransitionOutcome;

/** Deterministic opaque transition id for Observation runs. */
export function observationTransitionId(
  subjectId: string,
  revision: number,
  observationId: string
): string {
  const safeObservationId = observationId.replace(":", "-");
  return `t-obs-${subjectId}-r${revision}-o${safeObservationId}`;
}

/** Deterministic retrieval query built from input + read-only snapshot (no ranking). */
export function buildObservationRetrievalQuery(
  input: ObservationInputV0,
  snapshot: SubjectStateV0
): MemoryRetrievalQueryV0 {
  return {
    schema_version: "memory-retrieval-query-v0",
    subject_id: snapshot.identity.subject_id,
    repository_revision: snapshot.memory_state.repository_revision,
    semantic_reference: input.observation_id,
    temporal: {
      now_logical_time: snapshot.runtime_metadata.logical_time,
      window_start: null
    },
    entity_refs: input.entity_refs,
    relationship_refs: [],
    current_context_refs: [
      ...snapshot.context.focus_refs,
      ...snapshot.context.environment_refs
    ],
    salience_constraints: { min_declared_score: null, max_candidates: 16 }
  } as unknown as MemoryRetrievalQueryV0;
}

export class ObservationTransitionExecutor {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async execute(
    ctx: RuntimeContext,
    input: ObservationInputV0,
    session: TransitionSessionFacts
  ): Promise<ObservationExecutionResult> {
    // ---- Step 1: authoritative anchor -------------------------------------------
    const checked = validateObservationInput(input);
    if (!checked.ok) {
      throw preProposalError("INVALID_SCHEMA", "SS-SCHEMA-001", checked.error.detail);
    }
    const obs = checked.value;

    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw preProposalError("UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    const anchored = anchorContext(ctx, snapshot);

    // Occurrence must equal current logical time (§6.2); fail before any producer work.
    if (obs.occurrence_logical_time !== anchored.current_logical_time) {
      throw preProposalError(
        "INVALID_LOGICAL_TIME",
        "TIME-ADVANCE-001",
        `occurrence ${obs.occurrence_logical_time} must equal current logical_time ${anchored.current_logical_time}`
      );
    }

    // ---- Step 2+3: controlled projection (pre-retrieval) then retrieval ---------
    const contextProducer = this.deps.contextProducer;
    if (contextProducer === null) {
      throw new Error("composition error: contextProducer not wired");
    }
    const interpretation = this.deps.interpretation;
    if (interpretation === null) {
      throw new Error("composition error: interpretation not wired");
    }
    const appraisal = this.deps.appraisal;
    if (appraisal === null) {
      throw new Error("composition error: appraisal not wired");
    }
    const affectProducer = this.deps.affectProducer;
    if (affectProducer === null) {
      throw new Error("composition error: affectProducer not wired");
    }

    const projectionBeforeRetrieval = await contextProducer.produceControlledProjection(obs, {
      context_scene: snapshot.context.scene,
      retrieval_result: null
    });

    const query = buildObservationRetrievalQuery(obs, snapshot);
    const retrievalResult = await this.deps.retrieval.retrieve(query); // may be LEGAL EMPTY

    // ---- Step 4+5: interpretation and appraisal (fixed providers, no LLM) -------
    const projection = await contextProducer.produceControlledProjection(obs, {
      context_scene: snapshot.context.scene,
      retrieval_result: retrievalResult
    });
    void projectionBeforeRetrieval;

    const interpretationDraft = await interpretation.interpret(projection);
    const appraisalDraft = await appraisal.appraise(projection, interpretationDraft);

    // ---- Step 6+7: deltas and proposal assembly ----------------------------------
    const affectDelta = await affectProducer.produceAffectDelta({
      context: anchored,
      snapshot,
      transition_type: "Observation",
      appraisal: appraisalDraft
    });
    const contextDelta = await contextProducer.produceContextDelta(obs, snapshot);

    const proposal: CanonicalTransitionProposalV1Shape = {
      schema_version: "canonical-transition-proposal-v1" as never,
      transition_id: observationTransitionId(
        anchored.subject_id,
        anchored.state_revision,
        obs.observation_id
      ) as never,
      subject_id: anchored.subject_id as never,
      transition_type: "Observation" as never,
      expected_state_revision: anchored.state_revision as never,
      time_input: {
        kind: "OCCURRENCE",
        occurrence_logical_time: obs.occurrence_logical_time
      } as never,
      cause_refs: [obs.observation_id] as never,
      domain_deltas: [affectDelta, contextDelta] as never, // raw-ASCII: affect < context
      external_refs: [] as never
    };

    // ---- Step 8: delegate all authority to SubjectCore -----------------------------
    return await this.deps.subjectCore.commit(
      commitInput(proposal as never, snapshot, session)
    );
  }
}

interface CanonicalTransitionProposalV1Shape {
  readonly schema_version: string;
  readonly transition_id: string;
  readonly subject_id: string;
  readonly transition_type: "Observation";
  readonly expected_state_revision: number;
  readonly time_input: { readonly kind: "OCCURRENCE"; readonly occurrence_logical_time: number };
  readonly cause_refs: readonly string[];
  readonly domain_deltas: readonly DomainDeltaV0[];
  readonly external_refs: readonly string[];
}

function commitInput(
  proposal: unknown,
  currentState: SubjectStateV0,
  session: TransitionSessionFacts
): CommitTransitionInput {
  return {
    proposal: proposal as never,
    currentState,
    identity_record_version_before: session.identity_record_version_before,
    first_seen_sequence: session.first_seen_sequence,
    prior_attempts: session.prior_attempts,
    previous_commit_ref: session.previous_commit_ref,
    previous_record_checksum: session.previous_record_checksum,
    prepared_result_ref: session.prepared_result_ref,
    repository_bindings: session.repository_bindings,
    ...(session.reference_validator !== undefined
      ? { reference_validator: session.reference_validator }
      : {})
  };
}
