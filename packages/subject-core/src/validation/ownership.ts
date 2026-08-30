/**
 * P2.1.2 — Producer → writable-path ownership matrix (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §7.2.
 * Enforces `Producer != Mutator`: producers only mint deltas for their owned paths;
 * subject-core (P2.1.3) remains the sole canonical mutator.
 */

import type { DomainName, ProducerName, TransitionType } from "../types/enums.js";
import type { WritableFieldPathV0, ReadonlyFieldPathV0 } from "../types/transition.js";
import { fail, ok, type ValidationResult } from "./result.js";

const SS_AUTH = "SS-AUTH-001";
const SCHEMA = "SS-SCHEMA-001";

const REGISTERED_PRODUCERS: readonly ProducerName[] = [
  "affect",
  "context",
  "memory",
  "regulation",
  "personality",
  "relationship"
];
const REGISTERED_DOMAINS: readonly DomainName[] = [
  "affect",
  "context",
  "memory-content",
  "memory-retrieval",
  "regulation",
  "personality",
  "relationship"
];

/** §7.2 registered `(producer,domain)` bindings. */
const REGISTERED_BINDINGS: ReadonlyArray<readonly [ProducerName, DomainName]> = [
  ["affect", "affect"],
  ["context", "context"],
  ["memory", "memory-content"],
  ["memory", "memory-retrieval"],
  ["regulation", "regulation"],
  ["personality", "personality"],
  ["relationship", "relationship"]
];

/** §7.2 writable-path ownership: path → owning `(producer,domain)` + allowed transitions. */
const OWNERSHIP: Readonly<
  Record<WritableFieldPathV0, { readonly producer: ProducerName; readonly domain: DomainName; readonly transitions: readonly TransitionType[] }>
> = {
  "/mood": { producer: "affect", domain: "affect", transitions: ["Time", "Observation"] },
  "/affect": { producer: "affect", domain: "affect", transitions: ["Time", "Observation"] },
  "/regulation": { producer: "regulation", domain: "regulation", transitions: ["Time", "CognitionAction"] },
  "/context": { producer: "context", domain: "context", transitions: ["Observation", "CognitionAction"] },
  "/memory_state/working_refs": { producer: "memory", domain: "memory-retrieval", transitions: ["Observation"] },
  "/memory_state/recent_retrieval_trace": { producer: "memory", domain: "memory-retrieval", transitions: ["Observation"] },
  "/memory_state/last_retrieval_at": { producer: "memory", domain: "memory-retrieval", transitions: ["Observation"] },
  "/memory_state/active_episode_refs": { producer: "memory", domain: "memory-content", transitions: ["Learning"] },
  "/memory_state/autobiographical_index_revision": { producer: "memory", domain: "memory-content", transitions: ["Learning"] },
  "/memory_state/repository_revision": { producer: "memory", domain: "memory-content", transitions: ["Learning"] },
  "/memory_state/consolidation_cursor": { producer: "memory", domain: "memory-content", transitions: ["Learning"] },
  "/memory_state/lifecycle_metadata": { producer: "memory", domain: "memory-content", transitions: ["Learning"] },
  "/personality": { producer: "personality", domain: "personality", transitions: ["Personality"] },
  "/relationships": {
    producer: "relationship",
    domain: "relationship",
    transitions: ["Relationship"]
  },
  "/memory_state/pending_encoding_refs": { producer: "memory", domain: "memory-content", transitions: ["Learning"] }
};

const READONLY_PATHS: readonly ReadonlyFieldPathV0[] = [
  "/schema_version",
  "/identity",
  "/traits_seed",
  "/beliefs",
  "/mechanism_config",
  "/trace_window",
  "/runtime_metadata"
];

export function isRegisteredProducer(p: string): p is ProducerName {
  return (REGISTERED_PRODUCERS as readonly string[]).includes(p);
}

export function isRegisteredDomain(d: string): d is DomainName {
  return (REGISTERED_DOMAINS as readonly string[]).includes(d);
}

export function isRegisteredBinding(p: ProducerName, d: DomainName): boolean {
  return REGISTERED_BINDINGS.some(([bp, bd]) => bp === p && bd === d);
}

export function isWritablePath(p: string): p is WritableFieldPathV0 {
  return Object.prototype.hasOwnProperty.call(OWNERSHIP, p);
}

export function isReadonlyPath(p: string): p is ReadonlyFieldPathV0 {
  return (READONLY_PATHS as readonly string[]).includes(p);
}

/**
 * Validate a `(producer, domain)` pair and, when a path is supplied, that the producer/domain
 * owns the path and the transition type is among the allowed transitions.
 *
 * - unknown/unregistered producer/domain → UNAUTHORIZED_PRODUCER (runtime/LLM cannot mint deltas);
 * - registered pair touching a path owned by a DIFFERENT pair → INVALID_TRANSITION_OWNER;
 * - readonly/classification path → FORBIDDEN_DIRECT_MUTATION;
 * - unknown path → INVALID_SCHEMA.
 */
export function validateOwnership(
  producer: string,
  domain: string,
  path: string,
  transition_type: TransitionType,
  detail: string
): ValidationResult<void> {
  if (!isRegisteredProducer(producer)) {
    return fail("UNAUTHORIZED_PRODUCER", SS_AUTH, `${detail}: producer not registered`);
  }
  if (!isRegisteredDomain(domain)) {
    return fail("UNAUTHORIZED_PRODUCER", SS_AUTH, `${detail}: domain not registered`);
  }
  if (!isRegisteredBinding(producer, domain)) {
    return fail("UNAUTHORIZED_PRODUCER", SS_AUTH, `${detail}: (${producer},${domain}) is not a registered binding`);
  }
  if (isReadonlyPath(path)) {
    return fail("FORBIDDEN_DIRECT_MUTATION", SS_AUTH, `${detail}: readonly/core-derived path ${path}`);
  }
  if (!isWritablePath(path)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${detail}: unknown field path ${path}`);
  }
  const owner = OWNERSHIP[path];
  if (owner.producer !== producer || owner.domain !== domain) {
    return fail("INVALID_TRANSITION_OWNER", SS_AUTH, `${detail}: ${path} owned by ${owner.producer}/${owner.domain}, not ${producer}/${domain}`);
  }
  if (!(owner.transitions as readonly string[]).includes(transition_type)) {
    return fail("INVALID_TRANSITION_OWNER", SS_AUTH, `${detail}: ${path} not writable by transition ${transition_type}`);
  }
  return ok(undefined);
}
