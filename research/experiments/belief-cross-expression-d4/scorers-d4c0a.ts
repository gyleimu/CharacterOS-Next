/**
 * D4-C0a — THE FROZEN QUALIFICATION SCORER, AS A CALLABLE PURE FUNCTION.
 *
 * Implements `D4C0A_QUALIFICATION_RULE` (contract.ts, frozen at revision 0 and unchanged since) exactly:
 * three fixtures, three replicates each, each fixture's modal token must equal its pre-registered
 * expected token, and ANY invalid trial fails the instrument.
 *
 * It reads only the supplied records, the frozen fixture list, the frozen expected-token map and the
 * frozen token vocabulary. No clock, no provider metadata, no other line's outputs.
 */

import {
  D4C0A_EXPECTED_TOKEN_MAP,
  D4C0A_QUALIFICATION_FIXTURES,
  D4C0A_QUALIFICATION_RULE,
  D4C0A_TOKENS,
  type D4C0AToken
} from "./contract.ts";

export interface D4C0AQualificationTrialV0 {
  readonly trial_id: string;
  readonly fixture_id: string;
  readonly parsed_token: string | null;
}

export interface D4C0AQualificationOutcomeV0 {
  readonly instrument_verdict: "D4_C0A_INSTRUMENT_QUALIFIED" | "D4_C0A_INSTRUMENT_UNQUALIFIED";
  readonly per_fixture: Readonly<Record<string, { readonly counts: Record<string, number>; readonly modal: string | null; readonly tie: boolean; readonly expected: string; readonly records: number; readonly pass: boolean }>>;
  readonly invalid_trials: number;
  readonly invalid_rule_triggered: boolean;
  readonly denominator: number;
  readonly total_records: number;
  readonly exact_token_match_required: true;
  readonly tolerance_or_similarity_substitution: false;
  readonly what_it_proves: string;
  readonly what_it_does_not_prove: string;
}

function isLegal(token: string | null): token is D4C0AToken {
  return token !== null && (D4C0A_TOKENS as readonly string[]).includes(token);
}

function uniqueModalOf(counts: Record<string, number>): { modal: string | null; tie: boolean } {
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (top === undefined || top[1] === 0) return { modal: null, tie: false };
  const tie = ranked[1] !== undefined && ranked[1][1] === top[1];
  return { modal: tie ? null : top[0], tie };
}

export function scoreD4C0AQualificationV0(
  trials: readonly D4C0AQualificationTrialV0[]
): D4C0AQualificationOutcomeV0 {
  const replicates = D4C0A_QUALIFICATION_RULE.replicates_per_fixture;
  const perFixture: Record<string, { counts: Record<string, number>; modal: string | null; tie: boolean; expected: string; records: number; pass: boolean }> = {};
  let invalid = 0;
  let allPass = true;
  for (const fixture of D4C0A_QUALIFICATION_FIXTURES) {
    const rows = trials.filter((t) => t.fixture_id === fixture.fixture_id);
    invalid += rows.filter((r) => !isLegal(r.parsed_token)).length;
    const counts: Record<string, number> = {};
    for (const token of D4C0A_TOKENS) counts[token] = 0;
    for (const row of rows) {
      if (isLegal(row.parsed_token)) counts[row.parsed_token] = (counts[row.parsed_token] ?? 0) + 1;
    }
    const { modal, tie } = uniqueModalOf(counts);
    const expected = (D4C0A_EXPECTED_TOKEN_MAP[fixture.fixture_id] ?? "") as string;
    const pass = rows.length === replicates && modal === expected;
    if (!pass) allPass = false;
    perFixture[fixture.fixture_id] = { counts, modal, tie, expected, records: rows.length, pass };
  }
  const invalidRuleTriggered = invalid > 0;
  return Object.freeze({
    instrument_verdict: allPass && !invalidRuleTriggered ? "D4_C0A_INSTRUMENT_QUALIFIED" : "D4_C0A_INSTRUMENT_UNQUALIFIED",
    per_fixture: Object.freeze(perFixture),
    invalid_trials: invalid,
    invalid_rule_triggered: invalidRuleTriggered,
    denominator: D4C0A_QUALIFICATION_FIXTURES.length * replicates,
    total_records: trials.length,
    exact_token_match_required: true as const,
    tolerance_or_similarity_substitution: false as const,
    what_it_proves: D4C0A_QUALIFICATION_RULE.what_it_proves,
    what_it_does_not_prove: D4C0A_QUALIFICATION_RULE.what_it_does_not_prove
  });
}
