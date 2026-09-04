/**
 * CommunicationDirectiveV0 — closed two-kind communication directive
 * (STRUCTURED_COMMUNICATION_DIRECTIVE_V0).
 *
 * Produced by validated conversation cognition (NOT derived from familiarity,
 * evidence count, current_intent, reasoning_summary, regex or scene text).
 * The host branches on this directive AFTER cognition validation.
 *
 * CLARIFY_MISSING_CONTEXT: the response should request missing context before
 * acting as if that unresolved context is known. Host renders a fixed
 * clarification — no model-authored declarative language enters the branch.
 *
 * REALIZE_CURRENT_INTENT: ordinary language realization may express the
 * validated cognition intent through the existing language provider pipeline.
 */

export const COMMUNICATION_DIRECTIVE_SCHEMA_VERSION_V0 =
  "communication-directive-v0" as const;

export type CommunicationDirectiveV0 =
  | { readonly kind: "CLARIFY_MISSING_CONTEXT" }
  | { readonly kind: "REALIZE_CURRENT_INTENT" };

export const COMMUNICATION_DIRECTIVE_KINDS_V0 = Object.freeze([
  "CLARIFY_MISSING_CONTEXT",
  "REALIZE_CURRENT_INTENT"
] as const);

export type CommunicationDirectiveKindV0 =
  (typeof COMMUNICATION_DIRECTIVE_KINDS_V0)[number];

/**
 * Deterministic fail-closed validation. Rejects null, arrays, missing kind,
 * unknown kind, case variants, and ANY additional property.
 */
export function validateCommunicationDirectiveV0(
  v: unknown
): { ok: true; directive: CommunicationDirectiveV0 } | { ok: false; detail: string } {
  if (v === null || v === undefined) {
    return { ok: false, detail: "directive: expected object, got null/undefined" };
  }
  if (typeof v !== "object" || Array.isArray(v)) {
    return { ok: false, detail: "directive: expected plain object" };
  }
  const keys = Object.keys(v).sort();
  if (keys.length !== 1 || keys[0] !== "kind") {
    return {
      ok: false,
      detail: `directive: expected exactly {kind}, got [${keys.join(",")}]`
    };
  }
  const kind = (v as Record<string, unknown>)["kind"];
  if (typeof kind !== "string" || !(COMMUNICATION_DIRECTIVE_KINDS_V0 as readonly string[]).includes(kind)) {
    return {
      ok: false,
      detail: `directive.kind: expected one of [${COMMUNICATION_DIRECTIVE_KINDS_V0.join(",")}], got ${JSON.stringify(kind)}`
    };
  }
  return {
    ok: true,
    directive: Object.freeze({ kind } as CommunicationDirectiveV0)
  };
}
