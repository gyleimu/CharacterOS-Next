/* eslint-disable no-restricted-imports -- Research harness: computes the live contract hashes from FROZEN PRODUCTION artefacts. */
/**
 * MODEL-VISIBLE CONTRACT PARITY — the NEW contract authority.
 *
 * The remediation changed the model-facing contract (schema + system prompt), so
 * the authoritative request hash moved: `db8d8993…` belongs to the CONSUMED
 * calibration and nothing may claim it as the authority for a future run.
 *
 * This module computes the live hashes from the real artefacts and records the
 * consumed values alongside them, so the historical record and the future
 * authority are never conflated. `parity.test.ts` asserts every constant here
 * against a live computation.
 */
import { createHash } from "node:crypto";

import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA
} from "../../../packages/runtime/dist/index.js";
import { CONVERSATION_COGNITION_SYSTEM_PROMPT_V8 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function hashText(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

/** The consumed calibration's authority — historical, never re-issued. */
export const CONSUMED_CONTRACT = Object.freeze({
  request_hash: "sha256:db8d8993c63e6de476c4ddb28dff5c55d5716f8f1fb3cc23ccfcd841bc31f509",
  system_hash: "sha256:9241794b19b06b7a85a020c0c2a3522fd14504c80689ef8a3180afed8e25dc2c",
  schema_hash: "sha256:e9da721b67903c40e40f32dc1989456924923167e921e47cdd2231a78ee771b9",
  body_bytes: 16085,
  status: "CONSUMED_BY_EXECUTOR_CALIBRATION_STOP_EARLY"
});

/** The live model-facing schema hash (after the parity remediation). */
export function liveSchemaHash(): string {
  return hashText(canonicalJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA));
}

/** The live model-facing system-prompt hash (after the parity remediation). */
export function liveSystemHash(): string {
  return hashText(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8);
}

/**
 * The remediation's hashes as DATA, pinned by parity.test.ts against the live
 * computation, so a later contract edit cannot silently keep a stale value here.
 */
export const REMEDIATED_CONTRACT = Object.freeze({
  schema_hash: "sha256:54ac7977f3b9e7f2e422fd6dc5f218fe34e82ffc368ebec68a58b4e634feec35",
  system_hash: "sha256:044bfe7b7641cb9cadcf9f02005560fd6b9332576bcfb3c8a0cd40ae4a91f121",
  request_hash: "sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35",
  body_bytes: 17381,
  status: "AWAITING_NEW_CALIBRATION_PREREGISTRATION_AUTHORITY"
});

/** The remediation's authoritative model-facing request (live, 100x-deterministic). */
export const REMEDIATED_REQUEST = Object.freeze({
  request_hash: "sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35",
  body_bytes: 17381
});
