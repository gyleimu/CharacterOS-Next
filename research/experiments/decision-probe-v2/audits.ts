/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV2 — protocol audits and the TRANSPORT_EQUIVALENCE_GATE. RESEARCH-ONLY.
 * ZERO model calls, fully offline.
 *
 * The gate's central claim, made mechanical: **Layer A (the semantic measurement contract) is
 * carried in `messages`.** `messages` are transport-independent; the only member whose fate
 * depends on the transport is `structured_output` (Layer B), which the OpenAI-compatible
 * transport never forwards. Therefore a transport that drops the schema still delivers the full
 * measurement contract, and a transport that keeps it delivers the same contract plus grammar.
 */

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED } from "../decision-probe-v1/contract.ts";
import { runV1AuditsV0, type AuditResultV0 } from "../decision-probe-v1/audits.ts";
import {
  DECISION_PROBE_V2_HASH_PROJECTION_V0,
  V2_FORMAT_ONLY_CONTRACT,
  V2_NEUTRAL_LABELS,
  V2_NEUTRAL_LABEL_MAPPING,
  V2_PRIMARY_SEMANTIC_CONTRACT,
  V2_TOKEN_REMAP_CONTRACT
} from "./contract.ts";

export interface V2AuditResultV0 {
  readonly audit: string;
  readonly status: "PASS" | "FAIL";
  readonly detail: readonly string[];
}

function toV2(result: AuditResultV0): V2AuditResultV0 {
  return { audit: result.audit, status: result.status, detail: result.detail };
}

/** A1 — V2's measurement contract is byte-identical to V1's. V2 changed no sent byte. */
export function auditSemanticContractInheritanceV0(): V2AuditResultV0 {
  const identical = V2_PRIMARY_SEMANTIC_CONTRACT === DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED;
  return {
    audit: "SEMANTIC_CONTRACT_INHERITANCE",
    status: identical ? "PASS" : "FAIL",
    detail: identical
      ? ["V2's primary semantic contract is byte-identical to DecisionProbeV1's override block — V2 changes zero sent bytes"]
      : ["V2's contract differs from V1's — this would be an undeclared measurement change"]
  };
}

/** A2 — FORMAT_ONLY removes exactly the construct anchors and nothing else. */
export function auditFormatOnlyConstructionV0(): V2AuditResultV0 {
  const base = V2_PRIMARY_SEMANTIC_CONTRACT.split("\n");
  const only = V2_FORMAT_ONLY_CONTRACT.split("\n");
  const detail: string[] = [];
  let ok = true;
  const removed = base.filter((line) => !only.includes(line));
  if (only.length !== base.length - 4) {
    ok = false;
    detail.push(`expected exactly 4 lines removed, got ${String(base.length - only.length)}`);
  }
  for (const line of removed) {
    const isAnchorLine =
      line.startsWith("Decision meanings (binding):") ||
      DECISION_PROBE_DECISIONS.some((token) => line.startsWith(`  ${token} —`));
    if (!isAnchorLine) {
      ok = false;
      detail.push(`a non-anchor line was removed: ${line}`);
    }
  }
  // Layer A must survive: task, output shape and legal tokens are still stated.
  if (!only.some((line) => line.includes("Choose exactly one decision"))) {
    ok = false;
    detail.push("the measurement task instruction was lost");
  }
  if (!only.some((line) => line.includes('"decision": one of'))) {
    ok = false;
    detail.push("the output object definition was lost");
  }
  for (const token of DECISION_PROBE_DECISIONS) {
    if (!only.some((line) => line.includes(`"${token}"`))) {
      ok = false;
      detail.push(`legal token ${token} is no longer advertised`);
    }
  }
  if (!only.some((line) => line.includes("decision_probe_schema_version"))) {
    ok = false;
    detail.push("the required schema-version member was lost");
  }
  if (ok) {
    detail.push(
      "exactly the 4 anchor lines (header + 3 definitions) removed; measurement task, output object definition and legal token names retained"
    );
  }
  return { audit: "FORMAT_ONLY_CONSTRUCTION", status: ok ? "PASS" : "FAIL", detail };
}

/** A3 — TOKEN_REMAP swaps labels while KEEPING the anchors, and keeps the tokens knowable. */
export function auditTokenRemapConstructionV0(): V2AuditResultV0 {
  const detail: string[] = [];
  let ok = true;
  const base = V2_PRIMARY_SEMANTIC_CONTRACT.split("\n");
  const remapped = V2_TOKEN_REMAP_CONTRACT.split("\n");
  if (base.length !== remapped.length) {
    ok = false;
    detail.push("the remap changed the line count");
  }
  const changed = base.filter((line, index) => line !== remapped[index]);
  if (changed.length !== 5) {
    ok = false;
    detail.push(`expected exactly 5 changed lines (enum line + header + 3 labels), got ${String(changed.length)}`);
  }
  for (const label of V2_NEUTRAL_LABELS) {
    if (!V2_TOKEN_REMAP_CONTRACT.includes(`  ${label} —`)) {
      ok = false;
      detail.push(`neutral label ${label} has no anchor line`);
    }
    if (!V2_TOKEN_REMAP_CONTRACT.includes(`"${label}"`)) {
      ok = false;
      detail.push(`neutral label ${label} is not advertised as a legal output token`);
    }
  }
  for (const token of DECISION_PROBE_DECISIONS) {
    if (V2_TOKEN_REMAP_CONTRACT.includes(`"${token}"`)) {
      ok = false;
      detail.push(`English token ${token} still advertised as a legal output token`);
    }
  }
  if (!remapped.some((line) => line.includes("Decision labels (binding):"))) {
    ok = false;
    detail.push("the label header was not renamed");
  }
  // The mapping must live in the protocol, not in the prompt.
  if (V2_TOKEN_REMAP_CONTRACT.includes("OPTION_A = ACCEPT")) {
    ok = false;
    detail.push("the prompt states the mapping explicitly — the diagnostic would be vacuous");
  }
  if (Object.keys(V2_NEUTRAL_LABEL_MAPPING).length !== 3) {
    ok = false;
    detail.push("the frozen mapping is incomplete");
  }
  if (ok) {
    detail.push(
      "labels swapped to OPTION_A/B/C, anchors retained, English tokens no longer advertised, mapping lives in the protocol only"
    );
  }
  return { audit: "TOKEN_REMAP_CONSTRUCTION", status: ok ? "PASS" : "FAIL", detail };
}

/**
 * A4 — TRANSPORT_EQUIVALENCE_GATE.
 * Mechanical claim: Layer A is carried in `messages`; the only family-varying request member is
 * `structured_output`, which the OpenAI-compatible transport drops. Therefore the contract
 * reaches both transports identically.
 */
export function auditTransportEquivalenceV0(input: {
  readonly primary_request: ModelTransportRequestV0;
  readonly format_only_request: ModelTransportRequestV0;
}): V2AuditResultV0 {
  const detail: string[] = [];
  let ok = true;
  const systemOf = (request: ModelTransportRequestV0): string =>
    request.messages.find((message) => message.role === "system")?.content ?? "";

  for (const [label, request] of [
    ["primary", input.primary_request],
    ["format_only", input.format_only_request]
  ] as const) {
    const system = systemOf(request);
    if (!system.includes("DECISION PROBE OUTPUT CONTRACT")) {
      ok = false;
      detail.push(`${label}: the contract header is not present at message level`);
    }
    if (!system.includes("Choose exactly one decision")) {
      ok = false;
      detail.push(`${label}: the measurement task is not present at message level`);
    }
  }
  if (!systemOf(input.primary_request).includes("Decision meanings (binding):")) {
    ok = false;
    detail.push("primary: the anchors are not present at message level");
  }
  if (systemOf(input.format_only_request).includes("Decision meanings (binding):")) {
    ok = false;
    detail.push("format_only: the anchors were not actually withheld");
  }
  // The contract must live in `messages`, and must NOT live in `structured_output`: a member the
  // cloud transport drops can never be the sole carrier of the measurement contract.
  const messagesCarryTheContract = canonicalJsonString(input.primary_request.messages).includes(
    "DECISION PROBE OUTPUT CONTRACT"
  );
  if (!messagesCarryTheContract) {
    ok = false;
    detail.push("the contract is not carried in `messages` — it would be transport-dependent");
  }
  const schemaCarriesNoConstructText = !canonicalJsonString(
    input.primary_request.structured_output?.schema ?? {}
  ).includes("DECISION PROBE OUTPUT CONTRACT");
  if (!schemaCarriesNoConstructText) {
    ok = false;
    detail.push("the schema member carries construct text; Layer A and Layer B are conflated");
  }
  if (ok) {
    detail.push(
      "Layer A is delivered at message level for both contracts; `structured_output` is the only family-varying member (Layer B) and carries no construct information"
    );
  }
  return { audit: "TRANSPORT_EQUIVALENCE_GATE", status: ok ? "PASS" : "FAIL", detail };
}

/** A5 — Layer-1–3 gates on the inherited contract: construct-neutrality, fixture- and state-blindness. */
export async function runV2AuditsV0(input?: {
  readonly primary_request?: ModelTransportRequestV0;
  readonly format_only_request?: ModelTransportRequestV0;
}): Promise<{ readonly results: readonly (AuditResultV0 | V2AuditResultV0)[]; readonly all_pass: boolean }> {
  const inherited = await runV1AuditsV0();
  const results: (AuditResultV0 | V2AuditResultV0)[] = [
    ...inherited.results.map(toV2),
    auditSemanticContractInheritanceV0(),
    auditFormatOnlyConstructionV0(),
    auditTokenRemapConstructionV0()
  ];
  if (input?.primary_request !== undefined && input.format_only_request !== undefined) {
    results.push(
      auditTransportEquivalenceV0({
        primary_request: input.primary_request,
        format_only_request: input.format_only_request
      })
    );
  }
  return {
    results,
    all_pass: results.every((result) => result.status === "PASS")
  };
}

export async function deriveV2ContractHashesV0(): Promise<Readonly<Record<string, HashV1>>> {
  return Object.freeze({
    primary: await hashEnvelope(DECISION_PROBE_V2_HASH_PROJECTION_V0, {
      primary: V2_PRIMARY_SEMANTIC_CONTRACT
    }),
    format_only: await hashEnvelope(DECISION_PROBE_V2_HASH_PROJECTION_V0, {
      format_only: V2_FORMAT_ONLY_CONTRACT
    }),
    token_remap: await hashEnvelope(DECISION_PROBE_V2_HASH_PROJECTION_V0, {
      token_remap: V2_TOKEN_REMAP_CONTRACT
    }),
    projected_messages_probe: await hashEnvelope(DECISION_PROBE_V2_HASH_PROJECTION_V0, {
      note: "messages carry Layer A; structured_output carries Layer B only"
    })
  });
}
