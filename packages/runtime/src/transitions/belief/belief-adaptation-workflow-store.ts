/**
 * InMemory durable store for the frozen Belief Adaptation Workflow V0
 * (`BeliefAdaptationWorkflowStoreV0`).
 *
 * INFRASTRUCTURE ONLY: holds the durable workflow records exactly as produced
 * by the frozen workflow; it owns NO Belief semantics, NO canonical state, and
 * NO authority. Every conditional update is linearizable within one process
 * (the session host serializes turns); create-once semantics (provider claim,
 * semantic candidate, plasticity receipt, proposal checkpoint, terminal) are
 * enforced exactly as the frozen contract requires.
 *
 * Session durability follows the established delivery/ingress ledger pattern:
 * `exportState()` produces a detached JSON-safe image (embedded in the session
 * durable state) and `restoreState()` rebuilds a fresh store from it. Tamper
 * authority stays with the frozen workflow: every loaded record is revalidated
 * and its checkpoint fingerprint recomputed by `runBeliefAdaptationWorkflowV0`
 * before any replay.
 */

import type {
  HashV1,
  IdentifierV0
} from "@characteros-next/subject-core";
import {
  deriveBeliefAdaptationWorkflowCheckpointFingerprint,
  type BeliefAdaptationTerminalV0,
  type BeliefAdaptationWorkflowRecordV0,
  type BeliefAdaptationWorkflowStoreV0
} from "./belief-adaptation-workflow.js";

export const BELIEF_ADAPTATION_WORKFLOW_STORE_SCHEMA_VERSION =
  "belief-adaptation-workflow-store-state-v0" as const;

/** Detached, JSON-safe durable image of every workflow record. */
export interface BeliefAdaptationWorkflowStoreStateV0 {
  readonly schema_version: typeof BELIEF_ADAPTATION_WORKFLOW_STORE_SCHEMA_VERSION;
  readonly records: readonly BeliefAdaptationWorkflowRecordV0[];
}

/** Workflow records that have not reached their write-once terminal result. */
const TERMINAL_KINDS: readonly string[] = [
  "COMPLETE_COMMITTED",
  "COMPLETE_ALREADY_COMMITTED",
  "COMPLETE_NO_BEARING",
  "COMPLETE_NEW_PROPOSITION_CANDIDATE_OBSERVED",
  "COMPLETE_NO_CHANGE",
  "COMPLETE_EXECUTOR_NO_OP",
  "REJECTED_SEMANTIC",
  "REJECTED_EXECUTOR"
];

export class InMemoryBeliefAdaptationWorkflowStoreV0 implements BeliefAdaptationWorkflowStoreV0 {
  private readonly records = new Map<string, BeliefAdaptationWorkflowRecordV0>();

  private mutable(workflowId: string): BeliefAdaptationWorkflowRecordV0 {
    const record = this.records.get(workflowId);
    if (record === undefined) {
      throw new Error(`belief workflow store: record ${workflowId} missing`);
    }
    return record;
  }

  private async write(
    workflowId: string,
    next: Omit<BeliefAdaptationWorkflowRecordV0, "checkpoint_fingerprint">
  ): Promise<void> {
    const placeholder = {
      ...next,
      checkpoint_fingerprint: ("sha256:" + "0".repeat(64)) as HashV1
    } as BeliefAdaptationWorkflowRecordV0;
    const fingerprint = await deriveBeliefAdaptationWorkflowCheckpointFingerprint(placeholder);
    this.records.set(workflowId, { ...placeholder, checkpoint_fingerprint: fingerprint });
  }

  async load(workflow_id: IdentifierV0): Promise<BeliefAdaptationWorkflowRecordV0 | null> {
    return this.records.get(workflow_id) ?? null;
  }

  async createIfAbsent(record: BeliefAdaptationWorkflowRecordV0): Promise<"CREATED" | "EXISTING"> {
    if (this.records.has(record.workflow_id)) return "EXISTING";
    this.records.set(record.workflow_id, record);
    return "CREATED";
  }

  async claimProviderCall(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1
  ): Promise<"CLAIMED" | "ALREADY_CLAIMED"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) {
      throw new Error("belief workflow store: request fingerprint mismatch");
    }
    if (record.external_provider_call_count === 1) return "ALREADY_CLAIMED";
    await this.write(workflow_id, {
      ...record,
      external_provider_call_count: 1,
      stage: "B2_SEMANTIC_PROVIDER_CALL"
    });
    return "CLAIMED";
  }

  async saveSemanticCandidate(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    candidate: BeliefAdaptationWorkflowRecordV0["semantic_candidate"],
    candidate_fingerprint: HashV1
  ): Promise<"SAVED" | "CANDIDATE_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) {
      throw new Error("belief workflow store: request fingerprint mismatch");
    }
    if (record.semantic_candidate !== null) {
      return JSON.stringify(record.semantic_candidate) === JSON.stringify(candidate)
        ? "SAVED"
        : "CANDIDATE_CONFLICT";
    }
    await this.write(workflow_id, {
      ...record,
      semantic_candidate: candidate,
      semantic_candidate_fingerprint: candidate_fingerprint,
      stage: "B3_SEMANTIC_CHECKPOINTED"
    });
    return "SAVED";
  }

  async savePlasticityReceipt(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    receipt: BeliefAdaptationWorkflowRecordV0["plasticity_receipt"]
  ): Promise<"SAVED" | "RECEIPT_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) {
      throw new Error("belief workflow store: request fingerprint mismatch");
    }
    if (record.plasticity_receipt !== null) {
      return JSON.stringify(record.plasticity_receipt) === JSON.stringify(receipt)
        ? "SAVED"
        : "RECEIPT_CONFLICT";
    }
    await this.write(workflow_id, { ...record, plasticity_receipt: receipt, stage: "B4_PLASTICITY_CHECKPOINTED" });
    return "SAVED";
  }

  async saveProposalCheckpoint(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    checkpoint: BeliefAdaptationWorkflowRecordV0["proposal_checkpoint"]
  ): Promise<"SAVED" | "CHECKPOINT_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) {
      throw new Error("belief workflow store: request fingerprint mismatch");
    }
    if (record.proposal_checkpoint !== null) {
      return JSON.stringify(record.proposal_checkpoint) === JSON.stringify(checkpoint)
        ? "SAVED"
        : "CHECKPOINT_CONFLICT";
    }
    await this.write(workflow_id, { ...record, proposal_checkpoint: checkpoint, stage: "B5_PROPOSAL_PREPARED" });
    return "SAVED";
  }

  async compareAndSetStage(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    from: BeliefAdaptationWorkflowRecordV0["stage"],
    to: BeliefAdaptationWorkflowRecordV0["stage"]
  ): Promise<"SET" | "STAGE_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) {
      throw new Error("belief workflow store: request fingerprint mismatch");
    }
    if (record.stage !== from) return "STAGE_CONFLICT";
    await this.write(workflow_id, { ...record, stage: to });
    return "SET";
  }

  async saveTerminalResult(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    terminal: BeliefAdaptationTerminalV0
  ): Promise<"SAVED" | "TERMINAL_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) {
      throw new Error("belief workflow store: request fingerprint mismatch");
    }
    if (record.terminal_result !== null) {
      return JSON.stringify(record.terminal_result) === JSON.stringify(terminal)
        ? "SAVED"
        : "TERMINAL_CONFLICT";
    }
    await this.write(workflow_id, { ...record, terminal_result: terminal, stage: "B7_COMPLETE" });
    return "SAVED";
  }

  // ---- session durability (infrastructure surface, not part of the frozen contract) ----

  /** Deterministic workflow ids of records without a write-once terminal result. */
  listNonTerminalWorkflowIds(): readonly IdentifierV0[] {
    return [...this.records.values()]
      .filter((record) => {
        const terminal = record.terminal_result as { readonly kind?: string } | null;
        return terminal === null || terminal.kind === undefined || !TERMINAL_KINDS.includes(terminal.kind);
      })
      .map((record) => record.workflow_id)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  /** Detached JSON-safe durable image (never aliases live records). */
  exportState(): BeliefAdaptationWorkflowStoreStateV0 {
    return {
      schema_version: BELIEF_ADAPTATION_WORKFLOW_STORE_SCHEMA_VERSION,
      records: JSON.parse(JSON.stringify([...this.records.values()])) as BeliefAdaptationWorkflowRecordV0[]
    };
  }

  /** Rebuilds from a detached image. Shape errors fail closed (empty store). */
  async restoreState(
    state: unknown
  ): Promise<{ readonly ok: boolean; readonly restored: number; readonly detail: string | null }> {
    if (state === null || state === undefined) return { ok: true, restored: 0, detail: null };
    if (typeof state !== "object" || Array.isArray(state)) {
      return { ok: false, restored: 0, detail: "belief workflow store state: expected object" };
    }
    const record = state as Record<string, unknown>;
    if (record["schema_version"] !== BELIEF_ADAPTATION_WORKFLOW_STORE_SCHEMA_VERSION) {
      return { ok: false, restored: 0, detail: "belief workflow store state: unsupported schema_version" };
    }
    const rawRecords = record["records"];
    if (!Array.isArray(rawRecords)) {
      return { ok: false, restored: 0, detail: "belief workflow store state: records array required" };
    }
    const seen = new Set<string>();
    for (const raw of rawRecords) {
      if (typeof raw !== "object" || raw === null) {
        return { ok: false, restored: 0, detail: "belief workflow store state: record must be an object" };
      }
      const candidate = raw as Record<string, unknown>;
      if (typeof candidate["workflow_id"] !== "string" || typeof candidate["checkpoint_fingerprint"] !== "string") {
        return { ok: false, restored: 0, detail: "belief workflow store state: record identity malformed" };
      }
      if (seen.has(candidate["workflow_id"])) {
        return { ok: false, restored: 0, detail: "belief workflow store state: duplicate workflow_id" };
      }
      seen.add(candidate["workflow_id"]);
    }
    this.records.clear();
    for (const raw of rawRecords) {
      const restoredRecord = JSON.parse(JSON.stringify(raw)) as BeliefAdaptationWorkflowRecordV0;
      this.records.set(restoredRecord.workflow_id, restoredRecord);
    }
    return { ok: true, restored: this.records.size, detail: null };
  }
}
