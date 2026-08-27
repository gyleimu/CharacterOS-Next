/**
 * P2.4 — MICL stage capability minting (freeze §7.6/§14.1; p2-runtime-plan §11).
 *
 * Freeze ordering: reserveAndRoute FIRST, then durable PreparedLogicalResultV1
 * create/read-verify, then commitReserved with the minted binding. The frozen
 * Time/Observation executors take a host-minted `TransitionCapabilities` value
 * whose fingerprint must be authoritative for the EXACT proposal — but the
 * proposal is only fully assembled inside the executor (deterministic producers).
 *
 * This module closes that gap WITHOUT touching frozen executor internals:
 *  - the wrapper SubjectCorePort captures the proposal at `reserveAndRoute` —
 *    the executor's own proposal bytes;
 *  - `capabilities.preparedBinding` is a synchronous SENTINEL carrying the
 *    stage key;
 *  - the wrapper's `commitReserved`/`terminalizeReservedNoOp` REPLACES the
 *    sentinel with the real durable content-addressed binding (via
 *    `MiclWorkflowStore.prepareStageRecord`) before forwarding to subject-core.
 *
 * The executor never observes the substitution; the durable prepared record is
 * created strictly between reservation and authority, exactly as frozen.
 */

import type {
  CanonicalTransitionProposalV1,
  HashV1,
  IdentifierV0,
  MiclStageKey,
  PreparedLogicalResultBindingV1,
  WorkflowBindingV0
} from "@characteros-next/subject-core";
import type {
  SubjectCorePort,
  TransitionCapabilities
} from "../ports/subject-core-port.js";
import type { MiclWorkflowStore } from "./micl-workflow-store.js";

/** Sentinel ref prefix recognized by the wrapper (never reaches subject-core). */
export const MICL_SENTINEL_PREPARED_REF_PREFIX = "workflow:micl-pending-" as const;

export interface MiclStageMinter {
  /** Capturing wrapper over the host SubjectCorePort (proposal bytes only). */
  core(): SubjectCorePort;
  /** Stage capabilities whose `preparedBinding` is a synchronous sentinel. */
  capabilities(
    repositoryBindings: ReadonlyArray<{
      readonly repository_revision: string;
      readonly repository_revision_hash: string;
    }>
  ): TransitionCapabilities;
}

/**
 * One minter per stage execution; not reusable across stages. Closure-based so
 * the captured proposal is module-private state without `this` aliasing.
 */
export function createMiclStageMinter(
  inner: SubjectCorePort,
  store: MiclWorkflowStore,
  workflowBinding: WorkflowBindingV0
): MiclStageMinter {
  let captured: CanonicalTransitionProposalV1 | null = null;

  const rebind = async <
    T extends { readonly preparedBinding: PreparedLogicalResultBindingV1 }
  >(
    input: T
  ): Promise<T> => {
    const binding = input.preparedBinding;
    if (!binding.prepared_result_ref.startsWith(MICL_SENTINEL_PREPARED_REF_PREFIX)) {
      return input;
    }
    if (captured === null) {
      throw new Error("micl capability corruption: no captured proposal for sentinel binding");
    }
    const real = await store.prepareStageRecord(captured, workflowBinding);
    return { ...input, preparedBinding: real };
  };

  return {
    core(): SubjectCorePort {
      return {
        reserveAndRoute: async (proposal) => {
          captured = proposal;
          return inner.reserveAndRoute(proposal);
        },
        commitReserved: async (input) => inner.commitReserved(await rebind(input)),
        terminalizeReservedNoOp: async (input) =>
          inner.terminalizeReservedNoOp(await rebind(input)),
        reconcile: (transitionId, subjectId, fingerprint) =>
          inner.reconcile(transitionId, subjectId, fingerprint),
        readCurrentSnapshot: (subjectId) => inner.readCurrentSnapshot(subjectId)
      };
    },
    capabilities(
      repositoryBindings: ReadonlyArray<{
        readonly repository_revision: string;
        readonly repository_revision_hash: string;
      }>
    ): TransitionCapabilities {
      return {
        get preparedBinding(): PreparedLogicalResultBindingV1 {
          if (captured === null) {
            throw new Error("micl capability misuse: sentinel binding read before reservation");
          }
          // Sentinel values are placeholders only; the wrapper substitutes the
          // real durable binding before subject-core verifies anything.
          return {
            prepared_result_ref: `${MICL_SENTINEL_PREPARED_REF_PREFIX}${workflowBinding.stage_key}` as never,
            transition_id: captured.transition_id,
            subject_id: captured.subject_id,
            transition_type: captured.transition_type,
            payload_fingerprint: "micl-pending" as HashV1
          };
        },
        repository_bindings: repositoryBindings
      };
    }
  };
}

/** Convenience: micl workflow binding for one stage (freeze §7.6 WorkflowBindingV0). */
export function miclWorkflowBinding(
  miclId: IdentifierV0,
  requestFingerprint: HashV1,
  stageKey: MiclStageKey
): WorkflowBindingV0 {
  return {
    micl_id: miclId,
    micl_request_fingerprint: requestFingerprint,
    stage_key: stageKey
  };
}
