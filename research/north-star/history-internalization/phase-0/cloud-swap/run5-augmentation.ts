/* eslint-disable no-restricted-imports -- Isolated research harness composing frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * RUN-5 — SOURCE_QUOTE COMPLIANCE AUGMENTATION (research-condition scoped, frozen).
 *
 * WHY: run-4's sole blocking failure was
 *   CONVERSATION_COGNITION_FACTUAL_AUTHORIZATION_REJECTED: ... claims[0]:
 *   REJECTED_SOURCE_BINDING SOURCE_QUOTE is not an exact substring of every cited source
 *
 * The authoritative rule is `presentInEverySource(...)` (`factual-claim-authorization.ts:315`): a
 * SOURCE_QUOTE claim's text must appear verbatim in EVERY source it cites. The rule is ALREADY stated in
 * the production cognition prompt (rule 9, `conversation-cognition-provider-v8.ts:477`), and the model
 * violated it anyway — the same pattern as the `PRIMARY_STANCE => SUBJECTIVE_SELECTION` rule. A prior
 * attempt to strengthen that clause ("COPIED BYTE-FOR-BYTE") was REVERTED, and the reversion is itself
 * pinned by `set-like-ref-canonicalization.test.ts:121`, because the frozen preregistered experiments pin
 * the exact request bytes and historical request identity is immutable.
 *
 * WHAT THIS IS INSTEAD OF TOUCHING PRODUCTION: the augmentation is applied at the RESEARCH TRANSPORT
 * BOUNDARY, for this condition only. Production prompt text, the product's request bytes, the validator
 * and every historical pin are untouched. The cost is declared, not hidden: run-5's model-visible bytes
 * differ from run-1/3/4, so run-5 is not comparable to them — a cost run-5 already carried, since it also
 * runs on a different executor.
 *
 * WHY IT CANNOT MOVE THE ENDPOINT: it constrains how a quote may be CITED. It says nothing about the
 * trajectory's events, the target proposition, credence, arms, or any treatment-bearing content, so it
 * cannot bias the measurement in the treatment's direction. `assertAugmentationIsTreatmentOrthogonalV0`
 * checks exactly that, rather than asserting it in prose.
 *
 * WHAT IT ADDRESSES, AND THE HONEST LIMIT: the rule has two ways to fail — paraphrasing instead of
 * quoting, and quoting a span that occurs in only one of several cited sources. This text addresses BOTH
 * (quote exactly; cite only the source a span actually occurs in). Prompt wording is still only wording:
 * if run-5 fails the same way WITH the payload recorded, the finding is that stating this rule harder
 * does not produce compliance, and the decision escalates to the contract's semantics — which is not a
 * change this file may make.
 */

import type { ModelTransportV0 } from "../../../../../packages/runtime/dist/index.js";

import { P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS } from "./../contract.ts";

/**
 * The frozen augmentation. Appended to the END of the existing system message, so the production
 * instruction text is preserved in full and the message count and roles are unchanged.
 */
export const RUN5_SOURCE_QUOTE_AUGMENTATION_V0 = [
  "",
  "18. CITATION DISCIPLINE (BINDING, in addition to rule 9):",
  "For a factual_assessment claim whose kind is SOURCE_QUOTE:",
  "  (a) the claim's text must be COPIED exactly, character for character, including case and",
  "      punctuation, from a source you can see. Never paraphrase, summarise, splice or normalise it;",
  "  (b) a SOURCE_QUOTE claim may cite ONE OR MORE source_refs, but its text must appear verbatim in",
  "      EVERY source_ref it cites. The host checks every cited source, not any one of them;",
  "  (c) therefore: if the span you want to quote occurs in only one source, cite ONLY that source.",
  "      Do not cite a second source for support unless the same span also occurs verbatim in it;",
  "  (d) if you cannot find a span that satisfies (a) and (b), do not emit a SOURCE_QUOTE claim for it.",
  "      Emit no claim, or use one of the advertised closed operations instead.",
  "This rule governs citation FORM only. It does not change what you may claim, which evidence exists, or",
  "what any proposition means."
].join("\n");

/**
 * Treatment-orthogonality check: the augmentation must not carry any part of the treatment or any
 * experimenter vocabulary that the leakage audit forbids. Checked, not asserted in prose.
 */
export function assertAugmentationIsTreatmentOrthogonalV0(): {
  readonly ok: boolean;
  readonly violations: readonly string[];
} {
  const lowered = RUN5_SOURCE_QUOTE_AUGMENTATION_V0.toLowerCase();
  const violations = P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS.filter((needle) =>
    lowered.includes(needle.toLowerCase())
  );
  return { ok: violations.length === 0, violations };
}

export class Run5AugmentationErrorV0 extends Error {
  readonly code: "RUN5_AUGMENTATION_NOT_APPLICABLE";

  constructor(code: Run5AugmentationErrorV0["code"], detail: string) {
    super(`${code}: ${detail}`);
    this.name = "Run5AugmentationErrorV0";
    this.code = code;
  }
}

/**
 * Applies the augmentation to the END of the existing system message.
 *
 * FAIL CLOSED on a request with no system message: the condition's declared intervention would otherwise
 * be silently absent, and "the augmentation was applied" would be an unchecked claim. Silently not
 * applying it is the one failure mode this wrapper must not have.
 *
 * Conformant with `ModelTransportV0`: it never mutates the caller's request, never changes the message
 * count, and never changes any role.
 */
export function createAugmentedCognitionTransportV0(
  inner: ModelTransportV0,
  augmentation: string = RUN5_SOURCE_QUOTE_AUGMENTATION_V0
): ModelTransportV0 {
  return {
    complete: async (request: never) => {
      const typed = request as { messages?: readonly { role: string; content: string }[] };
      const messages = typed.messages;
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Run5AugmentationErrorV0(
          "RUN5_AUGMENTATION_NOT_APPLICABLE",
          "request carries no messages; the declared cognition augmentation could not be applied"
        );
      }
      const systemIndex = messages.findIndex((message) => message.role === "system");
      if (systemIndex < 0) {
        throw new Run5AugmentationErrorV0(
          "RUN5_AUGMENTATION_NOT_APPLICABLE",
          "request carries no system message; the declared cognition augmentation could not be applied"
        );
      }
      const augmented = messages.map((message, index) =>
        index === systemIndex ? { role: message.role, content: `${message.content}${augmentation}` } : message
      );
      return inner.complete({ ...(request as object), messages: augmented } as never);
    }
  } as ModelTransportV0;
}
