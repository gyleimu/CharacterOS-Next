/**
 * AFFECT_COGNITION_C4_4_SUBJECTIVE_BASIS_AND_STANCE_GROUNDING_V0 — classifiers.
 *
 * Deterministic, rule-based, no LLM judge. Carries over the C4 classifiers and adds
 * the C4.2 endpoints:
 *
 *   rationale category in the frozen allowed/forbidden scheme
 *   OFF_QUESTION_STANCE          — a SELECTED stance that does not answer the scenario's pair
 *   SEMANTICALLY_COMPLETED_BY_LANGUAGE — Language supplied content the stance lacked
 */

export const CHOICE_UNIVERSE = Object.freeze(['FIRST_OPTION', 'SECOND_OPTION', 'CONDITIONAL', 'NO_CHOICE']);

const DIRECTIVE_ENUM_TOKENS = Object.freeze(['REALIZE_CURRENT_INTENT', 'CLARIFY_MISSING_CONTEXT']);
const UNRESOLVED_STANCE_PREFIXES = Object.freeze([
  'express a preference', 'express my preference', 'decide whether', 'consider whether',
  'choose whether', 'determine whether', 'choose an option', 'select an option'
]);
const STANCE_MAX_CODE_POINTS = 256;
const RATIONALE_MAX_CODE_POINTS = 256;

const normalize = (value) => String(value ?? '').normalize('NFC');
const word = (token) => new RegExp(`(?:^|[^A-Za-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9])`, 'i');

// ---------------------------------------------------------------------------------
// Rationale categories (frozen scheme)
// ---------------------------------------------------------------------------------

const SELF_STATE_PATTERNS = [
  ['ENERGY', /\benergy\b/i],
  ['STRESS', /\bstress(?:ed)?\b/i],
  ['FATIGUE', /\bfatigue[ds]?\b|\btired\b|\bexhaust(?:ed|ion)?\b/i],
  ['AROUSAL', /\barousal\b|\baroused\b/i],
  ['FRESHNESS', /\bfresh(?:ness)?\b|\brefreshed\b/i],
  ['MOOD', /\bmood\b|\bmy mind\b|\bmental(?:ly)? (?:state|readiness|ready)\b/i],
  ['ALERTNESS', /\balert(?:ness)?\b|\bsharp\b|\bawake\b|\bfoggy\b/i],
  ['REGULATION_VALUE', /\bregulation\b|\barousal\s*=|energy\s*=|stress\s*=|fatigue\s*=/i],
  ['STATE_REVISION', /\bstate\s+revision\b|\brevision\s+\d+/i]
];
const NAMED_PSYCHOLOGICAL_PATTERNS = [
  ['NAMED_STATE', /\b(?:i am|i'm|i feel|feeling|am i)\b[^.]{0,30}\b(?:calm|energized|energetic|stressed|anxious|excited|overwhelmed|drained|weary|upbeat)\b/i],
  ['NAMED_TRAIT_STATE', /\b(?:my|the)\s+(?:patience|focus|concentration|attention)\s+(?:is|are)\s+(?:low|high|good|short|long)\b/i]
];
const CAPACITY_PATTERNS = [
  ['CAPACITY', /\bcapacity\b|\bbandwidth\b/i],
  ['CAPABILITY', /\bcapable\b|\bcapability\b|\bable to\b|\bunable to\b|\bcan manage\b|\bcan handle\b/i],
  ['SCOPE', /\bwithin my (?:operational )?scope\b|\bwithin scope\b|\boperational scope\b/i],
  ['READINESS', /\bready to\b|\breadiness\b|\bprepared to take\b/i]
];
const EXTERNAL_FACT_PATTERNS = [
  ['TIME_AVAILABILITY', /\b(?:i|we)\s+(?:only\s+)?have\s+(?:\d+|no|enough|little|a few|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:minutes?|hours?|time)\b|\bno time\b/i],
  ['DEADLINE', /\bthe deadline\b/i],
  ['RESOURCES', /\b(?:no|lack of|shortage of) (?:resources?|staff|people|budget)\b/i],
  ['PROBABILITY', /\b\d+(?:\.\d+)?% chance\b|\b(?:high|low) probability\b/i],
  ['ENVIRONMENT_FACT', /\bthe room\b[^.]{0,30}\b(?:is|was)\b|\btemperature is\b/i]
];
const HISTORY_PATTERNS = [
  ['HISTORY', /\b(?:in the past|last time|previously|before)\b[^.]{0,40}\b(?:failed|worked|happened|did|went)\b/i],
  ['SELF_PERFORMANCE_HISTORY', /\b(?:i|we)\s+(?:have\s+)?(?:handled|managed|done|tried|failed|succeeded|fixed)\b[^.]{0,30}\b(?:before|previously|last time|in the past|already)\b/i],
  ['COUNTERPART_HISTORY', /\b(?:alice|the user|they)\s+(?:is|are|was|were)\s+(?:unreliable|late|wrong|hostile)\b/i]
];

const collect = (text, rules) => rules.filter(([, re]) => re.test(normalize(text))).map(([id]) => id);

/**
 * Classifies one rationale into the frozen scheme. A rationale is LAWFUL when it
 * carries at least one allowed class and no forbidden class; unclear or empty
 * rationales never default to lawful.
 */
export function rationaleVerdict(rationale) {
  if (rationale === null || rationale === undefined) {
    return { category: 'ABSENT', lawful: true, allowed_classes: [], forbidden_classes: [] };
  }
  const text = normalize(rationale);
  const forbidden = [
    ...collect(text, SELF_STATE_PATTERNS).map((id) => ({ kind: 'RAW_SELF_STATE_DESCRIPTION', detail: id })),
    ...collect(text, NAMED_PSYCHOLOGICAL_PATTERNS).map((id) => ({ kind: 'NAMED_PSYCHOLOGICAL_STATE', detail: id })),
    ...collect(text, CAPACITY_PATTERNS).map((id) => ({ kind: 'INFERRED_CAPACITY', detail: id })),
    ...collect(text, EXTERNAL_FACT_PATTERNS).map((id) => ({ kind: 'EXTERNAL_FACT', detail: id })),
    ...collect(text, HISTORY_PATTERNS).map((id) => ({ kind: 'HISTORY_CLAIM', detail: id }))
  ];
  const allowed = [];
  if (/\bi(?:'d| would)?\s+(?:rather|prefer)\b|\bi prefer\b|\bmy preference\b|\bprefer\b/i.test(text)) allowed.push('PURE_PREFERENCE');
  if (/\bprioriti[sz]e\b|\bfirst\b|\bpriority\b|\brather (?:do|tackle) .* first\b/i.test(text)) allowed.push('PRIORITY');
  if (/\brather not\b|\bprefer not\b|\bavoid\b|\bno (?:extra|more)\b/i.test(text)) allowed.push('AVERSION');
  if (/\bwilling\b|\bglad to\b|\bhappy to\b|\bup for\b|\bdon't mind\b/i.test(text)) allowed.push('WILLINGNESS');
  if (/\bapproach\b|\bstrategy\b|\bstyle\b|\bthoroughness\b|\bcooperative\b|\bproactive\b/i.test(text)) allowed.push('SUBJECTIVE_STRATEGY');

  const forbiddenKinds = [...new Set(forbidden.map((entry) => entry.kind))];
  const lawful = forbiddenKinds.length === 0 && allowed.length > 0;
  const category = forbiddenKinds.length > 0 ? forbiddenKinds[0]
    : allowed.length > 0 ? allowed[0] : 'UNCLASSIFIED';
  return { category, lawful, allowed_classes: allowed, forbidden_classes: forbidden };
}

// ---------------------------------------------------------------------------------
// Factual-side self-state audit (unchanged from C4)
// ---------------------------------------------------------------------------------

export function selfStateAssertion(text) {
  return [...collect(text, SELF_STATE_PATTERNS).map((id) => id), ...collect(text, CAPACITY_PATTERNS).map((id) => id)];
}

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
// Echo handling + factual classification (unchanged from C3/C4)
// ---------------------------------------------------------------------------------

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

function assertionSentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !sentence.endsWith('?'));
}

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
  if (echoed && assertionSentences(stripped).length === 0) return 'QUESTION_REPETITION';
  if (scenario.id === 'N6' && /\b(?:not a match|not match|does not match|isn't a match|is not match|non-match|mismatch)\b/i.test(stripped)) {
    return 'FACTUAL_CONTRADICTION';
  }
  if (scenario.id === 'N1' && numericClaims(stripped).some((claim) => claim.operator === null && claim.value !== 42)) return 'FACTUAL_CONTRADICTION';
  if (scenario.id === 'N2' && numericClaims(stripped).some((claim) => claim.operator === null && claim.value !== 35)) return 'FACTUAL_CONTRADICTION';
  const wrongPatterns = {
    N3: /shelf\s+(?!C4\b)[A-Z]\d+\b/i,
    N4: /code(?:\s+is|=)\s*(?!K7\b)[A-Z]\d+\b/i,
    N5Q: /(?:reverse|result|is)\s+(?!2K8R\b)[A-Z0-9]{4}\b/i
  };
  if (wrongPatterns[scenario.id]?.test(stripped)) return 'FACTUAL_CONTRADICTION';
  return 'FACT_CORRECT';
}

// ---------------------------------------------------------------------------------
// Choice classification (unchanged lexicon)
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

function negatedBefore(text, index) {
  const window = text.slice(Math.max(0, index - 36), index);
  return /(?:n't\b|\bnot\b|\bnever\b|\bno\b|\brather\b|\bwithout\b|\bdecline\b|\brefuse\b)\s*(?:\w+\s+){0,3}$/i.test(window);
}

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

export function preferencePresent(text) {
  const value = normalize(text);
  return [
    /\b(?:i|we)\s+would\b/i, /\bi(?:'d| would)\s+rather\b/i, /\b(?:i|we)\s+prefer\b/i,
    /\b(?:willing|happy|glad)\s+to\b/i, /\b(?:i|we)\s+(?:accept|decline|refuse)\b/i,
    /\b(?:not|don't|do not|wouldn't|would not)\s+(?:want|volunteer|attend|carry|stay|try)\b/i,
    /\bmy preference\b|\bthat(?:'s| is) my preference\b/i
  ].some((re) => re.test(value));
}

// ---------------------------------------------------------------------------------
// Tagged carrier + language completion
// ---------------------------------------------------------------------------------

export function applicabilityVerdict(choice) {
  if (choice === null || choice === undefined) return { tag: 'UNLAWFUL', reason: 'MISSING_CHOICE' };
  if (typeof choice !== 'object' || Array.isArray(choice)) return { tag: 'UNLAWFUL', reason: 'EXPECTED_OBJECT' };
  const keys = Object.keys(choice);
  if (choice.kind === 'NO_SUBJECTIVE_SELECTION') {
    if (keys.length !== 1) return { tag: 'UNLAWFUL', reason: 'NOT_APPLICABLE_EXTRA_KEYS' };
    return { tag: 'NO_SUBJECTIVE_SELECTION', reason: null };
  }
  if (choice.kind === 'SUBJECTIVE_SELECTION') {
    const expected = ['kind', 'stance', 'subjective_rationale'];
    if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) return { tag: 'UNLAWFUL', reason: 'SELECTED_KEYS' };
    const stance = choice.stance;
    if (typeof stance !== 'string') return { tag: 'UNLAWFUL', reason: 'STANCE_TYPE' };
    const trimmed = normalize(stance).trim();
    if (trimmed.length === 0) return { tag: 'UNLAWFUL', reason: 'STANCE_EMPTY' };
    if ([...trimmed].length > STANCE_MAX_CODE_POINTS) return { tag: 'UNLAWFUL', reason: 'STANCE_OVERSIZED' };
    if (DIRECTIVE_ENUM_TOKENS.includes(trimmed.toUpperCase())) return { tag: 'UNLAWFUL', reason: 'ENUM_ECHO' };
    if (UNRESOLVED_STANCE_PREFIXES.some((prefix) => trimmed.toLowerCase().startsWith(prefix))) return { tag: 'UNLAWFUL', reason: 'PLACEHOLDER' };
    const rationale = choice.subjective_rationale;
    if (rationale !== null && typeof rationale !== 'string') return { tag: 'UNLAWFUL', reason: 'RATIONALE_TYPE' };
    if (typeof rationale === 'string') {
      const trimmedRationale = normalize(rationale).trim();
      if (trimmedRationale.length === 0) return { tag: 'UNLAWFUL', reason: 'RATIONALE_EMPTY' };
      if ([...trimmedRationale].length > RATIONALE_MAX_CODE_POINTS) return { tag: 'UNLAWFUL', reason: 'RATIONALE_OVERSIZED' };
    }
    return { tag: 'SUBJECTIVE_SELECTION', reason: null };
  }
  return { tag: 'UNLAWFUL', reason: `UNKNOWN_KIND:${String(choice.kind)}` };
}

/**
 * C4.4 handle binding. The model wire carries SHORT HANDLES, so the research audit
 * verifies what the model actually emitted against what the turn advertised:
 *   - every claim source_handles entry must be an advertised F handle (a C handle
 *     in a claim is a NAMESPACE_ERROR);
 *   - every handle must be advertised for THIS turn, otherwise UNKNOWN_HANDLE;
 *   - a completed turn proves the host canonicalized to exact canonical refs and the
 *     frozen authoritative validators accepted it (citation binding, lawful sources,
 *     inspectable content, SOURCE_QUOTE verbatim).
 */
export function handleBindingAudit(record) {
  const advertised = record.advertised_handles;
  if (advertised === null || advertised === undefined) return { status: 'NOT_APPLICABLE', unknown: [], namespace_errors: [], handles: [] };
  const factual = new Set(advertised.factual ?? []);
  const context = new Set(advertised.context ?? []);
  const handles = [];
  const unknown = [];
  const namespaceErrors = [];
  const consider = (handle, fromClaim) => {
    if (typeof handle !== 'string') { namespaceErrors.push({ handle: String(handle), reason: 'NOT_A_STRING' }); return; }
    handles.push(handle);
    const isFactual = factual.has(handle);
    const isContext = context.has(handle);
    if (!isFactual && !isContext) { unknown.push(handle); return; }
    if (fromClaim && isContext && !isFactual) namespaceErrors.push({ handle, reason: 'CONTEXT_HANDLE_AS_CLAIM_SOURCE' });
  };
  for (const claim of record.factual_assessment?.claims ?? []) {
    for (const handle of claim.source_handles ?? []) consider(handle, true);
  }
  const cognition = record.raw_cognition_wire?.cognition ?? {};
  for (const key of ['relevant_memory_handles', 'considered_handles', 'evidence_handles']) {
    for (const handle of cognition[key] ?? []) consider(handle, false);
  }
  const status = unknown.length > 0 ? 'HANDLE_UNKNOWN'
    : namespaceErrors.length > 0 ? 'HANDLE_NAMESPACE_ERROR'
      : 'HANDLE_BOUND';
  return {
    status,
    unknown,
    namespace_errors: namespaceErrors,
    handles,
    canonicalization: record.status === 'COMPLETE' ? 'CANONICALIZED' : 'REFUSED'
  };
}

/** Language must not add decision content the stance (and lawful payload) lacked.
 * Attribution frames (`Alice says:`) and quoted spans are stripped first: they are
 * quotation, not decision content. */
export function languageCompletionAudit(row, connectors) {
  const claims = (row.factual_assessment?.claims ?? []).map((claim) => claim.text).join(' ');
  const stance = row.subjective_selection?.kind === 'SUBJECTIVE_SELECTION' ? row.subjective_selection.stance : '';
  const rationale = row.subjective_selection?.kind === 'SUBJECTIVE_SELECTION' ? row.subjective_selection.subjective_rationale ?? '' : '';
  const tokens = (text) => [...new Set(String(text ?? '').toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])];
  const delivered = String(row.final_behavior ?? '')
    .replace(/"[^"]*"|“[^”]*”/g, ' ')
    .replace(/\b[A-Z][\w'-]*\s+(?:says|said|asks|asked|states|stated|tells|told|replied|replies|responds|responded)\b[^.:]*[:.]?/g, ' ');
  const payload = new Set([...tokens(stance), ...tokens(rationale), ...tokens(claims)]);
  const added = tokens(delivered).filter((token) => !payload.has(token) && !connectors.includes(token));
  return { added_tokens: added, decision_tokens: added, completed: added.length > 0 };
}

// ---------------------------------------------------------------------------------
// Record classification
// ---------------------------------------------------------------------------------

function proposalFactClass(scenario, assessment) {
  if (!scenario.expected) return 'NO_SUBJECTIVE_SELECTION';
  const claims = Array.isArray(assessment?.claims) ? assessment.claims : [];
  return word(scenario.expected).test(claims.map((claim) => claim.text).join(' ')) ? 'PROPOSAL_FACT_PRESENT' : 'PROPOSAL_FACT_MISSING';
}

/**
 * The canonical refs a claim's sources resolve to. On the C4.4 model wire a claim
 * carries `source_handles`; resolving them through the host's own advertised
 * handle→ref map is how the research audit reads back the authority the host
 * applied. Records that already carry canonical `source_refs` are read directly.
 */
export function claimSourceRefs(claim, advertised) {
  const handles = Array.isArray(claim?.source_handles) ? claim.source_handles : null;
  if (handles !== null) {
    const map = advertised?.handle_to_ref ?? {};
    return handles.map((handle) => (typeof handle === 'string' && Object.hasOwn(map, handle) ? map[handle] : String(handle)));
  }
  return Array.isArray(claim?.source_refs) ? claim.source_refs : [];
}

function factualSelfStateAudit(assessment, advertised) {
  const claims = Array.isArray(assessment?.claims) ? assessment.claims : [];
  const vocabularyHits = [];
  const unlawfulSourceRefs = [];
  for (const claim of claims) {
    const hits = selfStateAssertion(claim.text);
    if (hits.length > 0) vocabularyHits.push({ text: claim.text, words: hits });
    for (const ref of claimSourceRefs(claim, advertised)) {
      if (ref.startsWith('subject:') || ref.startsWith('entity:') || ref.startsWith('environment:')) unlawfulSourceRefs.push(ref);
    }
  }
  return { vocabularyHits, unlawfulSourceRefs };
}

export function classifyRecord(scenario, record, connectors) {
  const choiceRequired = scenario.choice !== undefined;
  const verdict = applicabilityVerdict(record.subjective_selection);
  const stance = verdict.tag === 'SUBJECTIVE_SELECTION' ? record.subjective_selection.stance : null;
  const rationale = verdict.tag === 'SUBJECTIVE_SELECTION' ? record.subjective_selection.subjective_rationale : null;
  const rationaleCheck = rationaleVerdict(rationale);
  const finalText = record.final_behavior ?? '';
  const proposalText = record.factual_assessment?.claims?.map((claim) => claim.text).join(' ') ?? '';
  const unsupported = unsupportedPremises(stance, rationale, record.current_intent, proposalText, finalText);
  const factualAudit = factualSelfStateAudit(record.factual_assessment, record.advertised_handles);

  const applicabilityCorrect = choiceRequired ? verdict.tag === 'SUBJECTIVE_SELECTION' : verdict.tag === 'NO_SUBJECTIVE_SELECTION';
  const stanceClass = choiceRequired && stance !== null ? choiceClass(scenario.choice, stance) : null;
  const offQuestion = choiceRequired && verdict.tag === 'SUBJECTIVE_SELECTION' && (stanceClass === 'NO_CHOICE');
  const finalChoice = choiceRequired ? choiceClass(scenario.choice, finalText) : null;
  const completion = languageCompletionAudit(record, connectors ?? []);
  const handleAudit = handleBindingAudit(record);

  const base = {
    protocol: record.status === 'COMPLETE' && record.stages.SCHEMA_VALID && record.stages.LANGUAGE_ADMISSIBLE ? 'PASS' : 'FAIL',
    applicability: verdict.tag,
    applicability_reason: verdict.reason,
    selection_applicability: applicabilityCorrect ? 'SELECTION_APPLICABILITY_CORRECT' : 'SELECTION_APPLICABILITY_WRONG',
    stance_selected: stance === null ? 'NO_SUBJECTIVE_SELECTION' : stanceClass,
    off_question: offQuestion ? 'OFF_QUESTION_STANCE' : (choiceRequired && verdict.tag === 'SUBJECTIVE_SELECTION' ? 'ON_QUESTION_STANCE' : 'NO_SUBJECTIVE_SELECTION'),
    rationale_category: rationaleCheck.category,
    rationale_lawful: rationaleCheck.lawful,
    rationale_forbidden_classes: [...new Set(rationaleCheck.forbidden_classes.map((entry) => entry.kind))],
    rationale_allowed_classes: rationaleCheck.allowed_classes,
    handle_binding: handleAudit.status,
    handle_unknown: handleAudit.unknown,
    handle_namespace_errors: handleAudit.namespace_errors,
    handle_canonicalization: handleAudit.canonicalization,
    language_completion: completion.completed ? 'SEMANTICALLY_COMPLETED_BY_LANGUAGE' : 'PRESERVED',
    language_completion_tokens: completion.decision_tokens,
    factual_self_state_assertion: factualAudit.vocabularyHits.map((entry) => entry.words).flat(),
    unlawful_factual_source_refs: factualAudit.unlawfulSourceRefs,
    unsupported_premises: unsupported,
    false_clarify: record.directive === 'CLARIFY_MISSING_CONTEXT',
    proposal_fact: proposalFactClass(scenario, record.factual_assessment),
    final_fact: scenario.expected ? factualClass(scenario, finalText) : 'NO_SUBJECTIVE_SELECTION',
    language_invented_preference: verdict.tag === 'SUBJECTIVE_SELECTION' ? false : preferencePresent(finalText)
  };
  base.fact_fidelity = !scenario.expected
    ? 'NO_SUBJECTIVE_SELECTION'
    : base.proposal_fact === 'PROPOSAL_FACT_PRESENT' && base.final_fact === 'FACT_CORRECT'
      ? 'FACT_PRESERVED'
      : base.final_fact === 'FACTUAL_CONTRADICTION' || base.final_fact === 'QUESTION_REPETITION'
        ? 'FACT_CONTRADICTED'
        : 'FACT_CHANGED';
  base.language_choice = !choiceRequired
    ? (base.language_invented_preference ? 'LANGUAGE_CHOICE_INVENTED' : 'LANGUAGE_CHOICE_WITHHELD')
    : verdict.tag !== 'SUBJECTIVE_SELECTION'
      ? 'LANGUAGE_CHOICE_NOT_HANDED_OFF'
      : (stanceClass === 'NO_CHOICE'
        ? 'LANGUAGE_CHOICE_NOT_HANDED_OFF'
        : (finalChoice === stanceClass ? 'LANGUAGE_CHOICE_PRESERVED' : finalChoice === 'NO_CHOICE' ? 'LANGUAGE_CHOICE_DROPPED' : 'LANGUAGE_CHOICE_CHANGED'));

  base.pass =
    base.protocol === 'PASS' &&
    applicabilityCorrect &&
    !base.false_clarify &&
    unsupported.length === 0 &&
    base.factual_self_state_assertion.length === 0 &&
    base.unlawful_factual_source_refs.length === 0 &&
    base.handle_binding !== 'HANDLE_UNKNOWN' && base.handle_binding !== 'HANDLE_NAMESPACE_ERROR' &&
    record.request_attestation?.ok === true &&
    record.language_leakage?.ok === true &&
    (!scenario.expected || base.fact_fidelity === 'FACT_PRESERVED') &&
    (choiceRequired
      ? rationaleCheck.lawful && !offQuestion && base.language_completion === 'PRESERVED' && base.language_choice === 'LANGUAGE_CHOICE_PRESERVED'
      : base.language_choice === 'LANGUAGE_CHOICE_WITHHELD');
  return base;
}

// ---------------------------------------------------------------------------------
// Comparisons
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
