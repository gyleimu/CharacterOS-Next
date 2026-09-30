/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D4-C0a REVISION 2 — THE FROZEN TRANSFORMER CONTRACT. FROZEN. ZERO MODEL CALLS.
 *
 * THE GAP THIS CLOSES
 *   Revision 0 and revision 1 froze the base system text, the contract text, the schema, the binding
 *   renderer and the normalisation — every byte of the model-facing payload — but never froze a
 *   TRANSFORMER CONTRACT: no name, no explicit substitution/append rule, no fail-closed list. This
 *   round's own §1 requires the implementation to use a name taken from the frozen contract, and no such
 *   name existed.
 *
 *   It is a documentation gap, not scientific freedom: the payload was already fully determined. The
 *   frozen base text says "The user message states: proposition A, …", which fixes the binding block to
 *   the user message; the frozen contract text opens with "The output-format rules above are SUPERSEDED
 *   for this invocation", which presupposes it is appended after output-format rules — the system
 *   message. What was missing was the name and the explicit fail-closed specification, both of which are
 *   engineering facts with no bearing on the construct.
 *
 *   Found at: model_calls_before_amendment = 0, qualification outputs seen = false, target outputs seen =
 *   false.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import {
  D4C0A_BASE_SYSTEM_TEXT,
  D4C0A_CONTRACT_TEXT,
  D4C0A_JSON_SCHEMA,
  D4_HASH_PROJECTION_V0
} from "./contract.ts";
import { D4_REVISION_0_MANIFEST_HASH } from "./contract-rev1-directional-majority.ts";

export const D4_VERSION_REV2 = "belief-cross-expression-composition-d4-rev2" as const;

export const D4_REVISION_1_MANIFEST_HASH =
  "sha256:66afec1d5b574aab1444dc719d29cd81527d50852e9d68c4905405580ac01d4b" as const;

export const D4C0A_TRANSFORMER_CONTRACT = Object.freeze({
  name: "buildD4C0AStanceTransferRequestV0",
  input:
    "a state-blind base request { messages: [system = the frozen base system text, user = the frozen binding block for one arm or fixture], structured_output = kind JSON_SCHEMA }",
  append: "the frozen contract text is appended to the SYSTEM message exactly once, the frozen base system text surviving as a byte-exact prefix",
  substitution: "structured_output.schema is replaced by the frozen D4-C0a schema exactly once",
  binding_placement: "the binding block stays the whole user message, unchanged, because the frozen base text states that the user message carries it",
  preserves_the_base_prefix_byte_for_byte: true,
  fails_closed_on: [
    "a base whose system content already carries the contract text (already transformed)",
    "a base whose structured_output.schema is already the frozen D4-C0a schema",
    "a base that is not exactly one system message followed by one user message",
    "a base whose user content is not a rendered binding block",
    "a system content carrying any other research measurement contract",
    "a binding block that does not contain each of the four binding lines exactly once"
  ],
  transformer_on_transformer: false,
  decision_probe_v2_reused: false,
  a1_or_d2_or_d3_contract_reused: false,
  what_it_may_not_do: [
    "rewrite the scientific contract",
    "change any wording of the frozen text",
    "add a helpful explanation",
    "add an expected mapping",
    "add a treatment-specific hint",
    "copy any additional instruction from the A1, D2 or D3 contracts"
  ],
  implementation_is_a_rendering_of_the_frozen_specification: true
});

export const D4C0A_TRANSFORMER_GAP = Object.freeze({
  verdict: "D4_C0A_TRANSFORMER_CONTRACT_NOT_PREVIOUSLY_FROZEN",
  what_existed: [
    "the base system text",
    "the contract text",
    "the schema",
    "the anchors",
    "the token vocabulary",
    "the binding renderer",
    "the normalisation"
  ],
  what_was_missing: ["a transformer name", "an explicit substitution/append rule", "an explicit fail-closed list"],
  why_the_payload_was_already_determined:
    "the frozen base text states where the binding block goes, and the frozen contract text presupposes it is appended after output-format rules",
  scientific_freedom_in_the_gap: false,
  model_calls_before_amendment: 0,
  qualification_outputs_seen_before_amendment: false,
  target_outputs_seen_before_amendment: false,
  resolution: "the contract is frozen here, before the implementation and before any call"
});

// =============================================================================================
// MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D4Rev2ManifestV0 {
  readonly version: typeof D4_VERSION_REV2;
  readonly gap: typeof D4C0A_TRANSFORMER_GAP;
  readonly transformer_contract: typeof D4C0A_TRANSFORMER_CONTRACT;
  readonly frozen_base_system_text_hash: HashV1;
  readonly frozen_contract_text_hash: HashV1;
  readonly frozen_schema_hash: HashV1;
  readonly supersedes_scope: readonly string[];
  readonly revision_1_manifest_hash_preserved: string;
  readonly revision_0_manifest_hash_preserved: string;
  readonly scientific_content_unchanged: true;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD4Rev2ManifestV0(): Promise<D4Rev2ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };
  check(D4C0A_TRANSFORMER_CONTRACT.name === "buildD4C0AStanceTransferRequestV0", "the transformer name changed");
  check(D4C0A_TRANSFORMER_CONTRACT.fails_closed_on.length === 6, "the fail-closed list is incomplete");
  check(D4C0A_TRANSFORMER_CONTRACT.what_it_may_not_do.length === 6, "the prohibition list is incomplete");
  check(!D4C0A_TRANSFORMER_CONTRACT.transformer_on_transformer, "transformer-on-transformer is allowed");
  check(D4C0A_TRANSFORMER_GAP.model_calls_before_amendment === 0, "calls were spent before the amendment");
  check(!D4C0A_TRANSFORMER_GAP.qualification_outputs_seen_before_amendment, "qualification outputs existed");
  check(!D4C0A_TRANSFORMER_GAP.target_outputs_seen_before_amendment, "target outputs existed");
  check(!D4C0A_TRANSFORMER_GAP.scientific_freedom_in_the_gap, "the gap is claimed to have contained scientific freedom");
  check(D4C0A_BASE_SYSTEM_TEXT.includes("The user message states"), "the base text no longer fixes the binding placement");
  check(D4C0A_CONTRACT_TEXT.includes("The output-format rules above are SUPERSEDED"), "the contract text no longer presupposes an append point");
  check(D4C0A_JSON_SCHEMA["required"] !== undefined, "the frozen schema has no required list");
  if (problems.length > 0) throw new Error(`D4_C0A_REV2_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    transformer_name: D4C0A_TRANSFORMER_CONTRACT.name,
    fail_closed_conditions: D4C0A_TRANSFORMER_CONTRACT.fails_closed_on.length,
    prohibitions: D4C0A_TRANSFORMER_CONTRACT.what_it_may_not_do.length,
    gap_found_at_model_calls: 0,
    scientific_content_changed: false,
    verification_cost: 0
  };

  const body = {
    version: D4_VERSION_REV2,
    gap: D4C0A_TRANSFORMER_GAP,
    transformer_contract: D4C0A_TRANSFORMER_CONTRACT,
    supersedes_scope: [
      "the transformer contract (name, substitution/append rule, fail-closed list) — previously absent"
    ] as const,
    revision_1_manifest_hash_preserved: D4_REVISION_1_MANIFEST_HASH,
    revision_0_manifest_hash_preserved: D4_REVISION_0_MANIFEST_HASH,
    scientific_content_unchanged: true as const,
    tests
  };
  return Object.freeze({
    ...body,
    frozen_base_system_text_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, { base_system_text: D4C0A_BASE_SYSTEM_TEXT }),
    frozen_contract_text_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, { contract_text: D4C0A_CONTRACT_TEXT }),
    frozen_schema_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, { schema: D4C0A_JSON_SCHEMA }),
    manifest_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, body)
  });
}
