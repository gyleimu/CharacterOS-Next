/**
 * Episode Content Reader V0 — the ONE narrow read-only Memory capability for
 * production language context (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0).
 *
 * Given already-lawful episode refs under an authoritative repository revision
 * binding, returns the corresponding immutable EpisodicMemoryRecordV0 content
 * required for language context construction: episode ref, stored payload hash
 * and the validated `context.scene`.
 *
 * REQUIRED CHECKS per ref (fail closed, no silent omission):
 *   - non-episode / receipt / authority refs: REJECTED (kind grammar)
 *   - repository revision binding: the revision manifest must exist
 *   - exact canonical ref membership: manifest record_hashes AND
 *     validateRefsBelong against the subject's bound revision — subject
 *     membership is enforced by binding the revision to the requesting
 *     subject's canonical memory_state
 *   - stored payload hash: recomputed stored hash must equal the manifest's
 *     declared record payload_hash
 *   - EpisodicMemoryRecordV0 schema validation of the stored payload
 *
 * Deliberately NOT exposed: revision minting, MemoryPreparationAuthority,
 * raw internal maps, mutation methods, arbitrary repository traversal, or any
 * capability handed to an LLM. The reader is injected only into trusted
 * runtime composition and never grants caller-created refs authority.
 * No recursive expansion of embedded refs.
 */

import type { CanonicalRefV0, RepositoryRevisionIdV0 } from "@characteros-next/subject-core";
import { validateRefElement } from "@characteros-next/subject-core";
import { validateEpisodicMemoryRecord } from "./episodic-record.js";
import type { InMemoryMemoryRepository } from "../repository/in-memory-memory-repository.js";

export const EPISODE_CONTENT_READER_SCHEMA_VERSION_V0 = "episode-content-reader-v0" as const;

/** Minimum useful V0 content for one validated episode. */
export interface EpisodeContentV0 {
  readonly ref: CanonicalRefV0;
  readonly payload_hash: string;
  readonly scene: string;
}

export type EpisodeContentReadResultV0 =
  | { readonly ok: true; readonly contents: readonly EpisodeContentV0[] }
  | { readonly ok: false; readonly code: EpisodeContentReadFailureCodeV0; readonly detail: string };

export type EpisodeContentReadFailureCodeV0 =
  | "READER_MISCONFIGURED"
  | "REF_INVALID"
  | "REVISION_UNBOUND"
  | "REF_NOT_IN_REVISION"
  | "PAYLOAD_MISSING"
  | "PAYLOAD_HASH_MISMATCH"
  | "PAYLOAD_SCHEMA_INVALID";

/**
 * Narrow read-only capability. Constructed ONLY by trusted composition over the
 * concrete memory repository; the raw payload surface stays inside the memory
 * package.
 */
export interface EpisodeContentReaderV0 {
  read(input: {
    readonly repository_revision: RepositoryRevisionIdV0;
    readonly refs: readonly CanonicalRefV0[];
  }): Promise<EpisodeContentReadResultV0>;
}

export function createEpisodeContentReaderV0(repo: InMemoryMemoryRepository): EpisodeContentReaderV0 {
  if (typeof repo.readStoredPayload !== "function") {
    throw new Error("episode content reader requires the concrete memory repository");
  }
  return {
    async read(input) {
      const manifest = await repo.readManifest(input.repository_revision);
      if (manifest === null) {
        return {
          ok: false,
          code: "REVISION_UNBOUND",
          detail: `repository revision ${input.repository_revision} has no bound manifest`
        };
      }
      const contents: EpisodeContentV0[] = [];
      for (const ref of input.refs) {
        const refCheck = validateRefElement(ref, "episode ref", ["episode"]);
        if (!refCheck.ok) {
          return {
            ok: false,
            code: "REF_INVALID",
            detail: `${refCheck.error.detail} (receipt/authority/non-episode refs are never episode content)`
          };
        }
        const episodeRef = refCheck.value;
        const declared = (manifest.record_hashes as readonly { ref: string; payload_hash: string }[]).find(
          (record) => record.ref === episodeRef
        );
        if (declared === undefined) {
          return {
            ok: false,
            code: "REF_NOT_IN_REVISION",
            detail: `episode ref ${episodeRef} is not a member of revision ${input.repository_revision}`
          };
        }
        const belongs = await repo.validateRefsBelong(input.repository_revision, [episodeRef]);
        if (!belongs) {
          return {
            ok: false,
            code: "REF_NOT_IN_REVISION",
            detail: `episode ref ${episodeRef} does not belong to revision ${input.repository_revision}`
          };
        }
        const payload = repo.readStoredPayload(episodeRef);
        if (payload === null) {
          return {
            ok: false,
            code: "PAYLOAD_MISSING",
            detail: `episode ref ${episodeRef} has no repository-owned payload`
          };
        }
        const storedHash = await repo.payloadHashOf(episodeRef);
        if (storedHash === null || storedHash !== declared.payload_hash) {
          return {
            ok: false,
            code: "PAYLOAD_HASH_MISMATCH",
            detail: `episode ref ${episodeRef} stored payload hash does not match the manifest record hash`
          };
        }
        const validated = validateEpisodicMemoryRecord(payload);
        if (!validated.ok) {
          return {
            ok: false,
            code: "PAYLOAD_SCHEMA_INVALID",
            detail: `episode ref ${episodeRef} payload is not a closed EpisodicMemoryRecordV0: ${validated.error.detail}`
          };
        }
        contents.push({
          ref: episodeRef,
          payload_hash: declared.payload_hash,
          scene: validated.value.context.scene
        });
      }
      return { ok: true, contents };
    }
  };
}
