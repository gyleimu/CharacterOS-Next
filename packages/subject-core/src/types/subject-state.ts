/**
 * P2.1.1 — SubjectStateV0 canonical schema (types-only).
 * Source: docs/implementation/p2-1-contract-freeze.md §4 (S0) and §6 (exact nested types).
 * All 13 top-level fields are required. Nullable fields are `T | null` (never `undefined`);
 * the sole optional-keys exception is the noncanonical SubjectSeedInputV0 (§4.1).
 */

import type {
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0,
  UnitIntervalV0,
  RepositoryRevisionIdV0
} from "./scalars.js";
import type { CanonicalRefV0 } from "./ref.js";
import type { AffectChannelId, AffectPhase, TransitionType } from "./enums.js";
import type { TraceWindowV1 } from "./trace.js";

/** §6.2 Identity.origin_metadata (closed). */
export interface OriginMetadataV0 {
  readonly creation_source: IdentifierV0 | null;
  readonly seed_version: IdentifierV0 | null;
}

/** §6.2 IdentityV0 (immutable seed; identity_anchors is an ordered unique string array). */
export interface IdentityV0 {
  readonly subject_id: IdentifierV0;
  readonly display_name: string;
  readonly origin_metadata: OriginMetadataV0;
  readonly identity_anchors: readonly string[];
  readonly self_schema_seed_refs: readonly CanonicalRefV0[];
}

/** §6.2 TraitsSeedV0.dimensions pattern map: key `^[a-z][a-z0-9_]{0,63}$`, value UnitInterval. */
export interface TraitsSeedV0 {
  readonly dimensions: { readonly [trait: string]: UnitIntervalV0 };
}

/**
 * PersonalityState V0 (schema v1) — persistent ACQUIRED slow state, canonically
 * distinct from the immutable traits_seed. A registered-dimension container:
 * dimensions are unique and sorted by dimension_id; updates may only target
 * EXISTING registered dimensions (new dimensions require an explicit schema
 * migration). Values reuse the bounded UnitIntervalV0 scalar. This state is NOT
 * emotion/mood/belief/relationship/need/cognition, and never reinterprets
 * traits_seed.
 */
export const PERSONALITY_STATE_SCHEMA_VERSION = "personality-state-v0" as const;

export interface PersonalityDimensionStateV0 {
  readonly dimension_id: IdentifierV0;
  readonly value: UnitIntervalV0;
}

export interface PersonalityStateV0 {
  readonly schema_version: typeof PERSONALITY_STATE_SCHEMA_VERSION;
  readonly dimensions: readonly PersonalityDimensionStateV0[];
}

/** §6.2 retrieval_config (closed, init-only). */
export interface RetrievalConfigV0 {
  readonly profile_id: "RETRIEVAL_V0";
  readonly affect_congruence_enabled: false;
  readonly recent_trace_capacity: 64;
}

/** §6.2 MemoryStateV0. */
export interface MemoryStateV0 {
  readonly working_refs: readonly CanonicalRefV0[];
  readonly active_episode_refs: readonly CanonicalRefV0[];
  readonly autobiographical_index_revision: RepositoryRevisionIdV0 | null;
  readonly repository_revision: RepositoryRevisionIdV0;
  readonly consolidation_cursor: LogicalTimeV0 | null;
  readonly retrieval_config: RetrievalConfigV0;
  readonly recent_retrieval_trace: readonly CanonicalRefV0[];
  readonly lifecycle_metadata: EmptyClosedObjectV0;
  readonly pending_encoding_refs: readonly CanonicalRefV0[];
  readonly last_retrieval_at: LogicalTimeV0 | null;
}

/** §6.2 BeliefsV0 (readonly). items are unique/sorted by ref. */
export interface BeliefsV0 {
  readonly items: readonly BeliefItemV0[];
}

export interface BeliefItemV0 {
  readonly ref: CanonicalRefV0;
  readonly summary: string | null;
}

/**
 * RelationshipState V0 — persistent counterpart-specific slow state.
 *
 * This is a generic registered container, not a relationship psychology model.
 * Counterparts are unique and raw-canonical-ref sorted; dimensions within each
 * counterpart are unique and raw-ASCII sorted by dimension_id. Membership is
 * explicit canonical state and updates may target only existing members.
 */
export const RELATIONSHIP_STATE_SCHEMA_VERSION = "relationship-state-v0" as const;

export interface RelationshipDimensionStateV0 {
  readonly dimension_id: IdentifierV0;
  readonly value: UnitIntervalV0;
}

export interface RelationshipCounterpartStateV0 {
  readonly counterpart_ref: CanonicalRefV0;
  readonly dimensions: readonly RelationshipDimensionStateV0[];
}

export interface RelationshipStateV0 {
  readonly schema_version: typeof RELATIONSHIP_STATE_SCHEMA_VERSION;
  readonly counterparts: readonly RelationshipCounterpartStateV0[];
}

/** §6.2 MoodV0 / AffectV0 / RegulatoryStateV0 / WorkingContextV0. */
export interface MoodV0 {
  readonly baseline: UnitIntervalV0;
  readonly generated_under_profile: "FAST_EMA_V0" | null;
  readonly last_update: LogicalTimeV0 | null;
}

export interface AffectV0 {
  readonly active_channels: readonly AffectChannelV0[];
  readonly generated_under_profile: "FAST_EMA_V0" | null;
  readonly updated_at: LogicalTimeV0 | null;
}

export interface AffectChannelV0 {
  readonly channel_id: AffectChannelId;
  readonly intensity: UnitIntervalV0;
  readonly phase: AffectPhase;
  readonly started_at: LogicalTimeV0;
  readonly source_appraisal_ref: CanonicalRefV0;
}

export interface RegulatoryStateV0 {
  readonly energy: UnitIntervalV0;
  readonly stress: UnitIntervalV0;
  readonly arousal: UnitIntervalV0;
  readonly fatigue: UnitIntervalV0;
  readonly last_update: LogicalTimeV0 | null;
}

export interface WorkingContextV0 {
  readonly scene: string;
  readonly task: string | null;
  readonly focus_refs: readonly CanonicalRefV0[];
  readonly active_entity_refs: readonly CanonicalRefV0[];
  readonly environment_refs: readonly CanonicalRefV0[];
  readonly current_observation_ref: CanonicalRefV0 | null;
}

/** §12 MechanismConfigV0 (readonly after init; only active affect authority). */
export interface MechanismConfigV0 {
  readonly affect_profile: AffectProfileV0;
  readonly legacy_reference_defaults: LegacyReferenceDefaultsV0;
  readonly feature_flags: EmptyClosedObjectV0;
  readonly thresholds: EmptyClosedObjectV0;
}

export interface AffectProfileV0 {
  readonly profile_id: "FAST_EMA_V0";
  readonly timebase: "legacy_tick";
}

export interface LegacyReferenceDefaultsV0 {
  readonly tHold: 60;
  readonly alpha: 0.06;
  readonly tau: 150;
  readonly clamp: 0.25;
}

/** §6.2 RuntimeMetadataV0. */
export interface RuntimeMetadataV0 {
  readonly subject_version: "subject-v0";
  readonly state_revision: StateRevisionV0;
  readonly logical_time: LogicalTimeV0;
  readonly last_transition_time: LogicalTimeV0 | null;
  readonly last_transition_type: TransitionType | null;
  readonly created_at: LogicalTimeV0;
  readonly updated_at: LogicalTimeV0;
}

/** §5.1 rule 6: closed object with exactly zero keys, `{}` in JSON. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- frozen zero-key closed object; emptiness IS the contract.
export interface EmptyClosedObjectV0 {
  // Intentionally empty; no keys may be added under V0.
}

/**
 * §6.1 SubjectState — exactly 14 top-level fields, all required.
 *
 * V2 is one explicit, migration-free evolution: the closed V1
 * `relationships.models` placeholder is replaced by canonical
 * RelationshipStateV0. V1 snapshots are not accepted as V2.
 */
export interface SubjectStateV0 {
  readonly schema_version: "subject-state-v2";
  readonly identity: IdentityV0;
  readonly traits_seed: TraitsSeedV0;
  readonly personality: PersonalityStateV0;
  readonly memory_state: MemoryStateV0;
  readonly beliefs: BeliefsV0;
  readonly relationships: RelationshipStateV0;
  readonly mood: MoodV0;
  readonly affect: AffectV0;
  readonly regulation: RegulatoryStateV0;
  readonly context: WorkingContextV0;
  readonly mechanism_config: MechanismConfigV0;
  readonly trace_window: TraceWindowV1;
  readonly runtime_metadata: RuntimeMetadataV0;
}
