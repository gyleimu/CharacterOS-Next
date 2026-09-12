/**
 * CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_V0 — product life operations.
 *
 * READ/WRITE composition over the EXISTING frozen seams so ONE product session
 * can exercise one subject's whole life without leaving the CLI:
 *   - `observe`     → `submitExternalObservationV0` (structured external ingress)
 *   - `time`        → `advanceSubjectTimeV0` (explicit canonical ticks)
 *   - `environment` → `EnvironmentSubjectHostV0` (deterministic environment)
 *   - state/life    → READ-ONLY projections over canonical state + Memory
 *
 * After any operation that advances the ONE shared canonical subject source, the
 * human host is re-adopted from that shared source so the same session continues
 * the same life. No canonical semantics change here: this is composition only.
 */

import type {
  BeliefSemanticTargetResolutionProviderV0,
  FactualEventAppraisalProviderV0,
  InteractiveSubjectStateViewV0,
  InteractiveSubjectStatusV0,
  LivedMemoryInspectionV0,
  ModelTransportTraceV0,
  ModelTransportV0,
  PersonalityAdaptationFactoryV0,
  RelationshipInteractionQualifyingAdmissionProviderV0,
  SessionInteractionOutcomeV0,
  SubjectEnvironmentV0,
  SubjectSessionStatusV0
} from "@characteros-next/runtime";
import type { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import type { SharedSubjectSourceStoreV0 } from "./cross-context-canonical.js";
import {
  submitExternalObservationV0,
  type ExternalObservationIngressOutcomeV0,
  type ExternalStructuredObservationRequestV0
} from "./external-observation-ingress.js";
import {
  advanceSubjectTimeV0,
  type AdvanceSubjectTimeResultV0
} from "./subject-time-advance.js";
import { EnvironmentSubjectHostV0 } from "./environment-subject-host.js";
import { ReferenceReviewEnvironmentV0 } from "./reference-review-environment.js";

export interface ProductLifeSubjectV0 {
  readonly subject_id: string;
  readonly display_name: string;
  readonly identity_anchors: readonly string[];
}

export interface ProductLifeOperationsConfigV0 {
  readonly storage_root: string;
  readonly subject: ProductLifeSubjectV0;
  readonly interaction_interval_ticks?: number;
}

export interface ProductLifeOperationsDepsV0 {
  readonly host: InteractiveSubjectHostV0;
  readonly sharedSourceStore: SharedSubjectSourceStoreV0;
  readonly conversationCognitionTransport: ModelTransportV0;
  readonly languageTransport: ModelTransportV0;
  readonly factualEventAppraisalProvider: FactualEventAppraisalProviderV0;
  readonly beliefSemanticProvider?: BeliefSemanticTargetResolutionProviderV0;
  readonly personalityAdaptationFactory?: PersonalityAdaptationFactoryV0;
  readonly relationshipFamiliarityAdmissionProvider?: RelationshipInteractionQualifyingAdmissionProviderV0;
  /** Override for tests; defaults to the product reference environment. */
  readonly environment?: SubjectEnvironmentV0;
  readonly provider_identity?: {
    readonly model: string;
    readonly num_predict: number;
    readonly context_window_tokens?: number;
    readonly last_trace?: () => ModelTransportTraceV0 | null;
  };
  readonly clock?: () => string;
}

export interface ProductEnvironmentRunV0 {
  readonly environment_id: string;
  readonly resolution: "NEW_ENVIRONMENT_SUBJECT" | "ENVIRONMENT_SUBJECT_RESTORED";
  readonly outcomes: readonly SessionInteractionOutcomeV0[];
  readonly status: SubjectSessionStatusV0;
}

export interface ProductStateViewV0 {
  readonly status: InteractiveSubjectStatusV0;
  readonly state: InteractiveSubjectStateViewV0;
  readonly shared_revision: number | null;
}

export interface ProductLifeViewV0 {
  readonly subject_id: string;
  readonly display_name: string;
  readonly origin: "NEW_SUBJECT" | "SUBJECT_RESTORED";
  readonly logical_time: number;
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly shared_revision: number | null;
  readonly affect: { readonly valence: number; readonly activation: number };
  readonly regulation: InteractiveSubjectStateViewV0["regulation"];
  readonly personality: InteractiveSubjectStateViewV0["personality"];
  readonly beliefs: InteractiveSubjectStateViewV0["beliefs"];
  readonly relationships: InteractiveSubjectStateViewV0["relationships"];
  readonly recent_memory: LivedMemoryInspectionV0;
}

export class ProductLifeOperationsV0 {
  constructor(
    private readonly config: ProductLifeOperationsConfigV0,
    private readonly deps: ProductLifeOperationsDepsV0
  ) {}

  private ingressDeps(): Parameters<typeof submitExternalObservationV0>[0] {
    return {
      sharedSourceStore: this.deps.sharedSourceStore,
      subject: {
        subject_id: this.config.subject.subject_id,
        display_name: this.config.subject.display_name,
        identity_anchors: [...this.config.subject.identity_anchors]
      },
      conversationCognitionTransport: this.deps.conversationCognitionTransport,
      languageTransport: this.deps.languageTransport,
      factualEventAppraisalProvider: this.deps.factualEventAppraisalProvider,
      ...(this.deps.beliefSemanticProvider === undefined
        ? {}
        : { beliefSemanticProvider: this.deps.beliefSemanticProvider }),
      ...(this.deps.personalityAdaptationFactory === undefined
        ? {}
        : { personalityAdaptationFactory: this.deps.personalityAdaptationFactory }),
      ...(this.deps.relationshipFamiliarityAdmissionProvider === undefined
        ? {}
        : { relationshipFamiliarityAdmissionProvider: this.deps.relationshipFamiliarityAdmissionProvider }),
      clock: this.deps.clock ?? (() => new Date().toISOString())
    };
  }

  /** Structured external observation → canonical ingress; then re-adopt shared state. */
  async observe(
    request: ExternalStructuredObservationRequestV0
  ): Promise<ExternalObservationIngressOutcomeV0> {
    const outcome = await submitExternalObservationV0(this.ingressDeps(), request);
    if (outcome.kind !== "CONFLICT") {
      await this.deps.host.reloadFromShared();
    }
    return outcome;
  }

  /** Explicit canonical ticks; then re-adopt shared state. */
  async time(ticks: number): Promise<AdvanceSubjectTimeResultV0> {
    const result = await advanceSubjectTimeV0({ ...this.ingressDeps() }, ticks);
    if (!result.no_op) {
      await this.deps.host.reloadFromShared();
    }
    return result;
  }

  /** Deterministic environment interactions against the SAME shared subject. */
  async environment(interactions: number): Promise<ProductEnvironmentRunV0> {
    const host = await EnvironmentSubjectHostV0.open(
      {
        subject_id: this.config.subject.subject_id,
        display_name: this.config.subject.display_name,
        identity_anchors: [...this.config.subject.identity_anchors],
        session_id: `product-environment-${this.config.subject.subject_id}`,
        storage_root: this.config.storage_root,
        interaction_interval_ticks: this.config.interaction_interval_ticks ?? 1
      },
      {
        conversationCognitionTransport: this.deps.conversationCognitionTransport,
        languageTransport: this.deps.languageTransport,
        factualEventAppraisalProvider: this.deps.factualEventAppraisalProvider,
        environment: this.deps.environment ?? new ReferenceReviewEnvironmentV0(),
        sharedSourceStore: this.deps.sharedSourceStore,
        ...(this.deps.beliefSemanticProvider === undefined
          ? {}
          : { beliefSemanticProvider: this.deps.beliefSemanticProvider }),
        ...(this.deps.personalityAdaptationFactory === undefined
          ? {}
          : { personalityAdaptationFactory: this.deps.personalityAdaptationFactory }),
        ...(this.deps.relationshipFamiliarityAdmissionProvider === undefined
          ? {}
          : { relationshipFamiliarityAdmissionProvider: this.deps.relationshipFamiliarityAdmissionProvider }),
        ...(this.deps.provider_identity === undefined ? {} : { provider_identity: this.deps.provider_identity }),
        clock: this.deps.clock ?? (() => new Date().toISOString())
      }
    );
    const outcomes: SessionInteractionOutcomeV0[] = [];
    for (let index = 0; index < interactions; index += 1) {
      const outcome = await host.processNextInteraction();
      outcomes.push(outcome);
      if (outcome.status !== "COMPLETE") break;
    }
    await this.deps.host.reloadFromShared();
    return {
      environment_id: host.environmentId(),
      resolution: host.resolution(),
      outcomes,
      status: await host.status()
    };
  }

  /** READ-ONLY canonical state view. */
  async stateView(): Promise<ProductStateViewV0> {
    return {
      status: await this.deps.host.status(),
      state: await this.deps.host.subjectStateView(),
      shared_revision: this.deps.host.sharedRevision()
    };
  }

  /** READ-ONLY one-life view composing status + canonical state + recent Memory. */
  async lifeView(): Promise<ProductLifeViewV0> {
    const status = await this.deps.host.status();
    const state = await this.deps.host.subjectStateView();
    const recentMemory = await this.deps.host.livedMemory({ limit: 5 });
    return {
      subject_id: status.subject_id,
      display_name: state.identity.display_name,
      origin: status.origin,
      logical_time: status.logical_time,
      state_revision: status.state_revision,
      repository_revision: status.repository_revision,
      shared_revision: this.deps.host.sharedRevision(),
      affect: state.affect,
      regulation: state.regulation,
      personality: state.personality,
      beliefs: state.beliefs,
      relationships: state.relationships,
      recent_memory: recentMemory
    };
  }
}
