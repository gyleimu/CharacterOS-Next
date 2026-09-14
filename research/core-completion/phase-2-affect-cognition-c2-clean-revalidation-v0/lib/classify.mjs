const normalize = (value) => String(value ?? '').normalize('NFC');
const word = (token) => new RegExp(`(?:^|[^A-Za-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9])`, 'i');

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

export function choiceClass(kind, value) {
  const text = normalize(value).toLowerCase();
  if (text.trim() === '') return 'NO_CHOICE';
  if (/\b(?:depends|if |provided|assuming|unless|would need|need to know|not sure|unsure)\b/.test(text)) return 'CONDITIONAL';
  const decline = /\b(?:would not|wouldn't|do not want|don't want|decline|refuse|pass|rather not|prefer not|won't|cannot|can't|keep the current|stop now|inspect the backup plan first|backup plan first|not stay)\b/;
  const accept = /\b(?:would volunteer|i volunteer|willing to|would attend|prefer to attend|would try|i'd try|try it|do the extra pass|would do|rehearse(?: the presentation)? first|presentation first|would stay|i can stay|happy to|yes[, .])\b/;
  if (kind === 'ORDER') {
    if (/\b(?:inspect the backup plan|backup plan)\b[^.]{0,40}\bfirst\b|\bfirst\b[^.]{0,40}\b(?:inspect the backup plan|backup plan)\b/.test(text)) return 'SECOND_OPTION';
    if (/\b(?:rehearse|presentation)\b[^.]{0,40}\bfirst\b|\bfirst\b[^.]{0,40}\b(?:rehearse|presentation)\b/.test(text)) return 'FIRST_OPTION';
  }
  if (decline.test(text)) return 'SECOND_OPTION';
  if (accept.test(text)) return 'FIRST_OPTION';
  if (kind === 'SOCIAL' && /\b(?:thank|appreciate|okay|understood|got it|relief)\b/.test(text)) return 'FIRST_OPTION';
  return 'NO_CHOICE';
}

export function factualClass(scenario, text) {
  const value = normalize(text);
  const expected = word(scenario.expected);
  if (!expected.test(value)) return 'FACT_MISSING_OR_WRONG';
  if (scenario.id === 'N6' && /\b(?:not a match|not match|does not match|isn't a match|is not match|non-match|mismatch)\b/i.test(value)) return 'FACTUAL_CONTRADICTION';
  if (scenario.id === 'N4' && /what code is printed\?\s*$/i.test(value.trim())) return 'QUESTION_REPETITION';
  const wrongPatterns = {
    N1: /(?:answer|result|equals|is)\s+(?:not\s+)?(?!42\b)\d+\b/i,
    N2: /(?:answer|result|equals|is)\s+(?:not\s+)?(?!35\b)\d+\b/i,
    N3: /shelf\s+(?!C4\b)[A-Z]\d+\b/i,
    N4: /code(?:\s+is|=)\s*(?!K7\b)[A-Z]\d+\b/i,
    N5Q: /(?:reverse|result|is)\s+(?!2K8R\b)[A-Z0-9]{4}\b/i
  };
  if (wrongPatterns[scenario.id]?.test(value)) return 'FACTUAL_CONTRADICTION';
  return 'FACT_CORRECT';
}

function proposalFactClass(scenario, assessment) {
  if (!scenario.expected) return 'NOT_APPLICABLE';
  const claims = Array.isArray(assessment?.claims) ? assessment.claims : [];
  const joined = claims.map((claim) => claim.text).join(' ');
  return word(scenario.expected).test(joined) ? 'PROPOSAL_FACT_PRESENT' : 'PROPOSAL_FACT_MISSING';
}

export function classifyRecord(scenario, record) {
  const finalText = record.final_behavior ?? '';
  const proposalText = record.factual_assessment?.claims?.map((claim) => claim.text).join(' ') ?? '';
  const unsupported = unsupportedPremises(record.current_intent, proposalText, finalText);
  const base = {
    protocol: record.status === 'COMPLETE' && record.stages.SCHEMA_VALID && record.stages.LANGUAGE_ADMISSIBLE ? 'PASS' : 'FAIL',
    unsupported_premises: unsupported,
    false_clarify: record.directive === 'CLARIFY_MISSING_CONTEXT',
    proposal_fact: proposalFactClass(scenario, record.factual_assessment),
    final_fact: scenario.expected ? factualClass(scenario, finalText) : 'NOT_APPLICABLE',
    intent_choice: scenario.choice ? choiceClass(scenario.choice, record.current_intent) : 'NOT_APPLICABLE',
    final_choice: scenario.choice ? choiceClass(scenario.choice, finalText) : 'NOT_APPLICABLE'
  };
  base.fact_fidelity = !scenario.expected ? 'NOT_APPLICABLE' : base.proposal_fact === 'PROPOSAL_FACT_PRESENT' && base.final_fact === 'FACT_CORRECT' ? 'FACT_PRESERVED' : base.final_fact === 'FACTUAL_CONTRADICTION' ? 'FACT_CONTRADICTED' : 'FACT_CHANGED';
  base.choice_fidelity = !scenario.choice ? 'NOT_APPLICABLE' : base.intent_choice === 'NO_CHOICE' ? (base.final_choice === 'NO_CHOICE' ? 'CHOICE_MISSING' : 'CHOICE_INVENTED') : base.final_choice === base.intent_choice ? 'CHOICE_PRESERVED' : 'CHOICE_CHANGED';
  base.pass = base.protocol === 'PASS' && !base.false_clarify && unsupported.length === 0 && record.request_attestation?.ok === true && record.language_leakage?.ok === true && (!scenario.expected || base.fact_fidelity === 'FACT_PRESERVED') && (!scenario.choice || base.choice_fidelity === 'CHOICE_PRESERVED');
  return base;
}

export function totalVariation(a, b, universe) {
  const nA = a.length || 1; const nB = b.length || 1;
  return 0.5 * universe.reduce((sum, label) => sum + Math.abs(a.filter((x) => x === label).length / nA - b.filter((x) => x === label).length / nB), 0);
}

export function jensenShannon(a, b, universe) {
  const nA = a.length || 1; const nB = b.length || 1;
  const kl = (p, q) => p === 0 ? 0 : p * Math.log2(p / q);
  return 0.5 * universe.reduce((sum, label) => { const p = a.filter((x) => x === label).length / nA; const q = b.filter((x) => x === label).length / nB; const m = (p + q) / 2; return sum + kl(p, m) + kl(q, m); }, 0);
}

export function distribution(labels, universe = ['FIRST_OPTION', 'SECOND_OPTION', 'CONDITIONAL', 'NO_CHOICE']) {
  return Object.fromEntries(universe.map((label) => [label, labels.filter((value) => value === label).length]));
}
