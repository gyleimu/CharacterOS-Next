/**
 * P2.1.1 — Canonical transition proposal + domain delta types (§7.1–§7.2), types-only.
 * Source: docs/implementation/p2-1-contract-freeze.md §7.1–§7.2.
 */

import type {
  IdentifierV0,
  LogicalTimeV0,
  RepositoryRevisionIdV0,
  StateRevisionV0,
  TransitionIdV0
} from "./scalars.js";
import type { CanonicalRefV0 } from "./ref.js";
import type { DomainName, ProducerName, TransitionType } from "./enums.js";
import type {
  AffectV0,
  EmptyClosedObjectV0,
  MoodV0,
  RegulatoryStateV0,
  WorkingContextV0
} from "./subject-state.js";

/** §7.1 canonical time input — exactly one shape per transition class. */
export type TimeInputV1 =
  | { readonly kind: "ELAPSED"; readonly elapsed_time: ElapsedDurationV1 }
  | { readonly kind: "OCCURRENCE"; readonly occurrence_logical_time: LogicalTimeV0 };

/** §7.1 nonnegative safe-integer tick duration. */
export interface ElapsedDurationV1 {
  readonly value: LogicalTimeV0;
  readonly unit: "tick";
}

/** §7.1 CanonicalTransitionProposalV1 — every key required, no semantic metadata. */
export interface CanonicalTransitionProposalV1 {
  readonly schema_version: "canonical-transition-proposal-v1";
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly transition_type: TransitionType;
  readonly expected_state_revision: StateRevisionV0;
  readonly time_input: TimeInputV1;
  readonly cause_refs: readonly CanonicalRefV0[];
  readonly domain_deltas: readonly DomainDeltaV0[];
  readonly external_refs: readonly CanonicalRefV0[];
}

/** §7.2 DomainDeltaV0 (closed). */
export interface DomainDeltaV0 {
  readonly producer: IdentifierV0;
  readonly domain: DomainName;
  readonly expected_repository_revision: RepositoryRevisionIdV0 | null;
  readonly operations: readonly FieldReplacementV0[];
  readonly provenance_refs: readonly CanonicalRefV0[];
}

/** §7.2 FieldReplacementV0 — discriminated union; `value` must match the exact path type. */
export type FieldReplacementV0 =
  | { readonly path: "/mood"; readonly value: MoodV0 }
  | { readonly path: "/affect"; readonly value: AffectV0 }
  | { readonly path: "/regulation"; readonly value: RegulatoryStateV0 }
  | { readonly path: "/context"; readonly value: WorkingContextV0 }
  | { readonly path: "/memory_state/working_refs"; readonly value: readonly CanonicalRefV0[] }
  | { readonly path: "/memory_state/recent_retrieval_trace"; readonly value: readonly CanonicalRefV0[] }
  | { readonly path: "/memory_state/last_retrieval_at"; readonly value: LogicalTimeV0 | null }
  | { readonly path: "/memory_state/active_episode_refs"; readonly value: readonly CanonicalRefV0[] }
  | { readonly path: "/memory_state/autobiographical_index_revision"; readonly value: RepositoryRevisionIdV0 | null }
  | { readonly path: "/memory_state/repository_revision"; readonly value: RepositoryRevisionIdV0 }
  | { readonly path: "/memory_state/consolidation_cursor"; readonly value: LogicalTimeV0 | null }
  | { readonly path: "/memory_state/lifecycle_metadata"; readonly value: EmptyClosedObjectV0 }
  | { readonly path: "/memory_state/pending_encoding_refs"; readonly value: readonly CanonicalRefV0[] };

/**
 * §7.2 FieldPathV0: the union of every classified literal. The writable subset is the 13
 * FieldReplacementV0 paths; the read-only set (§7.2 readonly/core-derived classifications)
 * is enumerated separately for the P2.1.2 ownership check.
 */
export type WritableFieldPathV0 = FieldReplacementV0["path"];

export type ReadonlyFieldPathV0 =
  | "/schema_version"
  | "/identity"
  | "/traits_seed"
  | "/beliefs"
  | "/relationships"
  | "/mechanism_config"
  | "/trace_window"
  | "/runtime_metadata";

export type CanonicalFieldPathV0 = WritableFieldPathV0 | ReadonlyFieldPathV0;

/**
 * §7.1 ProducerAuthorizationSetV1 — trusted invocation capability supplied by the
 * composition root, NOT a proposal field and NOT hash/persistence data. Closed
 * `{bindings:[{producer,domain}]}`; entries use registered producer/domain literals,
 * are unique and sorted by `(producer,domain)`, and for one request must equal EXACTLY
 * the distinct `(producer,domain)` set in `domain_deltas`. Only the host composition
 * can construct an instance; a payload merely claiming a producer string without the
 * matching authenticated capability is UNAUTHORIZED_PRODUCER.
 */
export interface ProducerAuthorizationSetV1 {
  readonly schema_version: "producer-authorization-set-v1";
  readonly bindings: readonly {
    readonly producer: ProducerName;
    readonly domain: DomainName;
  }[];
}
