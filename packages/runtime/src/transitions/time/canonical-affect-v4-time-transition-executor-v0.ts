/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — the explicit v4 Time executor
 * (§37/§38/§45/§46).
 *
 * Constructable ONLY through explicit foundation mode
 * ("EXPLICIT_V4_FOUNDATION_V0"); never registered in the default
 * RuntimeCompositionRoot.
 *
 * Reuses the v3 Time orchestration law exactly: same two-call SubjectCorePort
 * flow (reserveAndRoute → commitReserved | terminalizeReservedNoOp), same
 * transition-identity/builder pattern, same durable zero-tick NO_OP, same CAS
 * semantics. The ONLY differences vs v3 Time:
 *   - the predecessor snapshot must be subject-state-v4 (fail closed)
 *   - the /affect replacement comes from advanceAffectTimeV0 (bounded-VA
 *     recovery; Time is the ONLY v4 Affect recovery writer, §46)
 *   - the positive-Time proposal carries exactly /affect + /regulation
 *     (NO /mood — v4 has no Mood, §42)
 *   - no Appraisal, no eligibility, no provider, no model calls (§50)
 *
 * Predecessor compatibility (§30): the produced /affect replacement validates
 * as CanonicalAffectV0 because the predecessor was verified subject-state-v4.
 */

import type {
  CanonicalTransitionProposalV1,
  CommitReservedOutcome,
  DomainDeltaV0,
  SubjectStateV4
} from "@characteros-next/subject-core";
import { validateCanonicalAffectShape, validateMechanismConfigV1Shape } from "@characteros-next/subject-core";
import { AffectDynamicsContractErrorV0 } from "@characteros-next/affect";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { CanonicalAffectTimeProducerPortV0 } from "../../ports/canonical-affect-time-producer-port-v0.js";
import type { TransitionCapabilities } from "../../ports/subject-core-port.js";
import { admitElapsedTicks, anchorContext, stageFailure, TransitionStageFailure } from "../common.js";

export const V4_TIME_FOUNDATION_MODE = "EXPLICIT_V4_FOUNDATION_V0" as const;
export type V4TimeFoundationMode = typeof V4_TIME_FOUNDATION_MODE;

export interface CanonicalAffectTimeTransitionInputV0 {
  readonly elapsed_ticks: number;
}

export type CanonicalAffectTimeExecutionResultV0 = CommitReservedOutcome;

export interface CanonicalAffectV4TimeExecutorDepsV0 {
  readonly subjectCore: RuntimeDependencyContainer["subjectCore"];
  readonly producerAuthorizationIssuer: NonNullable<RuntimeDependencyContainer["producerAuthorizationIssuer"]>;
  readonly regulationProducer: NonNullable<RuntimeDependencyContainer["regulationProducer"]>;
  readonly canonicalAffectTimeProducer: CanonicalAffectTimeProducerPortV0;
}

/** Deterministic v4 Time transition id — distinct namespace from v3. */
export function canonicalAffectTimeTransitionId(subjectId: string, revision: number, ticks: number): string {
  return `t-time-v4-${subjectId}-r${revision}-e${ticks}`;
}

function buildV4TimeNoOpProposal(subjectId: string, stateRevision: number): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: canonicalAffectTimeTransitionId(subjectId, stateRevision, 0),
    subject_id: subjectId,
    transition_type: "Time",
    expected_state_revision: stateRevision,
    time_input: { kind: "ELAPSED", elapsed_time: { value: 0, unit: "tick" } },
    cause_refs: [],
    domain_deltas: [],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
}

function buildV4TimeProposal(
  subjectId: string,
  stateRevision: number,
  ticks: number,
  affectDelta: DomainDeltaV0,
  regulationDelta: DomainDeltaV0
): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: canonicalAffectTimeTransitionId(subjectId, stateRevision, ticks),
    subject_id: subjectId,
    transition_type: "Time",
    expected_state_revision: stateRevision,
    time_input: {
      kind: "ELAPSED",
      elapsed_time: { value: ticks, unit: "tick" }
    },
    cause_refs: [],
    // raw-ASCII domain order: affect < regulation (identical to v3 Time)
    domain_deltas: [affectDelta, regulationDelta],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
}

const STAGE = "TIME" as const;

/**
 * The explicit v4 Time executor. Reuses the v3 Time orchestration law via the
 * shared SubjectCorePort flow; a `time-transition-common.ts` extraction is
 * intentionally NOT needed because this executor composes the SAME two-call
 * SubjectCorePort primitives — the CAS/idempotency law lives in the core, not
 * in either executor.
 */
export class CanonicalAffectV4TimeTransitionExecutorV0 {
  /** §38: only constructable through explicit foundation mode. */
  readonly mode: typeof V4_TIME_FOUNDATION_MODE;

  constructor(
    private readonly deps: CanonicalAffectV4TimeExecutorDepsV0,
    mode: V4TimeFoundationMode
  ) {
    if (mode !== "EXPLICIT_V4_FOUNDATION_V0") {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "v4 Time executor requires explicit foundation mode");
    }
    this.mode = mode;
  }

  async execute(
    ctx: RuntimeContext,
    input: CanonicalAffectTimeTransitionInputV0,
    capabilities: TransitionCapabilities
  ): Promise<CanonicalAffectTimeExecutionResultV0> {
    admitElapsedTicks(STAGE, input.elapsed_ticks);

    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw stageFailure(STAGE, "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    // §38: predecessor must be subject-state-v4. Fail closed otherwise.
    if ((snapshot as { schema_version?: unknown }).schema_version !== "subject-state-v4") {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "v4 Time requires a subject-state-v4 predecessor");
    }
    // §8 pairing law: v4 state must carry the BOUNDED_AFFECT_DYNAMICS_V0/tick profile.
    const mech = (snapshot as { mechanism_config?: unknown }).mechanism_config;
    if (!validateMechanismConfigV1Shape(mech, "predecessor.mechanism_config")) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "predecessor mechanism_config is not the v4 pairing");
    }
    const anchored = anchorContext(ctx, snapshot, STAGE);

    // ---- elapsed = 0 → durable terminal NO_OP (identical to v3 law, §43) --------
    if (input.elapsed_ticks === 0) {
      const zeroProposal = buildV4TimeNoOpProposal(anchored.subject_id, anchored.state_revision);
      const reserved = await this.deps.subjectCore.reserveAndRoute(zeroProposal);
      switch (reserved.kind) {
        case "CONTINUE":
          return this.deps.subjectCore.terminalizeReservedNoOp({
            proposal: zeroProposal,
            continuation: reserved.continuation,
            producerAuthorization: this.deps.producerAuthorizationIssuer.issue([]),
            preparedBinding: capabilities.preparedBinding
          });
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
        case "ALREADY_COMMITTED":
          return { kind: "COMMITTED", bundle: reserved.bundle, result: reserved.bundle.canonical_result };
      }
    }

    // ---- §45: affect recovery through advanceAffectTimeV0 (§40 adapter) --------
    const v4Snapshot = snapshot as unknown as SubjectStateV4;
    let affectDelta: DomainDeltaV0;
    try {
      affectDelta = await this.deps.canonicalAffectTimeProducer.produceCanonicalAffectTimeDelta({
        current_affect: v4Snapshot.affect,
        elapsed_ticks: input.elapsed_ticks
      });
    } catch (error) {
      if (error instanceof AffectDynamicsContractErrorV0) {
        throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", error.message);
      }
      throw new TransitionStageFailure(
        STAGE,
        "SERVICE_UNAVAILABLE",
        "FAIL-SERVICE-001",
        "canonical affect time producer failed (fail closed)",
        { cause: error }
      );
    }
    // §30 predecessor-compatibility: the produced /affect replacement must
    // validate as CanonicalAffectV0 (predecessor is v4).
    const affectOp = affectDelta.operations.find((op) => op.path === "/affect");
    if (affectOp !== undefined && !validateCanonicalAffectShape(affectOp.value, "affect")) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "produced /affect replacement is not a CanonicalAffectV0");
    }

    // ---- regulation: the existing ReferenceRegulationV0Producer (§41) -----------
    const regulationProducer = this.deps.regulationProducer;
    let regulationDelta: DomainDeltaV0;
    try {
      regulationDelta = await regulationProducer.produceRegulationDelta({
        context: anchored,
        regulation: snapshot.regulation,
        elapsed_ticks: input.elapsed_ticks
      });
    } catch (error) {
      throw new TransitionStageFailure(
        STAGE,
        "SERVICE_UNAVAILABLE",
        "FAIL-SERVICE-001",
        "regulation producer failed (fail closed)",
        { cause: error }
      );
    }

    const proposal = buildV4TimeProposal(
      anchored.subject_id,
      anchored.state_revision,
      input.elapsed_ticks,
      affectDelta,
      regulationDelta
    );

    // ---- first call: reservation (same CAS/idempotency law as v3) ---------------
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

    // ---- second call: single CAS -------------------------------------------------
    return this.deps.subjectCore.commitReserved({
      proposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.producerAuthorizationIssuer.issue([
        { producer: "affect", domain: "affect" },
        { producer: "regulation", domain: "regulation" }
      ]),
      preparedBinding: capabilities.preparedBinding,
      repository_bindings: capabilities.repository_bindings as never
    });
  }
}
