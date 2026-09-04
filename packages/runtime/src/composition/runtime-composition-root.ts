/**
 * P2.3.1 — RuntimeCompositionRoot: the ONLY trusted-capability assembly point.
 *
 * Responsibilities (frozen):
 * - receive trusted capabilities and adapter implementations from the host
 *   composition (product/sandbox later; tests today);
 * - validate required members and assemble one frozen RuntimeDependencyContainer
 *   SHELL;
 * - expose it read-only.
 *
 * Freeze semantics: only the container shell (and the runtime-created `memory`
 * wrapper) are frozen. Injected adapters are deliberately NOT frozen — they are
 * stateful implementations (stores, journals, repositories) whose lifecycle belongs
 * to the host composition.
 *
 * Hard non-responsibilities: this class executes NOTHING — no transitions, no MICL,
 * no workflow, no orchestration logic, no SubjectState mutation, no memory writes.
 * Transition executors arrive in later slices and consume `dependencies()`.
 */

import type {
  RuntimeDependencyContainer
} from "../types/runtime-dependency-container.js";
import { createMemoryPreparationAuthority } from "@characteros-next/memory";
import type { EpisodeContentReaderV0, MemoryPreparationAuthority } from "@characteros-next/memory";
import type { ProducerAuthorizationIssuer } from "@characteros-next/subject-core";
import type { ModelTransportV0 } from "../transports/model-transport.js";
import { LanguageRealizationProviderV0 } from "../providers/behavior/language-realization-provider.js";
import type {
  AppraisalPort,
  AffectProducerPort,
  CognitionProviderV0,
  ContextProducerPort,
  InterpretationPort,
  RegulationProducerPort,
  RetrievalMetadataProducerPort,
  RetrievalPort,
  SubjectCorePort
} from "../ports/index.js";
import type { LearningSourceReadAuthority } from "../transitions/learning/learning-source-authority.js";
import type { LearningAdoptionAuthority } from "../transitions/learning/learning-adoption-authority.js";

export interface RuntimeCompositionOptions {
  /** Required: canonical commit boundary + authoritative snapshot reads. */
  readonly subjectCore: SubjectCorePort;
  /**
   * Required: the trusted producer-authorization issuer whose verify verdict is
   * wired into `subjectCore` (ATTACK D closure). Executors mint capabilities
   * through it; there is no structural alternative.
   */
  readonly producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  /**
   * Required: the SANCTIONED intent-driven memory authority (R2-G closure). The
   * raw revision-minting surface is intentionally NOT part of this seam.
   */
  readonly memoryRepository: MemoryPreparationAuthority;
  /** Required: deterministic retrieval seam. */
  readonly retrieval: RetrievalPort;
  /** Optional until their slices wire adapters. */
  readonly interpretation?: InterpretationPort;
  readonly appraisal?: AppraisalPort;
  readonly affectProducer?: AffectProducerPort;
  readonly regulationProducer?: RegulationProducerPort;
  readonly contextProducer?: ContextProducerPort;
  readonly retrievalMetadataProducer?: RetrievalMetadataProducerPort;
  /**
   * P2-next — CognitionProviderV0 seam (proposals only). Optional until the
   * CognitionAction slice wiring; the executor fails closed when null.
   */
  readonly cognitionProvider?: CognitionProviderV0;
  /**
   * P2.3.5.3c — read-only committed-bundle projection for Learning trusted-source
   * validation (host-minted from its own durable store read face). Optional until
   * Learning wiring; the Learning executor fails closed when null.
   */
  readonly learningSourceAuthority?: LearningSourceReadAuthority;
  /**
   * P2.3.5.3c — host-minted narrow adoption projection (exactly
   * `markAdopted(revision)`) over its concrete repository. Required for the
   * successful Learning lifecycle; the executor fails closed when null.
   */
  readonly learningAdoptionAuthority?: LearningAdoptionAuthority;
  /**
   * PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0 — host-supplied model transport for
   * the language realization provider (ONE call per conversation response; no
   * retries). Omitted → languageRealizationProvider stays null and the
   * conversation text response executor fails closed. Cognition-only
   * operations never touch it.
   */
  readonly languageTransport?: ModelTransportV0;
  /**
   * PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0 — host-minted narrow episode content
   * reader over its concrete memory repository (memory package factory).
   * Omitted → episodeContentReader stays null and the conversation text
   * response executor fails closed.
   */
  readonly episodeContentReader?: EpisodeContentReaderV0;
  readonly conversationCognitionTransport?: ModelTransportV0;
}

export class RuntimeCompositionRoot {
  private readonly container: RuntimeDependencyContainer;

  constructor(options: RuntimeCompositionOptions) {
    if (options.subjectCore === undefined) {
      throw new Error("composition error: subjectCore capability is required");
    }
    if (options.producerAuthorizationIssuer === undefined) {
      throw new Error("composition error: producerAuthorizationIssuer capability is required");
    }
    if (options.memoryRepository === undefined) {
      throw new Error("composition error: memoryRepository capability is required");
    }
    if (options.retrieval === undefined) {
      throw new Error("composition error: retrieval capability is required");
    }
    const assembled: RuntimeDependencyContainer = {
      subjectCore: options.subjectCore,
      producerAuthorizationIssuer: options.producerAuthorizationIssuer,
      // BLOCKER B2 closure: NEVER retain the concrete repository object. The
      // runtime-facing handle is a fresh frozen projection exposing only the
      // sanctioned authority operations; any raw revision-minting surface carried
      // by the injected implementation is unreachable through dependencies().
      memory: { repository: createMemoryPreparationAuthority(options.memoryRepository) },
      retrieval: options.retrieval,
      interpretation: options.interpretation ?? null,
      appraisal: options.appraisal ?? null,
      affectProducer: options.affectProducer ?? null,
      regulationProducer: options.regulationProducer ?? null,
      contextProducer: options.contextProducer ?? null,
      retrievalMetadataProducer: options.retrievalMetadataProducer ?? null,
      cognitionProvider: options.cognitionProvider ?? null,
      learningSourceAuthority: options.learningSourceAuthority ?? null,
      learningAdoptionAuthority: options.learningAdoptionAuthority ?? null,
      languageRealizationProvider:
        options.languageTransport !== undefined
          ? new LanguageRealizationProviderV0(options.languageTransport)
          : null,
      episodeContentReader: options.episodeContentReader ?? null,
      conversationCognitionTransport: options.conversationCognitionTransport ?? null
    };
    // Freeze shell + runtime-created wrapper only; adapters stay live (see header).
    Object.freeze(assembled);
    Object.freeze(assembled.memory);
    this.container = assembled;
  }

  /** Read-only dependency view for future transition executors. */
  dependencies(): RuntimeDependencyContainer {
    return this.container;
  }
}
