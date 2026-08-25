/**
 * P2.1.3 — SHA-256 hash helpers over canonical-json-v1 envelopes.
 * Source: docs/implementation/p2-1-contract-freeze.md §8.1, §14.4.
 *
 * Wire form is lowercase `sha256:` + 64 hexadecimal characters. Domain separation is
 * provided by the required `projection` member inside every hashed JCS envelope — raw
 * JSON of state is never a hash input. Computation uses the platform WebCrypto
 * `globalThis.crypto.subtle` (pure computation; no I/O, no side effects) and is
 * therefore asynchronous.
 */

import type { HashV1 } from "../types/scalars.js";
import { canonicalJsonString } from "./json.js";

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] as number).toString(16).padStart(2, "0");
  }
  return hex;
}

/** SHA-256 over a UTF-8 string; lowercase hex digest. */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

/** `sha256:<hex>` wire form over raw text. */
export async function sha256HashV1(text: string): Promise<HashV1> {
  return `sha256:${await sha256Hex(text)}` as HashV1;
}

/**
 * Hashes one domain-separated envelope `{projection, value}` in JCS form and returns
 * the `sha256:<hex>` wire value.
 */
export async function hashEnvelope(projection: string, value: unknown): Promise<HashV1> {
  const text = canonicalJsonString({ projection, value });
  return sha256HashV1(text);
}

/** Deterministic content-addressed ref: `<kind>:<hex>` where hex = SHA-256 of the JCS envelope. */
export async function deriveRef(kind: string, projection: string, value: unknown): Promise<string> {
  return `${kind}:${await sha256Hex(canonicalJsonString({ projection, value }))}`;
}
