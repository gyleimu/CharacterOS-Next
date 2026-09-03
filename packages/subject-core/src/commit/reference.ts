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
import type { IdentifierV0 } from "../types/scalars.js";
import type { AtomicCommitBundleAnyVersion } from "../types/persistence-v2.js";
import type { ReferenceValidatorCapability, MemoryAdoptionValidatorCapability } from "./engine.js";
import { InMemoryAtomicCommitStore } from "./store.js";
import { InMemoryTransitionIdentityJournal } from "../identity/journal.js";
import { SubjectCoreFacade, type SubjectCoreFacadePorts } from "./facade.js";
import {
  createProducerAuthorizationIssuer,
  type ProducerAuthorizationIssuer
} from "./producer-authorization.js";
import {
  mintPreparedGovernedWriterAuthorityTokenV0,
  type MintPreparedGovernedWriterAuthorityTokenInputV0,
  type PreparedGovernedWriterAuthorityTokenV0
} from "./writer-authority-membrane.js";

export interface InMemoryFacadeOptions {
  /** Verdict-only repository capability (defaults to accepting everything). */
  readonly referenceValidator?: ReferenceValidatorCapability;
  /**
   * R2-H (ATTACK F): verdict-only memory adoption proof. When omitted, ANY proposal
   * that changes the canonical memory binding fails closed at the engine.
   */
  readonly memoryAdoptionValidator?: MemoryAdoptionValidatorCapability;
  /** Optional seed snapshots by subject (default: none — subjects must exist). */
  readonly seedSnapshots?: ReadonlyMap<IdentifierV0, SubjectStateV0>;
  /**
   * Optional seed committed bundles (test/fixture affordance for historical
   * V1-only subjects): seeded in authority order before any new commit, so
   * post-cutover promotion tests can start from an authentic V1 history.
   */
  readonly seedBundles?: readonly AtomicCommitBundleAnyVersion[];
  /**
   * Trusted prepared-record verdict — REQUIRED. There is no default: a facade
   * without an explicit prepared-result gate must never be minted (fail closed,
   * ATTACK C closure).
   */
  readonly preparedResultValidator: SubjectCoreFacadePorts["preparedResultValidator"];
}

export interface ReadOnlyStoreHandle {
  getCommittedBundles(): readonly AtomicCommitBundleAnyVersion[];
  currentRevision(subjectId: string): number | null;
  readCurrentBundle(subjectId: string): AtomicCommitBundleAnyVersion | null;
  readCommittedByTransitionId(transitionId: string): AtomicCommitBundleAnyVersion | null;
  /**
   * Read-only current canonical snapshot (same authority the facade's own
   * StateReader uses: latest committed bundle snapshot, else the seed).
   * INTERACTION_FAMILIARITY_EXPERIENCE_INGESTION_V0 read surface.
   */
  readCurrentState(subjectId: string): Promise<SubjectStateV0 | null>;
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

export interface InMemoryFacadeAssembly {
  readonly facade: SubjectCoreFacade;
  readonly storeRead: ReadOnlyStoreHandle;
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

export function createInMemorySubjectCoreFacade(
  options: InMemoryFacadeOptions
): InMemoryFacadeAssembly {
  if (options.preparedResultValidator === undefined) {
    throw new Error(
      "createInMemorySubjectCoreFacade: preparedResultValidator is required (fail closed; §7.6)"
    );
  }
  const store = new InMemoryAtomicCommitStore();
  for (const seeded of options.seedBundles ?? []) {
    store.seedCommittedBundle(seeded);
  }
  const journal = new InMemoryTransitionIdentityJournal();
  const producerAuthorizationIssuer = createProducerAuthorizationIssuer();
  const seeds = options.seedSnapshots ?? new Map<IdentifierV0, SubjectStateV0>();

  const ports: SubjectCoreFacadePorts = {
    store,
    journal,
    stateReader: {
      async readCurrentSnapshot(subjectId: IdentifierV0): Promise<SubjectStateV0 | null> {
        const bundle = store.readCurrentBundle(subjectId);
        if (bundle !== null) return bundle.next_snapshot;
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
    facade: new SubjectCoreFacade(ports),
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
        if (bundle !== null) return bundle.next_snapshot;
        return seeds.get(subjectId as IdentifierV0) ?? null;
      }
    },
    journal
  };
}
