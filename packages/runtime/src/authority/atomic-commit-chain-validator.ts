/**
 * CharacterOS Atomic Commit Chain Validator V0 — full coordinator
 * (CHARACTEROS_ATOMIC_COMMIT_CHAIN_VALIDATOR_V0, LEVEL_2).
 *
 * Validates ONE complete candidate canonical history from the trusted R0
 * genesis envelope to the trusted Level-2 canonical head:
 *   1. trusted-boundary admission (module-private WeakSet)
 *   2. genesis law verification
 *   3. trusted-head structural validation
 *   4. per-bundle closed single-record validation (V1/V2 dispatch REUSED —
 *      no duplicated bundle law)
 *   5. per-bundle continuity: version monotonicity (REUSED primitive),
 *      subject, revision, commit-link, predecessor hash continuity, logical
 *      time, trace continuity, identity uniqueness, repository bindings
 *   6. V2 persisted canonical proposal effect replay (SAME shared
 *      transition-effect primitives as production commit semantics)
 *   7. terminal trusted-head binding
 *
 * Proof levels (frozen):
 *   V1: INTEGRITY_CONTINUITY_TRACE_AND_TRUSTED_HEAD_BINDING_ONLY_NO_PROPOSAL_EFFECT_REPLAY
 *       — V1 proposal bytes do not exist; they are NEVER synthesized from
 *       trace/transition type/ids/paths/next snapshot.
 *   V2: INTEGRITY_CONTINUITY_TRUSTED_HEAD_BINDING_AND_CANONICAL_PROPOSAL_EFFECT_REPLAY.
 *
 * PURE / READ-ONLY: zero store writes, zero head publication, zero repair,
 * zero migration, zero state mutation, zero trace append, zero model, zero
 * network. Caller arrays are snapshotted before validation and verified
 * unchanged semantically (pure functions never mutate).
 *
 * Writer-authority STATUS is classified per V2 bundle from the CharacterOS
 * static historical authority registry and REPORTED in the receipt; it never
 * controls general chain validity and never constitutes governed provenance.
 */

import type { HashV1, IdentifierV0, StateRevisionV0 } from "@characteros-next/subject-core";
import {
  evaluateCommitBundleVersionStepV0,
  hashEnvelope,
  lastTraceRef,
  nextTraceWindow,
  stateHash,
  validateAtomicCommitBundleAnyVersion,
  type AtomicCommitBundleAnyVersion,
  type AtomicCommitBundleV2,
  type CanonicalRefV0,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import { replayCanonicalTransitionEffectV0 } from "@characteros-next/subject-core";

import {
  isTrustedCanonicalHistoryBoundaryReceiptV0,
  validateTrustedCanonicalHeadInputV0,
  verifyGenesisEnvelopeV0,
  type TrustedCanonicalHistoryBoundaryReceiptV0
} from "./trusted-canonical-history-boundary.js";
import {
  getRecognizedWriterSchemaContractsV0,
  REGISTERED_AUTHORIZATION_GATE_IDS_V0,
  REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0
} from "./historical-writer-authority-registry.js";

// ---- policy descriptor --------------------------------------------------------------

export const ATOMIC_COMMIT_CHAIN_VALIDATOR_POLICY_ID_V0 =
  "characteros-atomic-commit-chain-validator-v0" as const;

export const ATOMIC_COMMIT_CHAIN_VALIDATION_POLICY_PROJECTION_V0 =
  "characteros-next/subject-core/atomic-commit-chain-validation-policy/v1" as const;

export const V1_CHAIN_PROOF_LEVEL_V0 =
  "INTEGRITY_CONTINUITY_TRACE_AND_TRUSTED_HEAD_BINDING_ONLY_NO_PROPOSAL_EFFECT_REPLAY" as const;

export const V2_CHAIN_PROOF_LEVEL_V0 =
  "INTEGRITY_CONTINUITY_TRUSTED_HEAD_BINDING_AND_CANONICAL_PROPOSAL_EFFECT_REPLAY" as const;

export const ATOMIC_COMMIT_CHAIN_CHECKPOINT_SUPPORT_V0 = "NONE" as const;
export const TRUNCATED_CHAIN_POLICY_V0 = "FAIL_CLOSED" as const;

/** Immutable policy descriptor freezing the complete chain law. */
export interface AtomicCommitChainValidationPolicyDescriptorV0 {
  readonly policy_id: typeof ATOMIC_COMMIT_CHAIN_VALIDATOR_POLICY_ID_V0;
  readonly recognized_bundle_versions: readonly ["atomic-commit-v1", "atomic-commit-v2"];
  readonly version_monotonicity: "DOWNGRADE_FORBIDDEN";
  readonly genesis_law: "REVISION_ZERO_ENVELOPE_WITH_RECOMPUTED_HASHES";
  readonly adjacency_laws: "SUBJECT_REVISION_COMMIT_LINK_HASH_TIME_TRACE_IDENTITY_BINDINGS";
  readonly v1_proof_level: typeof V1_CHAIN_PROOF_LEVEL_V0;
  readonly v2_proof_level: typeof V2_CHAIN_PROOF_LEVEL_V0;
  readonly v1_proposal_synthesis: "FORBIDDEN";
  readonly v2_replay: "SHARED_CANONICAL_TRANSITION_EFFECT_PRIMITIVES";
  readonly checkpoint_support: typeof ATOMIC_COMMIT_CHAIN_CHECKPOINT_SUPPORT_V0;
  readonly truncated_chain_policy: typeof TRUNCATED_CHAIN_POLICY_V0;
  readonly trusted_head_equality: "SIX_FIELD_EXACT_NO_SUBSET";
  readonly authority_status_separation: "STATUS_REPORTED_NOT_CONTROLLING_VALIDITY";
  readonly failure_precedence: readonly [
    "BOUNDARY_ADMISSION",
    "GENESIS",
    "TRUSTED_HEAD_STRUCTURAL",
    "SINGLE_RECORD",
    "CONTINUITY",
    "V2_EFFECT_REPLAY",
    "TRUSTED_HEAD_TERMINAL"
  ];
}

export const ATOMIC_COMMIT_CHAIN_VALIDATION_POLICY_DESCRIPTOR_V0: AtomicCommitChainValidationPolicyDescriptorV0 =
  {
    policy_id: ATOMIC_COMMIT_CHAIN_VALIDATOR_POLICY_ID_V0,
    recognized_bundle_versions: ["atomic-commit-v1", "atomic-commit-v2"],
    version_monotonicity: "DOWNGRADE_FORBIDDEN",
    genesis_law: "REVISION_ZERO_ENVELOPE_WITH_RECOMPUTED_HASHES",
    adjacency_laws: "SUBJECT_REVISION_COMMIT_LINK_HASH_TIME_TRACE_IDENTITY_BINDINGS",
    v1_proof_level: V1_CHAIN_PROOF_LEVEL_V0,
    v2_proof_level: V2_CHAIN_PROOF_LEVEL_V0,
    v1_proposal_synthesis: "FORBIDDEN",
    v2_replay: "SHARED_CANONICAL_TRANSITION_EFFECT_PRIMITIVES",
    checkpoint_support: "NONE",
    truncated_chain_policy: "FAIL_CLOSED",
    trusted_head_equality: "SIX_FIELD_EXACT_NO_SUBSET",
    authority_status_separation: "STATUS_REPORTED_NOT_CONTROLLING_VALIDITY",
    failure_precedence: [
      "BOUNDARY_ADMISSION",
      "GENESIS",
      "TRUSTED_HEAD_STRUCTURAL",
      "SINGLE_RECORD",
      "CONTINUITY",
      "V2_EFFECT_REPLAY",
      "TRUSTED_HEAD_TERMINAL"
    ]
  };

Object.freeze(ATOMIC_COMMIT_CHAIN_VALIDATION_POLICY_DESCRIPTOR_V0);

export async function deriveAtomicCommitChainValidationPolicyFingerprintV0(): Promise<HashV1> {
  return hashEnvelope(
    ATOMIC_COMMIT_CHAIN_VALIDATION_POLICY_PROJECTION_V0,
    ATOMIC_COMMIT_CHAIN_VALIDATION_POLICY_DESCRIPTOR_V0
  );
}

// ---- input / result types -----------------------------------------------------------

export interface AtomicCommitChainValidationInputV0 {
  readonly trusted_boundary: TrustedCanonicalHistoryBoundaryReceiptV0;
  /** Candidate canonical path, oldest → newest. Array order is NOT chain authority. */
  readonly bundles: readonly unknown[];
}

export type ChainValidationFailureCodeV0 =
  | "UNTRUSTED_BOUNDARY"
  | "INVALID_GENESIS"
  | "INVALID_TRUSTED_HEAD"
  | "INVALID_BUNDLE"
  | "UNKNOWN_ATOMIC_COMMIT_VERSION"
  | "VERSION_DOWNGRADE"
  | "SUBJECT_MISMATCH"
  | "REVISION_GAP"
  | "DUPLICATE_REVISION"
  | "PREDECESSOR_REF_MISMATCH"
  | "PREDECESSOR_CHECKSUM_MISMATCH"
  | "PREDECESSOR_SNAPSHOT_MISMATCH"
  | "STATE_HASH_MISMATCH"
  | "SNAPSHOT_HASH_MISMATCH"
  | "LOGICAL_TIME_MISMATCH"
  | "TRACE_CONTINUITY_FAILURE"
  | "IDENTITY_RECORD_FAILURE"
  | "REPOSITORY_BINDING_FAILURE"
  | "TRANSITION_ID_REUSE"
  | "DUPLICATE_COMMIT_REF"
  | "DUPLICATE_RECORD_CHECKSUM"
  | "CYCLE_DETECTED"
  | "V2_PROPOSAL_EFFECT_MISMATCH"
  | "TRUSTED_HEAD_MISMATCH"
  | "TRUNCATED_HISTORY";

export interface ChainValidationFailureV0 {
  readonly code: ChainValidationFailureCodeV0;
  readonly bundle_index: number | null;
  readonly commit_ref: CanonicalRefV0 | null;
  readonly detail: string;
  readonly source_failure?: {
    readonly code?: string;
    readonly reason?: string;
    readonly detail: string;
  } | undefined;
}

export type WriterAuthorityStatusV0 =
  | "NOT_PRESENT"
  | "RESOLVED_VALID"
  | "UNRESOLVED"
  | "RESOLVED_INVALID";

export interface ChainValidationReceiptV0 {
  readonly schema_version: "atomic-commit-chain-validation-receipt-v0";
  readonly policy_id: typeof ATOMIC_COMMIT_CHAIN_VALIDATOR_POLICY_ID_V0;
  readonly policy_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly genesis_revision: 0;
  readonly genesis_full_snapshot_checksum: HashV1;
  readonly genesis_state_hash: HashV1;
  readonly genesis_snapshot_hash: HashV1;
  readonly terminal_revision: StateRevisionV0;
  readonly terminal_commit_ref: CanonicalRefV0 | null;
  readonly terminal_record_checksum: HashV1 | null;
  readonly terminal_state_hash: HashV1;
  readonly terminal_snapshot_hash: HashV1;
  readonly bundle_count: number;
  readonly v1_bundle_count: number;
  readonly v2_bundle_count: number;
  readonly first_v2_bundle_index: number | null;
  readonly first_v2_revision: StateRevisionV0 | null;
  readonly v1_proof_level: typeof V1_CHAIN_PROOF_LEVEL_V0;
  readonly v2_proof_level: typeof V2_CHAIN_PROOF_LEVEL_V0;
  readonly writer_authority_summary: {
    readonly not_present: number;
    readonly resolved_valid: number;
    readonly unresolved: number;
    readonly resolved_invalid: number;
  };
}

export type AtomicCommitChainValidationResultV0 =
  | { readonly kind: "VALID"; readonly receipt: ChainValidationReceiptV0 }
  | {
      readonly kind: "INVALID";
      readonly policy_id: typeof ATOMIC_COMMIT_CHAIN_VALIDATOR_POLICY_ID_V0;
      readonly policy_fingerprint: HashV1;
      readonly failure: ChainValidationFailureV0;
    };

// ---- helpers ------------------------------------------------------------------------

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Writer-authority STATUS classification from the static historical authority
 * registry ONLY. No host boolean, no caller validator, no dynamic
 * registration. With zero gates/policies registered, a schema-matching
 * record currently classifies UNRESOLVED (gate/policy layer unresolved);
 * a known schema id with a wrong family/fingerprint classifies
 * RESOLVED_INVALID (known-invalid historical authority, reported verbatim).
 */
async function classifyWriterAuthorityStatusV0(
  writerAuthority: NonNullable<AtomicCommitBundleV2["writer_authority"]>
): Promise<WriterAuthorityStatusV0> {
  const contracts = await getRecognizedWriterSchemaContractsV0();
  const known = contracts.find(
    (contract) => contract.writer_schema_id === writerAuthority.writer_schema_id
  );
  if (known === undefined) return "UNRESOLVED";
  if (
    known.writer_family !== writerAuthority.writer_family ||
    known.writer_schema_fingerprint !== writerAuthority.writer_schema_fingerprint
  ) {
    return "RESOLVED_INVALID";
  }
  if (
    !REGISTERED_AUTHORIZATION_GATE_IDS_V0.includes(writerAuthority.authorization_gate_id) ||
    !REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0.includes(writerAuthority.writer_schema_id)
  ) {
    return "UNRESOLVED";
  }
  return "RESOLVED_VALID";
}

// ---- validator ----------------------------------------------------------------------

export async function validateAtomicCommitChainV0(
  input: AtomicCommitChainValidationInputV0
): Promise<AtomicCommitChainValidationResultV0> {
  const policyFingerprint = await deriveAtomicCommitChainValidationPolicyFingerprintV0();
  const invalid = (
    code: ChainValidationFailureCodeV0,
    bundleIndex: number | null,
    commitRef: CanonicalRefV0 | null,
    detail: string,
    sourceFailure?: { readonly code?: string; readonly reason?: string; readonly detail: string }
  ): AtomicCommitChainValidationResultV0 => ({
    kind: "INVALID",
    policy_id: ATOMIC_COMMIT_CHAIN_VALIDATOR_POLICY_ID_V0,
    policy_fingerprint: policyFingerprint,
    failure: {
      code,
      bundle_index: bundleIndex,
      commit_ref: commitRef,
      detail,
      source_failure: sourceFailure
    }
  });

  // 1. Boundary admission (WeakSet object identity — clones/lookalikes fail).
  if (!isTrustedCanonicalHistoryBoundaryReceiptV0(input.trusted_boundary)) {
    return invalid(
      "UNTRUSTED_BOUNDARY",
      null,
      null,
      "trusted boundary receipt was not minted by the internal issuer"
    );
  }
  const boundary = input.trusted_boundary;

  // Snapshot the caller-owned candidate array before any use (no mutation).
  const bundles: readonly unknown[] = [...input.bundles];

  // 2. Genesis law.
  const genesisCheck = await verifyGenesisEnvelopeV0(boundary.genesis);
  if (!genesisCheck.ok) {
    return invalid("INVALID_GENESIS", null, null, genesisCheck.error.detail);
  }
  const genesis = boundary.genesis;

  // 3. Trusted-head structural validation.
  const headCheck = validateTrustedCanonicalHeadInputV0(boundary.head);
  if (!headCheck.ok) {
    return invalid("INVALID_TRUSTED_HEAD", null, null, headCheck.error.detail);
  }
  const head = headCheck.head;

  const writerAuthoritySummary = {
    not_present: 0,
    resolved_valid: 0,
    unresolved: 0,
    resolved_invalid: 0
  };

  // 29. Empty chain: valid ONLY against the exact revision-zero genesis head.
  if (bundles.length === 0) {
    if (head.revision !== 0) {
      return invalid(
        "TRUNCATED_HISTORY",
        null,
        head.commit_ref,
        "positive trusted head with an empty candidate chain (checkpoint support is NONE)"
      );
    }
    if (
      head.commit_ref !== null ||
      head.record_checksum !== null ||
      head.subject_id !== genesis.snapshot.identity.subject_id ||
      head.state_hash !== genesis.state_hash ||
      head.snapshot_hash !== genesis.snapshot_hash
    ) {
      return invalid(
        "TRUSTED_HEAD_MISMATCH",
        null,
        head.commit_ref,
        "empty chain trusted head does not bind the genesis envelope exactly"
      );
    }
    return {
      kind: "VALID",
      receipt: buildReceipt(boundary, policyFingerprint, 0, 0, 0, null, null, writerAuthoritySummary)
    };
  }

  const subjectId = genesis.snapshot.identity.subject_id;
  const seenRevisions = new Set<number>([0]);
  const seenTransitionIds = new Set<string>();
  const seenCommitRefs = new Set<string>();
  const seenChecksums = new Set<string>();
  const repositoryBindingHashes = new Map<string, string>();
  let v1Count = 0;
  let v2Count = 0;
  let firstV2BundleIndex: number | null = null;
  let firstV2Revision: StateRevisionV0 | null = null;

  // Chain-held predecessor: genesis.snapshot or previous bundle.next_snapshot ONLY.
  let predecessor: SubjectStateV0 = genesis.snapshot;
  let predecessorBundle: AtomicCommitBundleAnyVersion | null = null;

  // 4-6. Per-bundle single-record + continuity + replay, lowest index first.
  for (let index = 0; index < bundles.length; index++) {
    const raw = bundles[index];

    // 4. Single-record closed validation (V1/V2 law REUSED, not duplicated).
    if (!isRecord(raw)) {
      return invalid("INVALID_BUNDLE", index, null, "bundle must be a plain object");
    }
    const single = await validateAtomicCommitBundleAnyVersion(raw);
    if (!single.ok) {
      // Unknown bundle versions get their own closed vocabulary entry.
      const isUnknownVersion = single.error.detail.includes("unknown version");
      return invalid(
        isUnknownVersion ? "UNKNOWN_ATOMIC_COMMIT_VERSION" : "INVALID_BUNDLE",
        index,
        isString(raw["commit_ref"]) ? (raw["commit_ref"] as CanonicalRefV0) : null,
        `single-record validation failed: ${single.error.detail}`,
        { code: single.error.error_code, reason: single.error.reason, detail: single.error.detail }
      );
    }
    const bundle = single.value as AtomicCommitBundleAnyVersion;
    const bundleRef = bundle.commit_ref;

    // 5a. Version continuity (REUSED version-step primitive; no duplicated law).
    if (predecessorBundle !== null) {
      const step = evaluateCommitBundleVersionStepV0(
        predecessorBundle.commit_version,
        bundle.commit_version
      );
      if (step !== "ALLOWED") {
        return invalid(
          "VERSION_DOWNGRADE",
          index,
          bundleRef,
          `version downgrade ${predecessorBundle.commit_version} -> ${bundle.commit_version}`
        );
      }
    }

    // 5b. Subject continuity.
    if (bundle.subject_id !== subjectId) {
      return invalid(
        "SUBJECT_MISMATCH",
        index,
        bundleRef,
        `bundle subject ${bundle.subject_id} does not match the chain subject ${subjectId}`
      );
    }

    // 5c. Revision continuity.
    if (seenRevisions.has(bundle.next_revision)) {
      return invalid(
        "DUPLICATE_REVISION",
        index,
        bundleRef,
        `revision ${bundle.next_revision} already committed on this chain`
      );
    }
    const expectedRevision = predecessorBundle === null ? 0 : predecessorBundle.next_revision;
    if (bundle.expected_revision !== expectedRevision) {
      return invalid(
        "REVISION_GAP",
        index,
        bundleRef,
        `expected_revision ${bundle.expected_revision} does not continue the chain at ${expectedRevision}`
      );
    }

    // 5d. Commit-link continuity.
    if (bundle.previous_commit_ref !== (predecessorBundle === null ? null : predecessorBundle.commit_ref)) {
      return invalid(
        "PREDECESSOR_REF_MISMATCH",
        index,
        bundleRef,
        "previous_commit_ref does not bind the chain-held predecessor commit"
      );
    }
    if (
      bundle.previous_record_checksum !==
      (predecessorBundle === null ? null : predecessorBundle.record_checksum)
    ) {
      return invalid(
        "PREDECESSOR_CHECKSUM_MISMATCH",
        index,
        bundleRef,
        "previous_record_checksum does not bind the chain-held predecessor record"
      );
    }

    // 5e. Predecessor hash continuity: recompute from the chain-held predecessor.
    const predecessorStateHash = await stateHash(predecessor);
    if (bundle.state_hash_before !== predecessorStateHash) {
      return invalid(
        "STATE_HASH_MISMATCH",
        index,
        bundleRef,
        "state_hash_before does not match stateHash(chain-held predecessor)"
      );
    }
    if (predecessorBundle !== null) {
      if (predecessorBundle.state_hash_after !== bundle.state_hash_before) {
        return invalid(
          "STATE_HASH_MISMATCH",
          index,
          bundleRef,
          "predecessor.state_hash_after does not equal current.state_hash_before"
        );
      }
      if (predecessorBundle.snapshot_hash_after !== bundle.snapshot_hash_before) {
        return invalid(
          "SNAPSHOT_HASH_MISMATCH",
          index,
          bundleRef,
          "predecessor.snapshot_hash_after does not equal current.snapshot_hash_before"
        );
      }
    }

    // 5f. Logical time continuity (exact transition law; never assume +1).
    if (bundle.logical_time_before !== predecessor.runtime_metadata.logical_time) {
      return invalid(
        "LOGICAL_TIME_MISMATCH",
        index,
        bundleRef,
        "logical_time_before does not equal the predecessor logical time"
      );
    }
    if (bundle.logical_time_after !== bundle.next_snapshot.runtime_metadata.logical_time) {
      return invalid(
        "LOGICAL_TIME_MISMATCH",
        index,
        bundleRef,
        "logical_time_after does not equal next_snapshot runtime logical time"
      );
    }
    const advance = bundle.logical_time_after - bundle.logical_time_before;
    if (bundle.transition_type === "Time") {
      if (advance < 1 || !Number.isSafeInteger(bundle.logical_time_after)) {
        return invalid(
          "LOGICAL_TIME_MISMATCH",
          index,
          bundleRef,
          "Time transitions require a positive safe-integer logical time advance"
        );
      }
    } else if (advance !== 0) {
      return invalid(
        "LOGICAL_TIME_MISMATCH",
        index,
        bundleRef,
        "non-Time transitions must not advance logical time"
      );
    }

    // 5g. Trace continuity: recompute the expected window from the predecessor.
    const expectedWindow = nextTraceWindow(predecessor.trace_window, bundle.trace_entry, bundle.next_revision);
    if (!sameJson(expectedWindow, bundle.trace_window)) {
      return invalid(
        "TRACE_CONTINUITY_FAILURE",
        index,
        bundleRef,
        "trace_window does not match nextTraceWindow(predecessor, trace_entry, next_revision)"
      );
    }
    if (!sameJson(expectedWindow, bundle.next_snapshot.trace_window)) {
      return invalid(
        "TRACE_CONTINUITY_FAILURE",
        index,
        bundleRef,
        "next_snapshot.trace_window does not match the projected successor window"
      );
    }
    if (bundle.mutation_history_link.previous_trace_ref !== lastTraceRef(predecessor.trace_window)) {
      return invalid(
        "TRACE_CONTINUITY_FAILURE",
        index,
        bundleRef,
        "mutation_history_link.previous_trace_ref does not bind the predecessor trace position"
      );
    }

    // 5h. Identity uniqueness + duplicate/cycle detection (adjacency-precise).
    if (seenTransitionIds.has(bundle.transition_id)) {
      return invalid(
        "TRANSITION_ID_REUSE",
        index,
        bundleRef,
        `transition_id ${bundle.transition_id} already committed on this chain`
      );
    }
    if (seenCommitRefs.has(bundleRef)) {
      if (predecessorBundle !== null && seenCommitRefs.has(predecessorBundle.commit_ref)) {
        // A bundle claiming to continue from a commit that already appeared at
        // an earlier, already-consumed position is a literal chain loop.
        const earlierIndex = findEarlierBundleIndex(bundles, index, bundleRef);
        if (earlierIndex !== null) {
          const earlier = bundles[earlierIndex] as AtomicCommitBundleAnyVersion;
          if (earlier.next_revision === bundle.expected_revision) {
            return invalid("CYCLE_DETECTED", index, bundleRef, "bundle loops back onto an already-consumed chain position");
          }
        }
      }
      return invalid("DUPLICATE_COMMIT_REF", index, bundleRef, "commit_ref already present on this chain");
    }
    if (seenChecksums.has(bundle.record_checksum)) {
      return invalid("DUPLICATE_RECORD_CHECKSUM", index, bundleRef, "record_checksum already present on this chain");
    }

    // 5i. Repository binding coherence across the chain (arrays MAY change;
    // the same revision id may never carry two different hashes).
    for (const binding of bundle.repository_revision_bindings) {
      const knownHash = repositoryBindingHashes.get(binding.repository_revision);
      if (knownHash !== undefined && knownHash !== binding.repository_revision_hash) {
        return invalid(
          "REPOSITORY_BINDING_FAILURE",
          index,
          bundleRef,
          `repository revision ${binding.repository_revision} appears with two different hashes`
        );
      }
      repositoryBindingHashes.set(binding.repository_revision, binding.repository_revision_hash);
    }
    if (bundle.commit_version === "atomic-commit-v2") {
      const expectedMemoryRevision = bundle.canonical_proposal.domain_deltas.find(
        (delta) => delta.expected_repository_revision !== null
      )?.expected_repository_revision;
      if (
        expectedMemoryRevision !== undefined &&
        expectedMemoryRevision !== null &&
        !bundle.repository_revision_bindings.some(
          (binding) => binding.repository_revision === expectedMemoryRevision
        )
      ) {
        return invalid(
          "REPOSITORY_BINDING_FAILURE",
          index,
          bundleRef,
          `V2 persisted proposal expects repository revision ${expectedMemoryRevision} without a recorded binding`
        );
      }
    }

    // 6. V2 persisted-proposal effect replay (SAME shared transition effect).
    if (bundle.commit_version === "atomic-commit-v2") {
      const replay = await replayCanonicalTransitionEffectV0({
        predecessor,
        proposal: bundle.canonical_proposal
      });
      if (replay.kind === "REJECTED") {
        // Replay failures map to the most precise closed vocabulary entry:
        // a persisted proposal expecting a different predecessor snapshot vs
        // a proposal whose logical-time law breaks at this position.
        const code: ChainValidationFailureCodeV0 =
          replay.failure.error_code === "STALE_STATE_REVISION"
            ? "PREDECESSOR_SNAPSHOT_MISMATCH"
            : replay.failure.error_code === "INVALID_LOGICAL_TIME"
              ? "LOGICAL_TIME_MISMATCH"
              : "V2_PROPOSAL_EFFECT_MISMATCH";
        return invalid(
          code,
          index,
          bundleRef,
          `persisted proposal does not replay onto the chain-held predecessor: ${replay.failure.detail}`,
          { code: replay.failure.error_code, reason: replay.failure.reason, detail: replay.failure.detail }
        );
      }
      const effect = replay.effect;
      const mismatches: string[] = [];
      if (!sameJson(effect.successor, bundle.next_snapshot)) mismatches.push("next_snapshot");
      if (effect.state_hash_before !== bundle.state_hash_before) mismatches.push("state_hash_before");
      if (effect.state_hash_after !== bundle.state_hash_after) mismatches.push("state_hash_after");
      if (effect.snapshot_hash_before !== bundle.snapshot_hash_before) mismatches.push("snapshot_hash_before");
      if (effect.snapshot_hash_after !== bundle.snapshot_hash_after) mismatches.push("snapshot_hash_after");
      if (effect.logical_time_before !== bundle.logical_time_before) mismatches.push("logical_time_before");
      if (effect.logical_time_after !== bundle.logical_time_after) mismatches.push("logical_time_after");
      if (!sameJson(effect.trace_entry, bundle.trace_entry)) mismatches.push("trace_entry");
      if (!sameJson(effect.trace_window, bundle.trace_window)) mismatches.push("trace_window");
      if (!sameJson(effect.previous_trace_ref, bundle.mutation_history_link.previous_trace_ref)) {
        mismatches.push("mutation_history_link.previous_trace_ref");
      }
      if (mismatches.length > 0) {
        return invalid(
          "V2_PROPOSAL_EFFECT_MISMATCH",
          index,
          bundleRef,
          `persisted proposal effect diverges from the committed record: ${mismatches.join(", ")}`
        );
      }
      if (bundle.writer_authority === null) {
        writerAuthoritySummary.not_present += 1;
      } else {
        const status = await classifyWriterAuthorityStatusV0(bundle.writer_authority);
        writerAuthoritySummary[status.toLowerCase() as keyof typeof writerAuthoritySummary] += 1;
      }
      if (v2Count === 0) {
        firstV2BundleIndex = index;
        firstV2Revision = bundle.expected_revision;
      }
      v2Count += 1;
    } else {
      v1Count += 1;
    }

    seenRevisions.add(bundle.next_revision);
    seenTransitionIds.add(bundle.transition_id);
    seenCommitRefs.add(bundleRef);
    seenChecksums.add(bundle.record_checksum);
    // The ONLY chain-held successor is this validated bundle's next_snapshot.
    predecessor = bundle.next_snapshot;
    predecessorBundle = bundle;
  }

  // 7. Terminal trusted-head binding: exact six-field equality, no subset.
  const terminal = bundles[bundles.length - 1] as AtomicCommitBundleAnyVersion;
  if (terminal.next_revision !== head.revision) {
    return invalid(
      "TRUNCATED_HISTORY",
      bundles.length - 1,
      terminal.commit_ref,
      `chain terminates at revision ${terminal.next_revision} but the trusted head is ${head.revision}`
    );
  }
  if (
    head.subject_id !== terminal.subject_id ||
    head.commit_ref !== terminal.commit_ref ||
    head.record_checksum !== terminal.record_checksum ||
    head.state_hash !== terminal.state_hash_after ||
    head.snapshot_hash !== terminal.snapshot_hash_after
  ) {
    return invalid(
      "TRUSTED_HEAD_MISMATCH",
      bundles.length - 1,
      terminal.commit_ref,
      "terminal bundle does not bind the trusted head exactly"
    );
  }

  return {
    kind: "VALID",
    receipt: buildReceipt(
      boundary,
      policyFingerprint,
      bundles.length,
      v1Count,
      v2Count,
      firstV2BundleIndex,
      firstV2Revision,
      writerAuthoritySummary,
      terminal
    )
  };
}

// ---- internal helpers ---------------------------------------------------------------

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function findEarlierBundleIndex(
  bundles: readonly unknown[],
  currentIndex: number,
  commitRef: string
): number | null {
  for (let i = 0; i < currentIndex; i++) {
    const candidate = bundles[i];
    if (isRecord(candidate) && candidate["commit_ref"] === commitRef) {
      return i;
    }
  }
  return null;
}

function buildReceipt(
  boundary: TrustedCanonicalHistoryBoundaryReceiptV0,
  policyFingerprint: HashV1,
  bundleCount: number,
  v1Count: number,
  v2Count: number,
  firstV2BundleIndex: number | null,
  firstV2Revision: StateRevisionV0 | null,
  summary: {
    not_present: number;
    resolved_valid: number;
    unresolved: number;
    resolved_invalid: number;
  },
  terminal?: AtomicCommitBundleAnyVersion
): ChainValidationReceiptV0 {
  const genesis = boundary.genesis;
  const receipt: ChainValidationReceiptV0 = {
    schema_version: "atomic-commit-chain-validation-receipt-v0",
    policy_id: ATOMIC_COMMIT_CHAIN_VALIDATOR_POLICY_ID_V0,
    policy_fingerprint: policyFingerprint,
    subject_id: genesis.snapshot.identity.subject_id,
    genesis_revision: 0,
    genesis_full_snapshot_checksum: genesis.full_snapshot_checksum,
    genesis_state_hash: genesis.state_hash,
    genesis_snapshot_hash: genesis.snapshot_hash,
    terminal_revision: (terminal?.next_revision ?? 0) as StateRevisionV0,
    terminal_commit_ref: terminal?.commit_ref ?? null,
    terminal_record_checksum: terminal?.record_checksum ?? null,
    terminal_state_hash: terminal?.state_hash_after ?? genesis.state_hash,
    terminal_snapshot_hash: terminal?.snapshot_hash_after ?? genesis.snapshot_hash,
    bundle_count: bundleCount,
    v1_bundle_count: v1Count,
    v2_bundle_count: v2Count,
    first_v2_bundle_index: firstV2BundleIndex,
    first_v2_revision: firstV2Revision,
    v1_proof_level: V1_CHAIN_PROOF_LEVEL_V0,
    v2_proof_level: V2_CHAIN_PROOF_LEVEL_V0,
    writer_authority_summary: summary
  };
  Object.freeze(receipt);
  Object.freeze(receipt.writer_authority_summary);
  return receipt;
}
