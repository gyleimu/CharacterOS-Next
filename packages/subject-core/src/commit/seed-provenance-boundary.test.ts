/**
 * Seed Provenance Boundary — trusted fixture, not lived history
 * (AUDIT_REMEDIATION_AND_FREEZE_V0, TASK 4).
 *
 * The seed surface (`seedSnapshots`, `seedBundles`, `seedCommittedBundle`,
 * `createInMemorySubjectCoreFacadeForExplicitV4V0`) is a TRUSTED FIXTURE /
 * INITIALIZATION BOUNDARY. It is retained deliberately — research and
 * initialization need it — and this suite proves it is now explicitly marked,
 * so a future causal experiment cannot inadvertently pass governed Relationship
 * state off as normally-experienced (governed-writer-produced) state.
 *
 * Proven here:
 *   1. the seed path performs NO canonical validation — seeded state is
 *      host-authored fixture data, never a production product
 *   2. the observer DETECTS seeded governed `relationship_core_*` state and
 *      tags it with the exact fixture provenance + non-causal status
 *   3. ordinary (non-reserved) seeded state is NOT flagged
 *   4. the observation is non-authoritative and non-numeric: it mints no
 *      capability, carries no decision field, and is a closed shape
 *   5. a seeded governed value is NOT governed-writer evidence: no bundle, no
 *      writer authority — and seeding an authority-bearing bundle is reported
 *      as a contract violation
 *   6. unreadable seed shapes are COUNTED, never silently ignored
 *   7. seeding still works (research capability preserved)
 *
 * Fully OFFLINE: deterministic fixtures only — 0 real model calls.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacade,
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  observeSeededGovernedRelationshipStateV0,
  SEEDED_GOVERNED_STATE_CAUSAL_STATUS_V0,
  SEEDED_GOVERNED_STATE_PROVENANCE_V0,
  SEED_WRITER_AUTHORITY_POLICY_V0,
  type SubjectStateV0
} from "../index.js";

const SUBJECT = "subject-s0";
const FAMILIARITY = "relationship_core_interaction_familiarity_v0";

/** Minimal shape carrying ONLY what the observer reads — the seed is unvalidated. */
function seedWith(dimensionIds: readonly string[]): Record<string, unknown> {
  return {
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: [
        {
          counterpart_ref: "entity:alice-like",
          dimensions: dimensionIds.map((dimension_id) => ({ dimension_id, value: 0.25 }))
        }
      ]
    }
  };
}

const OBSERVATION_KEYS = [
  "causal_status",
  "provenance",
  "reserved_governed_dimension_ids",
  "seed_contains_governed_relationship_state",
  "seeded_bundles_with_writer_authority",
  "unreadable_seed_shapes",
  "writer_authority_policy"
];

describe("seed provenance boundary", () => {
  it("1. the seed path performs NO canonical validation — seeded state is fixture data", async () => {
    // Deliberately NOT a valid SubjectStateV0: the seed reader returns it as-is.
    const invalidSeed = seedWith([FAMILIARITY]);
    const assembly = createInMemorySubjectCoreFacade({
      seedSnapshots: new Map([[SUBJECT as never, invalidSeed as unknown as SubjectStateV0]]),
      preparedResultValidator: async () => true
    });
    const read = await assembly.storeRead.readCurrentState(SUBJECT);
    expect(read).toBe(invalidSeed);
    // Nothing was committed: the seed is not a commit and produced no bundle.
    expect(assembly.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("2. seeded governed relationship state is DETECTED and tagged as fixture provenance", () => {
    const observation = observeSeededGovernedRelationshipStateV0({
      snapshots: [seedWith([FAMILIARITY, "arbitrary_host_dimension"])]
    });
    expect(observation.provenance).toBe(SEEDED_GOVERNED_STATE_PROVENANCE_V0);
    expect(observation.causal_status).toBe(SEEDED_GOVERNED_STATE_CAUSAL_STATUS_V0);
    expect(observation.writer_authority_policy).toBe(SEED_WRITER_AUTHORITY_POLICY_V0);
    expect(observation.seed_contains_governed_relationship_state).toBe(true);
    expect(observation.reserved_governed_dimension_ids).toStrictEqual([FAMILIARITY]);
    expect(observation.seeded_bundles_with_writer_authority).toBe(0);
    expect(observation.unreadable_seed_shapes).toBe(0);

    // The exact frozen literals state the causal consequence.
    expect(SEEDED_GOVERNED_STATE_PROVENANCE_V0).toBe("TRUSTED_FIXTURE_SEED_BOUNDARY");
    expect(SEEDED_GOVERNED_STATE_CAUSAL_STATUS_V0).toBe("NOT_GOVERNED_WRITER_EVIDENCE");
    expect(SEED_WRITER_AUTHORITY_POLICY_V0).toBe("MUST_BE_NULL");
  });

  it("3. ordinary non-reserved seeded state is NOT flagged", () => {
    const observation = observeSeededGovernedRelationshipStateV0({
      snapshots: [seedWith(["arbitrary_host_dimension", "relationship_public_dimension_v0"])]
    });
    expect(observation.seed_contains_governed_relationship_state).toBe(false);
    expect(observation.reserved_governed_dimension_ids).toStrictEqual([]);
    // The classifier is exact-prefix only: no fuzzy matching, no case folding.
    expect(observation.unreadable_seed_shapes).toBe(0);
  });

  it("4. the observation is non-authoritative and non-numeric", () => {
    const observation = observeSeededGovernedRelationshipStateV0({
      snapshots: [seedWith([FAMILIARITY])]
    });
    expect(Object.keys(observation).sort()).toStrictEqual(OBSERVATION_KEYS);
    // No capability, no token, no decision field, no value.
    const forbidden = /(capability|token|payload|decision|authority_record|credence|value)/i;
    expect(Object.keys(observation).filter((key) => forbidden.test(key))).toStrictEqual([]);
    expect(Object.isFrozen(observation)).toBe(false); // plain data, not a capability
    // It is a pure read: the input is untouched.
    const snapshot = seedWith([FAMILIARITY]);
    const before = JSON.stringify(snapshot);
    observeSeededGovernedRelationshipStateV0({ snapshots: [snapshot] });
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("5. a seeded governed value is NOT governed-writer evidence, and an authority-bearing seed is reported", () => {
    // Seeded governed state: no bundle, no writer authority anywhere.
    const seededObservation = observeSeededGovernedRelationshipStateV0({
      snapshots: [seedWith([FAMILIARITY])],
      bundles: []
    });
    expect(seededObservation.causal_status).toBe("NOT_GOVERNED_WRITER_EVIDENCE");
    expect(seededObservation.seed_contains_governed_relationship_state).toBe(true);
    expect(seededObservation.seeded_bundles_with_writer_authority).toBe(0);

    // The shape EVERY ordinary production V2 record has: writer_authority null.
    // Seeding such a bundle back is lawful and reported as no violation.
    const ordinaryShaped = observeSeededGovernedRelationshipStateV0({
      bundles: [{ commit_version: "atomic-commit-v2", writer_authority: null }]
    });
    expect(ordinaryShaped.seeded_bundles_with_writer_authority).toBe(0);

    // A bundle fabricated to LOOK like a governed product is reported as a
    // contract violation (SEED_WRITER_AUTHORITY_POLICY = MUST_BE_NULL).
    const fabricated = observeSeededGovernedRelationshipStateV0({
      bundles: [
        { commit_version: "atomic-commit-v2", writer_authority: null },
        {
          commit_version: "atomic-commit-v2",
          writer_authority: { writer_family: "RELATIONSHIP_GOVERNED_FEATURE" }
        }
      ]
    });
    expect(fabricated.seeded_bundles_with_writer_authority).toBe(1);
    expect(fabricated.causal_status).toBe("NOT_GOVERNED_WRITER_EVIDENCE");
  });

  it("6. unreadable seed shapes are COUNTED, never silently ignored", () => {
    const observation = observeSeededGovernedRelationshipStateV0({
      snapshots: [
        seedWith([FAMILIARITY]),
        null,
        { relationships: "not-an-object" },
        { relationships: { counterparts: "not-an-array" } },
        { relationships: { counterparts: [{ counterpart_ref: "entity:x", dimensions: "not-an-array" }] } },
        { relationships: { counterparts: [{ counterpart_ref: "entity:x", dimensions: [null] }] } },
        { relationships: { counterparts: [{ counterpart_ref: "entity:x", dimensions: [{ value: 0.5 }] }] } }
      ],
      bundles: [null]
    });
    // One readable snapshot carries governed state; the other six shapes are
    // unreadable, plus one unreadable bundle.
    expect(observation.reserved_governed_dimension_ids).toStrictEqual([FAMILIARITY]);
    expect(observation.unreadable_seed_shapes).toBe(7);
  });

  it("7. seeding still works — the research capability is preserved on both assemblies", async () => {
    const seed = seedWith([FAMILIARITY]);

    const v3 = createInMemorySubjectCoreFacade({
      seedSnapshots: new Map([[SUBJECT as never, seed as unknown as SubjectStateV0]]),
      preparedResultValidator: async () => true
    });
    expect(await v3.storeRead.readCurrentState(SUBJECT)).toBe(seed);

    const v4 = createInMemorySubjectCoreFacadeForExplicitV4V0({
      seedSnapshots: new Map([[SUBJECT as never, seed as never]]),
      preparedResultValidator: async () => true
    });
    expect(await v4.storeRead.readCurrentState(SUBJECT)).toBe(seed);

    // Both seed surfaces are observable through the ONE shared observer.
    for (const assembly of [v3, v4]) {
      const snapshot = await assembly.storeRead.readCurrentState(SUBJECT);
      const observation = observeSeededGovernedRelationshipStateV0({ snapshots: [snapshot] });
      expect(observation.seed_contains_governed_relationship_state).toBe(true);
      expect(observation.reserved_governed_dimension_ids).toStrictEqual([FAMILIARITY]);
    }
  });
});
