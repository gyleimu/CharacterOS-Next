/**
 * P2.3.1 — RuntimeDependencyContainer (boundary-layer type).
 *
 * The immutable dependency view assembled by RuntimeCompositionRoot and consumed by
 * future transition executors. Every member is an injected port/capability; the
 * container itself carries no behavior and is deeply frozen after assembly.
 *
 * `null` members are explicit "not yet wired" markers for later P2.3 slices — they are
 * NOT optional execution paths: executors that require them must treat null as a
 * composition error.
 */

import type {
  AppraisalPort,
  AffectProducerPort,
  CognitionProviderV0,
  ContextProducerPort,
  InterpretationPort,
  MemoryPort,
  RegulationProducerPort,
  RetrievalMetadataProducerPort,
  RetrievalPort,
  SubjectCorePort
} from "../ports/index.js";
import type { LearningSourceReadAuthority } from "../transitions/learning/learning-source-authority.js";
import type { LearningAdoptionAuthority } from "../transitions/learning/learning-adoption-authority.js";
import type { LanguageRealizationProviderV0 } from "../providers/behavior/language-realization-provider.js";
import type { EpisodeContentReaderV0 } from "@characteros-next/memory";
import type { ProducerAuthorizationIssuer } from "@characteros-next/subject-core";
import type { ModelTransportV0 } from "../transports/model-transport.js";

export interface RuntimeDependencyContainer {
  /** Canonical commit boundary + authoritative snapshot reads. */
  readonly subjectCore: SubjectCorePort;
  /** Trusted issuer minting producer-authorization capabilities verified by core. */
  readonly producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  /** Immutable revision repository: prepare/read/verdicts only (refs, no payloads). */
  readonly memory: MemoryPort;
  /** Deterministic retrieval seam backed by the memory repository capability. */
  readonly retrieval: RetrievalPort;

  /** Fixed-provider seams; null until their P2.3 slices wire real adapters. */
  readonly interpretation: InterpretationPort | null;
  readonly appraisal: AppraisalPort | null;
  readonly affectProducer: AffectProducerPort | null;
  readonly regulationProducer: RegulationProducerPort | null;
  /** Observation input → controlled projection + context delta (producer identity `context`). */
  readonly contextProducer: ContextProducerPort | null;
  /** Optional Observation retrieval-metadata trio producer (producer identity `memory`). */
  readonly retrievalMetadataProducer: RetrievalMetadataProducerPort | null;
  /**
   * P2-next — CognitionProviderV0 seam: proposals ONLY (schema/evidence/
   * action-space validated by the executor; canonical mutation impossible).
   * null = not yet wired; the CognitionAction executor fails closed.
   */
  readonly cognitionProvider: CognitionProviderV0 | null;
  /**
   * P2.3.5.3c — Learning trusted-source read authority (read-only committed-bundle
   * projection over the host's durable store); null until the Learning slice wires it.
   * Grants NO write surface: Learning's repository prepare capability remains the
   * separately projected MemoryPreparationAuthority.
   */
  readonly learningSourceAuthority: LearningSourceReadAuthority | null;
  /**
   * P2.3.5.3c — narrow adoption seam: exactly `markAdopted(candidateRevision)`,
   * invoked ONLY after the canonical commit has bound the candidate revision.
   * Grants NO revision/manifest/payload mutation surface. null = not yet wired;
   * the Learning executor fails closed on the wiring gate.
   */
  readonly learningAdoptionAuthority: LearningAdoptionAuthority | null;
  /**
   * PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0 — language realization provider
   * (ONE transport call, no retries). null = not wired; the conversation text
   * response executor fails closed when null. Never used by cognition-only
   * operations.
   */
  readonly languageRealizationProvider: LanguageRealizationProviderV0 | null;
  /**
   * PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0 — narrow read-only Memory episode
   * content capability (validated refs → immutable payload content). null =
   * not wired; the conversation text response executor fails closed when null.
   */
  readonly episodeContentReader: EpisodeContentReaderV0 | null;
  /**
   * STRUCTURED_COMMUNICATION_DIRECTIVE_V0 — conversation cognition transport
   * for the V1 conversation cognition provider (ONE call → nested cognition +
   * directive). null = not wired; the V1 conversation response executor fails
   * closed when null.
   */
  readonly conversationCognitionTransport: ModelTransportV0 | null;
}
