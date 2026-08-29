/**
 * Long-Term State Domain Boundary V0.
 *
 * This is an engineering ownership contract, not a scientific claim about a
 * complete psychological taxonomy. Applicability is explicit, non-exclusive,
 * and never authorizes an update. Each future state update still requires its
 * own domain-specific target, producer, transition, and canonical authority.
 *
 * PERSONALITY owns acquired, subject-global, cross-context slow disposition.
 * BELIEF is reserved for persistent proposition-specific state.
 * RELATIONSHIP is reserved for persistent counterpart-specific dyadic state.
 * Transient affect, mood, appraisal, cognition, and action are outside this set.
 */

import {
  fail,
  isRecord,
  ok,
  validateRefElement,
  type CanonicalRefV0,
  type ValidationResult
} from "@characteros-next/subject-core";

export const LONG_TERM_STATE_DOMAINS_V0 = Object.freeze([
  "PERSONALITY",
  "BELIEF",
  "RELATIONSHIP"
] as const);

export type LongTermStateDomainV0 = (typeof LONG_TERM_STATE_DOMAINS_V0)[number];

/** Every admitted set has one fixed semantic order and cardinality 0..3. */
export type LongTermStateDomainSetV0 =
  | readonly []
  | readonly ["PERSONALITY"]
  | readonly ["BELIEF"]
  | readonly ["RELATIONSHIP"]
  | readonly ["PERSONALITY", "BELIEF"]
  | readonly ["PERSONALITY", "RELATIONSHIP"]
  | readonly ["BELIEF", "RELATIONSHIP"]
  | readonly ["PERSONALITY", "BELIEF", "RELATIONSHIP"];

export type LongTermStateTargetV0 =
  | {
      readonly domain: "PERSONALITY";
      readonly target_kind: "SUBJECT_GLOBAL";
    }
  | {
      readonly domain: "BELIEF";
      readonly target_kind: "PROPOSITION";
      /** Generic canonical identity until proposition-specific authority exists. */
      readonly proposition_ref: CanonicalRefV0;
    }
  | {
      readonly domain: "RELATIONSHIP";
      readonly target_kind: "COUNTERPART";
      /** Existing entity/subject reference grammar identifies the counterpart. */
      readonly counterpart_ref: CanonicalRefV0;
    };

export const LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION =
  "long-term-state-domain-applicability-v0" as const;

/**
 * Explicit caller/config declaration only. It permits zero-to-many domains but
 * contains no target, delta, value, routing policy, or mutation capability.
 */
export interface LongTermStateDomainApplicabilityV0 {
  readonly schema_version: typeof LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION;
  readonly domains: LongTermStateDomainSetV0;
}

const REQUIREMENT = "SS-SCHEMA-001" as const;
const APPLICABILITY_KEYS: readonly string[] = ["schema_version", "domains"];
const PERSONALITY_TARGET_KEYS: readonly string[] = ["domain", "target_kind"];
const BELIEF_TARGET_KEYS: readonly string[] = ["domain", "target_kind", "proposition_ref"];
const RELATIONSHIP_TARGET_KEYS: readonly string[] = [
  "domain",
  "target_kind",
  "counterpart_ref"
];

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

export function validateLongTermStateDomainV0(
  value: unknown
): ValidationResult<LongTermStateDomainV0> {
  if (
    typeof value !== "string" ||
    !LONG_TERM_STATE_DOMAINS_V0.includes(value as LongTermStateDomainV0)
  ) {
    return fail("INVALID_SCHEMA", REQUIREMENT, "long_term_state_domain: unknown domain");
  }
  return ok(value as LongTermStateDomainV0);
}

export function canonicalizeLongTermStateDomainSetV0(
  value: unknown
): ValidationResult<LongTermStateDomainSetV0> {
  if (!Array.isArray(value)) {
    return fail("INVALID_SCHEMA", REQUIREMENT, "long_term_state_domains: expected array");
  }
  if (value.length > LONG_TERM_STATE_DOMAINS_V0.length) {
    return fail(
      "INVALID_VALUE_RANGE",
      REQUIREMENT,
      `long_term_state_domains: expected 0..${LONG_TERM_STATE_DOMAINS_V0.length} domains`
    );
  }

  const seen = new Set<LongTermStateDomainV0>();
  for (let index = 0; index < value.length; index++) {
    const checked = validateLongTermStateDomainV0(value[index]);
    if (!checked.ok) {
      return fail(
        checked.error.error_code,
        checked.error.reason,
        `long_term_state_domains[${index}]: ${checked.error.detail}`
      );
    }
    if (seen.has(checked.value)) {
      return fail(
        "INVALID_SCHEMA",
        REQUIREMENT,
        `long_term_state_domains[${index}]: duplicate domain ${checked.value}`
      );
    }
    seen.add(checked.value);
  }

  const canonical = LONG_TERM_STATE_DOMAINS_V0.filter((domain) => seen.has(domain));
  return ok(Object.freeze(canonical) as unknown as LongTermStateDomainSetV0);
}

export function validateLongTermStateTargetV0(
  value: unknown
): ValidationResult<LongTermStateTargetV0> {
  if (!isRecord(value)) {
    return fail("INVALID_SCHEMA", REQUIREMENT, "long_term_state_target: expected object");
  }

  const domain = validateLongTermStateDomainV0(value["domain"]);
  if (!domain.ok) return domain;

  if (domain.value === "PERSONALITY") {
    if (!exactKeys(value, PERSONALITY_TARGET_KEYS) || value["target_kind"] !== "SUBJECT_GLOBAL") {
      return fail(
        "INVALID_SCHEMA",
        REQUIREMENT,
        "long_term_state_target: PERSONALITY requires only SUBJECT_GLOBAL"
      );
    }
    return ok(Object.freeze({ domain: "PERSONALITY", target_kind: "SUBJECT_GLOBAL" }));
  }

  if (domain.value === "BELIEF") {
    if (!exactKeys(value, BELIEF_TARGET_KEYS) || value["target_kind"] !== "PROPOSITION") {
      return fail(
        "INVALID_SCHEMA",
        REQUIREMENT,
        "long_term_state_target: BELIEF requires one proposition_ref"
      );
    }
    const propositionRef = validateRefElement(
      value["proposition_ref"],
      "long_term_state_target.proposition_ref"
    );
    if (!propositionRef.ok) return propositionRef;
    return ok(
      Object.freeze({
        domain: "BELIEF",
        target_kind: "PROPOSITION",
        proposition_ref: propositionRef.value
      })
    );
  }

  if (!exactKeys(value, RELATIONSHIP_TARGET_KEYS) || value["target_kind"] !== "COUNTERPART") {
    return fail(
      "INVALID_SCHEMA",
      REQUIREMENT,
      "long_term_state_target: RELATIONSHIP requires one counterpart_ref"
    );
  }
  const counterpartRef = validateRefElement(
    value["counterpart_ref"],
    "long_term_state_target.counterpart_ref",
    ["entity", "subject"]
  );
  if (!counterpartRef.ok) return counterpartRef;
  return ok(
    Object.freeze({
      domain: "RELATIONSHIP",
      target_kind: "COUNTERPART",
      counterpart_ref: counterpartRef.value
    })
  );
}

export function validateLongTermStateDomainApplicabilityV0(
  value: unknown
): ValidationResult<LongTermStateDomainApplicabilityV0> {
  if (!isRecord(value) || !exactKeys(value, APPLICABILITY_KEYS)) {
    return fail(
      "INVALID_SCHEMA",
      REQUIREMENT,
      "long_term_state_domain_applicability: expected closed schema_version/domains object"
    );
  }
  if (value["schema_version"] !== LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION) {
    return fail(
      "INVALID_SCHEMA",
      REQUIREMENT,
      "long_term_state_domain_applicability.schema_version: invalid literal"
    );
  }
  const domains = canonicalizeLongTermStateDomainSetV0(value["domains"]);
  if (!domains.ok) return domains;
  return ok(
    Object.freeze({
      schema_version: LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
      domains: domains.value
    })
  );
}
