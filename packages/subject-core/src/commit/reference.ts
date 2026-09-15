/**
 * P2.3 Pre-Learning P0-2 — reference in-memory facade wiring (SANCTIONED assembly).
 *
 * The ONLY sanctioned way external packages obtain a mutable SubjectCore: a fully
 * wired SubjectCoreFacade backed by the reference in-memory store + journal. The raw
 * store and journal instances are NOT exposed as public mutation surfaces — callers
 * receive a read-only `storeRead` handle (bundles/revision projections) and the
 * journal only for host-side durability (export/import/rebuild), never for direct
 * writes. `compareAndCommit` is unreachable from outside this package.
 */

import type { SubjectStateV0 } from "../types/subject-state.js";
import type { SubjectStateAnyVersionV0, SubjectStateV4 } from "../types/subject-state-v4.js";
import type { IdentifierV0 } from "../types/scalars.js";
import type {
  AtomicCommitBundleForStateV0
} from "../types/persistence-v2.js";
import type { ReferenceValidatorCapability, MemoryAdoptionValidatorCapability } from "./engine.js";
import { InMemoryAtomicCommitStore } from "./store.js";
import { InMemoryTransitionIdentityJournal } from "../identity/journal.js";
import { SubjectCoreFacade, type SubjectCoreFacadePorts } from "./facade.js";
import {
  createProducerAuthorizationIssuer,
  type ProducerAuthorizationIssuer
} from "./producer-authorization.js";
import {
  isReservedRelationshipCoreDimensionIdV0,
  mintPreparedGovernedWriterAuthorityTokenV0,
  type MintPreparedGovernedWriterAuthorityTokenInputV0,
  type PreparedGovernedWriterAuthorityTokenV0
} from "./writer-authority-membrane.js";

export interface InMemoryFacadeOptions<
  TState extends SubjectStateAnyVersionV0 = SubjectStateV0
> {
  /** Verdict-only repository capability (defaults to accepting everything). */
  readonly referenceValidator?: ReferenceValidatorCapability;
  /**
   * R2-H (ATTACK F): verdict-only memory adoption proof. When omitted, ANY proposal
   * that changes the canonical memory binding fails closed at the engine.
   */
  readonly memoryAdoptionValidator?: MemoryAdoptionValidatorCapability;
  /**
   * Optional seed snapshots by subject (default: none — subjects must exist).
   *
   * SEED IS A TRUSTED FIXTURE / INITIALIZATION BOUNDARY — NOT LIVED HISTORY.
   * See `observeSeededGovernedRelationshipStateV0` for the explicit invariant:
   * seeded canonical state is host-authored fixture data and is NOT causal
   * evidence that a production (or governed) writer acted.
   */
  readonly seedSnapshots?: ReadonlyMap<IdentifierV0, TState>;
  /**
   * Optional seed committed bundles (test/fixture affordance for historical
   * V1-only subjects): seeded in authority order before any new commit, so
   * post-cutover promotion tests can start from an authentic V1 history.
   *
   * SEED IS A TRUSTED FIXTURE / INITIALIZATION BOUNDARY — NOT LIVED HISTORY.
   * A seeded bundle MUST NOT carry a non-null writer_authority (see
   * `SEED_WRITER_AUTHORITY_POLICY_V0` and
   * `observeSeededGovernedRelationshipStateV0`).
   */
  readonly seedBundles?: readonly AtomicCommitBundleForStateV0<TState>[];
  /**
   * Trusted prepared-record verdict — REQUIRED. There is no default: a facade
   * without an explicit prepared-result gate must never be minted (fail closed,
   * ATTACK C closure).
   */
  readonly preparedResultValidator: SubjectCoreFacadePorts<TState>["preparedResultValidator"];
}

export interface ReadOnlyStoreHandle<
  TState extends SubjectStateAnyVersionV0 = SubjectStateV0
> {
  getCommittedBundles(): readonly AtomicCommitBundleForStateV0<TState>[];
  currentRevision(subjectId: string): number | null;
  readCurrentBundle(subjectId: string): AtomicCommitBundleForStateV0<TState> | null;
  readCommittedByTransitionId(transitionId: string): AtomicCommitBundleForStateV0<TState> | null;
  /**
   * Read-only current canonical snapshot (same authority the facade's own
   * StateReader uses: latest committed bundle snapshot, else the seed).
   * INTERACTION_FAMILIARITY_EXPERIENCE_INGESTION_V0 read surface.
   */
  readCurrentState(subjectId: string): Promise<TState | null>;
}

/**
 * Trusted-composition issuer for prepared governed writer authority tokens
 * (INTERACTION_FAMILIARITY_EXPERIENCE_INGESTION_V0 minimum wiring). The
 * membrane issuer itself stays module-private; this handle parallels
 * producerAuthorizationIssuer: it exists ONLY on the assembly handed to
 * trusted runtime composition, and the facade/engine keep enforcing every
 * frozen governed law (token identity binding, reserved-write guard, exact
 * record materialization).
 */
export interface PreparedGovernedWriterAuthorityIssuer {
  issue(input: MintPreparedGovernedWriterAuthorityTokenInputV0): PreparedGovernedWriterAuthorityTokenV0;
}

export interface InMemoryFacadeAssembly<
  TState extends SubjectStateAnyVersionV0 = SubjectStateV0
> {
  readonly facade: SubjectCoreFacade<TState>;
  readonly storeRead: ReadOnlyStoreHandle<TState>;
  readonly journal: InMemoryTransitionIdentityJournal;
  /**
   * The trusted producer-authorization issuer wired into the facade's verifier
   * (ATTACK D closure). Host compositions issue capabilities through THIS issuer
   * only; structurally copied sets are refused by the facade.
   */
  readonly producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  /**
   * Trusted-composition issuer for prepared governed writer authority tokens
   * (see PreparedGovernedWriterAuthorityIssuer). NOT a module export surface:
   * the membrane issuer/verifier remain module-private.
   */
  readonly preparedGovernedWriterAuthorityIssuer: PreparedGovernedWriterAuthorityIssuer;
}

// ---- seed provenance boundary (trusted fixture, not lived history) --------------------

/**
 * SEED IS A TRUSTED FIXTURE / INITIALIZATION BOUNDARY — NOT LIVED HISTORY.
 *
 * Every seed surface (`seedSnapshots`, `seedBundles`, `seedCommittedBundle`,
 * `createInMemorySubjectCoreFacadeForExplicitV4V0`) injects host-authored
 * fixture data into the canonical pipeline WITHOUT running the production
 * writer path: no CAS, no governed-authority evaluation, no producer
 * authorization. Seeding remains lawful and necessary for initialization and
 * research.
 *
 * The explicit invariant this establishes (frozen):
 *
 *   Seeded governed `relationship_core_*` state MUST NOT be presented as
 *   causal evidence that the governed familiarity writer produced it. Only a
 *   committed bundle carrying a non-null `writer_authority` of family
 *   `RELATIONSHIP_GOVERNED_FEATURE` is that evidence, and seeding never mints
 *   one (`SEED_WRITER_AUTHORITY_POLICY_V0`).
 *
 * `observeSeededGovernedRelationshipStateV0` is the low-cost read-only
 * observation that makes the invariant checkable. It is NOT an authority
 * surface: it mints nothing, grants nothing, carries no numeric decision field
 * and mutates no input.
 */

/** Exact frozen provenance literal: the state came from the seed boundary. */
export const SEEDED_GOVERNED_STATE_PROVENANCE_V0 = "TRUSTED_FIXTURE_SEED_BOUNDARY" as const;

/** Exact frozen causal status: seeded state is not governed-writer evidence. */
export const SEEDED_GOVERNED_STATE_CAUSAL_STATUS_V0 = "NOT_GOVERNED_WRITER_EVIDENCE" as const;

/** Exact frozen contract for writer authority on a seeded bundle. */
export const SEED_WRITER_AUTHORITY_POLICY_V0 = "MUST_BE_NULL" as const;

/**
 * Read-only observation of governed Relationship state reaching the pipeline
 * through the seed boundary. Deliberately NON-AUTHORITATIVE and NON-NUMERIC.
 */
export interface SeededGovernedRelationshipStateObservationV0 {
  readonly provenance: typeof SEEDED_GOVERNED_STATE_PROVENANCE_V0;
  readonly causal_status: typeof SEEDED_GOVERNED_STATE_CAUSAL_STATUS_V0;
  readonly writer_authority_policy: typeof SEED_WRITER_AUTHORITY_POLICY_V0;
  /** Exact reserved `relationship_core_*` dimension ids present in the seed snapshots. */
  readonly reserved_governed_dimension_ids: readonly string[];
  /** True iff any seed snapshot carries reserved governed Relationship state. */
  readonly seed_contains_governed_relationship_state: boolean;
  /** Count of seeded bundles carrying a NON-NULL writer authority (a contract violation). */
  readonly seeded_bundles_with_writer_authority: number;
  /**
   * Count of seed shapes this observer could not read. Reported so an
   * unreadable shape can never silently hide governed state behind a
   * "nothing found" answer.
   */
  readonly unreadable_seed_shapes: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Pure, total, read-only observation of the seed boundary. Never throws, never
 * mutates, never mints. Unreadable shapes are counted rather than ignored.
 */
export function observeSeededGovernedRelationshipStateV0(input: {
  readonly snapshots?: readonly unknown[];
  readonly bundles?: readonly unknown[];
}): SeededGovernedRelationshipStateObservationV0 {
  const reserved = new Set<string>();
  let unreadable = 0;

  for (const snapshot of input.snapshots ?? []) {
    const state = asRecord(snapshot);
    if (state === null) {
      unreadable += 1;
      continue;
    }
    const relationships = state["relationships"];
    if (relationships === undefined || relationships === null) continue;
    const relationshipsRecord = asRecord(relationships);
    if (relationshipsRecord === null) {
      unreadable += 1;
      continue;
    }
    const counterparts = relationshipsRecord["counterparts"];
    if (counterparts === undefined || counterparts === null) continue;
    if (!Array.isArray(counterparts)) {
      unreadable += 1;
      continue;
    }
    for (const counterpart of counterparts) {
      const counterpartRecord = asRecord(counterpart);
      if (counterpartRecord === null) {
        unreadable += 1;
        continue;
      }
      const dimensions = counterpartRecord["dimensions"];
      if (dimensions === undefined || dimensions === null) continue;
      if (!Array.isArray(dimensions)) {
        unreadable += 1;
        continue;
      }
      for (const dimension of dimensions) {
        const dimensionRecord = asRecord(dimension);
        if (dimensionRecord === null) {
          unreadable += 1;
          continue;
        }
        const dimensionId = dimensionRecord["dimension_id"];
        if (typeof dimensionId !== "string") {
          unreadable += 1;
          continue;
        }
        if (isReservedRelationshipCoreDimensionIdV0(dimensionId)) reserved.add(dimensionId);
      }
    }
  }

  let seededWithAuthority = 0;
  for (const bundle of input.bundles ?? []) {
    const bundleRecord = asRecord(bundle);
    if (bundleRecord === null) {
      unreadable += 1;
      continue;
    }
    const authority = bundleRecord["writer_authority"];
    if (authority !== undefined && authority !== null) seededWithAuthority += 1;
  }

  return {
    provenance: SEEDED_GOVERNED_STATE_PROVENANCE_V0,
    causal_status: SEEDED_GOVERNED_STATE_CAUSAL_STATUS_V0,
    writer_authority_policy: SEED_WRITER_AUTHORITY_POLICY_V0,
    reserved_governed_dimension_ids: [...reserved].sort(),
    seed_contains_governed_relationship_state: reserved.size > 0,
    seeded_bundles_with_writer_authority: seededWithAuthority,
    unreadable_seed_shapes: unreadable
  };
}

export function createInMemorySubjectCoreFacade(
  options: InMemoryFacadeOptions
): InMemoryFacadeAssembly {
  return createInMemorySubjectCoreFacadeInternal(options, (bundle) => bundle.next_snapshot);
}

/** Explicit v4 foundation wiring. This is not used by RuntimeCompositionRoot.
 *
 * SEED IS A TRUSTED FIXTURE / INITIALIZATION BOUNDARY — NOT LIVED HISTORY: the
 * v4 explicit foundation takes its initial canonical state through
 * `seedSnapshots`/`seedBundles` exactly like the v3 assembly, so the seed
 * provenance contract applies unchanged (see
 * `observeSeededGovernedRelationshipStateV0`).
 */
export function createInMemorySubjectCoreFacadeForExplicitV4V0(
  options: InMemoryFacadeOptions<SubjectStateV4>
): InMemoryFacadeAssembly<SubjectStateV4> {
  return createInMemorySubjectCoreFacadeInternal(options, (bundle) => bundle.next_snapshot);
}

function createInMemorySubjectCoreFacadeInternal<
  TState extends SubjectStateAnyVersionV0
>(
  options: InMemoryFacadeOptions<TState>,
  stateFromBundle: (bundle: AtomicCommitBundleForStateV0<TState>) => TState
): InMemoryFacadeAssembly<TState> {
  if (options.preparedResultValidator === undefined) {
    throw new Error(
      "createInMemorySubjectCoreFacade: preparedResultValidator is required (fail closed; §7.6)"
    );
  }
  const store = new InMemoryAtomicCommitStore<AtomicCommitBundleForStateV0<TState>>();
  for (const seeded of options.seedBundles ?? []) {
    store.seedCommittedBundle(seeded);
  }
  const journal = new InMemoryTransitionIdentityJournal();
  const producerAuthorizationIssuer = createProducerAuthorizationIssuer();
  const seeds = options.seedSnapshots ?? new Map<IdentifierV0, TState>();

  const ports: SubjectCoreFacadePorts<TState> = {
    store,
    journal,
    stateReader: {
      async readCurrentSnapshot(subjectId: IdentifierV0): Promise<TState | null> {
        const bundle = store.readCurrentBundle(subjectId);
        if (bundle !== null) return stateFromBundle(bundle);
        return seeds.get(subjectId) ?? null;
      }
    },
    preparedResultValidator: options.preparedResultValidator,
    producerAuthorizationVerifier: async (set) => producerAuthorizationIssuer.verify(set),
    ...(options.referenceValidator !== undefined
      ? { referenceValidator: options.referenceValidator }
      : {}),
    ...(options.memoryAdoptionValidator !== undefined
      ? { memoryAdoptionValidator: options.memoryAdoptionValidator }
      : {})
  };

  return {
    facade: new SubjectCoreFacade<TState>(ports),
    producerAuthorizationIssuer,
    preparedGovernedWriterAuthorityIssuer: {
      issue: (input: MintPreparedGovernedWriterAuthorityTokenInputV0) =>
        mintPreparedGovernedWriterAuthorityTokenV0(input)
    },
    storeRead: {
      getCommittedBundles: () => store.getCommittedBundles(),
      currentRevision: (subjectId: string) => store.currentRevision(subjectId),
      readCurrentBundle: (subjectId: string) => store.readCurrentBundle(subjectId),
      readCommittedByTransitionId: (transitionId: string) =>
        store.readCommittedByTransitionId(transitionId),
      readCurrentState: async (subjectId: string) => {
        const bundle = store.readCurrentBundle(subjectId);
        if (bundle !== null) return stateFromBundle(bundle);
        return seeds.get(subjectId as IdentifierV0) ?? null;
      }
    },
    journal
  };
}
