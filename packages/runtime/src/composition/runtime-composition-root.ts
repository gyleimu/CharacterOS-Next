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
import { InMemoryConversationDeliveryLedger, type ConversationDeliveryLedgerAuthority } from "../transitions/conversation/behavior-delivery-ledger.js";
import { createExperienceReaderV0 } from "../transitions/conversation/experience-reader.js";
import { FactualMemoryEvidenceResolverV0 } from "../transitions/cognition-action/factual-memory-evidence.js";
import { InMemoryConversationFactualEventAuthorityV0 } from "../authority/conversation-factual-event-authority-v0.js";
import { createExperienceAppraisalReaderV0 } from "../experience-appraisal/experience-appraisal-reader.js";
import type { ExperienceAppraisalProviderV0 } from "../experience-appraisal/experience-appraisal-reader.js";
import type { FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";
import type { InMemoryMemoryRepository } from "@characteros-next/memory";
import { InMemoryConversationIngressLedger, type ConversationIngressLedgerAuthority } from "../transitions/conversation/conversation-ingress-ledger.js";

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
  /**
   * EXPERIENCE_MEMORY_FUTURE_COGNITION_INTEGRATION_V0 — the CONCRETE memory
   * repository exposing the stored-payload read face. When provided, the
   * composition root wires the authoritative ExperienceReaderV0 (over the SAME
   * composition-owned delivery ledger the feedback authority uses) and the
   * factual memory evidence resolver. Omitted: cognition input stays exactly V0.
   */
  readonly experiencePayloadRepository?: InMemoryMemoryRepository;
  /**
   * EXPERIENCE_MEMORY_FUTURE_COGNITION_INTEGRATION_V0 — pre-restored ledger
   * instances (host called restoreState with its persisted export before
   * composition). When provided, the reader/resolver/feedback authority all
   * share THESE instances; otherwise fresh empty ledgers are constructed.
   */
  readonly deliveryLedger?: ConversationDeliveryLedgerAuthority;
  readonly ingressLedger?: ConversationIngressLedgerAuthority;
  /** EXPERIENCE_APPRAISAL_INTEGRATION_V0 — the host-supplied provider port. */
  readonly experienceAppraisalProvider?: ExperienceAppraisalProviderV0;
  /**
   * PRE_COGNITION_CANONICAL_APPRAISAL_V0 — factual-event appraisal provider.
   * Optional until the governed conversation path wires the pre-cognition
   * stage; the factual-event executor fails closed when null.
   */
  readonly factualEventAppraisalProvider?: FactualEventAppraisalProviderV0;
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
    // Composition-owned durable stores + authoritative reader/resolver (§20):
    // ONE delivery ledger instance feeds both the feedback authority and the
    // experience reader. The reader requires the concrete payload-read face.
    const deliveryLedger = options.deliveryLedger ?? new InMemoryConversationDeliveryLedger();
    const ingressLedger = options.ingressLedger ?? new InMemoryConversationIngressLedger();
    const experienceReader = options.experiencePayloadRepository !== undefined
      ? createExperienceReaderV0({ repository: options.experiencePayloadRepository, deliveryLedger })
      : null;
    const factualEvidenceResolver = experienceReader !== null
      ? new FactualMemoryEvidenceResolverV0({ reader: experienceReader, episodeContentReader: options.episodeContentReader ?? null, store: options.experiencePayloadRepository ?? null })
      : null;
    // PRE_COGNITION_CANONICAL_APPRAISAL_V0 — the composition-owned factual
    // event authority over the SAME ingress ledger + committed-transition
    // read face + experience/appraisal readers (one store, one truth).
    const appraisalReaderForAuthority = experienceReader !== null && options.experiencePayloadRepository !== undefined
      ? createExperienceAppraisalReaderV0({ repository: options.experiencePayloadRepository, experienceReader })
      : null;
    const factualEventAuthority = ingressLedger !== null && experienceReader !== null && appraisalReaderForAuthority !== null
      ? new InMemoryConversationFactualEventAuthorityV0(
          ingressLedger,
          { readCommittedBundle: async (id) => options.learningSourceAuthority?.readCommittedBundle(id) ?? null },
          experienceReader,
          appraisalReaderForAuthority
        )
      : null;
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
      conversationCognitionTransport: options.conversationCognitionTransport ?? null,
      // BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — composition-owned durable ledgers:
      // constructed HERE (never accepted from options), so feedback execution
      // reads authoritative stored truth instead of caller-supplied receipts.
      conversationDeliveryLedger: deliveryLedger,
      conversationIngressLedger: ingressLedger,
      // EXPERIENCE_MEMORY_FUTURE_COGNITION_INTEGRATION_V0 — the reader uses the
      // SAME composition-owned delivery ledger instance (one store, one truth).
      experienceReader: experienceReader,
      factualEvidenceResolver: factualEvidenceResolver,
      experienceAppraisalProvider: options.experienceAppraisalProvider ?? null,
      experienceAppraisalStore: options.experiencePayloadRepository ?? null,
      factualEventAuthority: factualEventAuthority,
      factualEventAppraisalProvider: options.factualEventAppraisalProvider ?? null
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
