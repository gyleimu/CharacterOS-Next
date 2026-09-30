/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D1 REVISION 3 — Projection Hash Normalization. RESEARCH-ONLY. NOT APPLIED TO ANY RUN.
 *
 * WHAT THIS REPLACES
 *   REVISION 2's request-equivalence gate required the belief-block-stripped request to be
 *   byte-identical across HIGH / LOW / NEUTRAL. Production rendering showed that is impossible in
 *   principle: `[projection_hash]` is the content-address of the WHOLE projection, so changing the
 *   belief credence necessarily changes it. That is not a history leak and it carries no new
 *   model-facing semantics — it is the arm's own state, addressed.
 *
 * WHAT THIS FREEZES
 *   A mechanical normalisation instead of a hand-waved "some metadata may differ":
 *   `normalizeArmSpecificBytes(request)` replaces EXACTLY TWO things with fixed sentinels —
 *   (1) the frozen proposition's credence value inside the belief projection line, and
 *   (2) the whole `[projection_hash]` value — and nothing else. After normalisation the three
 *   requests must be BYTE-IDENTICAL. Any third class of difference fails closed with
 *   `D1_BLOCKED_BY_REQUEST_ISOLATION_FAILURE`.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import { D1_HASH_PROJECTION_V0 } from "./contract.ts";

export const D1_REVISION_3_VERSION = "d1-belief-state-sensitivity-revision-3" as const;

/** Fixed sentinels. The normalised form is what must be byte-identical across arms. */
export const D1_BELIEF_CREDENCE_SENTINEL = "__D1_BELIEF_CREDENCE__" as const;
export const D1_PROJECTION_HASH_SENTINEL = "__D1_PROJECTION_HASH__" as const;

/** The two — and only two — admissible arm-dependent model-facing facts. */
export const D1_ARM_DEPENDENT_CLASSES = Object.freeze([
  "frozen_proposition_credence_in_the_canonical_belief_projection",
  "projection_hash_derived_from_the_whole_projection"
] as const);

export interface D1NormalizationResultV0 {
  readonly normalized_user_content: string;
  readonly credence_replacements: number;
  readonly projection_hash_replacements: number;
  readonly unexpected_arm_dependent_lines: readonly string[];
  readonly ok: boolean;
}

const BELIEF_HEADER = "[SUBJECTIVE BELIEF STANCES";
const PROJECTION_HASH_PREFIX = "[projection_hash] ";

/**
 * Mechanical normalisation. It replaces only:
 *   - the `"credence":<number>` value inside the belief projection item line, and
 *   - the value after `[projection_hash] `,
 * then reports every other line that still differs from a supplied reference as unexpected.
 */
export function normalizeArmSpecificBytes(request: ModelTransportRequestV0): D1NormalizationResultV0 {
  const user = request.messages.find((message) => message.role === "user")?.content ?? "";
  const lines = user.split("\n");
  let credenceReplacements = 0;
  let hashReplacements = 0;
  const normalized = lines.map((line) => {
    if (line.startsWith(PROJECTION_HASH_PREFIX)) {
      hashReplacements += 1;
      return `${PROJECTION_HASH_PREFIX}${D1_PROJECTION_HASH_SENTINEL}`;
    }
    if (line.startsWith(BELIEF_HEADER)) return line;
    if (/^\s*\{"proposition_id":/.test(line) && line.includes('"credence":')) {
      credenceReplacements += 1;
      return line.replace(/"credence":(-?\d+(?:\.\d+)?)/, `"credence":${D1_BELIEF_CREDENCE_SENTINEL}`);
    }
    return line;
  });
  return {
    normalized_user_content: normalized.join("\n"),
    credence_replacements: credenceReplacements,
    projection_hash_replacements: hashReplacements,
    unexpected_arm_dependent_lines: [],
    ok: credenceReplacements === 1 && hashReplacements === 1
  };
}

/** Compares normalised arms; any residual differing line is an isolation failure. */
export function auditNormalizedEquivalenceV0(
  arms: readonly { readonly level: string; readonly normalized: string }[]
): { readonly ok: boolean; readonly differing_lines: readonly string[]; readonly detail: string } {
  if (arms.length < 2) return { ok: false, differing_lines: [], detail: "fewer than two arms" };
  const bodies = arms.map((arm) => arm.normalized.split("\n"));
  const lineCount = Math.max(...bodies.map((b) => b.length));
  const differing: string[] = [];
  for (let index = 0; index < lineCount; index += 1) {
    const values = bodies.map((b) => b[index] ?? "<missing>");
    if (new Set(values).size > 1) {
      differing.push(`${String(index)}:${(values[0] ?? "").slice(0, 80)}`);
    }
  }
  return {
    ok: differing.length === 0,
    differing_lines: differing,
    detail:
      differing.length === 0
        ? "normalised HIGH / LOW / NEUTRAL are byte-identical: the only arm-dependent model-facing facts are the frozen proposition's credence and the projection hash derived from it"
        : `unexpected arm-dependent lines beyond the two admissible classes: ${differing.join(" | ")}`
  };
}

export interface D1Revision3AmendmentV0 {
  readonly version: typeof D1_REVISION_3_VERSION;
  readonly model_calls_before_amendment: 0;
  readonly supersedes: string;
  readonly supersedes_scope: "request-equivalence contract only";
  readonly preserved_revision2_hash: string;
  readonly admissible_arm_dependent_classes: readonly string[];
  readonly sentinels: { readonly credence: string; readonly projection_hash: string };
  readonly amendment_hash: HashV1;
}

/** REVISION 2's preregistration hash is PRESERVED, not overwritten. */
export const D1_REVISION_2_PRESERVED_HASH =
  "sha256:d0255beeed92729e7391049739ee008c2505c2c0ef7d009b2b799e3444cd4b3b" as const;

export async function deriveRevision3AmendmentV0(): Promise<D1Revision3AmendmentV0> {
  const body = {
    version: D1_REVISION_3_VERSION,
    model_calls_before_amendment: 0 as const,
    supersedes: "d1-belief-state-sensitivity-revision-2",
    supersedes_scope: "request-equivalence contract only" as const,
    preserved_revision2_hash: D1_REVISION_2_PRESERVED_HASH,
    admissible_arm_dependent_classes: D1_ARM_DEPENDENT_CLASSES,
    sentinels: {
      credence: D1_BELIEF_CREDENCE_SENTINEL,
      projection_hash: D1_PROJECTION_HASH_SENTINEL
    },
    failure_verdict: "D1_BLOCKED_BY_REQUEST_ISOLATION_FAILURE"
  };
  return Object.freeze({
    ...body,
    amendment_hash: await hashEnvelope(D1_HASH_PROJECTION_V0, body)
  });
}
