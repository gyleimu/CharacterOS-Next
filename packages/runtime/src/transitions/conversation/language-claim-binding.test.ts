/**
 * AUTHORIZED_CLAIM_LANGUAGE_REALIZATION_V0 — the language contract clause and the
 * thin deterministic guard that backs it. Offline: no model call, no network.
 *
 * FROZEN DECISION (OPTION_B): an accepted claim is CAN_SAY, never MUST_SAY. The
 * relaxation exists for exactly ONE act (GENERATIVE); everything else keeps its
 * previous acceptance surface.
 */

import { describe, expect, it } from "vitest";

import { LANGUAGE_REALIZATION_ACT_CLAUSE_V10 } from "../../providers/behavior/language-realization-provider.js";
import {
  quotedSpansV0,
  validateGenerativeClaimBindingV0,
  type AuthorizedClaimTextV0
} from "./language-claim-binding.js";

const QUOTE = "I keep a red notebook on the desk.";
const authorized: readonly AuthorizedClaimTextV0[] = Object.freeze([
  Object.freeze({ kind: "SOURCE_QUOTE" as const, text: QUOTE })
]);

function generative(text: string, claims: readonly AuthorizedClaimTextV0[] = authorized) {
  return validateGenerativeClaimBindingV0({
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "GENERATIVE", target_ref: "observation:o-1" as never },
    authorized_claims: claims,
    text
  });
}

describe("the V10 act clause states the frozen decision", () => {
  it("grants GENERATIVE the authorized claims, as permission and not as an instruction", () => {
    expect(LANGUAGE_REALIZATION_ACT_CLAUSE_V10).toContain("GENERATIVE may additionally incorporate factual material taken ONLY from factual_assessment.claims");
    expect(LANGUAGE_REALIZATION_ACT_CLAUSE_V10).toContain("permission to use it, never an instruction to use it");
    expect(LANGUAGE_REALIZATION_ACT_CLAUSE_V10).toContain("no claim has to appear merely because it is available");
  });

  it("keeps GREET and ACKNOWLEDGE non-factual", () => {
    expect(LANGUAGE_REALIZATION_ACT_CLAUSE_V10).toContain("GREET and ACKNOWLEDGE remain non-factual act surfaces");
  });

  it("requires exact preservation and forbids inventing a fact", () => {
    expect(LANGUAGE_REALIZATION_ACT_CLAUSE_V10).toContain("preserve its factual content exactly as given");
    expect(LANGUAGE_REALIZATION_ACT_CLAUSE_V10).toContain("never invent, infer, paraphrase, expand or substitute a factual claim");
  });

  it("keeps PRIMARY_FACT and PRIMARY_STANCE wording intact", () => {
    expect(LANGUAGE_REALIZATION_ACT_CLAUSE_V10).toContain("When it is PRIMARY_FACT, state that authorized claim/result and nothing more");
    expect(LANGUAGE_REALIZATION_ACT_CLAUSE_V10).toContain("When it is PRIMARY_STANCE, express the selected stance");
  });
});

describe("quoted-span extraction", () => {
  it("finds straight and curly quoted spans", () => {
    expect(quotedSpansV0('You said "one" and then \u201Ctwo\u201D.')).toEqual(["one", "two"]);
  });

  it("finds no span for an unbalanced quotation (never guesses the end)", () => {
    expect(quotedSpansV0('He said "nothing closed here.')).toEqual([]);
  });
});

describe("GENERATIVE claim binding (the only relaxed surface)", () => {
  it("G2: an authorized SOURCE_QUOTE may be quoted verbatim", () => {
    expect(generative(`You mentioned before that "${QUOTE}"`)).toEqual({ ok: true });
  });

  it("G3: an authorized derivation's host-rendered text may be quoted verbatim", () => {
    const derivation: readonly AuthorizedClaimTextV0[] = Object.freeze([
      Object.freeze({ kind: "HOST_VERIFIABLE_DERIVATION" as const, text: "63 - 28 = 35." })
    ]);
    expect(generative('Earlier you worked out that "63 - 28 = 35."', derivation)).toEqual({ ok: true });
  });

  it("G4: an unauthorized quoted fact fails closed", () => {
    const checked = generative('You also said "I keep a blue notebook in the kitchen."');
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.detail).toContain("not carried by any host-authorized factual claim");
  });

  it("G5: an ALTERED quote fails closed even when the authorized claim is also present", () => {
    const checked = generative(`You said "${QUOTE}" and also "I keep a red notebook in the bedroom."`);
    expect(checked.ok).toBe(false);
  });

  it("G6/G1: no quotation at all is lawful, whether or not a claim is available", () => {
    expect(generative("Sure — here is a short poem about desks.")).toEqual({ ok: true });
    expect(generative("Sure — here is a short poem about desks.", [])).toEqual({ ok: true });
  });

  it("a quoted span must fit INSIDE an authorized claim, never the reverse", () => {
    const short: readonly AuthorizedClaimTextV0[] = Object.freeze([
      Object.freeze({ kind: "SOURCE_QUOTE" as const, text: "red notebook" })
    ]);
    // Quoting more than the authorized claim carries is unauthorized content.
    expect(generative(`You said "${QUOTE}"`, short).ok).toBe(false);
  });

  it("empty quotations are not content", () => {
    expect(generative('He said "" and that was it.')).toEqual({ ok: true });
  });
});

describe("every other atom and act keeps its previous acceptance surface", () => {
  const cases = [
    { name: "PRIMARY_FACT", atom: { kind: "PRIMARY_FACT", claim_index: 0, claim_kind: "SOURCE_QUOTE" } },
    { name: "PRIMARY_STANCE", atom: { kind: "PRIMARY_STANCE" } },
    { name: "GREET", atom: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "GREET", target_ref: "observation:o-1" } },
    { name: "ACKNOWLEDGE", atom: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE", target_ref: "observation:o-1" } }
  ] as const;

  for (const entry of cases) {
    it(`${entry.name}: an unauthorized quotation is NOT newly rejected (unchanged surface)`, () => {
      const checked = validateGenerativeClaimBindingV0({
        response_semantics: entry.atom as never,
        authorized_claims: authorized,
        text: 'Something "entirely unauthorized" here.'
      });
      expect(checked).toEqual({ ok: true });
    });
  }

  it("a legacy path with no response-semantics atom is untouched", () => {
    expect(
      validateGenerativeClaimBindingV0({ response_semantics: null, authorized_claims: [], text: '"anything at all"' })
    ).toEqual({ ok: true });
  });
});
