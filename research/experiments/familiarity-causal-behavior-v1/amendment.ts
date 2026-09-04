/**
 * Execution Amendment V0 — strict, explicit, one-amendment-per-execution-identity
 * mechanism for authorized post-readiness harness repairs
 * (FAMILIARITY_CAUSAL_BEHAVIOR_EXPERIMENT_V1, PRECALL freeze-law conflict fix).
 *
 * PURPOSE: the readiness-v1 manifest froze the pre-repair harness source
 * fingerprint. The authorized ENOBUFS harness repair (commit 8d7a78a) changed
 * one fingerprint-covered file, so `verifyFrozen`'s hard equality can never
 * pass again. This module lets a formal run present ONE immutable amendment
 * that authorizes EXACTLY ONE post-readiness source fingerprint for EXACTLY
 * ONE execution identity, under EXACT hash binding.
 *
 * THIS IS NOT A LOOSENING. The amendment path enforces MORE explicit checks
 * than the historical path:
 *   - original readiness files still verify byte-for-byte
 *   - original manifest fingerprint recorded in the amendment matches the
 *     manifest exactly
 *   - current source fingerprint matches the amendment's ONE authorized value
 *     exactly (no arrays, no wildcards, no growing sets)
 *   - built fingerprint and protocol hash are UNCHANGED from readiness
 *   - readiness commit exactly matches the frozen readiness commit
 *   - production changes NOT authorized
 *   - scientific protocol changes NOT authorized
 *   - execution identity is instance-bound (r2 amendment cannot authorize r1/r3)
 *   - repair-scope path isolation verified
 *
 * Any future source change → sourceFingerprint changes → amendment no longer
 * matches → formal run blocked. No automatic amendment scanning.
 */

import { check } from "./fixtures.ts";

export const EXECUTION_AMENDMENT_SCHEMA_VERSION_V0 =
  "execution-amendment-v1" as const;

export const SCIENTIFIC_PROTOCOL_ID_V1 = "FAMILIARITY_CAUSAL_BEHAVIOR_EXPERIMENT_V1" as const;

export const READINESS_COMMIT_V1 = "52c693970b81c510bed47d65b38a41ee188ad184" as const;

/** Immutable amendment artifact (closed shape, no mutable result fields). */
export interface ExecutionAmendmentV0 {
  readonly schema_version: typeof EXECUTION_AMENDMENT_SCHEMA_VERSION_V0;
  readonly scientific_protocol_id: typeof SCIENTIFIC_PROTOCOL_ID_V1;
  readonly execution_identity: string;
  readonly readiness_commit: typeof READINESS_COMMIT_V1;
  readonly original_readiness_source_fingerprint: string;
  readonly authorized_execution_source_fingerprint: string;
  readonly original_protocol_hash: string;
  readonly current_protocol_hash: string;
  readonly original_built_fingerprint: string;
  readonly current_built_fingerprint: string;
  readonly authorized_harness_repair_commits: readonly string[];
  readonly prior_abort_records: readonly string[];
  readonly prior_real_model_calls: 0;
  readonly production_changes_authorized: false;
  readonly scientific_protocol_changes_authorized: false;
  readonly allowed_repair_scope: readonly string[];
  readonly created_from_clean_head: string;
}

/**
 * Strict amendment validation. Every check uses exact equality — no prefix
 * hashes, no fuzzy matching, no "same enough". Returns the validated amendment
 * (or throws with a precise reason).
 */
export function validateExecutionAmendmentV0(input: {
  readonly raw_amendment: unknown;
  readonly manifest_source_fingerprint: string;
  readonly manifest_built_fingerprint: string;
  readonly manifest_protocol_hash: string;
  readonly current_source_fingerprint: string;
  readonly current_built_fingerprint: string;
  readonly current_protocol_hash: string;
  readonly requested_execution_identity: string;
  readonly readiness_files_verify: () => void;
  readonly repair_scope_files_verify: () => void;
}): { readonly authorized_source_fingerprint: string } {
  const a = input.raw_amendment as Partial<ExecutionAmendmentV0> | null | undefined;
  check(a !== null && typeof a === "object", "amendment: expected object");
  const amendment = a as Partial<ExecutionAmendmentV0>;

  check(
    amendment.schema_version === EXECUTION_AMENDMENT_SCHEMA_VERSION_V0,
    `amendment.schema_version: expected ${EXECUTION_AMENDMENT_SCHEMA_VERSION_V0}`
  );
  check(
    amendment.scientific_protocol_id === SCIENTIFIC_PROTOCOL_ID_V1,
    `amendment.scientific_protocol_id: expected ${SCIENTIFIC_PROTOCOL_ID_V1}`
  );
  check(
    amendment.execution_identity === input.requested_execution_identity,
    `amendment.execution_identity must EXACTLY match the requested --execution-identity`
  );
  check(
    typeof input.requested_execution_identity === "string" && input.requested_execution_identity.length > 0,
    "requested execution identity must be a non-empty string"
  );
  check(
    amendment.readiness_commit === READINESS_COMMIT_V1,
    `amendment.readiness_commit: expected ${READINESS_COMMIT_V1}`
  );
  check(
    typeof amendment.original_readiness_source_fingerprint === "string" &&
      amendment.original_readiness_source_fingerprint.startsWith("sha256:"),
    "amendment.original_readiness_source_fingerprint: sha256 string required"
  );
  check(
    amendment.original_readiness_source_fingerprint === input.manifest_source_fingerprint,
    "amendment original_readiness_source_fingerprint must EXACTLY match manifest.freeze.source_fingerprint"
  );
  check(
    typeof amendment.authorized_execution_source_fingerprint === "string" &&
      amendment.authorized_execution_source_fingerprint.startsWith("sha256:"),
    "amendment.authorized_execution_source_fingerprint: sha256 string required"
  );
  check(
    amendment.authorized_execution_source_fingerprint !== amendment.original_readiness_source_fingerprint,
    "authorized fingerprint must differ from the original readiness fingerprint (that is the entire purpose)"
  );
  check(
    input.current_source_fingerprint === amendment.authorized_execution_source_fingerprint,
    `current sourceFingerprint() must EXACTLY equal the amendment's authorized_execution_source_fingerprint`
  );
  check(
    amendment.original_protocol_hash === input.manifest_protocol_hash,
    "amendment.original_protocol_hash must EXACTLY match manifest.freeze.protocol_hash"
  );
  check(
    amendment.current_protocol_hash === input.manifest_protocol_hash,
    "amendment.current_protocol_hash must EXACTLY match manifest.freeze.protocol_hash (protocol unchanged)"
  );
  check(
    input.current_protocol_hash === input.manifest_protocol_hash,
    "current protocol hash must EXACTLY match manifest.freeze.protocol_hash (protocol unchanged)"
  );
  check(
    amendment.original_built_fingerprint === input.manifest_built_fingerprint,
    "amendment.original_built_fingerprint must EXACTLY match manifest.freeze.built_fingerprint"
  );
  check(
    amendment.current_built_fingerprint === input.manifest_built_fingerprint,
    "amendment.current_built_fingerprint must EXACTLY match manifest.freeze.built_fingerprint (built unchanged)"
  );
  check(
    input.current_built_fingerprint === input.manifest_built_fingerprint,
    "current built fingerprint must EXACTLY match manifest.freeze.built_fingerprint (built unchanged)"
  );
  check(
    Array.isArray(amendment.authorized_harness_repair_commits) &&
      amendment.authorized_harness_repair_commits.length > 0 &&
      amendment.authorized_harness_repair_commits.every((c) => typeof c === "string" && /^[0-9a-f]{40}$/.test(c)),
    "amendment.authorized_harness_repair_commits: non-empty array of 40-hex commits required"
  );
  check(
    Array.isArray(amendment.prior_abort_records) && amendment.prior_abort_records.length > 0,
    "amendment.prior_abort_records: non-empty array required"
  );
  check(
    amendment.prior_real_model_calls === 0,
    "amendment.prior_real_model_calls must be exactly 0 (no model calls in aborted attempts)"
  );
  check(
    amendment.production_changes_authorized === false,
    "amendment.production_changes_authorized must be exactly false"
  );
  check(
    amendment.scientific_protocol_changes_authorized === false,
    "amendment.scientific_protocol_changes_authorized must be exactly false"
  );
  check(
    Array.isArray(amendment.allowed_repair_scope) && amendment.allowed_repair_scope.length > 0,
    "amendment.allowed_repair_scope: non-empty array required"
  );
  check(
    typeof amendment.created_from_clean_head === "string" && /^[0-9a-f]{40}$/.test(amendment.created_from_clean_head),
    "amendment.created_from_clean_head: 40-hex commit required"
  );

  // Verify original readiness files byte-for-byte.
  input.readiness_files_verify();

  // Verify repair-scope path isolation.
  input.repair_scope_files_verify();

  return { authorized_source_fingerprint: amendment.authorized_execution_source_fingerprint };
}

export interface ValidatedExecutionAmendment {
  readonly authorized_source_fingerprint: string;
}
