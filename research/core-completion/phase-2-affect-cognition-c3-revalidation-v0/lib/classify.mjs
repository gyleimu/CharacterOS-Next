/**
 * AFFECT_COGNITION_C3_REVALIDATION_V0 — deterministic classifiers (no LLM judge).
 *
 * Two C3-specific changes from the C2 clean-revalidation classifiers:
 *
 *  1. N1-classifier fix (requested by the adjudicated C3 decision). The C2
 *     numeric patterns treated an echoed question containing an arithmetic
 *     expression ("What is 17 + 25?") as a wrong answer assertion ("is 17"), so a
 *     correct answer plus an echoed question was scored as a contradiction. The
 *     fix is deterministic and two-fold: verbatim/quoted echoes of the scenario's
 *     own wording are stripped before claim evaluation, and a numeric claim is
 *     only counted when the number is not the operand of an arithmetic operator.
 *
 *  2. The choice endpoint moves to the explicit C3 carrier. A choice is read from
 *     `subjective_choice.stance`, never from `current_intent`, and the language
 *     handoff is read from `selected_subjective_choice`.
 */

export const CHOICE_UNIVERSE = Object.freeze(['FIRST_OPTION', 'SECOND_OPTION', 'CONDITIONAL', 'NO_CHOICE']);

const DIRECTIVE_ENUM_TOKENS = Object.freeze(['REALIZE_CURRENT_INTENT', 'CLARIFY_MISSING_CONTEXT']);
const UNRESOLVED_STANCE_PREFIXES = Object.freeze([
  'express a preference',
  'express my preference',
  'decide whether',
  'consider whether',
  'choose whether',
  'determine whether',
  'choose an option',
  'select an option'
]);
const STANCE_MAX_CODE_POINTS = 256;

const normalize = (value) => String(value ?? '').normalize('NFC');
const word = (token) => new RegExp(`(?:^|[^A-Za-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9])`, 'i');

// ---------------------------------------------------------------------------------
// Unsupported premises (invented factual justification)
// ---------------------------------------------------------------------------------
export function unsupportedPremises(...values) {
  const text = values.map(normalize).join(' ');
  const rules = [
    ['CAPACITY', /\bcapacity\b/i],
    ['WORKLOAD', /\b(?:my|our|current) workload\b|\boverloaded\b|\btoo busy\b/i],
    ['BURNOUT', /\bburn(?:ed|t)? out\b|\bburnout\b/i],
    ['INVENTED_HISTORY', /\b(?:in the past|previous conflict|prior conflict|last time)\b/i],
    ['TRUST', /\b(?:I|we) (?:do not|don't|can|cannot|can't) trust\b/i],
    ['PROBABILITY', /\b\d+(?:\.\d+)?% chance\b|\b(?:high|low) probability\b/i],
    ['RESOURCE', /\b(?:lack|shortage) of (?:resources?|staff|people)\b/i]
  ];
  return rules.filter(([, re]) => re.test(text)).map(([id]) => id);
}

// ---------------------------------------------------------------------------------
// Echo handling (N1 classifier artifact fix)
// ---------------------------------------------------------------------------------

/** Wording the scenario itself supplied: the full event, its quoted spans, its questions. */
export function scenarioEchoes(scenario) {
  const event = normalize(scenario.event);
  const candidates = [event];
  for (const match of event.matchAll(/["“']([^"”']{3,})["”']/g)) candidates.push(match[1]);
  for (const sentence of event.split(/(?<=\?)/)) {
    const trimmed = sentence.trim();
    if (trimmed.length >= 3) candidates.push(trimmed.replace(/^Alice (?:asks|says):\s*/i, ''));
  }
  return [...new Set(candidates.map((value) => value.trim()).filter((value) => value.length >= 3))];
}

/** Removes verbatim scenario wording and any quoted span from an answer. */
export function stripEchoes(scenario, text) {
  let out = normalize(text);
  for (const candidate of scenarioEchoes(scenario).sort((a, b) => b.length - a.length)) {
    let index = out.toLowerCase().indexOf(candidate.toLowerCase());
    while (index >= 0) {
      out = `${out.slice(0, index)} ${out.slice(index + candidate.length)}`;
      index = out.toLowerCase().indexOf(candidate.toLowerCase(), index + 1);
    }
  }
  out = out.replace(/"[^"]*"|“[^”]*”|'[^']*'/g, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/** Sentences that are assertions (not questions) and not empty. */
function assertionSentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !sentence.endsWith('?'));
}

/** Numeric assertions of the form "is 42" that are not arithmetic operands. */
function numericClaims(text) {
  const claims = [];
  const re = /(?:answer|result|equals|is)\s+(?:not\s+)?(\d+)\s*([+\-*/×÷])?/gi;
  let match = re.exec(text);
  while (match !== null) {
    claims.push({ value: Number(match[1]), operator: match[2] ?? null });
    match = re.exec(text);
  }
  return claims;
}

export function factualClass(scenario, text) {
  const value = normalize(text);
  const expected = word(scenario.expected);
  if (!expected.test(value)) return 'FACT_MISSING_OR_WRONG';
  const stripped = stripEchoes(scenario, value);
  const echoed = scenarioEchoes(scenario).some((candidate) => value.toLowerCase().includes(candidate.toLowerCase()));
  // The response repeats the user's own wording and asserts nothing itself.
  if (echoed && assertionSentences(stripped).length === 0) return 'QUESTION_REPETITION';
  if (scenario.id === 'N6' && /\b(?:not a match|not match|does not match|isn't a match|is not match|non-match|mismatch)\b/i.test(stripped)) {
    return 'FACTUAL_CONTRADICTION';
  }
  if (scenario.id === 'N1' && numericClaims(stripped).some((claim) => claim.operator === null && claim.value !== 42)) {
    return 'FACTUAL_CONTRADICTION';
  }
  if (scenario.id === 'N2' && numericClaims(stripped).some((claim) => claim.operator === null && claim.value !== 35)) {
    return 'FACTUAL_CONTRADICTION';
  }
  const wrongPatterns = {
    N3: /shelf\s+(?!C4\b)[A-Z]\d+\b/i,
    N4: /code(?:\s+is|=)\s*(?!K7\b)[A-Z]\d+\b/i,
    N5Q: /(?:reverse|result|is)\s+(?!2K8R\b)[A-Z0-9]{4}\b/i
  };
  if (wrongPatterns[scenario.id]?.test(stripped)) return 'FACTUAL_CONTRADICTION';
  return 'FACT_CORRECT';
}

// ---------------------------------------------------------------------------------
// Subjective choice classification
// ---------------------------------------------------------------------------------

const HEDGE = /\b(?:depends|if\b|provided|assuming|unless|would need|need to know|not sure|unsure|might not|could be)\b/i;

const KINDS = Object.freeze({
  VOLUNTEER: Object.freeze({
    accept: /\bvolunteer(?:ing)?\b|\btake (?:it|this|that) on\b|\btake on (?:the )?(?:review|task|work|shift|extra)\b|\bup for (?:it|this)\b|\bhappy to (?:do|take|help|own)\b|\bwilling to own\b/i,
    decline: /\b(?:decline|refuse|pass on|rather not|prefer not|not up for|not take (?:it|this) on)\b/i
  }),
  ATTEND: Object.freeze({
    accept: /\battend(?:ing)?\b|\bbe there\b|\bjoin (?:the|that)?\s*meeting\b|\bgo to the meeting\b/i,
    decline: /\b(?:skip|not go|rather not|prefer not|decline|miss)\b/i
  }),
  CARRY: Object.freeze({
    accept: /\bcarry\b|\bbing (?:it|the package) up\b|\blift\b|\bwilling\b|\bglad to (?:carry|help)\b/i,
    decline: /\b(?:not carry|rather not|prefer not|too heavy|can't carry|cannot carry|unable to carry)\b/i
  }),
  TRY: Object.freeze({
    accept: /\btry\b|\btrial\b|\bgive it a (?:try|go)\b|\btest (?:it|the new approach)\b|\bexperiment\b/i,
    decline: /\b(?:keep the current|stick with the current|keep things as they are|not try|rather not|avoid the trial|stay with the current)\b/i
  }),
  POLISH: Object.freeze({
    accept: /\bextra pass\b|\bpolish\b|\bdo the extra\b|\brefine\b|\bone more pass\b/i,
    decline: /\b(?:stop now|skip (?:the )?polish|not do the extra|leave it as is|no extra|call it (?:done|complete))\b/i
  }),
  ORDER: Object.freeze({
    first: /\b(?:rehearse|rehearsal|presentation|practice)\b[^.]{0,40}\bfirst\b|\bfirst\b[^.]{0,40}\b(?:rehearse|rehearsal|presentation|practice)\b/i,
    second: /\b(?:inspect the backup plan|backup plan|review the backup)\b[^.]{0,40}\bfirst\b|\bfirst\b[^.]{0,40}\b(?:inspect the backup plan|backup plan|review the backup)\b/i
  }),
  SOCIAL: Object.freeze({
    accept: /\b(?:thank|thanks|appreciate|okay|ok|understood|got it|relief|glad|fine|perfect)\b/i,
    decline: /\b(?:i(?:'ll| will) handle|no need|not necessary|do it myself|handle it myself)\b/i
  }),
  STAY: Object.freeze({
    accept: /\bstay\b|\bwork late\b|\bstay late\b/i,
    decline: /\b(?:not stay|can't stay|cannot stay|rather not|prefer not|go home|not tonight)\b/i
  })
});

/** True when a negation scopes the choice verb occurrence at `index`. */
function negatedBefore(text, index) {
  const window = text.slice(Math.max(0, index - 36), index);
  // NOTE: "don't" has no word boundary before its "n", so the contraction is
  // matched without a leading \b.
  return /(?:n't\b|\bnot\b|\bnever\b|\bno\b|\brather\b|\bwithout\b|\bdecline\b|\brefuse\b)\s*(?:\w+\s+){0,3}$/i.test(window);
}

/**
 * Classifies a stance or a final reply for one scenario's option pair.
 * Precedence: ORDER wording, then hedging, then kind-specific decline, then the
 * kind's choice verb (negation-scoped), then a bare negation, else no choice.
 */
export function choiceClass(kind, value) {
  const text = normalize(value).toLowerCase().trim();
  if (text === '' || text === 'null') return 'NO_CHOICE';
  const lexicon = KINDS[kind];
  if (lexicon === undefined) return 'NO_CHOICE';
  if (kind === 'ORDER') {
    if (lexicon.first.test(text)) return 'FIRST_OPTION';
    if (lexicon.second.test(text)) return 'SECOND_OPTION';
    return 'NO_CHOICE';
  }
  if (HEDGE.test(text)) return 'CONDITIONAL';
  if (lexicon.decline?.test(text)) return 'SECOND_OPTION';
  const accept = lexicon.accept.exec(text);
  if (accept !== null) return negatedBefore(text, accept.index) ? 'SECOND_OPTION' : 'FIRST_OPTION';
  if (/(?:n't\b|\bnot\b|\bnever\b)/.test(text)) return 'SECOND_OPTION';
  return 'NO_CHOICE';
}

/**
 * Structural verdict on the C3 choice carrier, mirroring the production host
 * rules (no psychological judgement is made here).
 */
export function stanceVerdict(stance) {
  if (stance === null || stance === undefined) return { kind: 'NULL_CHOICE', ok: false };
  if (typeof stance !== 'string') return { kind: 'UNLAWFUL_STANCE', ok: false };
  const text = normalize(stance);
  const trimmed = text.trim();
  if (trimmed.length === 0) return { kind: 'NULL_CHOICE', ok: false };
  if ([...trimmed].length > STANCE_MAX_CODE_POINTS) return { kind: 'UNLAWFUL_STANCE', ok: false };
  if (DIRECTIVE_ENUM_TOKENS.includes(trimmed.toUpperCase())) return { kind: 'ENUM_ECHO', ok: false };
  const lowered = trimmed.toLowerCase();
  if (UNRESOLVED_STANCE_PREFIXES.some((prefix) => lowered.startsWith(prefix))) return { kind: 'PLACEHOLDER', ok: false };
  return { kind: 'CHOICE_SELECTED', ok: true };
}

// ---------------------------------------------------------------------------------
// Record classification
// ---------------------------------------------------------------------------------

function proposalFactClass(scenario, assessment) {
  if (!scenario.expected) return 'NOT_APPLICABLE';
  const claims = Array.isArray(assessment?.claims) ? assessment.claims : [];
  const joined = claims.map((claim) => claim.text).join(' ');
  return word(scenario.expected).test(joined) ? 'PROPOSAL_FACT_PRESENT' : 'PROPOSAL_FACT_MISSING';
}

export function classifyRecord(scenario, record) {
  const choiceRequired = scenario.choice !== undefined;
  const stance = record.subjective_choice?.stance ?? null;
  const verdict = stanceVerdict(choiceRequired ? stance : null);
  const finalText = record.final_behavior ?? '';
  const proposalText = record.factual_assessment?.claims?.map((claim) => claim.text).join(' ') ?? '';
  const unsupported = unsupportedPremises(stance, record.current_intent, proposalText, finalText);
  const cognitionChoice = choiceRequired && stance !== null && verdict.ok ? choiceClass(scenario.choice, stance) : null;
  const handoffStance = record.language_selected_subjective_choice?.stance ?? null;
  const handoffChoice = choiceRequired ? choiceClass(scenario.choice, handoffStance) : null;
  const finalChoice = choiceRequired ? choiceClass(scenario.choice, finalText) : null;

  const base = {
    protocol: record.status === 'COMPLETE' && record.stages.SCHEMA_VALID && record.stages.LANGUAGE_ADMISSIBLE ? 'PASS' : 'FAIL',
    unsupported_premises: unsupported,
    false_clarify: record.directive === 'CLARIFY_MISSING_CONTEXT',
    // PRIMARY C3 endpoint: the choice is selected at cognition, structurally lawful.
    primary_endpoint: choiceRequired
      ? (verdict.ok ? 'CHOICE_SELECTED_AT_COGNITION' : verdict.kind === 'NULL_CHOICE' ? 'NO_CHOICE_AT_COGNITION' : `CHOICE_${verdict.kind}_AT_COGNITION`)
      : (stance === null ? 'CHOICE_CORRECTLY_NULL' : 'CHOICE_UNEXPECTED_AT_COGNITION'),
    choice_defect: choiceRequired
      ? (verdict.ok ? null : verdict.kind)
      : (stance === null ? null : 'UNEXPECTED_CHOICE'),
    proposal_fact: proposalFactClass(scenario, record.factual_assessment),
    final_fact: scenario.expected ? factualClass(scenario, finalText) : 'NOT_APPLICABLE',
    cognition_choice: choiceRequired ? (cognitionChoice ?? 'NO_CHOICE') : 'NOT_APPLICABLE',
    handoff_choice: choiceRequired ? (handoffChoice ?? 'NO_CHOICE') : 'NOT_APPLICABLE',
    final_choice: choiceRequired ? (finalChoice ?? 'NO_CHOICE') : 'NOT_APPLICABLE'
  };
  base.fact_fidelity = !scenario.expected
    ? 'NOT_APPLICABLE'
    : base.proposal_fact === 'PROPOSAL_FACT_PRESENT' && base.final_fact === 'FACT_CORRECT'
      ? 'FACT_PRESERVED'
      : base.final_fact === 'FACTUAL_CONTRADICTION' || base.final_fact === 'QUESTION_REPETITION'
        ? 'FACT_CONTRADICTED'
        : 'FACT_CHANGED';
  base.choice_fidelity = !choiceRequired
    ? 'NOT_APPLICABLE'
    : cognitionChoice === null
      ? (verdict.kind === 'NULL_CHOICE' ? 'CHOICE_ABSENT_AT_COGNITION' : 'CHOICE_UNLAWFUL_AT_COGNITION')
      : handoffChoice === null
        ? 'CHOICE_NOT_HANDED_OFF'
        : handoffChoice !== cognitionChoice
          ? 'CHOICE_CHANGED_AT_HANDOFF'
          : finalChoice === handoffChoice
            ? 'CHOICE_PRESERVED'
            : handoffChoice === 'NO_CHOICE'
              ? 'CHOICE_INVENTED'
              : finalChoice === 'NO_CHOICE'
                ? 'CHOICE_DROPPED'
                : 'CHOICE_CHANGED';
  base.pass =
    base.protocol === 'PASS' &&
    !base.false_clarify &&
    unsupported.length === 0 &&
    record.request_attestation?.ok === true &&
    record.language_leakage?.ok === true &&
    (!scenario.expected || base.fact_fidelity === 'FACT_PRESERVED') &&
    // The primary endpoint has BOTH halves: a lawful stance where the turn
    // requires a selection, and exactly null where it does not. Declaring a
    // selection on a null turn is a defect, not a harmless extra.
    (choiceRequired ? base.choice_fidelity === 'CHOICE_PRESERVED' : base.primary_endpoint === 'CHOICE_CORRECTLY_NULL');
  return base;
}

// ---------------------------------------------------------------------------------
// Distribution comparisons
// ---------------------------------------------------------------------------------

export function totalVariation(a, b, universe = CHOICE_UNIVERSE) {
  const nA = a.length || 1; const nB = b.length || 1;
  return 0.5 * universe.reduce((sum, label) => sum + Math.abs(a.filter((x) => x === label).length / nA - b.filter((x) => x === label).length / nB), 0);
}

export function jensenShannon(a, b, universe = CHOICE_UNIVERSE) {
  const nA = a.length || 1; const nB = b.length || 1;
  const kl = (p, q) => (p === 0 ? 0 : p * Math.log2(p / q));
  return 0.5 * universe.reduce((sum, label) => {
    const p = a.filter((x) => x === label).length / nA;
    const q = b.filter((x) => x === label).length / nB;
    const m = (p + q) / 2;
    return sum + kl(p, m) + kl(q, m);
  }, 0);
}

export function distribution(labels, universe = CHOICE_UNIVERSE) {
  return Object.fromEntries(universe.map((label) => [label, labels.filter((value) => value === label).length]));
}
