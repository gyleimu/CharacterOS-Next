/**
 * Historical Writer Authority Registry — CharacterOS-owned static registry
 * FOUNDATION
 * (ATOMIC_COMMIT_BUNDLE_V2_AUTHORITY_SCHEMA_FOUNDATION, LEVEL_2).
 *
 * This is a source-controlled, static, append-only-by-version architecture:
 *   - NO register() / add() / set() / delete()
 *   - NO mutable Map exposure, no plugin registration, no host validator
 *     callbacks (HOST_DYNAMIC_WRITER_AUTHORITY_REGISTRATION = NO)
 *   - deeply frozen exported surfaces
 *
 * AUTHORITY DISTINCTIONS (frozen):
 *   schema recognized  != gate authorized
 *                      != write policy authorized
 *                      != feature admitted
 *                      != canonical governed write capability
 *
 * The registry recognizes exactly ONE writer SCHEMA contract (the
 * Relationship governed feature writer-authority PAYLOAD SCHEMA), exactly ONE
 * CharacterOS-owned static AUTHORIZATION GATE, and exactly ONE CharacterOS-
 * owned static GOVERNED WRITE POLICY
 * (RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0). The write policy
 * REQUIRES positive feature admission, and the Relationship feature-semantics
 * registry still contains ZERO entries — so no production governed
 * Relationship write can be authorized through this registry
 * (PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY = NONE,
 * REGISTERED_RELATIONSHIP_DECISION_FEATURE_COUNT = 0).
 */

import type { HashV1 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import type {
  CanonicalWriterAuthorityRecordV0,
  CanonicalWriterClassV0,
  CanonicalWriterFamilyV0
} from "@characteros-next/subject-core";
import {
  RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
  RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
  resolveRegisteredRelationshipFeatureDecisionSemanticsV0
} from "../transitions/relationship/relationship-feature-decision-semantics.js";
import { validateRelationshipGovernedFeatureWriterAuthorityPayloadV0 } from "../transitions/relationship/relationship-governed-writer-authority.js";

// ---- recognized schema contract shape ----------------------------------------------

/** One CharacterOS-recognized writer PAYLOAD SCHEMA contract. */
export interface RecognizedWriterSchemaContractV0 {
  readonly writer_family: CanonicalWriterFamilyV0;
  readonly writer_schema_id: string;
  readonly writer_schema_fingerprint: HashV1;
  readonly allowed_writer_classes: readonly CanonicalWriterClassV0[];
}

// ---- Relationship governed writer PAYLOAD SCHEMA descriptor (§17) -------------------

export const RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0 =
  "relationship-governed-feature-writer-authority-payload-v0" as const;

export const RELATIONSHIP_GOVERNED_WRITER_SCHEMA_PROJECTION =
  "characteros-next/runtime/relationship-governed-writer-schema/v1" as const;

/**
 * CharacterOS-owned descriptor of the Relationship governed writer
 * authority PAYLOAD SCHEMA contract. Deterministic, source-controlled; it is
 * NOT a concrete feature, policy, semantics registration, or capability.
 */
export interface RelationshipGovernedWriterSchemaDescriptorV0 {
  readonly schema_id: typeof RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0;
  readonly payload_schema_version: "relationship-governed-feature-writer-authority-payload-v0";
  readonly writer_family: "RELATIONSHIP_GOVERNED_FEATURE";
  readonly relationship_state_schema_version: "relationship-state-v0";
  readonly reserved_dimension_prefix: "relationship_core_";
  readonly payload_field_count: 17;
  readonly durable_authority_level: "LEVEL_2";
}

export const RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0: RelationshipGovernedWriterSchemaDescriptorV0 =
  {
    schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
    payload_schema_version: "relationship-governed-feature-writer-authority-payload-v0",
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
    relationship_state_schema_version: "relationship-state-v0",
    reserved_dimension_prefix: "relationship_core_",
    payload_field_count: 17,
    durable_authority_level: "LEVEL_2"
  };
Object.freeze(RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0);

/** Deterministic descriptor fingerprint (no wall clock / randomness / env). */
export async function deriveRelationshipGovernedWriterSchemaFingerprintV0(): Promise<HashV1> {
  return hashEnvelope(
    RELATIONSHIP_GOVERNED_WRITER_SCHEMA_PROJECTION,
    RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0
  );
}

// ---- static registry (built once lazily; never exposed mutably) --------------------

interface RegistryEntryV0 {
  readonly contract: RecognizedWriterSchemaContractV0;
}

let registryCache: ReadonlyMap<string, RegistryEntryV0> | null = null;

async function getRegistry(): Promise<ReadonlyMap<string, RegistryEntryV0>> {
  if (registryCache === null) {
    const fingerprint = await deriveRelationshipGovernedWriterSchemaFingerprintV0();
    const map = new Map<string, RegistryEntryV0>();
    map.set(RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0, {
      contract: {
        writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
        writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
        writer_schema_fingerprint: fingerprint,
        allowed_writer_classes: ["INITIALIZE", "UPDATE", "REINITIALIZE"]
      }
    });
    registryCache = map;
  }
  return registryCache;
}

/** Frozen informational view of recognized writer SCHEMA contract ids. */
export const RECOGNIZED_WRITER_SCHEMA_CONTRACT_IDS_V0: readonly string[] = Object.freeze([
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0
]);

/**
 * Safe read-only getter for the recognized writer SCHEMA contracts (built
 * once with the real deterministic fingerprints). Schema recognition confers
 * no gate/policy/write authorization.
 */
export async function getRecognizedWriterSchemaContractsV0(): Promise<
  readonly RecognizedWriterSchemaContractV0[]
> {
  const registry = await getRegistry();
  return [...registry.values()].map((entry) => entry.contract);
}

/**
 * Pure lookup: recognizes a writer schema contract by EXACT schema id +
 * family + schema fingerprint. Unknown / mismatching → null (fail closed).
 * This is schema recognition only — NOT gate authorization, NOT policy
 * authorization, NOT a write capability.
 */
export async function resolveRecognizedWriterSchemaContractV0(input: {
  readonly writer_family: CanonicalWriterFamilyV0;
  readonly writer_schema_id: string;
  readonly writer_schema_fingerprint: string;
}): Promise<RecognizedWriterSchemaContractV0 | null> {
  const registry = await getRegistry();
  const entry = registry.get(input.writer_schema_id);
  if (entry === undefined) return null;
  if (entry.contract.writer_family !== input.writer_family) return null;
  if (entry.contract.writer_schema_fingerprint !== input.writer_schema_fingerprint) return null;
  return entry.contract;
}

// ---- §5 static authorization gate registry: exactly ONE CharacterOS gate ---------

/** Exact CharacterOS-owned gate id (no caller-supplied gate identity). */
export const RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0 =
  "relationship-governed-feature-writer-authorization-gate-v0" as const;

export const RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_PROJECTION =
  "characteros-next/runtime/relationship-governed-feature-authorization-gate/v1" as const;

/**
 * CharacterOS-owned static authorization gate descriptor. Deep frozen,
 * deterministically fingerprinted, closed. NOT a feature, NOT a policy, NOT a
 * write capability.
 */
export interface RelationshipGovernedFeatureAuthorizationGateDescriptorV0 {
  readonly gate_id: typeof RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0;
  readonly gate_schema_version: "relationship-governed-feature-writer-authorization-gate-v0";
  readonly writer_family: "RELATIONSHIP_GOVERNED_FEATURE";
  readonly governed_writer_schema_id: typeof RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0;
  readonly durable_authority_level: "LEVEL_2";
  readonly dynamic_registration: "FORBIDDEN";
}

export const RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_DESCRIPTOR_V0: RelationshipGovernedFeatureAuthorizationGateDescriptorV0 =
  {
    gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
    gate_schema_version: "relationship-governed-feature-writer-authorization-gate-v0",
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
    governed_writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
    durable_authority_level: "LEVEL_2",
    dynamic_registration: "FORBIDDEN"
  };
Object.freeze(RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_DESCRIPTOR_V0);

/** Deterministic gate descriptor fingerprint (no wall clock / randomness / env). */
export async function deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0(): Promise<HashV1> {
  return hashEnvelope(
    RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_PROJECTION,
    RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_DESCRIPTOR_V0
  );
}

/** One registered authorization gate (id + exact descriptor fingerprint). */
export interface RegisteredAuthorizationGateV0 {
  readonly authorization_gate_id: typeof RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0;
  readonly authorization_gate_fingerprint: HashV1;
  readonly descriptor: RelationshipGovernedFeatureAuthorizationGateDescriptorV0;
}

let gateRegistryCache: ReadonlyMap<string, RegisteredAuthorizationGateV0> | null = null;

async function getGateRegistry(): Promise<ReadonlyMap<string, RegisteredAuthorizationGateV0>> {
  if (gateRegistryCache === null) {
    const fingerprint = await deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0();
    const map = new Map<string, RegisteredAuthorizationGateV0>();
    map.set(RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0, {
      authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
      authorization_gate_fingerprint: fingerprint,
      descriptor: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_DESCRIPTOR_V0
    });
    gateRegistryCache = map;
  }
  return gateRegistryCache;
}

/**
 * Safe read-only getter for registered authorization gates. AUTHORIZATION_GATE_COUNT = 1.
 */
export async function getRegisteredAuthorizationGatesV0(): Promise<
  readonly RegisteredAuthorizationGateV0[]
> {
  const registry = await getGateRegistry();
  return [...registry.values()];
}

export type AuthorizationGateResolutionLayerV0 =
  | { readonly layer: "RESOLVED"; readonly gate: RegisteredAuthorizationGateV0 }
  | { readonly layer: "UNKNOWN"; readonly detail: string }
  | { readonly layer: "INVALID"; readonly detail: string };

/**
 * Exact fail-closed gate resolution: the gate id resolves ONLY against the
 * authorization-gate registry (never the schema/policy/feature registries).
 * Unknown id → UNKNOWN; known id with a fingerprint mismatch → INVALID.
 */
export async function resolveAuthorizationGateV0(input: {
  readonly authorization_gate_id: string;
  readonly authorization_gate_fingerprint: string;
}): Promise<AuthorizationGateResolutionLayerV0> {
  const registry = await getGateRegistry();
  const entry = registry.get(input.authorization_gate_id);
  if (entry === undefined) {
    return { layer: "UNKNOWN", detail: `authorization gate id ${input.authorization_gate_id} is not registered` };
  }
  if (entry.authorization_gate_fingerprint !== input.authorization_gate_fingerprint) {
    return { layer: "INVALID", detail: `authorization gate fingerprint mismatch for ${input.authorization_gate_id}` };
  }
  return { layer: "RESOLVED", gate: entry };
}

// ---- §6 static governed write policy registry: exactly ONE CharacterOS policy -----

/** Exact CharacterOS-owned policy id (no caller-supplied policy identity). */
export const RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0 =
  "relationship-governed-feature-write-policy-v0" as const;

export const RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_PROJECTION =
  "characteros-next/runtime/relationship-governed-feature-write-policy/v1" as const;

/**
 * CharacterOS-owned static governed write policy descriptor. Deep frozen,
 * deterministically fingerprinted, closed. CRITICAL: the policy REQUIRES
 * positive feature admission — with the feature registry at ZERO entries the
 * policy denies EVERY reserved target; it NEVER means "any relationship_core_*
 * is allowed".
 */
export interface RelationshipGovernedFeatureWritePolicyDescriptorV0 {
  readonly policy_id: typeof RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0;
  readonly policy_schema_version: "relationship-governed-feature-write-policy-v0";
  readonly writer_family: "RELATIONSHIP_GOVERNED_FEATURE";
  readonly authorization_gate_id: typeof RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0;
  readonly feature_admission_requirement: "POSITIVE_EXACT_REGISTERED_BINDING_REQUIRED";
  readonly feature_registry_count_at_policy_freeze: 0;
  readonly removal_support: "UNSUPPORTED";
  readonly reinitialize_support: "EXPLICIT_POLICY_PERMISSION_REQUIRED";
  readonly durable_authority_level: "LEVEL_2";
  readonly dynamic_registration: "FORBIDDEN";
}

export const RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0: RelationshipGovernedFeatureWritePolicyDescriptorV0 =
  {
    policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
    policy_schema_version: "relationship-governed-feature-write-policy-v0",
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
    authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
    feature_admission_requirement: "POSITIVE_EXACT_REGISTERED_BINDING_REQUIRED",
    feature_registry_count_at_policy_freeze: 0,
    removal_support: "UNSUPPORTED",
    reinitialize_support: "EXPLICIT_POLICY_PERMISSION_REQUIRED",
    durable_authority_level: "LEVEL_2",
    dynamic_registration: "FORBIDDEN"
  };
Object.freeze(RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0);

/** Deterministic policy descriptor fingerprint (no wall clock / randomness / env). */
export async function deriveRelationshipGovernedFeatureWritePolicyFingerprintV0(): Promise<HashV1> {
  return hashEnvelope(
    RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_PROJECTION,
    RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0
  );
}

/** One registered governed write policy (id + exact descriptor fingerprint). */
export interface RegisteredGovernedWritePolicyV0 {
  readonly write_policy_id: typeof RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0;
  readonly write_policy_fingerprint: HashV1;
  readonly descriptor: RelationshipGovernedFeatureWritePolicyDescriptorV0;
}

let policyRegistryCache: ReadonlyMap<string, RegisteredGovernedWritePolicyV0> | null = null;

async function getPolicyRegistry(): Promise<ReadonlyMap<string, RegisteredGovernedWritePolicyV0>> {
  if (policyRegistryCache === null) {
    const fingerprint = await deriveRelationshipGovernedFeatureWritePolicyFingerprintV0();
    const map = new Map<string, RegisteredGovernedWritePolicyV0>();
    map.set(RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0, {
      write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      write_policy_fingerprint: fingerprint,
      descriptor: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0
    });
    policyRegistryCache = map;
  }
  return policyRegistryCache;
}

/**
 * Safe read-only getter for registered governed write policies.
 * GOVERNED_WRITE_POLICY_COUNT = 1.
 */
export async function getRegisteredGovernedWritePoliciesV0(): Promise<
  readonly RegisteredGovernedWritePolicyV0[]
> {
  const registry = await getPolicyRegistry();
  return [...registry.values()];
}

export type GovernedWritePolicyResolutionLayerV0 =
  | { readonly layer: "RESOLVED"; readonly policy: RegisteredGovernedWritePolicyV0 }
  | { readonly layer: "UNKNOWN"; readonly detail: string }
  | { readonly layer: "INVALID"; readonly detail: string };

/**
 * Exact fail-closed policy resolution: the policy id/fingerprint resolve ONLY
 * against the governed-write-policy registry (never the schema/gate/feature
 * registries). Unknown id → UNKNOWN; known id with a fingerprint mismatch →
 * INVALID.
 */
export async function resolveGovernedWritePolicyV0(input: {
  readonly write_policy_id: string;
  readonly write_policy_fingerprint: string;
}): Promise<GovernedWritePolicyResolutionLayerV0> {
  const registry = await getPolicyRegistry();
  const entry = registry.get(input.write_policy_id);
  if (entry === undefined) {
    return { layer: "UNKNOWN", detail: `write policy id ${input.write_policy_id} is not registered` };
  }
  if (entry.write_policy_fingerprint !== input.write_policy_fingerprint) {
    return { layer: "INVALID", detail: `write policy fingerprint mismatch for ${input.write_policy_id}` };
  }
  return { layer: "RESOLVED", policy: entry };
}

// ---- §33/§34 static historical authority resolver ------------------------------------

/**
 * Writer-authority STATUS vocabulary (frozen — identical literals to the
 * chain validator's public surface). Defined here so the RESOLVER owns the
 * classification and the chain validator re-exports the type unchanged.
 */
export type HistoricalWriterAuthorityStatusV0 =
  | "NOT_PRESENT"
  | "RESOLVED_VALID"
  | "UNRESOLVED"
  | "RESOLVED_INVALID";

/**
 * Layer-level resolution detail (diagnostic; the chain validator consumes
 * ONLY the overall status so chain validity semantics are unchanged).
 */
export interface HistoricalWriterAuthorityResolutionV0 {
  readonly status: HistoricalWriterAuthorityStatusV0;
  readonly schema_layer: "RESOLVED" | "UNKNOWN" | "INVALID" | "PENDING";
  readonly gate_layer: "RESOLVED" | "UNKNOWN" | "INVALID" | "PENDING";
  readonly policy_layer: "RESOLVED" | "UNKNOWN" | "INVALID" | "PENDING";
  readonly feature_layer: "ADMITTED" | "UNADMITTED" | "PENDING";
}

/**
 * Static historical authority resolver (§33/§34 REPAIRED).
 *
 * Each identity family resolves ONLY against its own registry:
 *   1. writer_schema_id + writer_schema_fingerprint → writer-SCHEMA registry
 *   2. authorization_gate_id + authorization_gate_fingerprint → authorization-GATE registry
 *   3. authority_payload.write_policy_id + write_policy_fingerprint (validated
 *      through the family-owned closed payload schema) → governed-write-POLICY registry
 *   4. authority_payload.feature_semantics_contract_id + fingerprint → admitted
 *      FEATURE-semantics registry (ZERO entries: everything is UNADMITTED)
 *
 * REPAIR NOTE (§34): the pre-repair placeholder compared the write-policy
 * registry against `writer_schema_id` (the WRONG identity family) and never
 * consulted the admitted-feature registry; the direct executable regression
 * demonstrated that defect before this repair was applied. The resolver only
 * PRODUCES the frozen status vocabulary — chain validity law is unchanged.
 *
 * With the feature registry at ZERO entries a non-null Relationship governed
 * authority can NEVER classify RESOLVED_VALID (feature_layer stays
 * UNADMITTED → UNRESOLVED), exactly per §36.
 */
export async function classifyHistoricalWriterAuthorityStatusV0(
  writerAuthority: CanonicalWriterAuthorityRecordV0
): Promise<HistoricalWriterAuthorityResolutionV0> {
  const pending: HistoricalWriterAuthorityResolutionV0 = {
    status: "UNRESOLVED",
    schema_layer: "PENDING",
    gate_layer: "PENDING",
    policy_layer: "PENDING",
    feature_layer: "PENDING"
  };

  // 1. schema layer — exact id + family + fingerprint against the SCHEMA registry.
  const known = (await getRecognizedWriterSchemaContractsV0()).find(
    (contract) => contract.writer_schema_id === writerAuthority.writer_schema_id
  );
  if (known === undefined) {
    return { ...pending, status: "UNRESOLVED", schema_layer: "UNKNOWN" };
  }
  if (
    known.writer_family !== writerAuthority.writer_family ||
    known.writer_schema_fingerprint !== writerAuthority.writer_schema_fingerprint
  ) {
    return { ...pending, status: "RESOLVED_INVALID", schema_layer: "INVALID" };
  }

  // 2. gate layer — exact id + fingerprint against the GATE registry.
  const gate = await resolveAuthorizationGateV0({
    authorization_gate_id: writerAuthority.authorization_gate_id,
    authorization_gate_fingerprint: writerAuthority.authorization_gate_fingerprint
  });
  if (gate.layer === "UNKNOWN") {
    return { ...pending, status: "UNRESOLVED", schema_layer: "RESOLVED", gate_layer: "UNKNOWN" };
  }
  if (gate.layer === "INVALID") {
    return { ...pending, status: "RESOLVED_INVALID", schema_layer: "RESOLVED", gate_layer: "INVALID" };
  }

  // 3. policy layer — the payload's OWN write-policy identity family, validated
  // through the family-owned closed payload schema (structural corruption here
  // is known-invalid, not merely unresolved).
  const payload = validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(
    writerAuthority.authority_payload
  );
  if (!payload.ok) {
    return {
      ...pending,
      status: "RESOLVED_INVALID",
      schema_layer: "RESOLVED",
      gate_layer: "RESOLVED",
      policy_layer: "INVALID"
    };
  }
  const policy = await resolveGovernedWritePolicyV0({
    write_policy_id: payload.value.write_policy_id,
    write_policy_fingerprint: payload.value.write_policy_fingerprint
  });
  if (policy.layer === "UNKNOWN") {
    return {
      ...pending,
      status: "UNRESOLVED",
      schema_layer: "RESOLVED",
      gate_layer: "RESOLVED",
      policy_layer: "UNKNOWN"
    };
  }
  if (policy.layer === "INVALID") {
    return {
      ...pending,
      status: "RESOLVED_INVALID",
      schema_layer: "RESOLVED",
      gate_layer: "RESOLVED",
      policy_layer: "INVALID"
    };
  }

  // 4. feature layer — exact admitted feature-semantics binding (registry V0
  // has ZERO entries, so every record is UNADMITTED → never RESOLVED_VALID).
  try {
    resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
      domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
      source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
      dimension_id: payload.value.dimension_id,
      feature_semantics_contract_id: payload.value.feature_semantics_contract_id,
      feature_semantics_contract_fingerprint: payload.value.feature_semantics_contract_fingerprint
    });
    return {
      status: "RESOLVED_VALID",
      schema_layer: "RESOLVED",
      gate_layer: "RESOLVED",
      policy_layer: "RESOLVED",
      feature_layer: "ADMITTED"
    };
  } catch {
    return {
      ...pending,
      status: "UNRESOLVED",
      schema_layer: "RESOLVED",
      gate_layer: "RESOLVED",
      policy_layer: "RESOLVED",
      feature_layer: "UNADMITTED"
    };
  }
}

// ---- gate / policy registry views ---------------------------------------------------

/**
 * Authorization-gate registry view. RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0
 * registers exactly ONE CharacterOS-owned static gate.
 */
export const REGISTERED_AUTHORIZATION_GATE_IDS_V0: readonly string[] = Object.freeze([
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0
]);

/**
 * Governed Relationship write-policy registry view. Exactly ONE CharacterOS-
 * owned static policy (which itself requires positive feature admission).
 */
export const REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0: readonly string[] =
  Object.freeze([RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0]);

/** Frozen role literals for downstream claims/tests. */
export const HOST_DYNAMIC_WRITER_AUTHORITY_REGISTRATION_V0 = "NO" as const;
export const PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0 = "NONE" as const;
/**
 * Exactly ONE CharacterOS-owned static governed write policy exists. The
 * policy REQUIRES positive feature admission, so with the feature registry at
 * ZERO entries it still denies every reserved target — no production governed
 * Relationship write is authorized (PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY = NONE).
 */
export const GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0 = 1 as const;
