/**
 * AUTHORIZED_CLAIM_LANGUAGE_REALIZATION_V0 — the thin deterministic guard for the
 * ONE relaxed act surface.
 *
 * FROZEN HUMAN DECISION (OPTION_B): an accepted factual claim means CAN_SAY, never
 * MUST_SAY. `PRIMARY_CONVERSATIONAL_ACT(GENERATIVE)` may therefore incorporate
 * factual material that the host has ALREADY authorized in
 * `factual_assessment.claims`. `GREET` and `ACKNOWLEDGE` remain non-factual act
 * surfaces, and `PRIMARY_FACT` is untouched: this module grants no new authority
 * and relaxes nothing else.
 *
 * WHAT THIS GUARD DECIDES, DETERMINISTICALLY: the QUOTED channel. Every
 * double-quoted span inside a GENERATIVE realization must be traceable, verbatim,
 * to one of the authorized claims that realization received; a quoted payload no
 * authorized claim carries fails closed. That is the whole rule — no rewriting, no
 * normalization, no repair.
 *
 * WHAT IT DELIBERATELY DOES NOT DO (v1, stated rather than implied): it cannot
 * decide an UNQUOTED paraphrase — there is no natural-language fact extraction, no
 * semantic equivalence check and no model-based validation here, and inventing one
 * would be a new authority rather than a guard. The model-facing contract remains
 * the primary constraint; this guard closes the channel a human reader would read
 * as a quotation. Unquoted factual text is out of its reach and is NOT claimed to
 * be covered.
 */

import type { ConversationalActKindV0 } from "./conversation-cognition-proposal.js";
import {
  PRIMARY_RESPONSE_KIND_CONVERSATIONAL_ACT_V0,
  type ResponseSemanticsAtomV0
} from "./conversation-cognition-proposal.js";

/** The exact authorized factual text the realization received, with its kind. */
export interface AuthorizedClaimTextV0 {
  readonly kind: "SOURCE_QUOTE" | "HOST_VERIFIABLE_DERIVATION";
  readonly text: string;
}

export interface ClaimBindingCheckInputV0 {
  /** The response-semantics atom the host routed to Language (null on legacy paths). */
  readonly response_semantics: ResponseSemanticsAtomV0 | null;
  /** The claims the host ALREADY authorized for this turn (never raw model prose). */
  readonly authorized_claims: readonly AuthorizedClaimTextV0[];
  /** The draft text the language stage produced. */
  readonly text: string;
}

/** Quotation pairs a reader treats as quoting: straight and curly double quotes. */
const QUOTE_PAIRS_V0: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze(['"', '"'] as const),
  Object.freeze(["\u201C", "\u201D"] as const)
]);

/**
 * Every balanced quoted span, in order of appearance. An UNBALANCED opening quote
 * yields no span: the guard never guesses where a quotation ends.
 */
export function quotedSpansV0(text: string): readonly string[] {
  const spans: string[] = [];
  for (const [open, close] of QUOTE_PAIRS_V0) {
    let cursor = 0;
    for (;;) {
      const start = text.indexOf(open, cursor);
      if (start < 0) break;
      const end = text.indexOf(close, start + open.length);
      if (end < 0) break;
      spans.push(text.slice(start + open.length, end));
      cursor = end + close.length;
    }
  }
  return spans;
}

export type ClaimBindingCheckResultV0 = { readonly ok: true } | { readonly ok: false; readonly detail: string };

/**
 * Fails closed when a GENERATIVE realization quotes factual material that no
 * authorized claim carries. Every other act/atom combination is untouched — this
 * function is a no-op for GREET, ACKNOWLEDGE, PRIMARY_FACT, PRIMARY_STANCE and the
 * legacy paths, so their acceptance is byte-identical to before this slice.
 */
export function validateGenerativeClaimBindingV0(input: ClaimBindingCheckInputV0): ClaimBindingCheckResultV0 {
  const atom = input.response_semantics;
  if (atom === null || atom.kind !== PRIMARY_RESPONSE_KIND_CONVERSATIONAL_ACT_V0) return { ok: true };
  const act: ConversationalActKindV0 = atom.act;
  if (act !== "GENERATIVE") return { ok: true };
  for (const span of quotedSpansV0(input.text)) {
    const quoted = span.trim();
    if (quoted.length === 0) continue;
    const authorized = input.authorized_claims.some((claim) => claim.text.includes(quoted));
    if (!authorized) {
      return {
        ok: false,
        detail:
          `GENERATIVE realization quotes ${JSON.stringify(quoted.slice(0, 120))}, which is not carried by any ` +
          `host-authorized factual claim (authorized claims: ${String(input.authorized_claims.length)})`
      };
    }
  }
  return { ok: true };
}
