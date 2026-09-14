/**
 * C4.2 — FROZEN paraphrase safety suite (zero model calls).
 *
 * Written BEFORE the candidate grounding guard was evaluated, from the category
 * list in the C4.2 brief, and never edited afterwards. It deliberately includes
 * lawful forms whose wording barely touches the request (synonyms, ellipsis,
 * pronoun-only replies) and invalid forms that DO share surface vocabulary
 * (echoes, wrong-target preferences), so the guard's real power is measured
 * rather than assumed.
 *
 * GROUPS
 *   LAWFUL_*   40 examples that a careful reader accepts as answering the request
 *   INVALID_*  20 examples that do not answer the requested choice
 *   LEXICAL_CEILING_DIAGNOSTIC — reported separately, NOT part of the acceptance
 *              standard: off-question stances no purely lexical rule can separate
 *              from an on-question answer.
 */

export const LAWFUL = Object.freeze([
  // ---- binary choice -----------------------------------------------------------------
  { id: 'L01', category: 'BINARY', request: 'Alice asks: "Would you prefer to attend the planning meeting, or skip it?" State your choice.', stance: 'I would attend the planning meeting.' },
  { id: 'L02', category: 'BINARY', request: 'Alice asks: "Would you prefer to attend the planning meeting, or skip it?" State your choice.', stance: 'I would rather skip it.' },
  { id: 'L03', category: 'BINARY', request: 'Alice asks: "Should we try the new approach or keep the current one?"', stance: 'I would try the new approach.' },
  { id: 'L04', category: 'BINARY', request: 'Alice asks: "Should we try the new approach or keep the current one?"', stance: 'I would keep the current approach.' },
  { id: 'L05', category: 'BINARY', request: 'Alice asks: "Do the polish pass or stop now?"', stance: 'I would do the polish pass.' },
  { id: 'L06', category: 'BINARY', request: 'Alice asks: "Do the polish pass or stop now?"', stance: 'I would stop now.' },
  { id: 'L07', category: 'BINARY', request: 'Two preparation tasks are due tomorrow: rehearse the presentation or inspect the backup plan. Which would you do first?', stance: 'I would rehearse the presentation first.' },
  { id: 'L08', category: 'BINARY', request: 'Two preparation tasks are due tomorrow: rehearse the presentation or inspect the backup plan. Which would you do first?', stance: 'I would inspect the backup plan first.' },
  // ---- yes/no willingness ------------------------------------------------------------
  { id: 'L09', category: 'WILLINGNESS', request: 'Alice asks: "Would you volunteer to own the code review?"', stance: 'I would volunteer to own the code review.' },
  { id: 'L10', category: 'WILLINGNESS', request: 'Alice asks: "Would you volunteer to own the code review?"', stance: 'I would not volunteer for the code review.' },
  { id: 'L11', category: 'WILLINGNESS', request: 'Alice asks: "Are you willing to carry the package upstairs?"', stance: 'I am willing to carry the package upstairs.' },
  { id: 'L12', category: 'WILLINGNESS', request: 'Alice asks: "Are you willing to carry the package upstairs?"', stance: 'I am not willing to carry the package upstairs.' },
  { id: 'L13', category: 'WILLINGNESS', request: 'Alice asks: "Would you stay late tonight to finish this?"', stance: 'I would stay late tonight to finish this.' },
  { id: 'L14', category: 'WILLINGNESS', request: 'Alice asks: "Would you stay late tonight to finish this?"', stance: 'I would not stay late tonight.' },
  // ---- preference --------------------------------------------------------------------
  { id: 'L15', category: 'PREFERENCE', request: 'Alice asks: "Which do you prefer, the reversible trial or the current process?"', stance: 'I prefer the reversible trial.' },
  { id: 'L16', category: 'PREFERENCE', request: 'Alice asks: "Which do you prefer, the reversible trial or the current process?"', stance: 'I prefer the current process.' },
  { id: 'L17', category: 'PREFERENCE', request: 'Alice asks: "What do you prefer here?"', stance: 'I prefer to keep things as they are.' },
  { id: 'L18', category: 'PREFERENCE', request: 'Alice asks: "Would you rather finish now or continue tomorrow?"', stance: 'I would rather finish now.' },
  // ---- priority ordering -------------------------------------------------------------
  { id: 'L19', category: 'PRIORITY', request: 'Alice asks: "Which task should come first, the rehearsal or the backup inspection?"', stance: 'The rehearsal should come first.' },
  { id: 'L20', category: 'PRIORITY', request: 'Alice asks: "Which task should come first, the rehearsal or the backup inspection?"', stance: 'The backup inspection should come first.' },
  { id: 'L21', category: 'PRIORITY', request: 'Alice asks: "Which should I prioritize, the documentation or the testing?"', stance: 'I would prioritize the documentation.' },
  { id: 'L22', category: 'PRIORITY', request: 'Alice asks: "Which should I prioritize, the documentation or the testing?"', stance: 'I would prioritize the testing.' },
  // ---- conditional choice ------------------------------------------------------------
  { id: 'L23', category: 'CONDITIONAL', request: 'Alice asks: "Would you volunteer if the deadline moves to Friday?"', stance: 'I would volunteer if the deadline moves to Friday.' },
  { id: 'L24', category: 'CONDITIONAL', request: 'Alice asks: "Would you attend if the meeting moves online?"', stance: 'I would attend if the meeting moves online.' },
  { id: 'L25', category: 'CONDITIONAL', request: 'Alice asks: "Would you try the new approach provided the trial stays reversible?"', stance: 'I would try the new approach, provided the trial stays reversible.' },
  { id: 'L26', category: 'CONDITIONAL', request: 'Alice asks: "Would you carry it if the elevator is available?"', stance: 'I would carry it if the elevator is available.' },
  // ---- open-ended choice -------------------------------------------------------------
  { id: 'L27', category: 'OPEN_ENDED', request: 'Alice asks: "What would you do about the failing test?"', stance: 'I would investigate the failing test.' },
  { id: 'L28', category: 'OPEN_ENDED', request: 'Alice asks: "How would you respond to the request?"', stance: 'I would acknowledge the request and answer it directly.' },
  { id: 'L29', category: 'OPEN_ENDED', request: 'Alice asks: "What would you do next?"', stance: 'I would review the outstanding items next.' },
  { id: 'L30', category: 'OPEN_ENDED', request: 'Alice asks: "How would you handle the review?"', stance: 'I would handle the review myself.' },
  // ---- mixed fact + choice -----------------------------------------------------------
  { id: 'L31', category: 'MIXED', request: 'Alice says: "The code review deadline is Thursday. Say whether you would volunteer to own the review."', stance: 'I would volunteer to own the review.' },
  { id: 'L32', category: 'MIXED', request: 'Alice says: "The planning meeting is at 15:00. Say whether you would prefer to attend."', stance: 'I would prefer to attend.' },
  { id: 'L33', category: 'MIXED', request: 'Alice says: "The sealed package weighs 4 kg. Say whether you would be willing to carry it upstairs."', stance: 'I would be willing to carry it upstairs.' },
  { id: 'L34', category: 'MIXED', request: 'Alice says: "The backup plan is due tomorrow. Say which you would do first, the rehearsal or the backup inspection."', stance: 'I would do the rehearsal first.' },
  // ---- synonym-heavy answers ---------------------------------------------------------
  { id: 'L35', category: 'SYNONYM', request: 'Alice asks: "Would you attend the meeting?"', stance: "I'd join." },
  { id: 'L36', category: 'SYNONYM', request: 'Alice asks: "Would you volunteer for the review?"', stance: "I'd be up for it." },
  { id: 'L37', category: 'SYNONYM', request: 'Alice asks: "Try the new approach or keep the current one?"', stance: "I'd stick with what we're using." },
  { id: 'L38', category: 'SYNONYM', request: 'Alice asks: "Do the polish pass or stop?"', stance: "I'd call it done." },
  // ---- ellipsis / pronoun-heavy ------------------------------------------------------
  { id: 'L39', category: 'ELLIPSIS', request: 'Alice asks: "Which task first?"', stance: "I'd start with the rehearsal." },
  { id: 'L40', category: 'ELLIPSIS', request: 'Alice asks: "Attend or skip?"', stance: 'Attend.' }
]);

export const INVALID = Object.freeze([
  // the historical C4 M2 form
  { id: 'X01', category: 'HISTORICAL_M2', request: 'Alice says: "The planning meeting is at 15:00. State the meeting time exactly as given, and say whether you would prefer to attend."', stance: 'I would volunteer.' },
  // plan-shaped stance on a genuine choice turn (the historical C3 Family-A text)
  { id: 'X02', category: 'PLAN_NOT_CHOICE', request: 'Alice asks: "Would you volunteer to own the code review?"', stance: 'I would provide the calculated sum of 42 to Alice.' },
  // directive enum echo
  { id: 'X03', category: 'DIRECTIVE_ENUM', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'REALIZE_CURRENT_INTENT' },
  // placeholder / deferral
  { id: 'X04', category: 'PLACEHOLDER', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'choose an option' },
  { id: 'X05', category: 'PLACEHOLDER', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'I would decide later.' },
  { id: 'X06', category: 'PLACEHOLDER', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'express a preference' },
  // empty / whitespace
  { id: 'X07', category: 'EMPTY', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: '' },
  { id: 'X08', category: 'EMPTY', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: '   ' },
  // off-question target (unrelated vocabulary)
  { id: 'X09', category: 'OFF_QUESTION', request: 'Alice asks: "Attend or skip?"', stance: 'I would handle the review.' },
  { id: 'X10', category: 'OFF_QUESTION', request: 'Alice asks: "Which task first, the rehearsal or the backup inspection?"', stance: 'I would work on the testing.' },
  { id: 'X11', category: 'OFF_QUESTION', request: 'Alice asks: "Would you volunteer for the review?"', stance: 'I would respond to Alice.' },
  { id: 'X12', category: 'OFF_QUESTION', request: 'Alice asks: "Would you volunteer to own the code review?"', stance: 'I would restate the deadline.' },
  // vague non-committals
  { id: 'X13', category: 'VAGUE', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'I am not sure.' },
  { id: 'X14', category: 'VAGUE', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'It depends.' },
  { id: 'X15', category: 'VAGUE', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'Sure.' },
  { id: 'X16', category: 'VAGUE', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'Okay.' },
  { id: 'X17', category: 'VAGUE', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'Fine.' },
  // echo / restatement forms that DO share surface vocabulary
  { id: 'X18', category: 'ECHO', request: 'Alice asks: "Would you prefer to attend the planning meeting, or skip it?"', stance: 'Would you prefer to attend the planning meeting, or skip it?' },
  { id: 'X19', category: 'ECHO', request: 'Alice says: "The planning meeting is at 15:00. Say whether you would prefer to attend."', stance: 'The planning meeting is at 15:00.' },
  // wrong-target preference sharing the word "prefer"
  { id: 'X20', category: 'WRONG_TARGET', request: 'Alice asks: "Would you prefer to attend the planning meeting?"', stance: 'I would prefer to finish the report today.' }
]);

/**
 * Reported separately: off-question stances that a purely lexical rule cannot
 * separate from a lawful answer, because they reuse request vocabulary while
 * selecting something else. NOT part of the acceptance standard — recorded so the
 * guard's ceiling is documented rather than discovered later.
 */
export const LEXICAL_CEILING_DIAGNOSTIC = Object.freeze([
  { id: 'D01', request: 'Alice asks: "Would you prefer to attend the planning meeting, or skip it?"', stance: 'I would attend to the report instead of the meeting.' },
  { id: 'D02', request: 'Alice asks: "Should we try the new approach or keep the current one?"', stance: 'I would try to keep both approaches open.' },
  { id: 'D03', request: 'Alice asks: "Would you volunteer to own the code review?"', stance: 'I would review the code, not own it.' }
]);

export const ACCEPTANCE_STANDARD = Object.freeze({
  lawful_required: 38,
  lawful_preferred: 40,
  invalid_required: 20,
  lawful_total: LAWFUL.length,
  invalid_total: INVALID.length
});
