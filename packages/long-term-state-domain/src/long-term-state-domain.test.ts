/** Long-Term State Domain Boundary V0 executable contract tests (DB1-DB38). */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateSubjectState,
  type ValidationResult
} from "@characteros-next/subject-core";

import * as boundaryApi from "./index.js";
import {
  LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
  LONG_TERM_STATE_DOMAINS_V0,
  canonicalizeLongTermStateDomainSetV0,
  validateLongTermStateDomainApplicabilityV0,
  validateLongTermStateDomainV0,
  validateLongTermStateTargetV0,
  type LongTermStateDomainApplicabilityV0,
  type LongTermStateDomainSetV0,
  type LongTermStateTargetV0
} from "./index.js";

const PUBLIC_RUNTIME_EXPORTS = Object.keys(boundaryApi).sort();
const PRODUCTION_SOURCE = [
  readFileSync(new URL("./index.ts", import.meta.url), "utf8"),
  readFileSync(new URL("./long-term-state-domain.ts", import.meta.url), "utf8")
].join("\n");
const PRODUCTION_CODE = PRODUCTION_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^\s*\/\/.*$/gm,
  ""
);
const PACKAGE_MANIFEST = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { readonly dependencies?: Readonly<Record<string, string>> };
const SUBJECT_STATE_SOURCE = readFileSync(
  new URL("../../subject-core/src/types/subject-state.ts", import.meta.url),
  "utf8"
);
const SUBJECT_STATE_VALIDATION_SOURCE = readFileSync(
  new URL("../../subject-core/src/validation/subject-state.ts", import.meta.url),
  "utf8"
);
const BELIEF_PACKAGE_SOURCE = readFileSync(
  new URL("../../belief/src/index.ts", import.meta.url),
  "utf8"
);
const RELATIONSHIP_PACKAGE_SOURCE = readFileSync(
  new URL("../../relationship/src/index.ts", import.meta.url),
  "utf8"
);

function uncommented(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
}

function requireOk<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new Error(result.error.detail);
  return result.value;
}

function applicability(domains: unknown): ValidationResult<LongTermStateDomainApplicabilityV0> {
  return validateLongTermStateDomainApplicabilityV0({
    schema_version: LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
    domains
  });
}

describe("closed domain and canonical domain-set contract", () => {
  it("DB1 domain enum closed", () => {
    expect(LONG_TERM_STATE_DOMAINS_V0).toEqual(["PERSONALITY", "BELIEF", "RELATIONSHIP"]);
    expect(Object.isFrozen(LONG_TERM_STATE_DOMAINS_V0)).toBe(true);
  });

  it("DB2 unknown domain rejected", () => {
    expect(validateLongTermStateDomainV0("AFFECT").ok).toBe(false);
    expect(validateLongTermStateDomainV0("SELF").ok).toBe(false);
  });

  it("DB3 empty domain set valid", () => {
    expect(requireOk(canonicalizeLongTermStateDomainSetV0([]))).toEqual([]);
  });

  it("DB4 one domain valid", () => {
    expect(requireOk(canonicalizeLongTermStateDomainSetV0(["BELIEF"]))).toEqual(["BELIEF"]);
  });

  it("DB5 multiple domains valid", () => {
    expect(requireOk(canonicalizeLongTermStateDomainSetV0(["RELATIONSHIP", "BELIEF"]))).toEqual([
      "BELIEF",
      "RELATIONSHIP"
    ]);
  });

  it("DB6 all three domains valid", () => {
    expect(
      requireOk(
        canonicalizeLongTermStateDomainSetV0(["RELATIONSHIP", "PERSONALITY", "BELIEF"])
      )
    ).toEqual(["PERSONALITY", "BELIEF", "RELATIONSHIP"]);
  });

  it("DB7 duplicate domains rejected", () => {
    expect(canonicalizeLongTermStateDomainSetV0(["BELIEF", "BELIEF"]).ok).toBe(false);
    expect(
      canonicalizeLongTermStateDomainSetV0(["PERSONALITY", "BELIEF", "PERSONALITY"]).ok
    ).toBe(false);
  });

  it("DB8 canonical domain ordering deterministic", () => {
    expect(
      requireOk(
        canonicalizeLongTermStateDomainSetV0(["RELATIONSHIP", "BELIEF", "PERSONALITY"])
      )
    ).toEqual(["PERSONALITY", "BELIEF", "RELATIONSHIP"]);
  });

  it("DB9 shuffled equivalent domain set canonical-equivalent", () => {
    const a = requireOk(canonicalizeLongTermStateDomainSetV0(["BELIEF", "PERSONALITY"]));
    const b = requireOk(canonicalizeLongTermStateDomainSetV0(["PERSONALITY", "BELIEF"]));
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
  });
});

describe("closed target contract", () => {
  it("DB10 Personality target = subject-global only", () => {
    expect(
      requireOk(
        validateLongTermStateTargetV0({
          domain: "PERSONALITY",
          target_kind: "SUBJECT_GLOBAL"
        })
      )
    ).toEqual({ domain: "PERSONALITY", target_kind: "SUBJECT_GLOBAL" });
  });

  it("DB11 Personality + counterpart field rejected", () => {
    expect(
      validateLongTermStateTargetV0({
        domain: "PERSONALITY",
        target_kind: "SUBJECT_GLOBAL",
        counterpart_ref: "entity:alice"
      }).ok
    ).toBe(false);
  });

  it("DB12 Personality + proposition field rejected", () => {
    expect(
      validateLongTermStateTargetV0({
        domain: "PERSONALITY",
        target_kind: "SUBJECT_GLOBAL",
        proposition_id: "belief-proposition-p"
      }).ok
    ).toBe(false);
  });

  it("DB13 Belief target requires proposition id", () => {
    expect(
      validateLongTermStateTargetV0({ domain: "BELIEF", target_kind: "PROPOSITION" }).ok
    ).toBe(false);
  });

  it("DB14 Belief malformed target rejected", () => {
    expect(
      validateLongTermStateTargetV0({
        domain: "BELIEF",
        target_kind: "PROPOSITION",
        proposition_id: "not a canonical identifier"
      }).ok
    ).toBe(false);
  });

  it("DB15 Relationship target requires counterpart ref", () => {
    expect(
      validateLongTermStateTargetV0({ domain: "RELATIONSHIP", target_kind: "COUNTERPART" }).ok
    ).toBe(false);
  });

  it("DB16 Relationship malformed target rejected", () => {
    for (const counterpart_ref of ["not-a-canonical-ref", "observation:not-a-counterpart"]) {
      expect(
        validateLongTermStateTargetV0({
          domain: "RELATIONSHIP",
          target_kind: "COUNTERPART",
          counterpart_ref
        }).ok
      ).toBe(false);
    }
  });

  it("DB17 closed keys enforced", () => {
    expect(
      validateLongTermStateTargetV0({
        domain: "BELIEF",
        target_kind: "PROPOSITION",
        proposition_id: "belief-proposition-p",
        metadata: {}
      }).ok
    ).toBe(false);
    expect(
      validateLongTermStateTargetV0({
        domain: "BELIEF",
        target_kind: "PROPOSITION",
        counterpart_ref: "entity:alice"
      }).ok
    ).toBe(false);
    expect(
      validateLongTermStateTargetV0({
        domain: "RELATIONSHIP",
        target_kind: "COUNTERPART",
        proposition_id: "belief-proposition-p"
      }).ok
    ).toBe(false);
    expect(
      validateLongTermStateTargetV0({
        domain: "BELIEF",
        target_kind: "COUNTERPART",
        proposition_id: "belief-proposition-p"
      }).ok
    ).toBe(false);
    expect(
      validateLongTermStateTargetV0({
        domain: "RELATIONSHIP",
        target_kind: "PROPOSITION",
        counterpart_ref: "entity:alice"
      }).ok
    ).toBe(false);
    expect(
      validateLongTermStateDomainApplicabilityV0({
        schema_version: LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
        domains: [],
        metadata: {}
      }).ok
    ).toBe(false);
  });
});

describe("applicability is non-authorizing and explicit", () => {
  const extraFields: readonly [string, Record<string, unknown>][] = [
    ["DB18 domain applicability contains no delta", { delta: 0.1 }],
    ["DB19 domain applicability contains no next value", { next_value: 0.8 }],
    ["DB20 domain applicability contains no personality dimension", { dimension_id: "x" }],
    ["DB21 domain applicability contains no relationship metric", { trust: 0.5 }],
    ["DB22 domain applicability contains no belief confidence", { confidence: 0.9 }]
  ];

  it.each(extraFields)("%s", (_label, extra) => {
    expect(
      validateLongTermStateDomainApplicabilityV0({
        schema_version: LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
        domains: ["BELIEF"],
        ...extra
      }).ok
    ).toBe(false);
  });

  it("DB23 automatic domain classification absent", () => {
    expect(PUBLIC_RUNTIME_EXPORTS.filter((name) => /classif|infer|route/i.test(name))).toEqual([]);
    expect(PRODUCTION_CODE).not.toMatch(/\b(?:classif\w*|infer\w*|route\w*)\b\s*(?:[=(:])/i);
  });

  it("DB24 no model transport or network", () => {
    expect(PUBLIC_RUNTIME_EXPORTS.filter((name) => /provider|transport|network|model/i.test(name))).toEqual(
      []
    );
    expect(PRODUCTION_CODE).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|OpenAI|LLM|embedding)\b/i
    );
    expect(PACKAGE_MANIFEST.dependencies).toEqual({
      "@characteros-next/subject-core": "workspace:*"
    });
  });

  it("DB25 no memory search", () => {
    expect(PUBLIC_RUNTIME_EXPORTS.filter((name) => /memory|search|retrieve/i.test(name))).toEqual([]);
    expect(PRODUCTION_CODE).not.toMatch(/\b(?:memory|search|retrieve|embedding)\w*\b\s*(?:[=(:])/i);
    expect(
      validateLongTermStateDomainApplicabilityV0({
        schema_version: LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
        domains: ["BELIEF"],
        memory_refs: ["episode:e1"]
      }).ok
    ).toBe(false);
  });

  it("DB26 no canonical mutation", () => {
    expect(
      PUBLIC_RUNTIME_EXPORTS.filter((name) => /commit|execute|mutat|transition/i.test(name))
    ).toEqual(
      []
    );
    expect(PRODUCTION_CODE).not.toMatch(
      /\b(?:commit|reserve|execute|mutate|transition|applyPatch|writeState)\w*\b\s*(?:[=(:])/i
    );

    const input = {
      schema_version: LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
      domains: ["RELATIONSHIP", "BELIEF"]
    } as const;
    const before = JSON.stringify(input);
    const output = requireOk(validateLongTermStateDomainApplicabilityV0(input));
    expect(JSON.stringify(input)).toBe(before);
    expect(output).not.toBe(input);
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.domains)).toBe(true);
  });

  it("DB27 SubjectState version semantics are truthful and explicit", () => {
    expect(PUBLIC_RUNTIME_EXPORTS.filter((name) => /SubjectState/i.test(name))).toEqual([]);
    expect(SUBJECT_STATE_SOURCE).toContain(
      'export const SUBJECT_STATE_SCHEMA_VERSION = "subject-state-v3" as const;'
    );
    expect(SUBJECT_STATE_SOURCE).toContain(
      "readonly schema_version: typeof SUBJECT_STATE_SCHEMA_VERSION;"
    );
    expect(SUBJECT_STATE_VALIDATION_SOURCE).toContain(
      'lit(o["schema_version"], "subject-state-v3", "subjectState.schema_version")'
    );
    const legacyV2 = validateSubjectState({ schema_version: "subject-state-v2" });
    expect(legacyV2.ok).toBe(false);
    if (!legacyV2.ok) {
      expect(legacyV2.error.detail).toContain("subjectState.schema_version");
    }
    expect(SUBJECT_STATE_SOURCE).not.toMatch(/LongTermStateDomainApplicability/);
    expect(PRODUCTION_CODE).not.toMatch(/@characteros-next\/subject-core\/|SubjectState/);
  });

  it("DB28 traits_seed unused as domain authority", () => {
    expect(
      validateLongTermStateDomainApplicabilityV0({
        schema_version: LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
        domains: ["PERSONALITY"],
        traits_seed: { dimensions: {} }
      }).ok
    ).toBe(false);
  });

  it("DB29 transient affect not represented as a long-term domain", () => {
    for (const domain of ["AFFECT", "MOOD", "ANGER", "JOY", "APPRAISAL"]) {
      expect(validateLongTermStateDomainV0(domain).ok).toBe(false);
    }
  });

  it("DB30 synthetic Alice fixture: BELIEF and RELATIONSHIP are jointly valid", () => {
    const declared = requireOk(applicability(["RELATIONSHIP", "BELIEF"]));
    const beliefTarget = requireOk(
      validateLongTermStateTargetV0({
        domain: "BELIEF",
        target_kind: "PROPOSITION",
        proposition_id: "belief-alice-breaks-promises"
      })
    );
    const relationshipTarget = requireOk(
      validateLongTermStateTargetV0({
        domain: "RELATIONSHIP",
        target_kind: "COUNTERPART",
        counterpart_ref: "entity:alice"
      })
    );
    expect(declared.domains).toEqual(["BELIEF", "RELATIONSHIP"]);
    expect([beliefTarget.domain, relationshipTarget.domain]).toEqual(["BELIEF", "RELATIONSHIP"]);
    expect(declared.domains).not.toContain("PERSONALITY");
  });

  it("DB31 PERSONALITY and RELATIONSHIP are jointly valid", () => {
    expect(requireOk(applicability(["RELATIONSHIP", "PERSONALITY"])).domains).toEqual([
      "PERSONALITY",
      "RELATIONSHIP"
    ]);
  });

  it("DB32 all-three valid", () => {
    expect(
      requireOk(applicability(["RELATIONSHIP", "BELIEF", "PERSONALITY"])).domains
    ).toEqual(["PERSONALITY", "BELIEF", "RELATIONSHIP"]);
  });

  it("DB33 one evidence set may legally apply to multiple domains", () => {
    const declared = requireOk(applicability(["BELIEF", "RELATIONSHIP"]));
    expect(declared).toEqual({
      schema_version: LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
      domains: ["BELIEF", "RELATIONSHIP"]
    });
  });

  it("DB34 no automatic cross-domain cascade", () => {
    expect(requireOk(applicability(["RELATIONSHIP"])).domains).toEqual(["RELATIONSHIP"]);
    expect(requireOk(applicability(["BELIEF"])).domains).toEqual(["BELIEF"]);
  });

  it("DB35 future semantic cardinality contract allows zero-to-many", () => {
    const sets: readonly LongTermStateDomainSetV0[] = [
      [],
      ["PERSONALITY"],
      ["BELIEF", "RELATIONSHIP"],
      ["PERSONALITY", "BELIEF", "RELATIONSHIP"]
    ];
    for (const domains of sets) expect(applicability(domains).ok).toBe(true);
  });

  it("DB36 future Personality authority remains domain-specific", () => {
    const targets: readonly LongTermStateTargetV0[] = [
      requireOk(
        validateLongTermStateTargetV0({
          domain: "PERSONALITY",
          target_kind: "SUBJECT_GLOBAL"
        })
      ),
      requireOk(
        validateLongTermStateTargetV0({
          domain: "BELIEF",
          target_kind: "PROPOSITION",
          proposition_id: "belief-generalized-proposition"
        })
      ),
      requireOk(
        validateLongTermStateTargetV0({
          domain: "RELATIONSHIP",
          target_kind: "COUNTERPART",
          counterpart_ref: "subject:alice"
        })
      )
    ];
    expect(targets.map((target) => target.target_kind)).toEqual([
      "SUBJECT_GLOBAL",
      "PROPOSITION",
      "COUNTERPART"
    ]);
  });

  it("DB37 Belief foundation is canonical while packages/belief remains behavior-empty", () => {
    expect(PUBLIC_RUNTIME_EXPORTS.filter((name) => /BeliefState/i.test(name))).toEqual([]);
    expect(uncommented(BELIEF_PACKAGE_SOURCE)).toBe("export {};");
    expect(BELIEF_PACKAGE_SOURCE).not.toMatch(/\bBeliefState\w*\b/);
    expect(SUBJECT_STATE_SOURCE).toContain("export interface BeliefStateV0");
    expect(PRODUCTION_SOURCE).toContain("proposition_id");
    expect(PRODUCTION_SOURCE).not.toContain("proposition_ref");
  });

  it("DB38 RelationshipState not implemented", () => {
    expect(PUBLIC_RUNTIME_EXPORTS.filter((name) => /RelationshipState/i.test(name))).toEqual([]);
    expect(uncommented(RELATIONSHIP_PACKAGE_SOURCE)).toBe("export {};");
    expect(RELATIONSHIP_PACKAGE_SOURCE).not.toMatch(/\bRelationshipState\w*\b/);
  });
});
