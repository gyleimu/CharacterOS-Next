/**
 * P2.2.1 — RepositoryRevision contract types, manifest validation and the frozen
 * revision-hash computation (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §8.5 (manifest + projection),
 * §9.3 (R0 golden vector), §11 (binding rules), §16 (repository = infrastructure).
 *
 * A repository revision is an immutable content-addressed set of memory-bound records.
 * This module defines its closed manifest schema, validates conformance, and computes
 * `RepositoryRevisionHash` exactly as frozen — it performs NO storage, NO retrieval and
 * NO embedding work. Revision identity/hashing is owned by the memory package;
 * SubjectState ownership stays with subject-core (§6.1).
 */

import type {
  HashV1,
  RepositoryRevisionIdV0,
  RepositoryRecordHashV1
} from "@characteros-next/subject-core";
import type { RepositoryRevisionManifestV1 } from "@characteros-next/subject-core";
import {
  hashEnvelope,
  isRecord,
  isString,
  validateHash,
  validateRepositoryRevision
} from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";
import { parseMemoryBoundRef } from "./refs.js";

/** Frozen §8.5 domain-separated projection for revision hashes. */
export const REPOSITORY_REVISION_HASH_PROJECTION =
  "characteros-next/memory/repository-revision-hash/v1";

export const REPOSITORY_MANIFEST_SCHEMA_VERSION = "repository-revision-manifest-v1" as const;

const MANIFEST_KEYS: readonly string[] = [
  "schema_version",
  "repository_revision",
  "parent_revision",
  "record_hashes",
  "index_manifest_hash"
];

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/**
 * Validates one closed RepositoryRevisionManifestV1 (§8.5): exact keys, identifier
 * formats, memory-bound record refs with well-formed payload hashes, unique and
 * sorted by ref, optional index manifest hash.
 */
export function validateRepositoryManifest(v: unknown): ValidationResult<RepositoryRevisionManifestV1> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "manifest: expected object");
  for (const key of Object.keys(v)) {
    if (!MANIFEST_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `manifest.${key}: unknown key`);
    }
  }
  if (v["schema_version"] !== REPOSITORY_MANIFEST_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "manifest.schema_version");
  }
  if (!isString(v["repository_revision"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "manifest.repository_revision: expected identifier");
  }
  const revisionId = validateRepositoryRevision(v["repository_revision"], "manifest.repository_revision");
  if (!revisionId.ok) return revisionId;
  if (v["parent_revision"] !== null) {
    if (!isString(v["parent_revision"])) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "manifest.parent_revision: expected identifier or null");
    }
    const parent = validateRepositoryRevision(v["parent_revision"], "manifest.parent_revision");
    if (!parent.ok) return parent;
  }
  const records = v["record_hashes"];
  if (!Array.isArray(records)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "manifest.record_hashes: expected array");
  }
  let previousRef: string | undefined;
  for (let i = 0; i < records.length; i++) {
    const label = `manifest.record_hashes[${i}]`;
    if (!isRecord(records[i])) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: expected object`);
    }
    const entry = records[i] as Record<string, unknown>;
    for (const key of Object.keys(entry)) {
      if (key !== "ref" && key !== "payload_hash") {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.${key}: unknown key`);
      }
    }
    const refCheck = parseMemoryBoundRef(entry["ref"], `${label}.ref`);
    if (!refCheck.ok) return refCheck;
    if (!isString(entry["payload_hash"])) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.payload_hash: expected hash string`);
    }
    const hashCheck = validateHash(entry["payload_hash"], `${label}.payload_hash`);
    if (!hashCheck.ok) return hashCheck;
    if (previousRef !== undefined) {
      if ((entry["ref"] as string) === previousRef) {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.ref: duplicate record ref`);
      }
      if ((entry["ref"] as string) < previousRef) {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.ref: records not sorted by ref`);
      }
    }
    previousRef = entry["ref"] as string;
  }
  const indexHash = v["index_manifest_hash"];
  if (indexHash !== null) {
    if (!isString(indexHash)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "manifest.index_manifest_hash: expected hash or null");
    }
    const indexCheck = validateHash(indexHash, "manifest.index_manifest_hash");
    if (!indexCheck.ok) return indexCheck;
  }
  return ok(v as unknown as RepositoryRevisionManifestV1);
}

export interface RevisionPrepareRequestV0 {
  /** Genesis revisions have no parent; every derived revision must name its parent. */
  readonly parent_revision: RepositoryRevisionIdV0 | null;
  /** Content-addressed records to bind, unique and sorted by ref. */
  readonly records: readonly RepositoryRecordHashV1[];
}

export interface PreparedRevisionV0 {
  readonly repository_revision: RepositoryRevisionIdV0;
  readonly manifest: RepositoryRevisionManifestV1;
}

/**
 * Builds a manifest for a prepare request (pure factory used by infrastructure
 * adapters). The returned manifest is deeply frozen; adoption into SubjectState
 * happens exclusively through a subject-core canonical commit.
 */
export function prepareRevisionManifest(
  repository_revision: RepositoryRevisionIdV0,
  request: RevisionPrepareRequestV0
): ValidationResult<PreparedRevisionV0> {
  const manifest = {
    schema_version: REPOSITORY_MANIFEST_SCHEMA_VERSION,
    repository_revision,
    parent_revision: request.parent_revision,
    record_hashes: [...request.records],
    index_manifest_hash: null
  };
  const checked = validateRepositoryManifest(manifest);
  if (!checked.ok) return checked;
  deepFreeze(checked.value);
  return ok({ repository_revision, manifest: checked.value });
}

/**
 * §8.5/§9.3 — computes the frozen RepositoryRevisionHash over the JCS envelope.
 * Pure deterministic computation over the manifest; no I/O.
 */
export function computeRepositoryRevisionHash(manifest: RepositoryRevisionManifestV1): Promise<HashV1> {
  return hashEnvelope(REPOSITORY_REVISION_HASH_PROJECTION, {
    schema_version: manifest.schema_version,
    repository_revision: manifest.repository_revision,
    parent_revision: manifest.parent_revision,
    record_hashes: manifest.record_hashes,
    index_manifest_hash: manifest.index_manifest_hash
  });
}
