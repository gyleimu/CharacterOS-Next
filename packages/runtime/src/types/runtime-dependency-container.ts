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
  ContextProducerPort,
  InterpretationPort,
  MemoryPort,
  RegulationProducerPort,
  RetrievalMetadataProducerPort,
  RetrievalPort,
  SubjectCorePort
} from "../ports/index.js";
import type { ProducerAuthorizationIssuer } from "@characteros-next/subject-core";

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
}
