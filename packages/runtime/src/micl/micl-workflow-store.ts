/**
 * P2.4 — MICL workflow store (micl-design.md §32; freeze §7.6; p2-runtime-plan §11 P2.4).
 *
 * Narrow workflow-owned authority for durable MICL progress: which stages
 * completed, which stage is pending, the authoritative refs of each completed
 * stage, and the frozen terminal MICLResult checkpoint. It is NOT canonical
 * SubjectState truth and exposes NO raw canonical journal/store internals.
 *
 * Prepared-record durability (freeze §7.6): before a NEW/SAME_OPEN proposal can
 * be terminalized as NO_OP or reach `commitReserved`, the store durably creates
 * ONE content-addressed `PreparedLogicalResultV1` —
 * `prepared_result_ref = workflow:<hex>` where hex is SHA-256/JCS of
 * `{projection:"characteros-next/runtime/prepared-logical-result/v1", value:
 * PREPARED_BODY_WITHOUT_PREPARED_RESULT_REF}` — and performs a read-verify
 * (same ref with different bytes = corruption). The record carries the frozen
 * `WorkflowBindingV0` (micl_id + request fingerprint + stage key); standalone
 * P2.3 executors keep their own behavior untouched.
 */

import type {
  CanonicalRefV0,
  CanonicalTransitionProposalV1,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  PreparedLogicalResultBindingV1,
  StateRevisionV0,
  TransitionType,
  WorkflowBindingV0
} from "@characteros-next/subject-core";
import { hashEnvelope, proposalFingerprint } from "@characteros-next/subject-core";
import type { MiclResultV0, MiclStageCheckpointV0, MiclWorkflowRecordV0 } from "./micl-types.js";

export const MICL_PREPARED_RESULT_PROJECTION =
  "characteros-next/runtime/prepared-logical-result/v1" as const;

/** Durable MICL progress authority (workflow-owned; never canonical state). */
export interface MiclWorkflowStore {
  /**
   * Create-if-absent durable record for one micl_id; returns the existing
   * record when present (ANY fingerprint) so the caller can compare.
   */
  loadOrCreate(init: {
    readonly micl_id: IdentifierV0;
    readonly subject_id: IdentifierV0;
    readonly request_fingerprint: HashV1;
    readonly initial_state_revision: StateRevisionV0;
    readonly initial_logical_time: LogicalTimeV0;
  }): Promise<MiclWorkflowRecordV0>;

  /** Durable stage checkpoint (committed logical result refs). */
  putStageCheckpoint(miclId: IdentifierV0, checkpoint: MiclStageCheckpointV0): Promise<void>;

  /** Durable terminal MICLResult checkpoint (byte-for-byte replay source). */
  putTerminalResult(miclId: IdentifierV0, result: MiclResultV0): Promise<void>;

  /**
   * Freeze §7.6: durable content-addressed PreparedLogicalResultV1 create +
   * read-verify for one stage proposal; mints the trusted binding capability.
   */
  prepareStageRecord(
    proposal: CanonicalTransitionProposalV1,
    workflowBinding: WorkflowBindingV0
  ): Promise<PreparedLogicalResultBindingV1>;

  /**
   * Crash reconciliation read (§32): the prepared record of one workflow stage,
   * or null when this stage never reached durable preparation. Used to rebuild
   * an exact committed stage result after a lost terminal checkpoint WITHOUT
   * re-running the committed stage.
   */
  findPreparedRecord(
    workflowBinding: WorkflowBindingV0
  ): Promise<{ readonly transition_id: string; readonly prepared_result_ref: string } | null>;

  /**
   * Durable stage-prepared marker for stages whose frozen executor owns its
   * prepared record inline (Learning, P2.3.5 behavior). The workflow ledger
   * records the deterministic identity BEFORE the executor runs so crash
   * reconciliation can locate the authoritative outcome.
   */
  putStagePreparedMarker(
    workflowBinding: WorkflowBindingV0,
    record: { readonly transition_id: string; readonly prepared_result_ref: string }
  ): Promise<void>;
}

function strip(digest: string): string {
  return digest.replace(/^sha256:/, "");
}

/** In-process durable reference implementation (content-addressed, CAS-free). */
export class InMemoryMiclWorkflowStore implements MiclWorkflowStore {
  private readonly records = new Map<string, MiclWorkflowRecordV0>();
  private readonly preparedBodies = new Map<string, string>();
  private readonly preparedMarkers = new Map<
    string,
    { binding: WorkflowBindingV0; record: { transition_id: string; prepared_result_ref: string } }
  >();

  async loadOrCreate(init: {
    readonly micl_id: IdentifierV0;
    readonly subject_id: IdentifierV0;
    readonly request_fingerprint: HashV1;
    readonly initial_state_revision: StateRevisionV0;
    readonly initial_logical_time: LogicalTimeV0;
  }): Promise<MiclWorkflowRecordV0> {
    const existing = this.records.get(init.micl_id);
    if (existing !== undefined) return existing;
    const record: MiclWorkflowRecordV0 = {
      micl_id: init.micl_id,
      subject_id: init.subject_id,
      request_fingerprint: init.request_fingerprint,
      initial_state_revision: init.initial_state_revision,
      initial_logical_time: init.initial_logical_time,
      stages: {},
      terminal_result: null
    };
    this.records.set(init.micl_id, record);
    return record;
  }

  async putStageCheckpoint(miclId: IdentifierV0, checkpoint: MiclStageCheckpointV0): Promise<void> {
    const record = this.records.get(miclId);
    if (record === undefined) {
      throw new Error(`workflow store corruption: no record for micl ${miclId}`);
    }
    const stages = { ...record.stages, [checkpoint.stage_key]: checkpoint };
    this.records.set(miclId, { ...record, stages });
  }

  async putTerminalResult(miclId: IdentifierV0, result: MiclResultV0): Promise<void> {
    const record = this.records.get(miclId);
    if (record === undefined) {
      throw new Error(`workflow store corruption: no record for micl ${miclId}`);
    }
    this.records.set(miclId, { ...record, terminal_result: result });
  }

  async prepareStageRecord(
    proposal: CanonicalTransitionProposalV1,
    workflowBinding: WorkflowBindingV0
  ): Promise<PreparedLogicalResultBindingV1> {
    const payloadFingerprint = await proposalFingerprint(proposal);
    // PREPARED_BODY_WITHOUT_PREPARED_RESULT_REF (freeze §7.6).
    const body = {
      schema_version: "prepared-logical-result-v1",
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type as TransitionType,
      payload_fingerprint: payloadFingerprint,
      workflow_binding: workflowBinding,
      domain_result_refs: [],
      external_effect_refs: [] as readonly []
    };
    const serialized = JSON.stringify(body);
    const ref = `workflow:${strip(await hashEnvelope(MICL_PREPARED_RESULT_PROJECTION, body))}` as CanonicalRefV0;
    const existing = this.preparedBodies.get(ref);
    if (existing !== undefined) {
      if (existing !== serialized) {
        throw new Error(`prepared-record corruption: same ref ${ref} with different bytes`);
      }
    } else {
      this.preparedBodies.set(ref, serialized);
      // Durable create + read-verify before any authority consumes the binding.
      const readBack = this.preparedBodies.get(ref);
      if (readBack !== serialized) {
        throw new Error(`prepared-record read-verify failed for ${ref}`);
      }
      this.preparedMarkers.set(ref, {
        binding: workflowBinding,
        record: { transition_id: proposal.transition_id, prepared_result_ref: ref }
      });
    }
    return {
      prepared_result_ref: ref,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type as TransitionType,
      payload_fingerprint: payloadFingerprint
    };
  }

  async findPreparedRecord(
    workflowBinding: WorkflowBindingV0
  ): Promise<{ readonly transition_id: string; readonly prepared_result_ref: string } | null> {
    for (const { binding, record } of this.preparedMarkers.values()) {
      if (
        binding.micl_id === workflowBinding.micl_id &&
        binding.micl_request_fingerprint === workflowBinding.micl_request_fingerprint &&
        binding.stage_key === workflowBinding.stage_key
      ) {
        return record;
      }
    }
    return null;
  }

  async putStagePreparedMarker(
    workflowBinding: WorkflowBindingV0,
    record: { readonly transition_id: string; readonly prepared_result_ref: string }
  ): Promise<void> {
    this.preparedMarkers.set(record.prepared_result_ref, { binding: workflowBinding, record });
  }
}
