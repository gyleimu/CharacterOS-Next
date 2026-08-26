/**
 * P2.3.3.2 (P0-1/P0-6 remediated) — ObservationTransitionExecutor.
 * Source: freeze §6.2, §7.1–§7.2, §13.3; p2-runtime-plan.md §8.2–§8.4.
 *
 * Orchestration ONLY, over the two-call SubjectCorePort. Enforced gates:
 *  - subject identity triple check (input == ctx == authoritative snapshot) BEFORE
 *    any producer work (P0-6 §16);
 *  - time semantics (P0-6 §17): occurrence == current → proceed; occurrence < current →
 *    OUT_OF_ORDER_OBSERVATION/TIME-OCCURRENCE-001; occurrence > current → typed
 *    INVALID_LOGICAL_TIME/TIME-ADVANCE-001 with routing=TIME_ADVANCE_REQUIRED (the
 *    orchestrator must run TimeTransition first; Observation never advances time);
 *  - stage dependency (A4.2): interpretation always receives a non-null retrieval
 *    result (LEGAL EMPTY is a valid result); null ⇒ INVALID_STAGE_DEPENDENCY;
 *  - evidence ownership (A4.3/§20): interpretation/appraisal evidence refs must belong
 *    to retrieval-selected refs ∪ canonical observation facts, else
 *    UNSUPPORTED_EVIDENCE_REF/LLM-EVID-001;
 *  - schema conformance (§19): interpretation draft + six-field AppraisalV0 validated
 *    before commit;
 *  - A11: affect + context (+ optional retrieval-metadata trio when the producer is
 *    wired) commit in ONE canonical proposal; a single invalid delta rejects all.
 */

import type {
  CanonicalTransitionProposalV1,
  CommitReservedOutcome,
  DomainDeltaV0,
  SubjectStateV0
} from "@characteros-next/subject-core";
import type { MemoryRetrievalQueryV0 } from "@characteros-next/memory";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { TransitionCapabilities } from "../../ports/subject-core-port.js";
import type { ObservationInputV0 } from "./types.js";
import { validateObservationInput } from "./types.js";
import {
  allowedEvidenceSet,
  findUnsupportedEvidenceRef,
  validateAppraisalV0,
  validateInterpretationProposal
} from "./proposal-validation.js";
import { anchorContext, stageFailure, TransitionStageFailure } from "../common.js";

export type ObservationExecutionResult = CommitReservedOutcome;

/** Deterministic opaque transition id for Observation runs. */
export function observationTransitionId(
  subjectId: string,
  revision: number,
  observationId: string
): string {
  const safeObservationId = observationId.replace(":", "-");
  return `t-obs-${subjectId}-r${revision}-o${safeObservationId}`;
}

/**
 * Deterministic retrieval query (P0-6 §22): current_context_refs are the GLOBAL
 * deduplicated raw-ASCII-sorted union of focus_refs + environment_refs; no reliance
 * on each group being sorted in isolation.
 */
export function buildObservationRetrievalQuery(
  input: ObservationInputV0,
  snapshot: SubjectStateV0
): MemoryRetrievalQueryV0 {
  const merged = [...snapshot.context.focus_refs, ...snapshot.context.environment_refs].sort();
  const uniqueMerged = merged.filter((ref, index) => index === 0 || merged[index - 1] !== ref);
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
    current_context_refs: uniqueMerged,
    salience_constraints: { min_declared_score: null, max_candidates: 16 }
  } as unknown as MemoryRetrievalQueryV0;
}

const STAGE = "OBSERVATION" as const;

export class ObservationTransitionExecutor {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async execute(
    ctx: RuntimeContext,
    input: ObservationInputV0,
    capabilities: TransitionCapabilities
  ): Promise<ObservationExecutionResult> {
    // ---- admission + authoritative anchor ----------------------------------------
    const checked = validateObservationInput(input);
    if (!checked.ok) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", checked.error.detail);
    }
    const obs = checked.value;

    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw stageFailure(STAGE, "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    const anchored = anchorContext(ctx, snapshot, STAGE);

    // P0-6 §16: subject identity triple check BEFORE any producer work.
    if (obs.subject_id !== anchored.subject_id) {
      throw stageFailure(
        STAGE,
        "UNKNOWN_SUBJECT",
        "SS-AUTH-001",
        `observation subject ${obs.subject_id} does not match authority ${anchored.subject_id}`
      );
    }

    // P0-6 §17: occurrence time semantics (no time rollback, no silent advance).
    if (obs.occurrence_logical_time < anchored.current_logical_time) {
      throw stageFailure(
        STAGE,
        "OUT_OF_ORDER_OBSERVATION",
        "TIME-OCCURRENCE-001",
        `past occurrence ${obs.occurrence_logical_time} < current ${anchored.current_logical_time}`
      );
    }
    if (obs.occurrence_logical_time > anchored.current_logical_time) {
      throw new TransitionStageFailure(
        STAGE,
        "INVALID_LOGICAL_TIME",
        "TIME-ADVANCE-001",
        `future occurrence ${obs.occurrence_logical_time} requires TimeTransition first`,
        { routing: "TIME_ADVANCE_REQUIRED" }
      );
    }

    // ---- ports presence -------------------------------------------------------------
    const contextProducer = this.deps.contextProducer;
    if (contextProducer === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "contextProducer not wired");
    }
    const interpretation = this.deps.interpretation;
    if (interpretation === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "interpretation not wired");
    }
    const appraisal = this.deps.appraisal;
    if (appraisal === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "appraisal not wired");
    }
    const affectProducer = this.deps.affectProducer;
    if (affectProducer === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "affectProducer not wired");
    }
    const retrievalMetadataProducer = this.deps.retrievalMetadataProducer;

    // ---- projection + retrieval ------------------------------------------------------
    void (await contextProducer.produceControlledProjection(obs, {
      context_scene: snapshot.context.scene,
      retrieval_result: null
    }));
    const query = buildObservationRetrievalQuery(obs, snapshot);
    const retrievalResult = await this.deps.retrieval.retrieve(query);

    // ---- A4.2: stage dependency is structural (retrieval always precedes) ------------
    const projectionWithEvidence = await contextProducer.produceControlledProjection(obs, {
      context_scene: snapshot.context.scene,
      retrieval_result: retrievalResult
    });
    if (projectionWithEvidence.retrieval_result === null) {
      throw stageFailure(
        STAGE,
        "INVALID_STAGE_DEPENDENCY",
        "MICL-STAGE-001",
        "interpretation requires a retrieval result"
      );
    }

    // ---- fixed providers + evidence ownership (A4.3/§19) ------------------------------
    const interpretationDraft = await interpretation.interpret(projectionWithEvidence);
    const interpretationChecked = validateInterpretationProposal(interpretationDraft);
    if (!interpretationChecked.ok) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", interpretationChecked.error.detail);
    }
    if (interpretationChecked.value.projection_hash !== projectionWithEvidence.projection_hash) {
      throw stageFailure(
        STAGE,
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        "interpretation proposal answers a different projection"
      );
    }

    const appraisalDraft = await appraisal.appraise(projectionWithEvidence, interpretationChecked.value);
    const appraisalChecked = validateAppraisalV0(appraisalDraft);
    if (!appraisalChecked.ok) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", appraisalChecked.error.detail);
    }

    // ---- evidence ownership (A4.3/§20) -------------------------------------------------
    const allowed = allowedEvidenceSet(
      {
        observation_id: obs.observation_id,
        source_refs: obs.source_refs,
        entity_refs: obs.entity_refs
      },
      retrievalResult.selected_memory_refs
    );
    const unsupported =
      findUnsupportedEvidenceRef(
        [
          ...interpretationChecked.value.evidence_refs,
          ...appraisalChecked.value.evidence_refs
        ],
        allowed
      ) ?? null;
    if (unsupported !== null) {
      throw stageFailure(
        STAGE,
        "UNSUPPORTED_EVIDENCE_REF",
        "LLM-EVID-001",
        `proposal cites ${unsupported} outside the allowed evidence set`
      );
    }

    // ---- deltas + proposal assembly ---------------------------------------------------
    const affectDelta = await affectProducer.produceAffectDelta({
      context: anchored,
      snapshot,
      transition_type: "Observation",
      appraisal: appraisalChecked.value
    });
    const contextDelta = await contextProducer.produceContextDelta(obs, snapshot);

    const authorizationBindings: Array<{
      producer: "affect" | "context" | "memory" | "regulation";
      domain: "affect" | "context" | "memory-content" | "memory-retrieval" | "regulation";
    }> = [
      { producer: "affect", domain: "affect" },
      { producer: "context", domain: "context" }
    ];
    const deltas: DomainDeltaV0[] = [affectDelta, contextDelta];
    if (retrievalMetadataProducer !== null) {
      const metadataDelta = await retrievalMetadataProducer.produceRetrievalMetadataDelta({
        snapshot,
        retrieval_result: retrievalResult
      });
      deltas.push(metadataDelta);
      authorizationBindings.push({ producer: "memory", domain: "memory-retrieval" });
    }
    // raw-ASCII domain order: affect < context < memory-retrieval
    deltas.sort((a, b) => (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0));

    const proposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: observationTransitionId(anchored.subject_id, anchored.state_revision, obs.observation_id),
      subject_id: anchored.subject_id,
      transition_type: "Observation",
      expected_state_revision: anchored.state_revision,
      time_input: { kind: "OCCURRENCE", occurrence_logical_time: obs.occurrence_logical_time },
      cause_refs: [obs.observation_id],
      domain_deltas: deltas,
      external_refs: []
    } as unknown as CanonicalTransitionProposalV1;

    // ---- first call: reservation -------------------------------------------------------
    const reserved = await this.deps.subjectCore.reserveAndRoute(proposal);
    if (reserved.kind !== "CONTINUE") {
      switch (reserved.kind) {
        case "ALREADY_COMMITTED":
          return { kind: "COMMITTED", bundle: reserved.bundle, result: reserved.bundle.canonical_result };
        case "TERMINAL_NO_OP":
          return { kind: "NO_OP" };
        case "REUSE_CONFLICT":
          return {
            kind: "REJECTED",
            failure: {
              error_code: "TRANSITION_ID_REUSE",
              reason: "IDEM-REUSE-001",
              detail: "transition id reuse with changed payload"
            }
          };
      }
    }

    // ---- second call: semantic pipeline + single CAS ------------------------------------
    return this.deps.subjectCore.commitReserved({
      proposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.producerAuthorizationIssuer.issue(authorizationBindings),
      preparedBinding: capabilities.preparedBinding,
      repository_bindings: capabilities.repository_bindings as never
    });
  }
}
