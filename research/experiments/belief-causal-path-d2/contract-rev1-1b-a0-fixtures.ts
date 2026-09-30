/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D2 REVISION 1.1b — A0 QUALIFICATION FIXTURES + TRANSFORMER CONTRACT. FROZEN. NOT RUN.
 * ZERO MODEL CALLS.
 *
 * WHY THIS FILE EXISTS
 *   REVISION 1.1a authorised "A0 instrument qualification, exactly 9 calls", but an audit of the
 *   frozen contracts found three things that were NOT actually frozen:
 *
 *     1. the A0 qualification fixtures existed only as KINDS
 *        (["explicit strong endorsement", "explicit undecided", "explicit strong doubt"]),
 *        never as literal stimulus bytes;
 *     2. no expected-token mapping existed anywhere, although the qualification rule is stated in
 *        terms of "the fixture's pre-registered expected token";
 *     3. `buildD2StructuralReadoutRequestV0` was only NAMED in D2_TRANSFORMER_LAWS, never specified.
 *
 *   Running the 9 qualification calls in that state would have meant authoring the stimuli, the
 *   answer key and the instrument at execution time — with the same actor writing both the
 *   fixtures and the tokens they are scored against. This file freezes all three BEFORE any call.
 *
 * SCOPE: A0 qualification fixtures, their expected tokens, and the A0 transformer contract only.
 * The scientific design is unchanged: causal graph, A0/A1/B contracts, anchors, closed sets,
 * r_confirm mapping, localisation matrix, verdict vocabulary and claim scope are untouched, and
 * REVISION 1 / 1.1 / 1.1a hashes are preserved.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import { D2_HASH_PROJECTION_V0, D2A0_ANCHORS, D2A0_TOKENS, type D2A0Token } from "./contract-rev1.ts";

export const D2_VERSION_REV1_1B = "belief-causal-path-d2-rev1.1b" as const;

export const D2_REVISION_1_1A_MANIFEST_HASH =
  "sha256:eb08f5dc08f754fdffeba923367360cacbff1cb609e7619748cfc6407daeddc1" as const;

// =============================================================================================
// FROZEN A0 QUALIFICATION FIXTURES (literal bytes)
// =============================================================================================

/**
 * A fixture presents a SYNTHETIC subject-state-like belief line about a proposition that has
 * nothing to do with the CAUTION proposition, plus the frozen readout question. It is state-blind
 * in the sense that matters: no CharacterOS canonical state, no arm, no treatment, and no
 * experimental credence (the experimental values 0.80 / 0.20 / 0.50 never appear).
 */
export interface D2A0QualificationFixtureV0 {
  readonly fixture_id: string;
  readonly kind: string;
  readonly belief_line: string;
  readonly expected_token: D2A0Token;
}

const READOUT_QUESTION =
  "Which bucket describes the subject's stance on the proposition shown in the belief line?";

export const D2A0_QUALIFICATION_FIXTURES: readonly D2A0QualificationFixtureV0[] = Object.freeze([
  Object.freeze({
    fixture_id: "A0-QF-A-STRONG-ENDORSEMENT",
    kind: "explicit strong endorsement",
    belief_line:
      'showing 1 of 1 canonical belief item(s)\n  {"proposition_id":"fixture:a0-qf-a","proposition_label":"A clamp should always be used when gluing a joint.","credence":0.95}',
    expected_token: "ENDORSES_STRONGLY"
  }),
  Object.freeze({
    fixture_id: "A0-QF-B-UNDECIDED",
    kind: "explicit undecided",
    belief_line:
      'showing 1 of 1 canonical belief item(s)\n  {"proposition_id":"fixture:a0-qf-b","proposition_label":"A clamp should always be used when gluing a joint.","credence":0.49}',
    expected_token: "UNDECIDED"
  }),
  Object.freeze({
    fixture_id: "A0-QF-C-STRONG-DOUBT",
    kind: "explicit strong doubt",
    belief_line:
      'showing 1 of 1 canonical belief item(s)\n  {"proposition_id":"fixture:a0-qf-c","proposition_label":"A clamp should always be used when gluing a joint.","credence":0.06}',
    expected_token: "DOUBTS_STRONGLY"
  })
]);

/** Every fixture proposition is identical and unrelated to CAUTION, so the only varying cue is the credence. */
export const D2A0_QUALIFICATION_INVARIANTS = Object.freeze({
  all_fixtures_share_one_proposition: true,
  proposition_is_unrelated_to_caution: true,
  only_the_credence_varies_between_fixtures: true,
  uses_characteros_canonical_state: false,
  contains_treatment: false,
  experimental_credences_0_80_0_20_0_50_present: false,
  fixture_credences: [0.95, 0.49, 0.06]
});

/**
 * The frozen output contract text. It states the scale and the required member; it never names a
 * target bucket for any state, never mentions a credence, and never uses an action token.
 */
export const D2A0_CONTRACT_TEXT: string = [
  "",
  "--- DECISION PROBE STRUCTURAL READOUT CONTRACT (research instrument; binding for THIS invocation) ---",
  "The output-format rules above are SUPERSEDED for this invocation. Nothing else changes:",
  "every SUBJECT DATA law, every untrusted-content law and every evidence law above still binds.",
  "Respond with EXACTLY ONE JSON object and nothing else. No prose, no code fences.",
  "Required members:",
  '  "d2_readout_schema_version": "d2-a0-structural-readout-v0"',
  '  "stance": one of "ENDORSES_STRONGLY" | "ENDORSES_MILDLY" | "UNDECIDED" | "DOUBTS_MILDLY" | "DOUBTS_STRONGLY"',
  "Bucket meanings (binding):",
  `  ENDORSES_STRONGLY — ${D2A0_ANCHORS.ENDORSES_STRONGLY}`,
  `  ENDORSES_MILDLY — ${D2A0_ANCHORS.ENDORSES_MILDLY}`,
  `  UNDECIDED — ${D2A0_ANCHORS.UNDECIDED}`,
  `  DOUBTS_MILDLY — ${D2A0_ANCHORS.DOUBTS_MILDLY}`,
  `  DOUBTS_STRONGLY — ${D2A0_ANCHORS.DOUBTS_STRONGLY}`,
  READOUT_QUESTION,
  "--- END DECISION PROBE STRUCTURAL READOUT CONTRACT ---"
].join("\n");

export const D2A0_READOUT_SCHEMA_VERSION = "d2-a0-structural-readout-v0" as const;

export const D2A0_JSON_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["d2_readout_schema_version", "stance"],
  properties: {
    d2_readout_schema_version: { const: D2A0_READOUT_SCHEMA_VERSION },
    stance: { enum: [...D2A0_TOKENS] },
    explanation: { type: "string", minLength: 1, maxLength: 240 }
  }
});

/** Transformer contract for `buildD2StructuralReadoutRequestV0`, per D2_TRANSFORMER_LAWS. */
export const D2A0_TRANSFORMER_CONTRACT = Object.freeze({
  name: "buildD2StructuralReadoutRequestV0",
  input: "a pristine production V8 cognition request (production system prompt, production user content, V8 structured-output declaration)",
  substitution: "structured_output.schema is replaced by D2A0_JSON_SCHEMA exactly once",
  append: "D2A0_CONTRACT_TEXT is appended to the system message exactly once, the production content surviving as a byte-exact prefix",
  preserves_production_prefix_byte_for_byte: true,
  fails_on_already_transformed_request: true,
  transformer_on_transformer: false,
  decision_probe_v2_used: false,
  contract_text_hash_projection: D2_HASH_PROJECTION_V0
});

export interface D2Rev11bManifestV0 {
  readonly version: typeof D2_VERSION_REV1_1B;
  readonly fixtures: readonly D2A0QualificationFixtureV0[];
  readonly invariants: typeof D2A0_QUALIFICATION_INVARIANTS;
  readonly contract_text: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly transformer_contract: typeof D2A0_TRANSFORMER_CONTRACT;
  readonly supersedes_scope: readonly string[];
  readonly d2_model_calls_before_amendment: 0;
  readonly design_changed: false;
  readonly revision_1_1a_manifest_hash_preserved: string;
  readonly fixture_manifest_hash: HashV1;
  readonly contract_text_hash: HashV1;
  readonly manifest_hash: HashV1;
}

export async function deriveD2Rev11bManifestV0(): Promise<D2Rev11bManifestV0> {
  const fixtureManifestHash = await hashEnvelope(D2_HASH_PROJECTION_V0, {
    fixtures: D2A0_QUALIFICATION_FIXTURES
  });
  const contractTextHash = await hashEnvelope(D2_HASH_PROJECTION_V0, {
    contract_text: D2A0_CONTRACT_TEXT
  });
  const body = {
    version: D2_VERSION_REV1_1B,
    fixtures: D2A0_QUALIFICATION_FIXTURES,
    invariants: D2A0_QUALIFICATION_INVARIANTS,
    contract_text: D2A0_CONTRACT_TEXT,
    schema: D2A0_JSON_SCHEMA,
    transformer_contract: D2A0_TRANSFORMER_CONTRACT,
    supersedes_scope: [
      "frozen A0 qualification fixture bytes (previously only fixture kinds)",
      "frozen expected-token mapping (previously absent)",
      "frozen A0 transformer specification (previously only a name)"
    ] as const,
    d2_model_calls_before_amendment: 0 as const,
    design_changed: false as const,
    revision_1_1a_manifest_hash_preserved: D2_REVISION_1_1A_MANIFEST_HASH
  };
  return Object.freeze({
    ...body,
    fixture_manifest_hash: fixtureManifestHash,
    contract_text_hash: contractTextHash,
    manifest_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, body)
  });
}
