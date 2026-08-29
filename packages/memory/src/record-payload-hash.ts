/**
 * Public, pure record-payload hashing contract shared by repository-owned
 * storage and read-only authority verifiers. This exposes no payload read or
 * mutation capability; it only guarantees that every verifier uses the exact
 * repository domain separator and canonical encoder.
 */

import { hashEnvelope, type HashV1 } from "@characteros-next/subject-core";

export const MEMORY_RECORD_PAYLOAD_HASH_PROJECTION =
  "characteros-next/memory/record-payload/v1" as const;

export async function computeMemoryRecordPayloadHash(
  payload: unknown
): Promise<HashV1> {
  return hashEnvelope(MEMORY_RECORD_PAYLOAD_HASH_PROJECTION, payload);
}
