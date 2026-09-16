/* eslint-disable no-restricted-imports -- Experiment host imports frozen built production roots by relative dist path (workspace packages are not linked under research/). */
/**
 * RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0 — one matched scene.
 *
 * Entry: the production `ConversationTextResponseExecutorV1` (Cognition V8 +
 * Language V10 + response-semantics atom) over a restored explicit-v4 subject,
 * composed with the PRODUCTION retrieval service
 * (`RepositoryBackedMemoryRetrievalServiceV0`) behind the existing
 * `RuntimeDependencyContainer.retrieval` seam.
 *
 * CONDITIONS differ ONLY in the canonical familiarity state (lawful history) and in
 * the explicitly-named research interventions:
 *
 *   A_LOW                    familiarity 1/32,  BASIC,  mediator not available
 *   B_HIGH                   familiarity 16/32, SEARCH_FIRST, mediator available
 *   C_MEDIATOR_ABLATED       HIGH state; the priority retrieval CONTRIBUTION is
 *                            suppressed (production service still runs) — mediator absent
 *   D_FAMILIARITY_EQUALIZED  HIGH state; the familiarity REPRESENTATION handed to
 *                            cognition is replaced by A_LOW's AND the mediator
 *                            contribution is suppressed, so EFFECTIVE familiarity
 *                            equals A_LOW while the HISTORY stays HIGH
 *   E_LOW_WITH_MEDIATOR      1/32, BASIC; the mediator is available WITHOUT familiarity
 *                            via an explicit canonical working ref
 *
 * Every intervention is declared in `RESEARCH_INTERVENTIONS`; none of them writes
 * canonical state (`NOT_PRODUCTION_WRITE`).
 *
 * ENDPOINT (instrument repair): the classified endpoint uses ONLY host-validated
 * facts — the response-semantics atom plus the designated factual claim's AUTHORIZED
 * `source_refs`. `CITES_COUNTERPART_MEDIATOR` requires the claim to cite the EXACT
 * counterpart mediator ref; a >= 20-character quote of anything else is NOT that class.
 */
import { createHash } from "node:crypto";

import {
  computeMemoryRecordPayloadHash,
  RepositoryBackedMemoryRetrievalServiceV0
} from "../../../packages/memory/dist/index.js";

import {
  ALICE,
  CONDITIONS,
  MEDIATOR_REF,
  MODEL,
  RESEARCH_INTERVENTIONS,
  SUBJECT,
  TASK,
  type ConditionId,
  type Scenario
} from "./contract.ts";
import { admitObservation, type Runtime } from "./world.ts";

const runtimeDist = new URL("../../../packages/runtime/dist/", import.meta.url).href;
const { RuntimeCompositionRoot } = await import(`${runtimeDist}composition/runtime-composition-root.js`);
const { ConversationTextResponseExecutorV1 } = await import(`${runtimeDist}transitions/conversation/conversation-text-response-executor-v1.js`);
const { createMiclStageMinter } = await import(`${runtimeDist}micl/micl-capabilities.js`);
const { InMemoryMiclWorkflowStore } = await import(`${runtimeDist}micl/micl-workflow-store.js`);
const { createEpisodeContentReaderV0 } = await import("../../../packages/memory/dist/index.js");

export interface SceneInput {
  readonly condition: ConditionId;
  readonly scenario: Scenario;
  readonly replicate: number;
  /** Condition-level research interventions (derived, never caller-chosen). */
  readonly suppress_mediator_contribution: boolean;
  readonly equalize_familiarity_representation: boolean;
  readonly cognitionTransport: unknown;
  readonly languageTransport: unknown;
}

export interface RetrievalAttemptAttestation {
  readonly query_fingerprint: string | null;
  readonly selected_refs: readonly string[];
  readonly selected_content_hashes: readonly string[];
  readonly candidate_count: number | null;
  readonly replaced_with_empty: boolean;
}

export interface InterventionAttestation {
  readonly declared: string | null;
  readonly familiarity_representation_replaced: boolean;
  readonly familiarity_line_before: string | null;
  readonly familiarity_line_after: string | null;
  readonly influence_line_before: string | null;
  readonly influence_line_after: string | null;
  readonly only_familiarity_lines_changed: boolean;
  readonly projection_hash_now_stale: boolean;
}

export interface SceneObservation {
  readonly schema_version: "familiarity-history-causal-scene-v0";
  readonly condition: string;
  readonly scenario_id: string;
  readonly replicate: number;
  readonly request_id: string;
  readonly result_kind: "OUTPUT_READY" | "FAILED";
  readonly failure_stage: string | null;
  readonly failure_detail: string | null;
  readonly directive_kind: string | null;
  readonly behavior_class: string;
  readonly atom_kind: string | null;
  readonly designated_claim: {
    readonly kind: string | null;
    readonly text_tail: string | null;
    readonly source_refs: readonly string[];
    readonly cites_counterpart_mediator: boolean;
  };
  readonly behavior_text: string | null;
  readonly forbidden_vocabulary: readonly string[];
  readonly recognition: {
    readonly familiarity_entry_line: string | null;
    readonly influence_entry_line: string | null;
    readonly mediator_visible_in_prompt: boolean;
    readonly mediator_in_allowed_refs: boolean;
    readonly condition_label_leak: boolean;
  };
  readonly retrieval: {
    readonly queries: number;
    readonly attempts: readonly RetrievalAttemptAttestation[];
    readonly recent_retrieval_refs: readonly string[];
  };
  readonly cognition: {
    readonly calls: number;
    readonly system_hash: string;
    readonly user_content: string;
    readonly projection_hash: string | null;
    readonly material_digest: string;
    /** Raw model output (forensic; never scored directly). */
    readonly raw_model_output: readonly string[];
  };
  readonly language: {
    readonly calls: number;
    readonly input_hash: string | null;
    readonly schema_version: string | null;
  };
  readonly intervention: InterventionAttestation;
}

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

const FAMILIARITY_LINE_PATTERN = /^-\s*entity:alice: presence=PRESENT level=\d+\/32$/m;
const INFLUENCE_LINE_PATTERN = /^-\s*entity:alice: context_resolution_strategy=\w+$/m;

export async function runScene(runtime: Runtime, input: SceneInput): Promise<SceneObservation> {
  // The subject must actually RECEIVE the counterpart's message as its observable
  // situation, exactly as the production session does; `task` stays the frozen
  // generic task so the goal context is identical across every cell.
  await admitObservation(
    runtime,
    `${input.scenario.id}-r${input.replicate}`,
    input.scenario.utterance,
    { scene: input.scenario.utterance, task: TASK }
  );
  const snapshot = (await runtime.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as never as {
    runtime_metadata: { logical_time: number; state_revision: number };
    memory_state: { repository_revision: string };
  };
  const bindings = [runtime.binding];

  const production = new RepositoryBackedMemoryRetrievalServiceV0(runtime.repo as never);
  const attempts: RetrievalAttemptAttestation[] = [];
  let queryCount = 0;

  const cognitionRequests: { readonly content: string }[] = [];
  const systemContents: string[] = [];
  const languageRequests: { readonly content: string }[] = [];
  const cognitionRaw: string[] = [];
  let familiarityLine: string | null = null;
  let influenceLine: string | null = null;
  const intervention: {
    replaced: boolean;
    familiarityBefore: string | null;
    familiarityAfter: string | null;
    influenceBefore: string | null;
    influenceAfter: string | null;
    onlyFamiliarityChanged: boolean;
    projectionHashStale: boolean;
  } = {
    replaced: false,
    familiarityBefore: null,
    familiarityAfter: null,
    influenceBefore: null,
    influenceAfter: null,
    onlyFamiliarityChanged: false,
    projectionHashStale: false
  };

  const cognitionTransport = {
    complete: async (request: { readonly messages: readonly { readonly role: string; readonly content: string }[] }) => {
      const system = request.messages.find((message) => message.role === "system")?.content ?? "";
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      systemContents.push(system);

      // ---- D_FAMILIARITY_EQUALIZED: research-only REPRESENTATION intervention --------
      // Replace ONLY the two familiarity lines so the model's effective familiarity view
      // equals A_LOW (level 1/32, BASIC). No canonical state is read or written here.
      let effectiveUser = user;
      if (input.equalize_familiarity_representation) {
        intervention.familiarityBefore = FAMILIARITY_LINE_PATTERN.exec(user)?.[0] ?? null;
        intervention.influenceBefore = INFLUENCE_LINE_PATTERN.exec(user)?.[0] ?? null;
        effectiveUser = user
          .replace(FAMILIARITY_LINE_PATTERN, "- entity:alice: presence=PRESENT level=1/32")
          .replace(INFLUENCE_LINE_PATTERN, "- entity:alice: context_resolution_strategy=BASIC_CONTEXT_FIRST");
        intervention.familiarityAfter = FAMILIARITY_LINE_PATTERN.exec(effectiveUser)?.[0] ?? null;
        intervention.influenceAfter = INFLUENCE_LINE_PATTERN.exec(effectiveUser)?.[0] ?? null;
        intervention.replaced = intervention.familiarityBefore !== intervention.familiarityAfter
          || intervention.influenceBefore !== intervention.influenceAfter;
        // Prove minimality: stripping the two familiarity lines from each side must give
        // byte-identical text.
        const strip = (text: string) => text
          .replace(FAMILIARITY_LINE_PATTERN, "")
          .replace(INFLUENCE_LINE_PATTERN, "");
        intervention.onlyFamiliarityChanged = strip(user) === strip(effectiveUser);
        intervention.projectionHashStale = intervention.replaced;
      }

      familiarityLine = FAMILIARITY_LINE_PATTERN.exec(effectiveUser)?.[0] ?? null;
      influenceLine = INFLUENCE_LINE_PATTERN.exec(effectiveUser)?.[0] ?? null;
      cognitionRequests.push({ content: effectiveUser });

      const effectiveRequest = effectiveUser === user
        ? request
        : {
            ...(request as Record<string, unknown>),
            messages: (request.messages as readonly { readonly role: string; readonly content: string }[])
              .map((message) => (message.role === "user" ? { ...message, content: effectiveUser } : message))
          };
      const response = await (input.cognitionTransport as {
        complete: (request: unknown) => Promise<{ readonly content: string }>;
      }).complete(effectiveRequest);
      cognitionRaw.push(typeof response.content === "string" ? response.content : "");
      return response;
    }
  };
  const languageTransport = {
    complete: async (request: unknown) => {
      const typed = request as { readonly messages: readonly { readonly role: string; readonly content: string }[] };
      languageRequests.push({ content: typed.messages.find((message) => message.role === "user")?.content ?? "" });
      return await (input.languageTransport as { complete: (request: unknown) => Promise<{ readonly content: string }> }).complete(request);
    }
  };

  const root = new RuntimeCompositionRoot({
    subjectCore: runtime.assembly.facade as never,
    producerAuthorizationIssuer: runtime.issuer as never,
    memoryRepository: runtime.repo as never,
    retrieval: {
      retrieve: async (query: unknown) => {
        queryCount += 1;
        const result = await production.retrieve(query as never) as {
          readonly selected_memory_refs: readonly string[];
          readonly deterministic_metadata: { readonly query_fingerprint?: string; readonly candidate_count?: number };
        };
        const selected = [...result.selected_memory_refs];
        const hashes = await Promise.all(selected.map(async (ref) => {
          const payload = runtime.repo.readStoredPayload(ref as never);
          return payload === undefined ? "unresolvable" : await computeMemoryRecordPayloadHash(payload);
        }));
        attempts.push({
          query_fingerprint: result.deterministic_metadata.query_fingerprint ?? null,
          selected_refs: input.suppress_mediator_contribution ? [] : selected,
          selected_content_hashes: input.suppress_mediator_contribution ? [] : hashes,
          candidate_count: result.deterministic_metadata.candidate_count ?? null,
          replaced_with_empty: input.suppress_mediator_contribution
        });
        if (!input.suppress_mediator_contribution) return result;
        // MEDIATOR ABLATION: the production service still ran and produced a validated
        // result; only the familiarity-mediated CONTRIBUTION is suppressed.
        return { ...result, selected_memory_refs: [], evidence: [] };
      }
    } as never,
    cognitionProvider: { propose: async () => { throw new Error("experiment: ordinary cognition provider must not be called"); } } as never,
    conversationCognitionTransport: cognitionTransport as never,
    languageTransport: languageTransport as never,
    episodeContentReader: createEpisodeContentReaderV0(runtime.repo as never) as never,
    experiencePayloadRepository: runtime.repo as never
  } as never);

  const requestId = `req-famhist-${input.condition}-${input.scenario.id}-r${input.replicate}`;
  const minter = createMiclStageMinter(runtime.assembly.facade as never, new InMemoryMiclWorkflowStore(), {
    micl_id: `micl-famhist-${requestId}` as never,
    micl_request_fingerprint: sha256(requestId) as never,
    stage_key: "OBSERVATION"
  } as never);
  const executor = new ConversationTextResponseExecutorV1({ ...root.dependencies(), subjectCore: minter.core() } as never);
  let result: { kind: string; stage?: string; detail?: string; behavior?: { text: string }; trace?: Record<string, unknown> };
  try {
    result = await executor.execute(
      { subject_id: SUBJECT, current_logical_time: snapshot.runtime_metadata.logical_time, state_revision: snapshot.runtime_metadata.state_revision } as never,
      { response_request_id: requestId as never, cause_refs: [] } as never,
      minter.capabilities(bindings as never) as never
    ) as never;
  } catch (error) {
    result = { kind: "FAILED", stage: "THROWN", detail: error instanceof Error ? error.message : String(error) };
  }

  const userContent = cognitionRequests[0]?.content ?? "";
  const mediatorVisibleInPrompt = userContent.includes("Use concise wording, a factual tone, and no unnecessary apology");
  const evidenceSection = /\[memory evidence \(allowed refs\)\]([\s\S]*?)(?:\n\[|$)/.exec(userContent)?.[1] ?? "";
  const recentRetrievalRefs = evidenceSection.split("\n").map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter((line) => line.startsWith("episode:") || line.startsWith("observation:") || line.startsWith("experience:")
      || line.startsWith("entity:") || line.startsWith("environment:") || line.startsWith("subject:"));
  const directiveKind = (result.trace?.["communication_directive_kind"] as string | undefined) ?? null;
  const languageUser = languageRequests[0]?.content ?? "";
  const languagePayload = parseLanguagePayload(languageUser);
  const planPrimary = languagePayload?.["realization_plan"] ?? null;
  const atomKind = planPrimary !== null
    ? (((planPrimary as { primary?: { kind?: string } }).primary?.kind) ?? null)
    : (result.kind === "OUTPUT_READY" && directiveKind === "CLARIFY_MISSING_CONTEXT" ? "PRIMARY_CLARIFICATION" : null);
  const claims = (languagePayload?.["factual_assessment"] as {
    claims?: readonly { kind?: string; text?: string; source_refs?: readonly string[] }[];
  } | undefined)?.claims ?? [];
  const planClaimIndex = (planPrimary as { primary?: { claim_index?: number } } | null)?.primary?.claim_index;
  const designated = typeof planClaimIndex === "number" ? claims[planClaimIndex] : undefined;
  const designatedSourceRefs = [...(designated?.source_refs ?? [])];
  // HOST-VALIDATED, DISCRIMINATOR-SPECIFIC endpoint: the claim must cite the exact
  // counterpart mediator ref. This is the instrument repair over the predecessor run.
  const citesCounterpartMediator = designated?.kind === "SOURCE_QUOTE"
    && designatedSourceRefs.includes(MEDIATOR_REF);
  const behaviorText = result.behavior?.text ?? null;

  let behaviorClass = "UNCLASSIFIED";
  if (result.kind === "OUTPUT_READY") {
    if (atomKind === "PRIMARY_CLARIFICATION") behaviorClass = "ASKS_FOR_FRAMING";
    else if (atomKind === "PRIMARY_STANCE") behaviorClass = "STANCE";
    else if (atomKind === "PRIMARY_CONVERSATIONAL_ACT") behaviorClass = "GENERATIVE_ACT";
    else if (atomKind === "PRIMARY_FACT") behaviorClass = citesCounterpartMediator ? "CITES_COUNTERPART_MEDIATOR" : "CITES_OTHER_EVIDENCE";
  }

  void ALICE;
  void MODEL;
  return {
    schema_version: "familiarity-history-causal-scene-v0",
    condition: input.condition,
    scenario_id: input.scenario.id,
    replicate: input.replicate,
    request_id: requestId,
    result_kind: result.kind === "OUTPUT_READY" ? "OUTPUT_READY" : "FAILED",
    failure_stage: result.kind === "OUTPUT_READY" ? null : (result.stage ?? null),
    failure_detail: result.kind === "OUTPUT_READY" ? null : (result.detail ?? null),
    directive_kind: directiveKind,
    behavior_class: behaviorClass,
    atom_kind: atomKind,
    designated_claim: {
      kind: designated?.kind ?? null,
      text_tail: typeof designated?.text === "string" ? designated.text.slice(-60) : null,
      source_refs: designatedSourceRefs,
      cites_counterpart_mediator: citesCounterpartMediator
    },
    behavior_text: behaviorText,
    forbidden_vocabulary: behaviorText === null ? [] : forbiddenVocabulary(behaviorText),
    recognition: {
      familiarity_entry_line: familiarityLine,
      influence_entry_line: influenceLine,
      mediator_visible_in_prompt: mediatorVisibleInPrompt,
      mediator_in_allowed_refs: recentRetrievalRefs.includes(MEDIATOR_REF),
      condition_label_leak: /\b(B_HIGH|A_LOW|C_MEDIATOR|D_FAMILIARITY|E_LOW|condition=|experiment|replicate)\b/.test(userContent)
    },
    retrieval: {
      queries: queryCount,
      attempts,
      recent_retrieval_refs: recentRetrievalRefs
    },
    cognition: {
      calls: cognitionRequests.length,
      system_hash: sha256(systemContents[0] ?? ""),
      user_content: userContent,
      projection_hash: /\[projection_hash\] (\S+)/.exec(userContent)?.[1] ?? null,
      material_digest: sha256(userContent),
      raw_model_output: cognitionRaw
    },
    language: {
      calls: languageRequests.length,
      input_hash: (result.trace?.["realization_input_hash"] as string | undefined) ?? null,
      schema_version: typeof languagePayload?.["schema_version"] === "string" ? (languagePayload["schema_version"] as string) : null
    },
    intervention: {
      declared: CONDITIONS[input.condition] === undefined
        ? null
        : (RESEARCH_INTERVENTIONS as Record<string, string | undefined>)[input.condition] ?? null,
      familiarity_representation_replaced: intervention.replaced,
      familiarity_line_before: intervention.familiarityBefore,
      familiarity_line_after: intervention.familiarityAfter,
      influence_line_before: intervention.influenceBefore,
      influence_line_after: intervention.influenceAfter,
      only_familiarity_lines_changed: intervention.onlyFamiliarityChanged,
      projection_hash_now_stale: intervention.projectionHashStale
    }
  };
}

function parseLanguagePayload(user: string): Record<string, unknown> | null {
  const start = user.indexOf("{");
  const end = user.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(user.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function forbiddenVocabulary(text: string): readonly string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const entry of [
    "i trust", "trust you", "trust me", "i like you", "i love", "affection", "intimacy",
    "we are friends", "bonded", "safe with you", "depend on you"
  ]) {
    if (lower.includes(entry)) found.push(entry);
  }
  return found;
}
