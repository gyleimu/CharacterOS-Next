/**
 * SUBJECT_ENVIRONMENT_PRODUCT_CONTINUITY_V0 + SUBJECT_CROSS_CONTEXT_PRODUCT_BRIDGE_V0 —
 * product host for ONE persistent subject living inside ONE declared
 * deterministic environment.
 *
 * Canonical subject state is read from and written to the ONE shared canonical
 * subject source (when configured); the environment checkpoint is a
 * CONTEXT SIDECAR that owns only environment lifecycle state (environment_state,
 * interaction index), never the canonical subject head. A sidecar is bound to
 * its declared `environment_id`.
 */

import {
  LongHorizonSubjectSessionV0 as SessionClass,
  captureSessionStoreImageV0,
  createInteractiveSubjectSeedV0,
  createLongHorizonSubjectSessionV0,
  rebuildSessionStoreSourceV0,
  type EnvironmentStateV0,
  type FactualEventAppraisalProviderV0,
  type LongHorizonSubjectSessionOptionsV0,
  type ModelTransportTraceV0,
  type ModelTransportV0,
  type SessionCheckpointV0,
  type SessionInteractionOutcomeV0,
  type SubjectEnvironmentV0,
  type SubjectSessionStatusV0
} from "@characteros-next/runtime";
import {
  ENVIRONMENT_CHECKPOINT_DOCUMENT_SCHEMA_VERSION,
  FileEnvironmentCheckpointStoreV0,
  type EnvironmentCheckpointDocumentV0,
  type EnvironmentCheckpointStoreV0
} from "./environment-checkpoint-store.js";
import {
  persistCanonicalSubjectV0,
  resolveCanonicalSubjectV0,
  type SharedSubjectSourceStoreV0
} from "./cross-context-canonical.js";
import { ReferenceReviewEnvironmentV0 } from "./reference-review-environment.js";

export interface EnvironmentSubjectHostConfigV0 {
  readonly subject_id: string;
  readonly display_name: string;
  readonly identity_anchors?: readonly string[];
  readonly session_id: string;
  readonly storage_root: string;
  readonly interaction_interval_ticks?: number;
}

export interface EnvironmentSubjectHostDepsV0 {
  readonly conversationCognitionTransport: ModelTransportV0;
  readonly languageTransport: ModelTransportV0;
  readonly factualEventAppraisalProvider: FactualEventAppraisalProviderV0;
  /** Override for tests; defaults to the product reference environment. */
  readonly environment?: SubjectEnvironmentV0;
  /** Override for tests; defaults to the file-backed sidecar store. */
  readonly checkpointStore?: EnvironmentCheckpointStoreV0;
  /**
   * SUBJECT_CROSS_CONTEXT_PRODUCT_BRIDGE_V0 — when supplied, the canonical
   * subject is read from and written to this ONE shared source; the environment
   * checkpoint becomes a non-authoritative sidecar.
   */
  readonly sharedSourceStore?: SharedSubjectSourceStoreV0;
  readonly provider_identity?: {
    readonly model: string;
    readonly num_predict: number;
    readonly context_window_tokens?: number;
    readonly last_trace?: () => ModelTransportTraceV0 | null;
  };
  readonly clock?: () => string;
}

export type EnvironmentSubjectResolutionV0 = "NEW_ENVIRONMENT_SUBJECT" | "ENVIRONMENT_SUBJECT_RESTORED";

export class EnvironmentSubjectRestoreErrorV0 extends Error {
  constructor(detail: string) {
    super(`Environment subject restore failed: ${detail}. Refusing to start a new subject.`);
    this.name = "EnvironmentSubjectRestoreErrorV0";
  }
}

export class WrongEnvironmentIdentityErrorV0 extends Error {
  constructor(expected: string, found: string) {
    super(
      `Environment sidecar belongs to environment ${found}, not the declared ${expected}; refusing to restore.`
    );
    this.name = "WrongEnvironmentIdentityErrorV0";
  }
}

export class EnvironmentSubjectHostV0 {
  private baseRevision: number | null;
  private lastCheckpointValue: SessionCheckpointV0 | null = null;
  private constructor(
    private readonly session: SessionClass,
    private readonly store: EnvironmentCheckpointStoreV0,
    private readonly environment: SubjectEnvironmentV0,
    private readonly resolutionValue: EnvironmentSubjectResolutionV0,
    private readonly sharedStore: SharedSubjectSourceStoreV0 | null,
    private readonly subjectId: string,
    baseRevision: number | null,
    private readonly clock: () => string
  ) {
    this.baseRevision = baseRevision;
  }

  static async open(
    config: EnvironmentSubjectHostConfigV0,
    deps: EnvironmentSubjectHostDepsV0
  ): Promise<EnvironmentSubjectHostV0> {
    const environment = deps.environment ?? new ReferenceReviewEnvironmentV0();
    const store =
      deps.checkpointStore ??
      new FileEnvironmentCheckpointStoreV0(config.storage_root, config.subject_id, environment.environment_id);
    const sharedStore = deps.sharedSourceStore ?? null;
    const clock = deps.clock ?? (() => new Date().toISOString());

    const options: LongHorizonSubjectSessionOptionsV0 = {
      subject: {
        subject_id: config.subject_id,
        display_name: config.display_name,
        identity_anchors: [...(config.identity_anchors ?? [])]
      },
      v3_source: createInteractiveSubjectSeedV0(
        config.subject_id,
        config.display_name,
        [...(config.identity_anchors ?? [])]
      ),
      conversationCognitionTransport: deps.conversationCognitionTransport,
      languageTransport: deps.languageTransport,
      factualEventAppraisalProvider: deps.factualEventAppraisalProvider,
      environment,
      session_id: config.session_id,
      interaction_interval_ticks: config.interaction_interval_ticks ?? 300,
      ...(deps.provider_identity === undefined ? {} : { provider_identity: deps.provider_identity }),
      clock
    };

    const loadedSidecar = await store.load();
    if (loadedSidecar.kind === "DOCUMENT" && loadedSidecar.document.environment_id !== environment.environment_id) {
      throw new WrongEnvironmentIdentityErrorV0(environment.environment_id, loadedSidecar.document.environment_id);
    }
    const resolution = await resolveCanonicalSubjectV0({
      sharedStore,
      storageRoot: config.storage_root,
      subjectId: config.subject_id,
      ownLegacy:
        loadedSidecar.kind === "DOCUMENT"
          ? {
              provenance: "ADOPTED_ENVIRONMENT",
              source_path: store.location() ?? "in-memory-environment-sidecar",
              subject_id: loadedSidecar.document.checkpoint.subject_id,
              head_ref: loadedSidecar.document.checkpoint.durable.identity.subject_head.commit_ref,
              durable: loadedSidecar.document.checkpoint.durable,
              store: loadedSidecar.document.store
            }
          : null
    });

    const session = await createLongHorizonSubjectSessionV0(options);
    if (resolution.kind === "CREATE_FRESH") {
      return new EnvironmentSubjectHostV0(
        session,
        store,
        environment,
        "NEW_ENVIRONMENT_SUBJECT",
        sharedStore,
        config.subject_id,
        null,
        clock
      );
    }

    const canonical = resolution.canonical;
    const source = await rebuildSessionStoreSourceV0(canonical.store).catch((error) => {
      throw new EnvironmentSubjectRestoreErrorV0(
        `store image rejected (${error instanceof Error ? error.message : String(error)})`
      );
    });
    const sidecar = loadedSidecar.kind === "DOCUMENT" ? loadedSidecar.document : null;
    const runtimeCheckpoint: SessionCheckpointV0 = {
      schema_version: "subject-session-checkpoint-v0",
      session_id: config.session_id,
      subject_id: config.subject_id,
      next_interaction_index: sidecar?.checkpoint.next_interaction_index ?? 0,
      completed_interactions: sidecar?.checkpoint.completed_interactions ?? 0,
      environment_state: sidecar?.checkpoint.environment_state ?? environment.exportState(),
      durable: canonical.durable,
      created_at: sidecar?.checkpoint.created_at ?? clock(),
      checkpoint_ref: sidecar?.checkpoint.checkpoint_ref ?? "sidecar:none"
    };
    let restore;
    try {
      restore = await session.restoreFromSource(runtimeCheckpoint, source as never);
    } catch (error) {
      throw new EnvironmentSubjectRestoreErrorV0(error instanceof Error ? error.message : String(error));
    }
    if (restore.kind !== "RESTORED") {
      throw new EnvironmentSubjectRestoreErrorV0(restore.detail ?? "restore not RESTORED");
    }
    const host = new EnvironmentSubjectHostV0(
      session,
      store,
      environment,
      "ENVIRONMENT_SUBJECT_RESTORED",
      sharedStore,
      config.subject_id,
      canonical.provenance === "SHARED" ? canonical.base_revision : null,
      clock
    );
    // Legacy adoption: publish the adopted canonical subject into the shared source.
    if (canonical.provenance !== "SHARED" && sharedStore !== null) {
      await host.persistCanonical();
    }
    return host;
  }

  resolution(): EnvironmentSubjectResolutionV0 {
    return this.resolutionValue;
  }

  /** Shared canonical subject revision this host last read/wrote (null before first persist). */
  sharedRevision(): number | null {
    return this.baseRevision;
  }

  /** Processes the NEXT deterministic environment interaction end to end. */
  async processNextInteraction(): Promise<SessionInteractionOutcomeV0> {
    const outcome = await this.session.processInteraction();
    if (outcome.status === "COMPLETE") {
      await this.persist();
    }
    return outcome;
  }

  /** True when the session has no outstanding mandatory lifecycle work. */
  isQuiescent(): boolean {
    return this.session.pendingWork().length === 0;
  }

  /** Captures and persists canonical (shared) + environment sidecar. */
  async persist(): Promise<SessionCheckpointV0> {
    const checkpoint = await this.session.checkpoint();
    const store = await captureSessionStoreImageV0(this.session.durableSource());
    if (this.sharedStore !== null) {
      const canonical = await persistCanonicalSubjectV0({
        sharedStore: this.sharedStore,
        subjectId: this.subjectId,
        durable: checkpoint.durable,
        store,
        expectedBaseRevision: this.baseRevision,
        updatedAt: this.clock()
      });
      this.baseRevision = canonical.base_revision;
    }
    const document: EnvironmentCheckpointDocumentV0 = {
      schema_version: ENVIRONMENT_CHECKPOINT_DOCUMENT_SCHEMA_VERSION,
      environment_id: this.environment.environment_id,
      base_revision: this.baseRevision,
      checkpoint,
      store
    };
    await this.store.save(document);
    this.lastCheckpointValue = checkpoint;
    return checkpoint;
  }

  /** Publishes the current canonical subject into the shared source only. */
  private async persistCanonical(): Promise<void> {
    if (this.sharedStore === null) return;
    const checkpoint = await this.session.checkpoint();
    const store = await captureSessionStoreImageV0(this.session.durableSource());
    const canonical = await persistCanonicalSubjectV0({
      sharedStore: this.sharedStore,
      subjectId: this.subjectId,
      durable: checkpoint.durable,
      store,
      expectedBaseRevision: this.baseRevision,
      updatedAt: this.clock()
    });
    this.baseRevision = canonical.base_revision;
  }

  lastCheckpoint(): SessionCheckpointV0 | null {
    return this.lastCheckpointValue;
  }

  environmentState(): EnvironmentStateV0 {
    return this.environment.exportState();
  }

  environmentId(): string {
    return this.environment.environment_id;
  }

  storageLocation(): string | null {
    return this.store.location();
  }

  status(): Promise<SubjectSessionStatusV0> {
    return this.session.status();
  }

  ledger(): readonly SessionInteractionOutcomeV0[] {
    return this.session.ledger();
  }
}
