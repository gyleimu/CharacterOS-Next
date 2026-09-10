/**
 * PERSISTENT_SUBJECT_CONFIGURATION_V0 — product subject configuration.
 *
 * Product-layer configuration identifies WHICH persistent subject a data root
 * belongs to and carries the human-visible identity metadata. It is NOT
 * canonical SubjectState authority: genesis and authoritative restore remain the
 * only sources of subject reality. On restore, configuration selects the target;
 * the durable canonical store proves it.
 *
 * Scope: exactly ONE configured subject per data root. Identity metadata only —
 * no psychology, no provider/model settings, no Memory, no secrets.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { writeJsonAtomicV0, readJsonFileV0 } from "./atomic-json-file.js";
import { FileInteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";

export const SUBJECT_CONFIG_SCHEMA_VERSION = "subject-config-v0" as const;
export const SUBJECT_CONFIG_FILE_NAME = "subject-config.json" as const;

/** Durable state marker: distinguishes "created, no lived history yet" from "durable store deleted". */
export type SubjectDurableStateV0 = "NONE" | "PRESENT";

export interface ProductSubjectConfigV0 {
  readonly schema_version: typeof SUBJECT_CONFIG_SCHEMA_VERSION;
  /** Durable machine identity; also the canonical SubjectState identity. */
  readonly subject_id: string;
  /** Human-visible canonical identity field. Never used for filesystem paths. */
  readonly display_name: string;
  /** Canonical identity anchors (V0: always empty — no fabricated persona). */
  readonly identity_anchors: readonly string[];
  readonly durable_state: SubjectDurableStateV0;
}

export class SubjectConfigurationErrorV0 extends Error {
  constructor(detail: string) {
    super(`Subject configuration error: ${detail}`);
    this.name = "SubjectConfigurationErrorV0";
  }
}

const SUBJECT_CONFIG_KEYS: readonly string[] = [
  "schema_version",
  "subject_id",
  "display_name",
  "identity_anchors",
  "durable_state"
];

const SUBJECT_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_DISPLAY_NAME_LENGTH = 64;

/** C0 controls + DEL are never allowed in configuration text. */
function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validated, filesystem-safe canonical subject id. */
export function validateSubjectIdV0(raw: unknown, detail: string): string {
  if (typeof raw !== "string") throw new SubjectConfigurationErrorV0(`${detail}: expected a string`);
  if (!SUBJECT_ID_RE.test(raw)) {
    throw new SubjectConfigurationErrorV0(
      `${detail}: must match ^[a-z0-9][a-z0-9-]{0,63}$ (lowercase letters, digits, hyphen; no path separators)`
    );
  }
  return raw;
}

/** Validated, control-character-free display name (may be empty for legacy recovery). */
export function validateDisplayNameV0(raw: unknown, detail: string): string {
  if (typeof raw !== "string") throw new SubjectConfigurationErrorV0(`${detail}: expected a string`);
  const normalized = raw.normalize("NFC").trim();
  if (hasControlCharacters(normalized)) {
    throw new SubjectConfigurationErrorV0(`${detail}: control characters are not allowed`);
  }
  if (normalized.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new SubjectConfigurationErrorV0(`${detail}: must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`);
  }
  return normalized;
}

/**
 * Deterministic, filesystem-safe subject id derived ONLY from the display name.
 * Stable across retries (no randomness), so a crash before the config commit
 * re-creates the SAME identity rather than a second unrelated subject.
 */
export function deriveSubjectIdV0(displayName: string): string {
  const normalized = displayName.normalize("NFC").trim();
  const slug = normalized
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const digest = createHash("sha256")
    .update(`characteros-next/product/subject-id/v0\0${normalized}`, "utf8")
    .digest("hex")
    .slice(0, 8);
  return `${slug.length > 0 ? slug : "subject"}-${digest}`;
}

/** Builds a validated creation config for a display name. */
export function buildSubjectConfigForCreationV0(displayName: string): ProductSubjectConfigV0 {
  const name = validateDisplayNameV0(displayName, "display_name");
  if (name.length === 0) throw new SubjectConfigurationErrorV0("display_name: a non-empty name is required to create a subject");
  const subjectId = validateSubjectIdV0(deriveSubjectIdV0(name), "derived subject_id");
  return {
    schema_version: SUBJECT_CONFIG_SCHEMA_VERSION,
    subject_id: subjectId,
    display_name: name,
    identity_anchors: [],
    durable_state: "NONE"
  };
}

export function subjectConfigPathV0(dataRoot: string): string {
  return join(dataRoot, SUBJECT_CONFIG_FILE_NAME);
}

function parseSubjectConfigV0(raw: unknown, path: string): ProductSubjectConfigV0 {
  if (!isRecord(raw)) throw new SubjectConfigurationErrorV0(`Subject configuration is invalid at ${path}: expected a JSON object`);
  for (const key of Object.keys(raw)) {
    if (!SUBJECT_CONFIG_KEYS.includes(key)) {
      throw new SubjectConfigurationErrorV0(`Subject configuration is invalid at ${path}: unknown key "${key}"`);
    }
  }
  if (raw["schema_version"] !== SUBJECT_CONFIG_SCHEMA_VERSION) {
    throw new SubjectConfigurationErrorV0(
      `Subject configuration is invalid at ${path}: unsupported schema_version ${String(raw["schema_version"])}`
    );
  }
  const subjectId = validateSubjectIdV0(raw["subject_id"], "subject_id");
  const displayName = validateDisplayNameV0(raw["display_name"], "display_name");
  const anchorsRaw = raw["identity_anchors"];
  if (!Array.isArray(anchorsRaw) || anchorsRaw.some((entry) => typeof entry !== "string")) {
    throw new SubjectConfigurationErrorV0(`Subject configuration is invalid at ${path}: identity_anchors must be a string array`);
  }
  const durableState = raw["durable_state"];
  if (durableState !== "NONE" && durableState !== "PRESENT") {
    throw new SubjectConfigurationErrorV0(`Subject configuration is invalid at ${path}: durable_state must be NONE or PRESENT`);
  }
  return {
    schema_version: SUBJECT_CONFIG_SCHEMA_VERSION,
    subject_id: subjectId,
    display_name: displayName,
    identity_anchors: anchorsRaw as readonly string[],
    durable_state: durableState
  };
}

export type SubjectConfigReadResultV0 =
  | { readonly kind: "NONE" }
  | { readonly kind: "CONFIG"; readonly config: ProductSubjectConfigV0 };

/** Reads the product subject config; FAILS CLOSED on malformed/unsupported content. */
export function readProductSubjectConfigV0(dataRoot: string): SubjectConfigReadResultV0 {
  const path = subjectConfigPathV0(dataRoot);
  let raw: unknown;
  try {
    raw = readJsonFileV0(path);
  } catch (error) {
    throw new SubjectConfigurationErrorV0(
      `Subject configuration is invalid at ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (raw === null) return { kind: "NONE" };
  return { kind: "CONFIG", config: parseSubjectConfigV0(raw, path) };
}

/** Atomically persists the product subject config (validated on the way in). */
export function writeProductSubjectConfigV0(dataRoot: string, config: ProductSubjectConfigV0): void {
  const validated = parseSubjectConfigV0(config, subjectConfigPathV0(dataRoot));
  writeJsonAtomicV0(subjectConfigPathV0(dataRoot), validated);
}

/** Marks durable state PRESENT once a canonical snapshot exists (idempotent). */
export function markSubjectDurableStatePresentV0(dataRoot: string, config: ProductSubjectConfigV0): ProductSubjectConfigV0 {
  if (config.durable_state === "PRESENT") return config;
  const updated: ProductSubjectConfigV0 = { ...config, durable_state: "PRESENT" };
  writeProductSubjectConfigV0(dataRoot, updated);
  return updated;
}

/** Subject ids that have a durable snapshot in this data root (sorted). */
export function listSnapshotSubjectIdsV0(dataRoot: string): readonly string[] {
  if (!existsSync(dataRoot)) return [];
  const suffix = ".snapshot.json";
  return readdirSync(dataRoot)
    .filter((name) => name.startsWith("subject-") && name.endsWith(suffix))
    .map((name) => name.slice("subject-".length, name.length - suffix.length))
    .filter((id) => id.length > 0)
    .sort();
}

/** Deterministic config recovery from a durable snapshot's canonical identity. */
export async function recoverConfigFromSnapshotV0(
  dataRoot: string,
  subjectId: string
): Promise<ProductSubjectConfigV0> {
  const store = new FileInteractiveSnapshotStoreV0(dataRoot, subjectId);
  const loaded = await store.load();
  if (loaded.kind !== "SNAPSHOT") {
    throw new SubjectConfigurationErrorV0(`cannot recover configuration: no readable snapshot for ${subjectId}`);
  }
  const snapshot = loaded.snapshot;
  const subject = snapshot.subject;
  if (snapshot.subject_id !== subjectId) {
    throw new SubjectConfigurationErrorV0(
      `snapshot ${snapshot.subject_id} does not match file identity ${subjectId}`
    );
  }
  if (subject.subject_id !== subjectId || snapshot.durable.identity.subject_state_hash.length === 0) {
    throw new SubjectConfigurationErrorV0(
      `cannot recover configuration for ${subjectId}: snapshot carries no consistent canonical identity`
    );
  }
  return {
    schema_version: SUBJECT_CONFIG_SCHEMA_VERSION,
    subject_id: validateSubjectIdV0(subject.subject_id, "recovered subject_id"),
    display_name: validateDisplayNameV0(subject.display_name, "recovered display_name"),
    identity_anchors: [...subject.identity_anchors],
    durable_state: "PRESENT"
  };
}

export type PersistentSubjectDecisionV0 =
  | { readonly kind: "CREATE_REQUIRED"; readonly preset: { readonly subject_id: string; readonly display_name: string } | null }
  | { readonly kind: "REINITIALIZE"; readonly config: ProductSubjectConfigV0 }
  | { readonly kind: "RESTORE"; readonly config: ProductSubjectConfigV0 }
  | { readonly kind: "RECOVER_AND_RESTORE"; readonly config: ProductSubjectConfigV0 };

export interface ResolvePersistentSubjectInputV0 {
  readonly dataRoot: string;
  /** Explicit environment override (development/automation). */
  readonly overrideSubjectId?: string;
  readonly overrideDisplayName?: string;
}

/**
 * Resolves the single persistent subject for a data root. FAILS CLOSED on
 * config/snapshot identity conflicts, ambiguous snapshot sets, or a config that
 * has lost its durable store. Never silently creates or rebinds a subject.
 */
export async function resolvePersistentSubjectV0(
  input: ResolvePersistentSubjectInputV0
): Promise<PersistentSubjectDecisionV0> {
  const overrideId =
    input.overrideSubjectId === undefined
      ? undefined
      : validateSubjectIdV0(input.overrideSubjectId, "CHARACTEROS_SUBJECT_ID");
  const config = readProductSubjectConfigV0(input.dataRoot);
  const snapshotIds = listSnapshotSubjectIdsV0(input.dataRoot);

  if (config.kind === "CONFIG") {
    if (overrideId !== undefined && overrideId !== config.config.subject_id) {
      throw new SubjectConfigurationErrorV0(
        `CHARACTEROS_SUBJECT_ID=${overrideId} differs from the configured subject ${config.config.subject_id} in this data root; use a separate CHARACTEROS_DATA_DIR to run a different subject`
      );
    }
    if (snapshotIds.length > 1) {
      throw new SubjectConfigurationErrorV0(
        `multiple subject snapshots found (${snapshotIds.join(", ")}); exactly one persistent subject is supported`
      );
    }
    const snapshotId = snapshotIds[0];
    if (snapshotId !== undefined && snapshotId !== config.config.subject_id) {
      throw new SubjectConfigurationErrorV0(
        `snapshot subject ${snapshotId} does not match configured subject ${config.config.subject_id}`
      );
    }
    if (snapshotId === undefined) {
      if (config.config.durable_state === "PRESENT") {
        throw new SubjectConfigurationErrorV0(
          `configured subject ${config.config.subject_id} has durable_state PRESENT but its snapshot is missing; refusing to recreate it`
        );
      }
      return { kind: "REINITIALIZE", config: config.config };
    }
    return { kind: "RESTORE", config: config.config };
  }

  // No configuration.
  if (snapshotIds.length > 1) {
    throw new SubjectConfigurationErrorV0(
      `multiple subject snapshots found (${snapshotIds.join(", ")}) but no configuration; cannot select one`
    );
  }
  const snapshotId = snapshotIds[0];
  if (snapshotId !== undefined) {
    if (overrideId !== undefined && overrideId !== snapshotId) {
      throw new SubjectConfigurationErrorV0(
        `CHARACTEROS_SUBJECT_ID=${overrideId} differs from the durable snapshot subject ${snapshotId}`
      );
    }
    const recovered = await recoverConfigFromSnapshotV0(input.dataRoot, snapshotId);
    return { kind: "RECOVER_AND_RESTORE", config: recovered };
  }

  const preset =
    overrideId === undefined
      ? null
      : {
          subject_id: overrideId,
          display_name: validateDisplayNameV0(input.overrideDisplayName ?? overrideId, "CHARACTEROS_DISPLAY_NAME")
        };
  return { kind: "CREATE_REQUIRED", preset };
}
