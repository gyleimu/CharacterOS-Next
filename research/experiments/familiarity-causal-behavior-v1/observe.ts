/* eslint-disable no-restricted-imports -- Experiment host consumes frozen built public roots; MICL issuer is trusted host wiring only. */
import { createHash } from "node:crypto";
import {
  InMemoryRetrievalService, createEpisodeContentReaderV0, validateMemoryRetrievalQuery,
  type MemoryRetrievalQueryV0, type MemoryRetrievalResultV0, type EpisodeContentReaderV0
} from "../../../packages/memory/dist/index.js";
import {
  ConversationTextResponseExecutorV0, LlmCognitionProviderV0,
  RuntimeCompositionRoot, InMemoryMiclWorkflowStore, ModelTransportErrorV0,
  type ModelTransportV0, type ModelTransportRequestV0, type CognitiveContextProjectionV0,
  type CognitionProposalV0, type RuntimeDependencyContainer,
  type ConversationTextResponseResultV0, type SubjectCorePort
} from "../../../packages/runtime/dist/index.js";
import type { LanguageRealizationDraftV0 } from "../../../packages/behavior/dist/index.js";
import { createMiclStageMinter } from "../../../packages/runtime/dist/micl/micl-capabilities.js";
import { check, equal, type World } from "./fixtures.ts";
import { ALICE, CONVENTION_REF, RESPONSE_REQUEST_ID, type Validity } from "./contract.ts";

export const sha256 = (value: string | Uint8Array) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const objectHash = (value: unknown) => sha256(JSON.stringify(value));
export type Save = (name: string, value: unknown) => Promise<void>;
type LanguageRealizationRequestV0 = Parameters<NonNullable<RuntimeDependencyContainer["languageRealizationProvider"]>["realize"]>[0];
export interface ErrorRecord { name: string; code: string | null; message: string; http_status: number | null }
export function errorRecord(error: unknown): ErrorRecord {
  const e = error as { name?: string; code?: string; message?: string; http_status?: number } | null;
  return { name: e?.name ?? "Error", code: e?.code ?? null, message: e?.message ?? String(error), http_status: e?.http_status ?? null };
}
export interface StageTrace {
  calls: number;
  request: ModelTransportRequestV0 | null;
  request_hash: string | null;
  raw: { content: string; model: string } | null;
  transport_error: ErrorRecord | null;
  provider_error: ErrorRecord | null;
}
export interface Observation {
  entry: "ConversationTextResponseExecutorV0.execute";
  source: { subject_id: string; state_revision: number; canonical_head: unknown; repository_binding: unknown };
  projection: CognitiveContextProjectionV0 | null;
  validated_cognition: CognitionProposalV0 | null;
  language: { input: LanguageRealizationRequestV0["input"]; input_hash: string; lawful_evidence_refs: string[] } | null;
  validated_draft: LanguageRealizationDraftV0 | null;
  cognition_stage: StageTrace;
  language_stage: StageTrace;
  retrieval_trace: { provenance: "OBSERVED_RETRIEVAL_PORT_CALLS_NOT_INTERNAL_ORCHESTRATOR_RESULT"; queries: MemoryRetrievalQueryV0[]; results: MemoryRetrievalResultV0[] };
  memory_reads: { input: Parameters<EpisodeContentReaderV0["read"]>[0]; result: Awaited<ReturnType<EpisodeContentReaderV0["read"]>> }[];
  result: ConversationTextResponseResultV0 | null;
  host_error: ErrorRecord | null;
  canonical_unchanged: boolean;
  validity: Validity;
}
export function classify(o: Observation): Validity {
  if (o.result?.kind === "FAILED" && o.result.stage === "STALE_CONTEXT") return "STALE_CONTEXT";
  if (o.host_error || !o.canonical_unchanged) return "HOST_CAUSAL_TRACE_FAILURE";
  if (o.result?.kind === "OUTPUT_READY") return "VALID_BEHAVIOR";
  if (o.result?.kind !== "FAILED") return "HOST_CAUSAL_TRACE_FAILURE";
  switch (o.result.stage) {
    case "COGNITION_FAILED":
      return o.cognition_stage.transport_error ? "COGNITION_TRANSPORT_FAILURE" :
        o.cognition_stage.provider_error ? "COGNITION_SCHEMA_FAILURE" : "HOST_CAUSAL_TRACE_FAILURE";
    case "MEMORY_EVIDENCE_FAILED": return "MEMORY_EVIDENCE_FAILURE";
    case "LANGUAGE_TRANSPORT_FAILED": return "LANGUAGE_TRANSPORT_FAILURE";
    case "LANGUAGE_SCHEMA_INVALID": return "LANGUAGE_SCHEMA_FAILURE";
    case "LANGUAGE_EVIDENCE_INVALID": return "LANGUAGE_EVIDENCE_FAILURE";
    case "STALE_CONTEXT": return "STALE_CONTEXT";
    case "REQUEST_INVALID": return "HOST_CAUSAL_TRACE_FAILURE";
  }
}
function stage(): StageTrace {
  return { calls: 0, request: null, request_hash: null, raw: null, transport_error: null, provider_error: null };
}

/** Transparent observers: pass the ORIGINAL request/result/error through unchanged.
 * Writes complete before the next dependent call. No raw vendor thinking is read.
 * Arm and trial IDs are deliberately absent from this production entry's parameters.
 */
export async function observeResponse(world: World, transports: { cognition: ModelTransportV0; language: ModelTransportV0 }, options: {
  empty?: boolean;
  requestId?: string;
  save?: Save;
  guard?: (stage: "cognition" | "language", observation: Observation) => Promise<void>;
  reader?: EpisodeContentReaderV0; // offline negative-test seam; CLI always uses production reader
} = {}): Promise<Observation> {
  const persist = options.save ?? (async () => {});
  const save: Save = async (name, value) => {
    try { await persist(name, value); }
    catch (error) { o.host_error = errorRecord(error); throw error; }
  };
  const before = structuredClone(world.snapshot);
  const subject = before.identity.subject_id;
  const head = world.assembly.storeRead.getCommittedBundles().at(-1);
  const o: Observation = {
    entry: "ConversationTextResponseExecutorV0.execute",
    source: { subject_id: subject, state_revision: before.runtime_metadata.state_revision,
      canonical_head: head ? { commit_ref: head.commit_ref, record_checksum: head.record_checksum } : null, repository_binding: world.binding },
    projection: null, validated_cognition: null, language: null, validated_draft: null,
    cognition_stage: stage(), language_stage: stage(),
    retrieval_trace: { provenance: "OBSERVED_RETRIEVAL_PORT_CALLS_NOT_INTERNAL_ORCHESTRATOR_RESULT", queries: [], results: [] },
    memory_reads: [], result: null, host_error: null, canonical_unchanged: false, validity: "HOST_CAUSAL_TRACE_FAILURE"
  };
  await save("source", o.source);
  const wrap = (name: "cognition" | "language"): ModelTransportV0 => ({ complete: async request => {
    const trace = name === "cognition" ? o.cognition_stage : o.language_stage;
    trace.request = structuredClone(request); trace.request_hash = objectHash(request);
    await save(`${name}-request`, { request: trace.request, request_hash: trace.request_hash });
    try { await options.guard?.(name, o); }
    catch (error) { o.host_error = errorRecord(error); throw error; }
    check(trace.calls === 0, "single transport invocation per production stage");
    await save(`${name}-attempt`, { attempted_call_ordinal: trace.calls + 1 });
    trace.calls++;
    let response;
    try { response = await transports[name].complete(request); }
    catch (error) {
      trace.transport_error = errorRecord(error);
      await save(`${name}-transport-error`, trace.transport_error); throw error;
    }
    trace.raw = { content: response.content, model: response.model };
    await save(`${name}-raw`, trace.raw);
    return response;
  } });
  class RecordingCognition extends LlmCognitionProviderV0 {
    override async propose(projection: CognitiveContextProjectionV0) {
      o.projection = structuredClone(projection);
      await save("cognition-projection", o.projection);
      try {
        const proposal = await super.propose(projection);
        o.validated_cognition = structuredClone(proposal);
        await save("cognition-validated", o.validated_cognition);
        return proposal;
      } catch (error) {
        o.cognition_stage.provider_error = errorRecord(error);
        await save("cognition-provider-error", o.cognition_stage.provider_error); throw error;
      }
    }
  }
  function recordLanguage(provider: NonNullable<RuntimeDependencyContainer["languageRealizationProvider"]>) {
    const realize = provider.realize.bind(provider);
    // Decorate the production-created instance, not a replacement provider.
    provider.realize = async request => {
      o.language = { input: structuredClone(request.input), input_hash: request.input_hash,
        lawful_evidence_refs: [...request.lawful_evidence_refs].sort() };
      await save("language-input", o.language);
      try {
        const draft = await realize(request);
        o.validated_draft = structuredClone(draft);
        await save("language-validated", o.validated_draft);
        return draft;
      } catch (error) {
        o.language_stage.provider_error = errorRecord(error);
        await save("language-provider-error", o.language_stage.provider_error); throw error;
      }
    };
  }
  const core: SubjectCorePort = {
    reserveAndRoute: p => world.assembly.facade.reserveAndRoute(p), commitReserved: p => world.assembly.facade.commitReserved(p),
    terminalizeReservedNoOp: p => world.assembly.facade.terminalizeReservedNoOp(p), reconcile: (t, s, f) => world.assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async id => (await world.assembly.storeRead.readCurrentState(id)) ?? null
  };
  const selected = !options.empty && world.records.some(r => r.episode_ref === CONVENTION_REF) ? [CONVENTION_REF] : [];
  const retrieval = new InMemoryRetrievalService({ rehearsals: [{ repository_revision: world.binding.repository_revision,
    semantic_reference: ALICE as never, selected_memory_refs: selected as never,
    evidence: selected.map(ref => ({ episode_ref: ref as never, reasons: [{ dimension: "ENTITY" as const, score: 0.8 as never }] })),
    candidate_count: selected.length, retrieval_trace_ref: null }] });
  const reader = options.reader ?? createEpisodeContentReaderV0(world.memory);
  const root = new RuntimeCompositionRoot({ subjectCore: core, producerAuthorizationIssuer: world.assembly.producerAuthorizationIssuer,
    memoryRepository: world.memory, cognitionProvider: new RecordingCognition(wrap("cognition"), { temperature: 0 }),
    languageTransport: wrap("language"),
    episodeContentReader: { read: async input => {
      const result = await reader.read(input);
      o.memory_reads.push(structuredClone({ input, result }));
      await save(`memory-read-${o.memory_reads.length}`, { input, result }); return result;
    } },
    retrieval: { retrieve: async query => {
      check(validateMemoryRetrievalQuery(query).ok, "query schema");
      o.retrieval_trace.queries.push(structuredClone(query));
      await save(`retrieval-query-${o.retrieval_trace.queries.length}`, query);
      const result = await retrieval.retrieve(query);
      check(await world.memory.validateRefsBelong(query.repository_revision, result.selected_memory_refs), "selected ref membership");
      o.retrieval_trace.results.push(structuredClone(result));
      await save(`retrieval-result-${o.retrieval_trace.results.length}`, result); return result;
    } } });
  const productionLanguage = root.dependencies().languageRealizationProvider;
  check(productionLanguage, "production-created language provider wired");
  recordLanguage(productionLanguage);
  const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
    micl_id: "micl-conversation" as never, micl_request_fingerprint: `sha256:${"1".repeat(64)}` as never, stage_key: "OBSERVATION"
  });
  try {
    const executor = new ConversationTextResponseExecutorV0({ ...root.dependencies(), subjectCore: minter.core() });
    o.result = await executor.execute({ subject_id: subject, current_logical_time: before.runtime_metadata.logical_time,
      state_revision: before.runtime_metadata.state_revision },
    { response_request_id: (options.requestId ?? RESPONSE_REQUEST_ID) as never, cause_refs: [] }, minter.capabilities([world.binding]));
  } catch (error) { o.host_error = errorRecord(error); }
  o.canonical_unchanged = equal(before, await world.assembly.storeRead.readCurrentState(subject));
  o.validity = classify(o);
  await save("production-result", o);
  if (o.result?.kind === "OUTPUT_READY") {
    await save("behavior", o.result.behavior);
    await save("behavior-endpoint", endpoint(o));
  }
  return o;
}

/** No draft/proposal/raw fallback. The only observation is product-deliverable text. */
export function endpoint(o: Observation) {
  check(o.validity === "VALID_BEHAVIOR" && o.result?.kind === "OUTPUT_READY", "valid production behavior required");
  const b = o.result.behavior;
  return { text: b.text, evidence_refs: b.evidence_refs, behavior_id: b.behavior_id, input_hash: b.input_hash };
}

/** Offline schema fixtures: same fixed output policy for ALL states, no arm branch.
 * Both real production providers still parse/validate these transport responses.
 */
export function fakeTransports(): { cognition: ModelTransportV0; language: ModelTransportV0 } {
  return {
    cognition: { complete: async request => {
      const hash = request.messages[1]?.content.match(/\[projection_hash\] (sha256:[a-f0-9]{64})/)?.[1];
      check(hash, "production cognition hash in request");
      return { model: "OFFLINE_SCHEMA_FIXTURE", content: JSON.stringify({ schema_version: "cognition-proposal-v0", projection_hash: hash,
        reasoning_summary: "Offline inspectable summary, not a character reply.", current_intent: "respond to the current request",
        relevant_memory_refs: [], considered_context_refs: [], evidence_refs: [], confidence: 0.5, uncertainty: 0.5, action_intent: null }) };
    } },
    language: { complete: async request => {
      const hash = request.messages[1]?.content.match(/\ninput_hash: (sha256:[a-f0-9]{64})/)?.[1];
      check(hash, "production language hash in request");
      return { model: "OFFLINE_SCHEMA_FIXTURE", content: JSON.stringify({ schema_version: "language-realization-draft-v0",
        input_hash: hash, text: "A deterministic schema fixture, not behavioral evidence.", evidence_refs: [] }) };
    } }
  };
}
export const failingTransport = (): ModelTransportV0 => ({ complete: async () => { throw new ModelTransportErrorV0("MODEL_TIMEOUT", null, "offline failure fixture"); } });
