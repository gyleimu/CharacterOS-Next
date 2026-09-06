/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — subject-state-v4 canonical schema
 * (types-first).
 *
 * V4 is the bounded-VA Affect state foundation:
 *   - exactly 13 top-level fields (mood REMOVED vs v3)
 *   - affect = CanonicalAffectV0 (valence ∈ [-1,1], activation ∈ [0,1])
 *   - mechanism_config = MechanismConfigV1 (BOUNDED_AFFECT_DYNAMICS_V0 / tick)
 *
 * V3 STAYS FROZEN: `SubjectStateV0` continues to mean exactly
 * `subject-state-v3`; its validator and canonical bytes are untouched. Nothing
 * in this module is reachable through the default production composition.
 *
 * Compatibility law (§8):
 *   subject-state-v3 ↔ FAST_EMA_V0 / legacy_tick
 *   subject-state-v4 ↔ BOUNDED_AFFECT_DYNAMICS_V0 / tick
 * Invalid pairings fail closed.
 */

import type {
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0,
  UnitIntervalV0,
  RepositoryRevisionIdV0
} from "./scalars.js";
import type { CanonicalRefV0 } from "./ref.js";
import type { TransitionType } from "./enums.js";
import type { TraceWindowV1 } from "./trace.js";
import { hashEnvelope } from "../canonical/hash.js";
import type {
  BeliefStateV0,
  EmptyClosedObjectV0,
  IdentityV0,
  MemoryStateV0,
  PersonalityStateV0,
  RelationshipStateV0,
  SubjectStateV0,
  RegulatoryStateV0,
  TraitsSeedV0,
  WorkingContextV0
} from "./subject-state.js";

// ----------------------------------------------------------------------------------
// Canonical Affect (§6): the persisted VA state — exactly two axes, no clock.
// ----------------------------------------------------------------------------------

export const CANONICAL_AFFECT_SCHEMA_VERSION = "canonical-affect-v0" as const;

declare const signedUnitIntervalBrand: unique symbol;
/** Signed unit interval: valence axis, finite, [-1, 1], never `-0`. */
export type SignedUnitIntervalV0 = number & { readonly [signedUnitIntervalBrand]: "SignedUnitIntervalV0" };

export interface CanonicalAffectV0 {
  readonly schema_version: typeof CANONICAL_AFFECT_SCHEMA_VERSION;
  readonly valence: SignedUnitIntervalV0;
  readonly activation: UnitIntervalV0;
}

// ----------------------------------------------------------------------------------
// subject-state-v4 (§5/§8): exactly 13 top-level fields, no Mood.
// ----------------------------------------------------------------------------------

export const SUBJECT_STATE_V4_SCHEMA_VERSION = "subject-state-v4" as const;

/** v3 alias: `SubjectStateV0` continues to mean exactly subject-state-v3. */
export type SubjectStateV3 = SubjectStateV0;

export interface AffectProfileV1 {
  readonly profile_id: "BOUNDED_AFFECT_DYNAMICS_V0";
  readonly timebase: "tick";
}

export interface MechanismConfigV1 {
  readonly affect_profile: AffectProfileV1;
  readonly feature_flags: EmptyClosedObjectV0;
  readonly thresholds: EmptyClosedObjectV0;
}

/** v4 runtime metadata: exact existing runtime field names plus the explicit
 * `schema_lineage` discriminator so v3/v4 states can never be confused. */
export interface V4RuntimeMetadataV0 {
  readonly subject_version: "subject-v0";
  readonly schema_lineage: "subject-state-v4";
  readonly state_revision: StateRevisionV0;
  readonly logical_time: LogicalTimeV0;
  readonly last_transition_time: LogicalTimeV0 | null;
  readonly last_transition_type: TransitionType | null;
  readonly created_at: LogicalTimeV0;
  readonly updated_at: LogicalTimeV0;
}

export interface SubjectStateV4 {
  readonly schema_version: typeof SUBJECT_STATE_V4_SCHEMA_VERSION;
  readonly identity: IdentityV0;
  readonly traits_seed: TraitsSeedV0;
  readonly personality: PersonalityStateV0;
  readonly memory_state: MemoryStateV0;
  readonly beliefs: BeliefStateV0;
  readonly relationships: RelationshipStateV0;
  readonly affect: CanonicalAffectV0;
  readonly regulation: RegulatoryStateV0;
  readonly context: WorkingContextV0;
  readonly mechanism_config: MechanismConfigV1;
  readonly trace_window: TraceWindowV1;
  readonly runtime_metadata: V4RuntimeMetadataV0;
}

/** Generic union where callers must genuinely handle both versions. */
export type SubjectStateAnyVersionV0 = SubjectStateV0 | SubjectStateV4;

// ----------------------------------------------------------------------------------
// V4 hash domains (§26/§27): separate /v2 projections, v3 /v1 bytes untouched.
// ----------------------------------------------------------------------------------

export const SUBJECT_STATE_V4_STATE_HASH_PROJECTION =
  "characteros-next/subject-state/state-hash/v2" as const;
export const SUBJECT_STATE_V4_SNAPSHOT_HASH_PROJECTION =
  "characteros-next/subject-state/snapshot-hash/v2" as const;
export const SUBJECT_STATE_V4_FULL_PERSISTENCE_PROJECTION =
  "characteros-next/subject-state/full-persistence/v2" as const;

/** §27 — the exact 12 top-level values in the V4 StateHash (mood absent,
 * trace_window excluded exactly as v3 law does). */
export function subjectStateV4ProjectionValue(snapshot: SubjectStateV4): Record<string, unknown> {
  return {
    schema_version: snapshot.schema_version,
    identity: snapshot.identity,
    traits_seed: snapshot.traits_seed,
    personality: snapshot.personality,
    memory_state: snapshot.memory_state,
    beliefs: snapshot.beliefs,
    relationships: snapshot.relationships,
    affect: snapshot.affect,
    regulation: snapshot.regulation,
    context: snapshot.context,
    mechanism_config: snapshot.mechanism_config,
    runtime_metadata: snapshot.runtime_metadata
  };
}

/** §20 dispatch: reads the literal top-level schema_version. Unknown/missing
 * version fails closed; the version is never inferred from field shape. */

export function stateHashV4(snapshot: SubjectStateV4): Promise<HashV1> {
  return hashEnvelope(SUBJECT_STATE_V4_STATE_HASH_PROJECTION, subjectStateV4ProjectionValue(snapshot));
}

export function readSubjectStateSchemaVersion(v: unknown): "subject-state-v3" | "subject-state-v4" | null {
  if (typeof v !== "object" || v === null) return null;
  const sv = (v as Record<string, unknown>)["schema_version"];
  if (sv === "subject-state-v3") return "subject-state-v3";
  if (sv === "subject-state-v4") return "subject-state-v4";
  return null;
}

// Re-export for downstream version-aware modules (single import point).
export type { RepositoryRevisionIdV0, IdentifierV0, CanonicalRefV0 };
