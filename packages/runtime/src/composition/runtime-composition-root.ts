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
import type { MemoryRepository } from "@characteros-next/memory";
import type {
  AppraisalPort,
  AffectProducerPort,
  InterpretationPort,
  RegulationProducerPort,
  RetrievalPort,
  SubjectCorePort
} from "../ports/index.js";

export interface RuntimeCompositionOptions {
  /** Required: canonical commit boundary + authoritative snapshot reads. */
  readonly subjectCore: SubjectCorePort;
  /** Required: immutable revision repository capability. */
  readonly memoryRepository: MemoryRepository;
  /** Required: deterministic retrieval seam. */
  readonly retrieval: RetrievalPort;
  /** Optional until their slices wire adapters. */
  readonly interpretation?: InterpretationPort;
  readonly appraisal?: AppraisalPort;
  readonly affectProducer?: AffectProducerPort;
  readonly regulationProducer?: RegulationProducerPort;
}

export class RuntimeCompositionRoot {
  private readonly container: RuntimeDependencyContainer;

  constructor(options: RuntimeCompositionOptions) {
    if (options.subjectCore === undefined) {
      throw new Error("composition error: subjectCore capability is required");
    }
    if (options.memoryRepository === undefined) {
      throw new Error("composition error: memoryRepository capability is required");
    }
    if (options.retrieval === undefined) {
      throw new Error("composition error: retrieval capability is required");
    }
    const assembled: RuntimeDependencyContainer = {
      subjectCore: options.subjectCore,
      memory: { repository: options.memoryRepository },
      retrieval: options.retrieval,
      interpretation: options.interpretation ?? null,
      appraisal: options.appraisal ?? null,
      affectProducer: options.affectProducer ?? null,
      regulationProducer: options.regulationProducer ?? null
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
