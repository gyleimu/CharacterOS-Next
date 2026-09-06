/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — explicit v4 genesis (§23-§26).
 *
 * materializeSubjectStateV4V0: validates, materializes, hashes and builds a
 * revision-zero persistence envelope for an explicitly constructed v4
 * subject. It does NOT upsert into any runtime store, mutate any repository,
 * or connect to the default composition root. Explicit foundation only.
 */

import type {
  HashV1,
  RepositoryRevisionIdV0
} from "../types/scalars.js";
import type { SubjectStateV4 } from "../types/subject-state-v4.js";
import {
  SUBJECT_STATE_V4_FULL_PERSISTENCE_PROJECTION,
  SUBJECT_STATE_V4_SNAPSHOT_HASH_PROJECTION,
  SUBJECT_STATE_V4_STATE_HASH_PROJECTION,
  subjectStateV4ProjectionValue
} from "../types/subject-state-v4.js";
import { hashEnvelope } from "../canonical/hash.js";
import { validateSubjectStateV4 } from "../validation/subject-state-v4.js";
import type { SubjectStateV0 } from "../types/subject-state.js";

/** Explicit foundation mode discriminator (§23): the only lawful way to
 * construct a v4 subject in this slice. */
export type V4FoundationMode = "EXPLICIT_V4_FOUNDATION_V0";

export interface SubjectStateV4GenesisSeedV0 {
  readonly schema_version: "subject-state-v4-genesis-seed-v0";
  readonly subject: {
    readonly subject_id: Parameters<typeof Object>[0] extends never ? never : string;
    readonly display_name: string;
    readonly identity_anchors: readonly string[];
  };
  /** Copies the representation-independent state from a validated v3 seed
   * (memory/context/personality/beliefs/relationships foundations). */
  readonly v3_source: SubjectStateV0;
  readonly r0_binding: {
    readonly repository_revision: RepositoryRevisionIdV0;
    readonly repository_revision_hash: HashV1;
  };
}

export interface V4PersistenceEnvelopeV0 {
  readonly schema_version: "subject-state-v4-persistence-envelope-v0";
  readonly mode: V4FoundationMode;
  readonly snapshot: SubjectStateV4;
  readonly state_hash: HashV1;
  readonly snapshot_hash: HashV1;
  readonly full_checksum: HashV1;
  readonly repository_binding: {
    readonly repository_revision: RepositoryRevisionIdV0;
    readonly repository_revision_hash: HashV1;
  };
}

export type SubjectStateV4GenesisResultV0 =
  | { readonly ok: true; readonly envelope: V4PersistenceEnvelopeV0; readonly state: SubjectStateV4 }
  | { readonly ok: false; readonly code: "INVALID_SEED" | "INVALID_R0_BINDING" | "INVALID_V4_STATE"; readonly detail: string };

function failGenesis(code: "INVALID_SEED" | "INVALID_R0_BINDING" | "INVALID_V4_STATE", detail: string): SubjectStateV4GenesisResultV0 {
  return { ok: false, code, detail };
}

/** Deep structural equality check for the copied v3 foundation blocks:
 * the genesis copies them verbatim, so the v4 state's blocks must
 * JSON-match the v3 source's blocks exactly. */
function copiedBlocksMatch(v4: SubjectStateV4, v3: SubjectStateV0): boolean {
  return (
    JSON.stringify(v4.identity) === JSON.stringify(v3.identity) &&
    JSON.stringify(v4.traits_seed) === JSON.stringify(v3.traits_seed) &&
    JSON.stringify(v4.personality) === JSON.stringify(v3.personality) &&
    JSON.stringify(v4.memory_state) === JSON.stringify(v3.memory_state) &&
    JSON.stringify(v4.beliefs) === JSON.stringify(v3.beliefs) &&
    JSON.stringify(v4.relationships) === JSON.stringify(v3.relationships) &&
    JSON.stringify(v4.context) === JSON.stringify(v3.context)
  );
}

export function materializeSubjectStateV4V0(input: {
  readonly mode: V4FoundationMode;
  readonly seed: SubjectStateV4GenesisSeedV0;
  readonly r0_binding: {
    readonly repository_revision: RepositoryRevisionIdV0;
    readonly repository_revision_hash: HashV1;
  };
  readonly reference_validator: (binding: {
    readonly repository_revision: RepositoryRevisionIdV0;
    readonly repository_revision_hash: HashV1;
  }) => Promise<boolean>;
}): Promise<SubjectStateV4GenesisResultV0> {
  return (async (): Promise<SubjectStateV4GenesisResultV0> => {
    if (input.mode !== "EXPLICIT_V4_FOUNDATION_V0") {
      return failGenesis("INVALID_SEED", `unknown genesis mode ${String(input.mode)}`);
    }
    // ---- reference binding validation (fail closed before anything else) ----
    const bindingOk = await input.reference_validator(input.r0_binding);
    if (bindingOk !== true) {
      return failGenesis("INVALID_R0_BINDING", "R0 binding failed the reference validator");
    }
    if (
      input.r0_binding.repository_revision !== input.seed.r0_binding.repository_revision ||
      input.r0_binding.repository_revision_hash !== input.seed.r0_binding.repository_revision_hash
    ) {
      return failGenesis("INVALID_R0_BINDING", "r0_binding does not match the seed's binding");
    }

    // ---- materialize the v4 state -------------------------------------------
    const v3 = input.seed.v3_source;
    const genesis: SubjectStateV4 = {
      schema_version: "subject-state-v4",
      identity: JSON.parse(JSON.stringify(v3.identity)) as SubjectStateV4["identity"],
      traits_seed: JSON.parse(JSON.stringify(v3.traits_seed)) as SubjectStateV4["traits_seed"],
      personality: JSON.parse(JSON.stringify(v3.personality)) as SubjectStateV4["personality"],
      memory_state: JSON.parse(JSON.stringify(v3.memory_state)) as SubjectStateV4["memory_state"],
      beliefs: JSON.parse(JSON.stringify(v3.beliefs)) as SubjectStateV4["beliefs"],
      relationships: JSON.parse(JSON.stringify(v3.relationships)) as SubjectStateV4["relationships"],
      // Inline the frozen baseline (0, 0.2) — importing from affect here
      // would create a subject-core → affect dependency cycle (§9).
      affect: {
        schema_version: "canonical-affect-v0" as const,
        valence: 0 as never,
        activation: 0.2 as never
      },
      regulation: JSON.parse(JSON.stringify(v3.regulation)) as SubjectStateV4["regulation"],
      context: JSON.parse(JSON.stringify(v3.context)) as SubjectStateV4["context"],
      mechanism_config: {
        affect_profile: { profile_id: "BOUNDED_AFFECT_DYNAMICS_V0", timebase: "tick" },
        feature_flags: {},
        thresholds: {}
      },
      trace_window: JSON.parse(JSON.stringify(v3.trace_window)) as SubjectStateV4["trace_window"],
      runtime_metadata: {
        subject_version: "subject-v0",
        schema_lineage: "subject-state-v4",
        state_revision: 0 as never,
        logical_time: 0 as never,
        last_transition_time: null,
        last_transition_type: null,
        created_at: 0 as never,
        updated_at: 0 as never
      }
    };
    if (!copiedBlocksMatch(genesis, v3)) {
      return failGenesis("INVALID_V4_STATE", "genesis copy diverged from the v3 source blocks");
    }
    Object.freeze(genesis.affect);
    Object.freeze(genesis);

    // ---- closed v4 validation ------------------------------------------------
    const checked = validateSubjectStateV4(genesis);
    if (!checked.ok) {
      return failGenesis("INVALID_V4_STATE", checked.error.detail);
    }

    // ---- hash + envelope -------------------------------------------------------
    const stateHash = await hashEnvelope(SUBJECT_STATE_V4_STATE_HASH_PROJECTION, subjectStateV4ProjectionValue(checked.value));
    const snapshotHash = await hashEnvelope(
      SUBJECT_STATE_V4_SNAPSHOT_HASH_PROJECTION,
      {
        last_trace_ref: null,
        state_hash: stateHash,
        state_revision: genesis.runtime_metadata.state_revision,
        subject_id: genesis.identity.subject_id,
        trace_cursor: genesis.trace_window.cursor
      }
    );
    const fullChecksum = await hashEnvelope(SUBJECT_STATE_V4_FULL_PERSISTENCE_PROJECTION, genesis);
    const envelope: V4PersistenceEnvelopeV0 = {
      schema_version: "subject-state-v4-persistence-envelope-v0",
      mode: "EXPLICIT_V4_FOUNDATION_V0",
      snapshot: checked.value,
      state_hash: stateHash,
      snapshot_hash: snapshotHash,
      full_checksum: fullChecksum,
      repository_binding: {
        repository_revision: input.r0_binding.repository_revision,
        repository_revision_hash: input.r0_binding.repository_revision_hash
      }
    };
    return { ok: true, envelope, state: genesis };
  })();
}
