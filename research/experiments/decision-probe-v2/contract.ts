/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV2 — TRANSPORT-AWARE MEASUREMENT PROTOCOL. RESEARCH-ONLY. NOT RUN.
 *
 * WHAT V2 CHANGES (and what it deliberately does not)
 *   V2 changes **zero bytes of the measurement contract**. The primary semantic contract is
 *   inherited from DecisionProbeV1 BYTE-IDENTICALLY and a test proves it. What V2 changes is
 *   protocol *interpretation* and *control structure*:
 *     - the semantic measurement contract is declared to be **message-level** and therefore
 *       transport-independent, and a gate proves both transports receive the same bytes;
 *     - `PURE_SUBSTITUTION` (whose effective information content depends on the transport) is
 *       replaced by `FORMAT_ONLY_DIAGNOSTIC`, which is transport-symmetric by construction;
 *     - only a control that observes the executor failing at a contract it **was actually given**
 *       may veto (see `V2_VETO_RULES`);
 *     - `CONSTRUCT_RESPONSE_PARAPHRASE_STABLE` is upgraded from diagnostic to a **qualification
 *       requirement** — V2's bar is strictly higher than V1's.
 *
 * LAYER MODEL (the organising idea)
 *   Layer A  SEMANTIC MEASUREMENT CONTRACT — task, output shape, legal tokens, construct anchors.
 *            MUST be identical across transports. This is the instrument.
 *   Layer B  STRUCTURAL ENFORCEMENT — provider-native grammar, prompt-only, host parser.
 *            MAY differ; it enforces FORM, never MEANING. Recorded in the manifest.
 *   Layer C  EXPERIMENTAL SUBJECT INFORMATION — subject projection, observation, state.
 *            What D1 will eventually vary. Never touched by the instrument contract.
 *
 * A measurement contract may never depend on whether a transport supports native schema.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED } from "../decision-probe-v1/contract.ts";

export const DECISION_PROBE_V2_PROTOCOL_VERSION = "decision-probe-v2" as const;

export const DECISION_PROBE_V2_HASH_PROJECTION_V0 =
  "characteros-next/research/decision-probe-v2/protocol/v0" as const;

/** The frozen schema version token carried INSIDE the inherited contract (unchanged from V1). */
export const DECISION_PROBE_V2_SCHEMA_TOKEN = "decision-probe-v1" as const;

/** Layer A. Inherited byte-identically from DecisionProbeV1's primary mode. */
export const V2_PRIMARY_SEMANTIC_CONTRACT: string = DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED;

/** The neutral labels used by the TOKEN_REMAP diagnostic. Frozen. */
export const V2_NEUTRAL_LABELS = Object.freeze(["OPTION_A", "OPTION_B", "OPTION_C"] as const);
export type V2NeutralLabel = (typeof V2_NEUTRAL_LABELS)[number];

/**
 * The frozen label↔construct mapping. It lives in the PROTOCOL (for scoring), never in the
 * prompt: the executor must recover the mapping from the anchor definitions alone. That is the
 * entire point of the diagnostic.
 */
export const V2_NEUTRAL_LABEL_MAPPING: Readonly<Record<V2NeutralLabel, (typeof DECISION_PROBE_DECISIONS)[number]>> =
  Object.freeze({ OPTION_A: "ACCEPT", OPTION_B: "VERIFY", OPTION_C: "REJECT" });

const DEFINITION_LINE_COUNT = DECISION_PROBE_DECISIONS.length + 1; // header + three definitions

function blockLines(): readonly string[] {
  return V2_PRIMARY_SEMANTIC_CONTRACT.split("\n");
}

function definitionLineIndices(): readonly number[] {
  const lines = blockLines();
  const header = lines.findIndex((line) => line.startsWith("Decision meanings (binding):"));
  if (header < 0) throw new Error("V2: definition header not found in the inherited contract");
  return [header, header + 1, header + 2, header + 3];
}

/**
 * Layer A control: the SAME contract with the construct anchors REMOVED.
 * The executor still knows it is a DecisionProbe request, still receives the output object
 * definition and the legal token names — it is told nothing about what the tokens MEAN.
 * Transport-symmetric by construction (message-level).
 */
export function buildFormatOnlyContractV2(): string {
  const lines = blockLines();
  const drop = new Set(definitionLineIndices());
  return lines.filter((_line, index) => !drop.has(index)).join("\n");
}

export const V2_FORMAT_ONLY_CONTRACT: string = buildFormatOnlyContractV2();

/**
 * Token-name-confound diagnostic: the SAME contract with neutral labels substituted for the three
 * English tokens, anchors preserved. The label→construct mapping is scored from the protocol.
 */
export function buildTokenRemapContractV2(): string {
  // POSITION-TARGETED replacement only. A naive substring replace would corrupt prose: the REJECT
  // anchor contains the word "accepted", so replaceAll("ACCEPT", …) would yield "OPTION_Ad".
  const lines = blockLines();
  const mapping: readonly [string, string][] = [
    ["ACCEPT", "OPTION_A"],
    ["VERIFY", "OPTION_B"],
    ["REJECT", "OPTION_C"]
  ];
  const anchorPrefix = (construct: string): string => "  " + construct + " —";
  const enumLine = '"decision": one of "ACCEPT" | "VERIFY" | "REJECT"';
  const remappedEnum = '"decision": one of "OPTION_A" | "OPTION_B" | "OPTION_C"';
  return lines
    .map((line) => {
      if (line.startsWith("Decision meanings (binding):")) return "Decision labels (binding):";
      for (const [construct, label] of mapping) {
        const prefix = anchorPrefix(construct);
        if (line.startsWith(prefix)) {
          return "  " + label + " —" + line.slice(prefix.length);
        }
      }
      if (line.includes(enumLine)) return line.replace(enumLine, remappedEnum);
      return line;
    })
    .join("\n");
}

export const V2_TOKEN_REMAP_CONTRACT: string = buildTokenRemapContractV2();

/** Layer B record. Does NOT form part of the scientific construct identity. */
export interface V2StructuralEnforcementV0 {
  readonly transport_family: "ollama-native" | "openai-compatible";
  readonly mechanism: "GRAMMAR_ENFORCED_VIA_NATIVE_format" | "SCHEMA_NOT_FORWARDED_PROMPT_CONTRACT_AND_HOST_PARSER_ONLY";
  readonly schema_transmitted_to_provider: boolean;
}

/**
 * V2 VETO RULES — the principle that resolves the V1 control failure.
 *
 * A control may veto ONLY if it observes the executor failing at a contract it was ACTUALLY
 * GIVEN. A diagnostic that deliberately withholds information from the contract measures the
 * NECESSITY of that information, not the viability of the instrument: if withholding changes
 * behaviour, that is evidence the withheld information is load-bearing — which SUPPORTS
 * including it. It cannot be a reason to fail the instrument.
 */
export const V2_VETO_RULES = Object.freeze({
  may_veto: [
    "production subject information contaminated",
    "fixture leakage",
    "state leakage",
    "protocol drift",
    "output parser unreliable",
    "executor cannot execute the ACTUAL measurement contract",
    "measurement contract itself highly unstable",
    "construct-wording sensitivity beyond the preregistered limit"
  ],
  may_not_veto: [
    "FORMAT_ONLY_DIAGNOSTIC behavioural change (it withholds the anchors on purpose)",
    "TOKEN_REMAP_DIAGNOSTIC behavioural change (it withholds token priors on purpose)"
  ],
  /** Explicit: a diagnostic that withholds information never vetoes the instrument. */
  diagnostics_veto: false as const,
  principle: "a control withholds the anchors to test their necessity; it cannot fail the instrument for behaving differently without them"
});

export const DECISION_PROBE_V2_QUALIFICATION_RULE = Object.freeze({
  measurement_mode: "PRIMARY_SEMANTIC_CONTRACT" as const,
  requires: [
    "primary: every frozen fixture modal == expected",
    "primary: agreement >= frozen min_agreement_fraction",
    "primary: schema-rejection rate <= frozen max_schema_rejection_rate",
    "primary: zero transport failures",
    "CONSTRUCT_NEUTRALITY audit PASS",
    "FIXTURE_BLINDNESS audit PASS",
    "STATE_BLINDNESS audit PASS",
    "TRANSPORT_EQUIVALENCE_GATE PASS",
    "C3: CONSTRUCT_RESPONSE_PARAPHRASE_STABLE (upgraded from diagnostic to REQUIREMENT in V2)"
  ],
  diagnostics: ["FORMAT_ONLY_DIAGNOSTIC", "TOKEN_REMAP_DIAGNOSTIC"],
  diagnostics_veto: false as const,
  applies_retrospectively_to_v1: false as const,
  applies_retrospectively_to_v0: false as const
});

export const DECISION_PROBE_V2_VERDICTS = Object.freeze([
  "DECISION_INSTRUMENT_V2_QUALIFIED",
  "DECISION_INSTRUMENT_V2_UNQUALIFIED",
  "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE",
  "INCONCLUSIVE_BY_DECISION_NOISE",
  "INCONCLUSIVE_AUDIT_FAILED",
  "INCONCLUSIVE_TRANSPORT_EQUIVALENCE_FAILED",
  "CROSS_TRANSPORT_DIVERGENCE"
] as const);

export const DECISION_PROBE_V2_DIAGNOSTIC_VERDICTS = Object.freeze([
  "CONSTRUCT_RESPONSE_PARAPHRASE_STABLE",
  "LEXICALLY_SENSITIVE",
  "CONSTRUCT_ANCHORS_ARE_NECESSARY",
  "CONSTRUCT_ANCHORS_NOT_NECESSARY",
  "TOKEN_PRIORS_LOAD_BEARING",
  "TOKEN_PRIORS_NOT_LOAD_BEARING",
  "FORMAT_ONLY_DIAGNOSTIC_NOT_RUN",
  "TOKEN_REMAP_DIAGNOSTIC_NOT_RUN"
] as const);

export interface V2ProtocolHashesV0 {
  readonly semantic_contract_hash: HashV1;
  readonly format_only_contract_hash: HashV1;
  readonly token_remap_contract_hash: HashV1;
  readonly protocol_hash: HashV1;
}

export async function deriveV2ProtocolHashesV0(): Promise<V2ProtocolHashesV0> {
  const contractHash = await hashEnvelope(
    "characteros-next/research/decision-probe-v1/c3-paraphrase-manifest/v0",
    { applied_override_block: V2_PRIMARY_SEMANTIC_CONTRACT }
  );
  const formatOnlyHash = await hashEnvelope(DECISION_PROBE_V2_HASH_PROJECTION_V0, {
    format_only: V2_FORMAT_ONLY_CONTRACT
  });
  const tokenRemapHash = await hashEnvelope(DECISION_PROBE_V2_HASH_PROJECTION_V0, {
    token_remap: V2_TOKEN_REMAP_CONTRACT
  });
  return Object.freeze({
    semantic_contract_hash: contractHash,
    format_only_contract_hash: formatOnlyHash,
    token_remap_contract_hash: tokenRemapHash,
    protocol_hash: await hashEnvelope(DECISION_PROBE_V2_HASH_PROJECTION_V0, {
      version: DECISION_PROBE_V2_PROTOCOL_VERSION,
      qualification_rule: DECISION_PROBE_V2_QUALIFICATION_RULE,
      veto_rules: V2_VETO_RULES,
      mapping: V2_NEUTRAL_LABEL_MAPPING
    })
  });
}

export { DEFINITION_LINE_COUNT as V2_DEFINITION_BLOCK_LINE_COUNT };
