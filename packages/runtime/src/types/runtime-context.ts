/**
 * P2.3.1 — RuntimeContext (boundary-layer type).
 *
 * Identifies the canonical position a single runtime operation is anchored to. It is a
 * READ MODEL of subject-core truth — the runtime never derives or mutates these values;
 * they come from the authoritative snapshot via SubjectCorePort.
 */

import type { IdentifierV0, LogicalTimeV0, StateRevisionV0 } from "@characteros-next/subject-core";

export interface RuntimeContext {
  /** Canonical subject this operation is scoped to. */
  readonly subject_id: IdentifierV0;
  /** Authoritative canonical logical time at read position. */
  readonly current_logical_time: LogicalTimeV0;
  /** Authoritative state revision at read position. */
  readonly state_revision: StateRevisionV0;
}
