/**
 * P2.2.1 — MemoryReference types and kind-scoped guards (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §5.3 (ref grammar + kind
 * allowlists), §8.5 (manifest-bound kinds).
 *
 * Memory references ARE subject-core CanonicalRefV0 values, narrowed by brand tags to
 * the memory-bound kinds. Nothing here owns or interprets payload content: refs are
 * opaque content addresses validated for grammar/kind only. Semantic existence belongs
 * to the repository capability (verdict-only), never to these guards.
 */

import type { Brand, CanonicalRefV0, RefKind } from "@characteros-next/subject-core";
import { refKind, validateRefElement } from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";

/** §8.5: the four ref kinds a repository revision manifest may bind. */
export const MEMORY_BOUND_REF_KINDS = ["memory", "episode", "event", "experience"] as const;

export type MemoryBoundRefKind = (typeof MEMORY_BOUND_REF_KINDS)[number];

/** Kind-branded views over CanonicalRefV0 (nominal via Brand tags). */
export type MemoryContentRef = Brand<CanonicalRefV0, "MemoryContentRef">;
export type EpisodeRef = Brand<CanonicalRefV0, "EpisodeRef">;
export type EventRef = Brand<CanonicalRefV0, "EventRef">;
export type ExperienceRef = Brand<CanonicalRefV0, "ExperienceRef">;
/** Appraisal evidence reference (grammar/kind only — never appraisal semantics). */
export type AppraisalRef = Brand<CanonicalRefV0, "AppraisalRef">;
/** Affect snapshot reference (grammar/kind only — never affect computation). */
export type AffectSnapshotRef = Brand<CanonicalRefV0, "AffectSnapshotRef">;

/** Any ref whose kind a repository revision may bind. */
export type MemoryBoundRef = MemoryContentRef | EpisodeRef | EventRef | ExperienceRef;

export function isMemoryBoundRefKind(kind: RefKind): boolean {
  return (MEMORY_BOUND_REF_KINDS as readonly string[]).includes(kind);
}

function parseKinded(
  v: unknown,
  detail: string,
  kind: RefKind
): ValidationResult<CanonicalRefV0> {
  const parsed = validateRefElement(v, detail, [kind]);
  if (!parsed.ok) return parsed;
  if (refKind(parsed.value) !== kind) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${detail}: expected ${kind} ref`);
  }
  return ok(parsed.value);
}

/** Narrows an unknown value to a memory-kind (`memory`) content ref. */
export function parseMemoryContentRef(v: unknown, detail: string): ValidationResult<MemoryContentRef> {
  const r = parseKinded(v, detail, "memory");
  return r.ok ? ok(r.value as MemoryContentRef) : r;
}

/** Narrows an unknown value to an `episode` ref. */
export function parseEpisodeRef(v: unknown, detail: string): ValidationResult<EpisodeRef> {
  const r = parseKinded(v, detail, "episode");
  return r.ok ? ok(r.value as EpisodeRef) : r;
}

/** Narrows an unknown value to an `event` ref. */
export function parseEventRef(v: unknown, detail: string): ValidationResult<EventRef> {
  const r = parseKinded(v, detail, "event");
  return r.ok ? ok(r.value as EventRef) : r;
}

/** Narrows an unknown value to an `experience` ref. */
export function parseExperienceRef(v: unknown, detail: string): ValidationResult<ExperienceRef> {
  const r = parseKinded(v, detail, "experience");
  return r.ok ? ok(r.value as ExperienceRef) : r;
}

/** Narrows an unknown value to an `appraisal` evidence ref (no semantics attached). */
export function parseAppraisalRef(v: unknown, detail: string): ValidationResult<AppraisalRef> {
  const r = parseKinded(v, detail, "appraisal");
  return r.ok ? ok(r.value as AppraisalRef) : r;
}

/** Narrows an unknown value to a `snapshot` ref used as affect-snapshot pointer. */
export function parseAffectSnapshotRef(v: unknown, detail: string): ValidationResult<AffectSnapshotRef> {
  const r = parseKinded(v, detail, "snapshot");
  return r.ok ? ok(r.value as AffectSnapshotRef) : r;
}

/**
 * Narrows an unknown value to any memory-bound kind. Membership inside one specific
 * revision is NOT checked here — that is the repository's verdict-only capability.
 */
export function parseMemoryBoundRef(v: unknown, detail: string): ValidationResult<MemoryBoundRef> {
  const parsed = validateRefElement(v, detail);
  if (!parsed.ok) return parsed;
  if (!isMemoryBoundRefKind(refKind(parsed.value))) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${detail}: ref kind not memory-bound`);
  }
  return ok(parsed.value as MemoryBoundRef);
}
