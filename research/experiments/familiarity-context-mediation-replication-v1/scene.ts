/* eslint-disable no-restricted-imports -- Experiment host imports frozen built production roots by relative dist path (workspace packages are not linked under research/). */
/**
 * FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1 — one matched scene.
 *
 * Entry: the production ConversationTextResponseExecutorV1 (Cognition V8 + Language V10 +
 * response-semantics atom) over a restored explicit-v4 subject, composed with the
 * PRODUCTION retrieval service behind the existing RuntimeDependencyContainer.retrieval
 * seam.
 *
 * CELLS differ ONLY in the canonical familiarity state / history and in one clearly
 * labelled research-only intervention:
 *   A_LOW                     familiarity 1/32,  BASIC_CONTEXT_FIRST,  counterpart context absent
 *   B_HIGH                    familiarity 6/32,  COUNTERPART_CONTEXT_SEARCH_FIRST, counterpart context present
 *   C_HIGH_RETRIEVAL_ABLATED  same canonical history as B_HIGH; the priority retrieval still
 *                             fires but its validated CONTRIBUTION is suppressed
 *   D_LOW_CONTEXT_EQUALIZED   familiarity 1/32 and B_HIGH's exact counterpart context made
 *                             readable via canonical working refs (no scene-level patch at all)
 *
 * ENDPOINT is derived ONLY from host-validated facts: the response-semantics atom plus the
 * designated factual claim's AUTHORIZED source_refs. CITES_COUNTERPART_CONTEXT requires the
 * claim to cite one of the counterpart refs; in A_LOW/C that ref set is not in the evidence
 * allowlist, so the class is unreachable there by construction. No LLM judge is used.
 */
import { createHash } from "node:crypto";

import {
  computeMemoryRecordPayloadHash,
  RepositoryBackedMemoryRetrievalServiceV0
} from "../../../packages/memory/dist/index.js";

import {
  ALICE,
  CONDITIONS,
  EPISODE_REFS,
  MODEL,
  RESEARCH_INTERVENTIONS,
  SHARED_CONTEXT_REFS,
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
  /** Derived from the cell id, never caller-chosen. */
  readonly suppress_mediator_contribution: boolean;
  readonly cognitionTransport: unknown;
  readonly languageTransport: unknown;
  /** "primary" | "replication" | "pilot" — pilot uses distinct identities. */
  readonly identity_phase: string;
}

export interface RetrievalAttemptAttestation {
  readonly query_fingerprint: string | null;
  readonly selected_refs: readonly string[];
  readonly selected_content_hashes: readonly string[];
  readonly candidate_count: number | null;
  readonly replaced_with_empty: boolean;
}

export interface SceneObservation {
  readonly schema_version: "familiarity-context-mediation-scene-v1";
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
    readonly cites_counterpart_context: boolean;
    readonly cited_counterpart_refs: readonly string[];
    readonly cites_shared_context: boolean;
  };
  /** §11 structured outcomes, every one derived from host-validated facts. */
  readonly outcomes: {
    readonly host_valid: boolean;
    readonly schema_valid: boolean;
    readonly factual_authority_pass: boolean;
    readonly counterpart_context_cited: boolean;
    readonly correct_counterpart_context_cited: boolean;
    readonly generic_context_only: boolean;
    readonly clarification_requested: boolean;
    readonly redundant_context_query: boolean;
    readonly assumes_shared_context: boolean;
    readonly continuation_directness: "DIRECT_CONTINUATION" | "CONTEXT_QUERY" | "FRAMING" | "NONE";
    readonly unsupported_relationship_inference: boolean;
  };
  readonly behavior_text: string | null;
  readonly forbidden_vocabulary: readonly string[];
  readonly recognition: {
    readonly familiarity_entry_line: string | null;
    readonly influence_entry_line: string | null;
    readonly counterpart_context_visible_in_prompt: boolean;
    readonly counterpart_refs_in_allowed_refs: readonly string[];
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
  readonly intervention: {
    readonly declared: string | null;
    readonly production_write: false;
  };
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
    `${input.scenario.id}-${input.identity_phase}-r${input.replicate}`,
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

  const cognitionTransport = {
    complete: async (request: { readonly messages: readonly { readonly role: string; readonly content: string }[] }) => {
      const system = request.messages.find((message) => message.role === "system")?.content ?? "";
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      systemContents.push(system);

      familiarityLine = FAMILIARITY_LINE_PATTERN.exec(user)?.[0] ?? null;
      influenceLine = INFLUENCE_LINE_PATTERN.exec(user)?.[0] ?? null;
      cognitionRequests.push({ content: user });

      const response = await (input.cognitionTransport as {
        complete: (request: unknown) => Promise<{ readonly content: string }>;
      }).complete(request);
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
  const counterpartSet = new Set(EPISODE_REFS);
  const sharedSet = new Set(SHARED_CONTEXT_REFS);
  const citedCounterpartRefs = designatedSourceRefs.filter((ref) => counterpartSet.has(ref));
  // READABILITY is host-determined: the counterpart items are readable exactly when their
  // refs are in the model-facing evidence allowlist. (A plain substring test on the prompt
  // is NOT usable — the scenario utterance itself can quote counterpart wording.)
  const counterpartRefsInAllowedRefs = recentRetrievalRefs.filter((ref) => counterpartSet.has(ref));
  const counterpartVisibleInPrompt = counterpartRefsInAllowedRefs.length > 0;
  // HOST-VALIDATED, DISCRIMINATOR-SPECIFIC endpoint: the designated claim must cite a
  // COUNTERPART ref. In A_LOW / C that ref set is not in the evidence allowlist, so this
  // class is unreachable there by construction.
  const citesCounterpartContext = designated?.kind === "SOURCE_QUOTE" && citedCounterpartRefs.length > 0;
  const citesSharedContext = citedCounterpartRefs.some((ref) => sharedSet.has(ref));
  const behaviorText = result.behavior?.text ?? null;
  const forbidden = behaviorText === null ? [] : forbiddenVocabulary(behaviorText);
  let behaviorClass = "UNCLASSIFIED";
  if (result.kind === "OUTPUT_READY") {
    if (atomKind === "PRIMARY_CLARIFICATION") behaviorClass = "ASKS_FOR_FRAMING";
    else if (atomKind === "PRIMARY_STANCE") behaviorClass = "STANCE";
    else if (atomKind === "PRIMARY_CONVERSATIONAL_ACT") behaviorClass = "GENERATIVE_ACT";
    else if (atomKind === "PRIMARY_FACT") behaviorClass = citesCounterpartContext ? "CITES_COUNTERPART_CONTEXT" : "CITES_GENERIC_ONLY";
  }

  // ---- §11 structured outcomes (every field host-determined) --------------------
  const hostValid = result.kind === "OUTPUT_READY";
  const genericOnly = hostValid && atomKind === "PRIMARY_FACT" && !citesCounterpartContext;
  const clarificationRequested = hostValid && atomKind === "PRIMARY_CLARIFICATION";
  const outcomes = {
    host_valid: hostValid,
    schema_valid: hostValid,
    factual_authority_pass: hostValid,
    counterpart_context_cited: citesCounterpartContext,
    correct_counterpart_context_cited: citesSharedContext,
    generic_context_only: genericOnly,
    clarification_requested: clarificationRequested,
    // Asking for framing while the counterpart context WAS available and relevant.
    redundant_context_query: clarificationRequested && CONDITIONS[input.condition].counterpart_context_available,
    assumes_shared_context: citesCounterpartContext && !clarificationRequested,
    continuation_directness: citesCounterpartContext
      ? ("DIRECT_CONTINUATION")
      : clarificationRequested
        ? ("FRAMING")
        : (genericOnly ? "CONTEXT_QUERY" : "NONE"),
    unsupported_relationship_inference: forbidden.length > 0
  } as const;

  void ALICE;
  void MODEL;
  return {
    schema_version: "familiarity-context-mediation-scene-v1",
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
      cites_counterpart_context: citesCounterpartContext,
      cited_counterpart_refs: citedCounterpartRefs,
      cites_shared_context: citesSharedContext
    },
    outcomes,
    behavior_text: behaviorText,
    forbidden_vocabulary: forbidden,
    recognition: {
      familiarity_entry_line: familiarityLine,
      influence_entry_line: influenceLine,
      counterpart_context_visible_in_prompt: counterpartVisibleInPrompt,
      counterpart_refs_in_allowed_refs: counterpartRefsInAllowedRefs,
      condition_label_leak: /\b(B_HIGH|A_LOW|C_HIGH|D_LOW|condition=|experiment|replicate)\b/.test(userContent)
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
      declared: (RESEARCH_INTERVENTIONS as Record<string, string | undefined>)[input.condition] ?? null,
      production_write: false
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
