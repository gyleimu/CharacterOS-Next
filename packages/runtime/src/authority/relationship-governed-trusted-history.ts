/**
 * Relationship Governed Trusted History Capability V0
 * (RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0 §14/§15, LEVEL_2).
 *
 * RAW_HISTORY_ARRAY_IS_GOVERNED_AUTHORITY = NO: the raw committed-bundle
 * array (`getCommittedBundles()`) NEVER authorizes a governed UPDATE or
 * REINITIALIZE by itself. Authority over canonical history enters this
 * module ONLY through an OPAQUE capability minted after ALL of:
 *   1. trusted history boundary admission (module-private WeakSet receipt —
 *      the existing trusted-canonical-history-boundary issuer),
 *   2. `validateAtomicCommitChainV0` → VALID over the COMPLETE candidate
 *      history,
 *   3. the chain-validation terminal head EXACTLY equal to the current
 *      canonical state/head facts (subject, revision, commit_ref,
 *      record_checksum, state_hash, snapshot_hash).
 *
 * The capability is deep frozen and WeakSet-admitted; structural clones are
 * rejected; it is never serialized as authority; there is NO caller-supplied
 * chain-receipt shortcut. No code claims to prove OS/process quiescence —
 * Level-2 application composition authority only.
 *
 * History lookup (§15) scans the capability's bundles BACKWARD for the exact
 * subject/counterpart/dimension target, skips unrelated commits, resolves the
 * latest matching non-null Relationship governed authority, and classifies it
 * through the exact static historical authority resolver. UPDATE requires the
 * latest matching authority to be RESOLVED_VALID; broken/ambiguous history
 * fails closed.
 */

import type { AtomicCommitBundleAnyVersion } from "@characteros-next/subject-core";
import type { CanonicalRefV0, HashV1, IdentifierV0, StateRevisionV0 } from "@characteros-next/subject-core";

import { validateAtomicCommitChainV0 } from "./atomic-commit-chain-validator.js";
import {
  classifyHistoricalWriterAuthorityStatusV0,
  type HistoricalWriterAuthorityStatusV0
} from "./historical-writer-authority-registry.js";
import {
  isTrustedCanonicalHistoryBoundaryReceiptV0,
  type TrustedCanonicalHistoryBoundaryReceiptV0,
  type TrustedCanonicalHeadInputV0
} from "./trusted-canonical-history-boundary.js";
import {
  validateRelationshipGovernedFeatureWriterAuthorityPayloadV0,
  type RelationshipGovernedFeatureWriterAuthorityPayloadV0
} from "../transitions/relationship/relationship-governed-writer-authority.js";

export const RELATIONSHIP_GOVERNED_TRUSTED_HISTORY_CAPABILITY_SCHEMA_VERSION_V0 =
  "relationship-governed-trusted-history-capability-v0" as const;

/** Opaque, deep-frozen, WeakSet-admitted trusted-history capability. */
export interface RelationshipGovernedTrustedHistoryCapabilityV0 {
  readonly schema_version: typeof RELATIONSHIP_GOVERNED_TRUSTED_HISTORY_CAPABILITY_SCHEMA_VERSION_V0;
  readonly subject_id: IdentifierV0;
  /** Terminal head facts proven EQUAL to the current canonical head at mint time. */
  readonly terminal_revision: StateRevisionV0;
  readonly terminal_commit_ref: CanonicalRefV0;
  readonly terminal_record_checksum: HashV1;
  readonly terminal_state_hash: HashV1;
  readonly terminal_snapshot_hash: HashV1;
  readonly bundle_count: number;
}

const trustedHistoryCapabilities = new WeakSet<object>();

/** Exact current canonical head facts required at mint time. */
export interface CurrentCanonicalHeadFactsV0 {
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly commit_ref: CanonicalRefV0 | null;
  readonly record_checksum: HashV1 | null;
  readonly state_hash: HashV1;
  readonly snapshot_hash: HashV1;
}

export type MintRelationshipGovernedTrustedHistoryOutcomeV0 =
  | { readonly kind: "MINTED"; readonly capability: RelationshipGovernedTrustedHistoryCapabilityV0 }
  | {
      readonly kind: "REJECTED";
      readonly code:
        | "UNTRUSTED_BOUNDARY"
        | "CHAIN_INVALID"
        | "HEAD_MISMATCH"
        | "EMPTY_HISTORY_WITH_POSITIVE_HEAD";
      readonly detail: string;
    };

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/**
 * INTERNAL trusted-history capability issuer. Deliberately NOT root-exported.
 * Mints ONLY after boundary admission + full chain VALID + terminal-head
 * exact equality with the supplied current canonical head facts.
 */
export async function mintRelationshipGovernedTrustedHistoryCapabilityV0(input: {
  readonly trusted_boundary: TrustedCanonicalHistoryBoundaryReceiptV0;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
  readonly current_head: CurrentCanonicalHeadFactsV0;
}): Promise<MintRelationshipGovernedTrustedHistoryOutcomeV0> {
  if (!isTrustedCanonicalHistoryBoundaryReceiptV0(input.trusted_boundary)) {
    return {
      kind: "REJECTED",
      code: "UNTRUSTED_BOUNDARY",
      detail: "trusted history capability requires a WeakSet-admitted boundary receipt"
    };
  }
  const chain = await validateAtomicCommitChainV0({
    trusted_boundary: input.trusted_boundary,
    bundles: input.bundles
  });
  if (chain.kind === "INVALID") {
    return {
      kind: "REJECTED",
      code: "CHAIN_INVALID",
      detail: `chain validation failed: ${chain.failure.code} ${chain.failure.detail}`
    };
  }
  const receipt = chain.receipt;
  if (
    receipt.terminal_commit_ref === null ||
    receipt.terminal_record_checksum === null ||
    input.current_head.commit_ref === null ||
    input.current_head.record_checksum === null
  ) {
    return {
      kind: "REJECTED",
      code: "EMPTY_HISTORY_WITH_POSITIVE_HEAD",
      detail: "a governed trusted-history capability requires a positive terminal head on BOTH sides"
    };
  }
  const exactHead =
    receipt.subject_id === input.current_head.subject_id &&
    receipt.terminal_revision === input.current_head.state_revision &&
    receipt.terminal_commit_ref === input.current_head.commit_ref &&
    receipt.terminal_record_checksum === input.current_head.record_checksum &&
    receipt.terminal_state_hash === input.current_head.state_hash &&
    receipt.terminal_snapshot_hash === input.current_head.snapshot_hash;
  if (!exactHead) {
    return {
      kind: "REJECTED",
      code: "HEAD_MISMATCH",
      detail: "chain terminal head does not EXACTLY equal the current canonical state/head (stale or divergent history)"
    };
  }
  const capability: RelationshipGovernedTrustedHistoryCapabilityV0 = {
    schema_version: RELATIONSHIP_GOVERNED_TRUSTED_HISTORY_CAPABILITY_SCHEMA_VERSION_V0,
    subject_id: receipt.subject_id,
    terminal_revision: receipt.terminal_revision,
    terminal_commit_ref: receipt.terminal_commit_ref,
    terminal_record_checksum: receipt.terminal_record_checksum,
    terminal_state_hash: receipt.terminal_state_hash,
    terminal_snapshot_hash: receipt.terminal_snapshot_hash,
    bundle_count: receipt.bundle_count
  };
  deepFreeze(capability);
  trustedHistoryCapabilities.add(capability);
  return { kind: "MINTED", capability };
}

/** WeakSet admission: only issuer-minted capabilities are trusted. */
export function isRelationshipGovernedTrustedHistoryCapabilityV0(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    trustedHistoryCapabilities.has(value as object)
  );
}

// ---- §15 prior-authority lookup -------------------------------------------------------

export type LatestRelationshipGovernedAuthorityLookupV0 =
  | {
      readonly kind: "FOUND";
      readonly payload: RelationshipGovernedFeatureWriterAuthorityPayloadV0;
      readonly commit_ref: CanonicalRefV0;
      readonly authority_payload_hash: HashV1;
      readonly status: HistoricalWriterAuthorityStatusV0;
    }
  | { readonly kind: "NO_MATCHING_AUTHORITY" }
  | { readonly kind: "UNTRUSTED_CAPABILITY"; readonly detail: string };

function headFromCapability(
  capability: RelationshipGovernedTrustedHistoryCapabilityV0
): Pick<
  TrustedCanonicalHeadInputV0,
  "commit_ref" | "record_checksum" | "state_hash" | "snapshot_hash" | "subject_id" | "revision"
> {
  return {
    subject_id: capability.subject_id,
    revision: capability.terminal_revision,
    commit_ref: capability.terminal_commit_ref,
    record_checksum: capability.terminal_record_checksum,
    state_hash: capability.terminal_state_hash,
    snapshot_hash: capability.terminal_snapshot_hash
  };
}

/**
 * §15 backward lookup over the capability-bound COMPLETE canonical history.
 * Unrelated commits are skipped; the LATEST matching non-null
 * RELATIONSHIP_GOVERNED_FEATURE authority is resolved and classified through
 * the exact static historical authority resolver. The capability (not the raw
 * array) is the admission token — a structural clone is rejected.
 */
export async function lookupLatestRelationshipGovernedAuthorityV0(input: {
  readonly capability: RelationshipGovernedTrustedHistoryCapabilityV0;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
  readonly subject_id: IdentifierV0;
  readonly counterpart_ref: CanonicalRefV0;
  readonly dimension_id: IdentifierV0;
}): Promise<LatestRelationshipGovernedAuthorityLookupV0> {
  if (!isRelationshipGovernedTrustedHistoryCapabilityV0(input.capability)) {
    return {
      kind: "UNTRUSTED_CAPABILITY",
      detail: "trusted history capability was not minted by the internal issuer"
    };
  }
  const head = headFromCapability(input.capability);
  for (let i = input.bundles.length - 1; i >= 0; i--) {
    const bundle = input.bundles[i];
    if (bundle === undefined) continue;
    if (bundle.commit_version !== "atomic-commit-v2") continue;
    if (bundle.subject_id !== input.subject_id) continue;
    const authority = bundle.writer_authority;
    if (authority === null) continue;
    if (authority.writer_family !== "RELATIONSHIP_GOVERNED_FEATURE") continue;
    const payload = validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(
      authority.authority_payload
    );
    if (!payload.ok) continue;
    if (payload.value.subject_id !== input.subject_id) continue;
    if (payload.value.counterpart_ref !== input.counterpart_ref) continue;
    if (payload.value.dimension_id !== input.dimension_id) continue;
    // Terminal-integrity re-bind: the scan must still terminate at the exact
    // frozen head recorded inside the capability (tampered array → broken
    // lineage → the caller fails closed).
    const terminal = input.bundles[input.bundles.length - 1];
    const terminalMatches =
      terminal !== undefined &&
      terminal.commit_ref === head.commit_ref &&
      terminal.record_checksum === head.record_checksum &&
      terminal.state_hash_after === head.state_hash &&
      terminal.snapshot_hash_after === head.snapshot_hash &&
      terminal.next_revision === head.revision;
    if (!terminalMatches) {
      return {
        kind: "UNTRUSTED_CAPABILITY",
        detail: "bundle array no longer terminates at the capability's frozen head"
      };
    }
    const resolution = await classifyHistoricalWriterAuthorityStatusV0(authority);
    return {
      kind: "FOUND",
      payload: payload.value,
      commit_ref: bundle.commit_ref,
      authority_payload_hash: authority.authority_payload_hash,
      status: resolution.status
    };
  }
  return { kind: "NO_MATCHING_AUTHORITY" };
}
