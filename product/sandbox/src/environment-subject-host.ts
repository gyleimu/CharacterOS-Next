/**
 * SUBJECT_ENVIRONMENT_PRODUCT_CONTINUITY_V0 — product host for ONE persistent
 * subject living inside ONE declared deterministic environment.
 *
 * Thin product adapter over the ALREADY-FROZEN long-horizon session:
 *   environment interaction
 *   → Observation → Experience → Memory/Learning
 *   → cognition → language → delivery
 *   → environment consequence → BehaviorOutcome → Experience
 * with ONE authoritative restart bundle (`SessionCheckpointV0` + the existing
 * `SessionStoreImageV0`) persisted atomically after every completed
 * interaction.
 *
 * It owns no psychology, no Memory refs, no intent, no wording and no new
 * environment ontology. It never activates general production ActionIntent:
 * the environment consequence path is the frozen session's own.
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
import { ReferenceReviewEnvironmentV0 } from "./reference-review-environment.js";

export interface EnvironmentSubjectHostConfigV0 {
  readonly subject_id: string;
  readonly display_name: string;
  readonly identity_anchors?: readonly string[];
  readonly session_id: string;
  /** Deterministic local directory holding the durable restart bundle. */
  readonly storage_root: string;
  readonly interaction_interval_ticks?: number;
}

export interface EnvironmentSubjectHostDepsV0 {
  readonly conversationCognitionTransport: ModelTransportV0;
  readonly languageTransport: ModelTransportV0;
  readonly factualEventAppraisalProvider: FactualEventAppraisalProviderV0;
  /** Override for tests; defaults to the product reference environment. */
  readonly environment?: SubjectEnvironmentV0;
  /** Override for tests; defaults to the file-backed store under storage_root. */
  readonly checkpointStore?: EnvironmentCheckpointStoreV0;
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

export class EnvironmentSubjectHostV0 {
  private constructor(
    private readonly session: SessionClass,
    private readonly store: EnvironmentCheckpointStoreV0,
    private readonly environment: SubjectEnvironmentV0,
    private readonly resolutionValue: EnvironmentSubjectResolutionV0,
    private lastCheckpointValue: SessionCheckpointV0
  ) {}

  static async open(
    config: EnvironmentSubjectHostConfigV0,
    deps: EnvironmentSubjectHostDepsV0
  ): Promise<EnvironmentSubjectHostV0> {
    const store =
      deps.checkpointStore ?? new FileEnvironmentCheckpointStoreV0(config.storage_root, config.subject_id);
    const environment = deps.environment ?? new ReferenceReviewEnvironmentV0();
    const loaded = await store.load();

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
      ...(deps.clock === undefined ? {} : { clock: deps.clock })
    };
    const session = await createLongHorizonSubjectSessionV0(options);

    if (loaded.kind === "NONE") {
      return new EnvironmentSubjectHostV0(session, store, environment, "NEW_ENVIRONMENT_SUBJECT", {
        schema_version: "subject-session-checkpoint-v0",
        session_id: config.session_id,
        subject_id: config.subject_id,
        next_interaction_index: 0,
        completed_interactions: 0,
        environment_state: environment.exportState(),
        durable: {} as never,
        created_at: "",
        checkpoint_ref: ""
      });
    }

    // A fresh process has no live store: rebuild the durable store face from the
    // persisted image, then run the SAME authoritative restore law.
    let source;
    try {
      source = await rebuildSessionStoreSourceV0(loaded.document.store);
    } catch (error) {
      throw new EnvironmentSubjectRestoreErrorV0(
        `store image rejected (${error instanceof Error ? error.message : String(error)})`
      );
    }
    let restore;
    try {
      restore = await session.restoreFromSource(loaded.document.checkpoint, source as never);
    } catch (error) {
      // Fail closed (e.g. a checkpoint whose identity does not match the
      // configured subject): never fall through to a new subject.
      throw new EnvironmentSubjectRestoreErrorV0(
        error instanceof Error ? error.message : String(error)
      );
    }
    if (restore.kind !== "RESTORED") {
      throw new EnvironmentSubjectRestoreErrorV0(restore.detail ?? "restore not RESTORED");
    }
    return new EnvironmentSubjectHostV0(
      session,
      store,
      environment,
      "ENVIRONMENT_SUBJECT_RESTORED",
      loaded.document.checkpoint
    );
  }

  resolution(): EnvironmentSubjectResolutionV0 {
    return this.resolutionValue;
  }

  /** Processes the NEXT deterministic environment interaction end to end. */
  async processNextInteraction(): Promise<SessionInteractionOutcomeV0> {
    const outcome = await this.session.processInteraction();
    // A COMPLETE interaction advances the index; persist the ONE atomic
    // restart bundle (subject durable state + environment state + store image).
    if (outcome.status === "COMPLETE") {
      await this.persist();
    }
    return outcome;
  }

  /** Captures and persists the current authoritative restart bundle. */
  async persist(): Promise<SessionCheckpointV0> {
    const checkpoint = await this.session.checkpoint();
    const store = await captureSessionStoreImageV0(this.session.durableSource());
    const document: EnvironmentCheckpointDocumentV0 = {
      schema_version: ENVIRONMENT_CHECKPOINT_DOCUMENT_SCHEMA_VERSION,
      checkpoint,
      store
    };
    await this.store.save(document);
    this.lastCheckpointValue = checkpoint;
    return checkpoint;
  }

  lastCheckpoint(): SessionCheckpointV0 {
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
