/* eslint-disable no-restricted-imports -- Isolated research harness composing frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * PHASE 0 HARNESS MECHANICS — transport-agnostic.
 *
 * The schedule runner takes a `Phase0BundleV0` (transports + appraisal provider + belief
 * semantic provider + call tally) so the EXACT SAME mechanics can be exercised against stub
 * transports at zero model calls before any real call is spent. `execute.ts` passes the real
 * production bundle; `smoke.ts` passes a deterministic stub bundle.
 *
 * Nothing here decides an outcome and nothing here writes a belief: every credence change can
 * only come from the production adaptation chain reading committed lived evidence.
 */

import type { SubjectStateV0 } from "../../../../packages/subject-core/dist/index.js";
import {
  InteractiveSubjectRuntimeV0,
  type BeliefAdaptationTurnReportV0,
  type InteractiveTurnOutcomeV0,
  type ModelTransportV0
} from "../../../../packages/runtime/dist/index.js";
export type Phase0AppraisalProviderV0 = Parameters<typeof InteractiveSubjectRuntimeV0.create>[0]["factualEventAppraisalProvider"];

import {
  P0_QUAL_PROPOSITION_ID,
  P0_QUAL_SUBJECT_ID,
  P0_QUAL_TURN_TEXT,
  P0_SUBJECT_A_ID,
  P0_SUBJECT_B_ID,
  P0_SUBJECT_DISPLAY_NAME,
  P0_TARGET_PROPOSITION_ID,
  P0_TURNS_PER_ARM,
  hashPhase0,
  renderPhase0TurnTextV0
} from "./contract.ts";
import { buildPhase0SourceForSubjectV0 } from "./fixtures.ts";

export interface Phase0BundleV0 {
  readonly cognitionTransport: ModelTransportV0;
  readonly languageTransport: ModelTransportV0;
  readonly appraisalProvider: Phase0AppraisalProviderV0;
  readonly beliefSemanticProvider: { propose: (input: never) => Promise<unknown> };
  readonly tally: { cognition: number; language: number; appraisal: number; belief_semantic: number };
  readonly cognitionRequests: { turn: string; messages: readonly { role: string; content: string }[] }[];
  readonly providerCalls: {
    readonly turn: string;
    /**
     * Which family the call belongs to. Optional and additive: the pre-existing callers recorded only
     * the belief-semantic family, so their artifacts stay byte-identical.
     */
    readonly family?: "cognition" | "language" | "appraisal" | "belief_semantic";
    readonly input: unknown;
    readonly output: unknown;
    readonly error: string | null;
  }[];
  readonly executorModel: string;
  readonly executorBaseUrl: string;
  readonly isStub: boolean;
  /** Called before each turn so a recording bundle can label its captured requests. */
  readonly setTurnLabel?: (label: string) => void;
}

/** One provider attempt, attributed to a subject turn and a call family. */
export interface Phase0CallAttemptV0 {
  readonly sequence: number;
  readonly turn: string;
  readonly family: "cognition" | "language" | "appraisal" | "belief_semantic";
  /** Hash of the exact request payload the provider received. */
  readonly request_hash: string;
  readonly result_status: string;
  readonly result_hash: string | null;
}

/** The attempt recorder an instrumented bundle carries. */
export interface Phase0AttemptsV0 {
  readonly attempts: Phase0CallAttemptV0[];
}

/**
 * §3 INSTRUMENTATION — record EVERY provider attempt of EVERY family.
 *
 * run-1 persisted payloads for only two of its four families, so its appraisal attempts have an
 * exact TOTAL but no per-turn attribution, permanently and by construction. This wrapper closes
 * that gap, and the SAME mechanism serves the real bundle and the stub bundle, so the 0-call smoke
 * run verifies the instrumentation that the next real run will depend on.
 */
export function instrumentPhase0BundleV0(
  bundle: Phase0BundleV0
): Phase0BundleV0 & { readonly attempts: Phase0CallAttemptV0[] } {
  const attempts: Phase0CallAttemptV0[] = [];
  let sequence = 0;
  const record = (
    family: Phase0CallAttemptV0["family"],
    requestHash: string,
    status: string,
    resultHash: string | null
  ): void => {
    sequence += 1;
    attempts.push({ sequence, turn: harnessTurnLabel, family, request_hash: requestHash, result_status: status, result_hash: resultHash });
  };
  const wrapTransport = (inner: ModelTransportV0, family: "cognition" | "language" | "appraisal"): ModelTransportV0 =>
    ({
      complete: async (request: never) => {
        const requestHash = await hashPhase0(JSON.stringify(request), `${family}-request`);
        try {
          const response = await inner.complete(request);
          record(family, requestHash, "OK", await hashPhase0(JSON.stringify(response), `${family}-response`));
          return response;
        } catch (error) {
          record(family, requestHash, `THREW: ${error instanceof Error ? error.message.slice(0, 80) : String(error)}`, null);
          throw error;
        }
      }
    }) as ModelTransportV0;

  const wrappedAppraisal = {
    proposeFactualEventAppraisal: async (context: never) => {
      const requestHash = await hashPhase0(JSON.stringify(context), "appraisal-request");
      try {
        const result = await bundle.appraisalProvider.proposeFactualEventAppraisal(context as never);
        record("appraisal", requestHash, "OK", await hashPhase0(JSON.stringify(result), "appraisal-response"));
        return result;
      } catch (error) {
        record("appraisal", requestHash, `THREW: ${error instanceof Error ? error.message.slice(0, 80) : String(error)}`, null);
        throw error;
      }
    }
  } as Phase0AppraisalProviderV0;

  return {
    ...bundle,
    cognitionTransport: wrapTransport(bundle.cognitionTransport, "cognition"),
    languageTransport: wrapTransport(bundle.languageTransport, "language"),
    appraisalProvider: wrappedAppraisal,
    // The belief-semantic provider is a different port (not a ModelTransportV0), so it needs its
    // own wrapper. It is the only family that can move the endpoint, so it must never be the one
    // family missing from the ledger.
    beliefSemanticProvider: {
      propose: async (input: never) => {
        const requestHash = await hashPhase0(JSON.stringify(input), "belief-semantic-request");
        try {
          const output = await bundle.beliefSemanticProvider.propose(input);
          record("belief_semantic", requestHash, "OK", await hashPhase0(JSON.stringify(output), "belief-semantic-response"));
          return output;
        } catch (error) {
          record("belief_semantic", requestHash, `THREW: ${error instanceof Error ? error.message.slice(0, 80) : String(error)}`, null);
          throw error;
        }
      }
    },
    attempts
  };
}

/** The harness's current turn label; the single source of attribution for attempts. */
let harnessTurnLabel = "PRE";

export interface TurnRecordV0 {
  readonly arm: string;
  readonly turn_index: number;
  readonly user_text: string;
  readonly status: string;
  readonly failure: string | null;
  readonly subject_text: string | null;
  readonly completed_prior_outcome: unknown;
  readonly belief_adaptation: BeliefAdaptationTurnReportV0 | null;
  readonly relationship_familiarity: unknown;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
}

export interface Phase0ScheduleResultV0 {
  readonly qualification: Record<string, unknown>;
  readonly preStateA: unknown;
  readonly preStateB: unknown;
  readonly postStateA: unknown;
  readonly postStateB: unknown;
  readonly itemPreA: TargetItemV0 | null;
  readonly itemPreB: TargetItemV0 | null;
  readonly itemPostA: TargetItemV0 | null;
  readonly itemPostB: TargetItemV0 | null;
  readonly turns: TurnRecordV0[];
  readonly integrityFailures: string[];
  readonly executedLeakage: Record<string, unknown>;
  readonly tally: Phase0BundleV0["tally"];
  readonly qualificationPassed: boolean;
}

export interface TargetItemV0 {
  readonly proposition_id: string;
  readonly proposition_label: string;
  readonly credence: number;
}

export async function openPhase0RuntimeV0(
  subjectId: string,
  source: SubjectStateV0,
  sessionId: string,
  bundle: Phase0BundleV0
): Promise<InteractiveSubjectRuntimeV0> {
  return await InteractiveSubjectRuntimeV0.create({
    subject: { subject_id: subjectId, display_name: P0_SUBJECT_DISPLAY_NAME, identity_anchors: [] },
    v3_source: source,
    conversationCognitionTransport: bundle.cognitionTransport,
    languageTransport: bundle.languageTransport,
    factualEventAppraisalProvider: bundle.appraisalProvider,
    session_id: sessionId,
    beliefSemanticProvider: bundle.beliefSemanticProvider as never
  });
}

/**
 * §14 canonical read-only state projection: canonical state, never prompt text or a cache.
 *
 * `snapshot()` requires a COMMITTED canonical bundle, so it is unavailable for a genesis state
 * that has not yet completed a turn. That is recorded as an explicit error string rather than
 * silently omitted — a POST-state without durable identity would be a real gap, and `execute.ts`
 * asserts on it.
 */
export async function capturePhase0StateV0(runtime: InteractiveSubjectRuntimeV0, subjectId: string): Promise<unknown> {
  const view = await runtime.subjectStateView();
  let durableIdentity: unknown = null;
  let durableStoreState: unknown = null;
  let durableError: string | null = null;
  try {
    const snapshot = await runtime.snapshot();
    durableIdentity = snapshot.durable.identity;
    durableStoreState = snapshot.durable.belief_workflow_store_state;
  } catch (error) {
    durableError = error instanceof Error ? error.message : String(error);
  }
  return {
    subject_id: subjectId,
    canonical_state_view: view,
    durable_identity: durableIdentity,
    durable_belief_workflow_store_state: durableStoreState,
    durable_identity_unavailable_reason: durableError
  };
}

export function targetItemOf(state: unknown): TargetItemV0 | null {
  const beliefs = (
    state as { canonical_state_view?: { beliefs?: readonly TargetItemV0[] } }
  ).canonical_state_view?.beliefs;
  return beliefs?.find((item) => item.proposition_id === P0_TARGET_PROPOSITION_ID) ?? null;
}

/**
 * SUBJECT-ID MAP — added for the swapped (cloud) condition, additive and default-preserving.
 *
 * Why it exists: the rerun amendment §19 requires FRESH subjects, so a new condition cannot reuse
 * run-1/run-3's identities. But this harness's leakage audit maps an arm to “its own” subject id, and
 * that mapping is what gives the audit its teeth — “the OTHER arm's id must never appear” is untestable
 * unless the audit knows which id belongs to which arm. Substituting ids from outside the harness would
 * have silently disarmed it, so the mapping is parameterised here and the audit stays live.
 *
 * The DEFAULTS are the frozen identities, so every existing caller is byte-for-byte unchanged.
 * Session ids travel with the map because the frozen session ids embed the frozen subject ids; deriving
 * them would have changed the frozen default.
 */
export interface Phase0SubjectIdsV0 {
  readonly qualification: string;
  readonly armA: string;
  readonly armB: string;
  readonly sessionQualification: string;
  readonly sessionA: string;
  readonly sessionB: string;
}

export const P0_FROZEN_SUBJECT_IDS_V0: Phase0SubjectIdsV0 = Object.freeze({
  qualification: P0_QUAL_SUBJECT_ID,
  armA: P0_SUBJECT_A_ID,
  armB: P0_SUBJECT_B_ID,
  sessionQualification: "session-qualification-0001",
  sessionA: "session-k7q2-4103-0001",
  sessionB: "session-k7q2-8267-0001"
});

/**
 * Executed-request leakage scan over the REAL recorded model-visible bytes (§4).
 *
 * The frozen ids are ALWAYS forbidden, whatever map is in force: a later condition's requests must
 * never contain an earlier condition's subject identity. The effective ids are added on top, and only
 * a subject's own id is exempt (it is rendered by production into its own prompt and cannot be removed
 * without a production modification).
 */
export function scanExecutedRequestsV0(
  requests: Phase0BundleV0["cognitionRequests"],
  subjectIds: Phase0SubjectIdsV0 = P0_FROZEN_SUBJECT_IDS_V0
): Record<string, unknown> {
  const strictNeedles = [
    "positive arm",
    "negative arm",
    "expected direction",
    "history internalization",
    "phase 0",
    "phase-0",
    P0_SUBJECT_A_ID,
    P0_SUBJECT_B_ID,
    P0_QUAL_SUBJECT_ID,
    subjectIds.armA,
    subjectIds.armB,
    subjectIds.qualification
  ];
  const hits: { turn: string; source: string; needle: string }[] = [];
  for (const request of requests) {
    const ownArm = request.turn.split(":")[0] as string;
    const ownIds: readonly string[] =
      ownArm === "QUALIFICATION"
        ? [subjectIds.qualification]
        : ownArm === "A"
          ? [subjectIds.armA]
          : ownArm === "B"
            ? [subjectIds.armB]
            : [];
    for (const [index, message] of request.messages.entries()) {
      const lower = message.content.toLowerCase();
      for (const needle of strictNeedles) {
        if (!lower.includes(needle.toLowerCase())) continue;
        // A subject's OWN id legitimately appears in its own prompt and cannot be removed
        // without a production modification. Every other needle is experimenter vocabulary
        // that has no lawful reason to be model-visible.
        if (ownIds.includes(needle)) continue;
        hits.push({ turn: request.turn, source: `message[${index}]:${message.role}`, needle });
      }
    }
  }
  return {
    method:
      "every recorded cognition request for every executed turn is scanned; the OTHER arm's subject id and the experimenter's vocabulary must never appear",
    requests_scanned: requests.length,
    strict_needles: strictNeedles,
    hits,
    clean: hits.length === 0,
    own_subject_id_is_expected_and_is_not_a_leak: true,
    scope_note:
      "this scan covers the experimenter's own vocabulary and identifiers. Model-generated reply text is NOT scanned for ordinary words such as 'trust': a subject saying it trusts someone is the treatment's own downstream expression, not experimenter leakage, and flagging it would be a false positive.",
    check_can_fire: strictNeedles.some((needle) =>
      `A model-visible line containing ${needle.toUpperCase()} here`.toLowerCase().includes(needle.toLowerCase())
    )
  };
}

const LAWFUL_TERMINALS = [
  "COMPLETE_COMMITTED",
  "COMPLETE_ALREADY_COMMITTED",
  "COMPLETE_NO_BEARING",
  "COMPLETE_NEW_PROPOSITION_ADMITTED"
] as const;

/**
 * Runs the frozen schedule: qualification turn, pre-state freeze, arm A turns, arm B turns,
 * post-state freeze. One pass, no branching on observed effects, no retry, no extension.
 *
 * `subjectIds` defaults to the frozen identities, so the default path is the frozen path. A new
 * condition passes a fresh map (rerun amendment §19); nothing else about the schedule changes.
 */
export async function runPhase0ScheduleV0(input: {
  readonly bundle: Phase0BundleV0;
  readonly sourceA: SubjectStateV0;
  readonly sourceB: SubjectStateV0;
  readonly subjectIds?: Phase0SubjectIdsV0 | undefined;
  readonly log?: (line: string) => void;
}): Promise<Phase0ScheduleResultV0> {
  const { bundle } = input;
  const subjectIds = input.subjectIds ?? P0_FROZEN_SUBJECT_IDS_V0;
  const log = input.log ?? ((): void => {});
  const turns: TurnRecordV0[] = [];
  const integrityFailures: string[] = [];
  let currentTurnLabel = "PRE";

  const runTurn = async (
    runtime: InteractiveSubjectRuntimeV0,
    arm: string,
    turnIndex: number,
    text: string
  ): Promise<void> => {
    currentTurnLabel = `${arm}:turn_${turnIndex}`;
    harnessTurnLabel = currentTurnLabel;
    bundle.setTurnLabel?.(currentTurnLabel);
    const before = await runtime.status();
    const outcome: InteractiveTurnOutcomeV0 = await runtime.submitUserText(text);
    const after = await runtime.status();
    const beliefReport = (outcome.belief_adaptation ?? null) as BeliefAdaptationTurnReportV0 | null;
    turns.push({
      arm,
      turn_index: turnIndex,
      user_text: text,
      status: outcome.status,
      failure: outcome.failure,
      subject_text: (outcome.subject_text ?? "").slice(0, 4000),
      completed_prior_outcome: outcome.completed_prior_outcome ?? null,
      belief_adaptation: beliefReport,
      relationship_familiarity: outcome.relationship_familiarity ?? null,
      state_revision_before: before.state_revision,
      state_revision_after: after.state_revision
    });
    if (outcome.status !== "COMPLETE") {
      integrityFailures.push(`turn ${arm}:turn_${turnIndex} status=${outcome.status} failure=${String(outcome.failure)}`);
    }
    if (beliefReport !== null && beliefReport.failure !== null) {
      integrityFailures.push(`turn ${arm}:turn_${turnIndex} belief wiring failure: ${beliefReport.failure}`);
    }
    log(
      `  ${arm}:turn_${turnIndex} status=${outcome.status} terminal=${beliefReport?.current?.terminal_kind ?? "none"} ` +
        `prev=${String(beliefReport?.current?.prior_credence ?? "null")} next=${String(beliefReport?.current?.next_credence ?? "null")}`
    );
  };

  // ---- STAGE 1: qualification (non-target subject, non-target evidence, NOT evidence) --------
  log("STAGE 1 — qualification");
  const qualificationRuntime = await openPhase0RuntimeV0(
    subjectIds.qualification,
    buildPhase0SourceForSubjectV0(subjectIds.qualification, "QUALIFICATION"),
    subjectIds.sessionQualification,
    bundle
  );
  await runTurn(qualificationRuntime, "QUALIFICATION", 0, P0_QUAL_TURN_TEXT);
  const qualTerminal = turns[0]?.belief_adaptation?.current?.terminal_kind ?? "NONE";
  const qualification = {
    purpose:
      "mechanical qualification of the production live path only: proves the turn completes, the belief semantic provider is reachable and returns a lawful envelope through the frozen runner, and per-turn call families can be counted. It is NOT scientific evidence and cannot contribute to the endpoint (different subject, different proposition, different evidence).",
    subject_id: subjectIds.qualification,
    proposition_id: P0_QUAL_PROPOSITION_ID,
    turn_status: turns[0]?.status ?? null,
    terminal_kind: qualTerminal,
    provider_calls: turns[0]?.belief_adaptation?.current?.provider_calls ?? null,
    lawful_terminal_observed: (LAWFUL_TERMINALS as readonly string[]).includes(qualTerminal),
    state_after_qualification: await capturePhase0StateV0(qualificationRuntime, subjectIds.qualification)
  };
  const qualificationPassed =
    turns[0]?.status === "COMPLETE" && (LAWFUL_TERMINALS as readonly string[]).includes(qualTerminal);
  if (!qualificationPassed) {
    integrityFailures.push(`qualification failed: status=${String(turns[0]?.status)} terminal=${qualTerminal}`);
  }

  // ---- STAGE 2: PRE-state freeze (before any scientific turn) --------------------------------
  log("STAGE 2 — pre-state freeze");
  const runtimeA = await openPhase0RuntimeV0(subjectIds.armA, input.sourceA, subjectIds.sessionA, bundle);
  const runtimeB = await openPhase0RuntimeV0(subjectIds.armB, input.sourceB, subjectIds.sessionB, bundle);
  const preStateA = await capturePhase0StateV0(runtimeA, subjectIds.armA);
  const preStateB = await capturePhase0StateV0(runtimeB, subjectIds.armB);
  const itemPreA = targetItemOf(preStateA);
  const itemPreB = targetItemOf(preStateB);

  // ---- STAGE 3: the frozen trajectory, exactly once, in the frozen order ---------------------
  if (qualificationPassed) {
    for (const [arm, runtime] of [["A", runtimeA], ["B", runtimeB]] as const) {
      log(`STAGE 3 — trajectory ${arm}`);
      for (let turn = 0; turn < P0_TURNS_PER_ARM; turn += 1) {
        const expected = renderPhase0TurnTextV0(arm, turn);
        await runTurn(runtime, arm, turn, expected);
        const record = turns[turns.length - 1] as TurnRecordV0;
        if (record.user_text !== expected) {
          integrityFailures.push(`turn ${arm}:${turn} text was not the frozen text`);
        }
      }
    }
  }

  // ---- STAGE 4: POST-state freeze ------------------------------------------------------------
  log("STAGE 4 — post-state freeze");
  const postStateA = await capturePhase0StateV0(runtimeA, subjectIds.armA);
  const postStateB = await capturePhase0StateV0(runtimeB, subjectIds.armB);

  return {
    qualification,
    preStateA,
    preStateB,
    postStateA,
    postStateB,
    itemPreA,
    itemPreB,
    itemPostA: targetItemOf(postStateA),
    itemPostB: targetItemOf(postStateB),
    turns,
    integrityFailures,
    executedLeakage: scanExecutedRequestsV0(bundle.cognitionRequests, subjectIds),
    tally: bundle.tally,
    qualificationPassed
  };
}
