/* eslint-disable no-restricted-imports -- Experiment host imports frozen built production roots by relative dist path (workspace packages are not linked under research/). */
/**
 * RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0 — one matched scene on the LIVE path.
 *
 * Entry: the production `ConversationTextResponseExecutorV1` (the same class the
 * product session authority uses) over a restored explicit-v4 subject. Cognition
 * reaches `ConversationCognitionProviderV8` (canonical V2 projection) and Language
 * reaches `language-realization-input-v10`; no historical protocol fallback.
 *
 * Memory is MATCHED: the injected retrieval service returns the same selection for
 * every condition, so the only model-visible difference is the familiarity material
 * (plus revision/time metadata, which is enumerated by the attestation).
 */
import { createHash } from "node:crypto";

import {
  computeRepositoryRevisionHash,
  createEpisodeContentReaderV0,
  InMemoryRetrievalService,
  type MemoryRetrievalQueryV0
} from "../../../packages/memory/dist/index.js";

import { ALICE, SUBJECT, type Scenario } from "./contract.ts";
import { admitObservation, check, classifyAtom, type Runtime } from "./world.ts";

const runtimeDist = new URL("../../../packages/runtime/dist/", import.meta.url).href;
const { RuntimeCompositionRoot } = await import(`${runtimeDist}composition/runtime-composition-root.js`);
const { ConversationTextResponseExecutorV1 } = await import(`${runtimeDist}transitions/conversation/conversation-text-response-executor-v1.js`);
const { createMiclStageMinter } = await import(`${runtimeDist}micl/micl-capabilities.js`);
const { InMemoryMiclWorkflowStore } = await import(`${runtimeDist}micl/micl-workflow-store.js`);

export interface AbsentRendering {
  /** The exact production rendering of an ABSENT familiarity entry line. */
  readonly familiarity_entry_line: string;
  /** The exact production rendering of the influence block for ABSENT familiarity. */
  readonly influence_lines: readonly string[];
  readonly familiarity_entry_absent_signature: string;
}

export interface SceneInput {
  readonly condition: string;
  readonly scenario: Scenario;
  readonly replicate: number;
  readonly ablation: boolean;
  readonly absent: AbsentRendering | null;
  readonly cognitionTransport: unknown;
  readonly languageTransport: unknown;
}

export interface SceneObservation {
  readonly schema_version: "familiarity-completion-scene-v0";
  readonly condition: string;
  readonly scenario_id: string;
  readonly replicate: number;
  readonly ablation: boolean;
  readonly request_id: string;
  readonly result_kind: "OUTPUT_READY" | "FAILED";
  readonly failure_stage: string | null;
  readonly failure_detail: string | null;
  readonly directive_kind: string | null;
  readonly behavior_class: string;
  readonly atom_kind: string | null;
  readonly plan_primary: unknown;
  readonly behavior_text: string | null;
  readonly forbidden_vocabulary: readonly string[];
  readonly recognition: {
    readonly familiarity_lines: readonly string[];
    readonly influence_lines: readonly string[];
    readonly convention_scene_in_cognition_request: boolean;
    readonly familiarity_material_present: boolean;
    readonly familiarity_material_ablated: boolean;
    readonly condition_label_leak: boolean;
  };
  readonly cognition: {
    readonly calls: number;
    readonly system_hash: string;
    readonly user_content: string;
    readonly projection_hash: string | null;
    readonly familiarity_entry_line: string | null;
    readonly influence_entry_line: string | null;
    readonly convention_handle: string | null;
    readonly material_digest: string;
  };
  readonly language: {
    readonly calls: number;
    readonly input_hash: string | null;
    readonly schema_version: string | null;
    readonly model_user_content: string | null;
  };
  readonly ablation_removed?: readonly string[];
  readonly concurrency: { readonly reserved_ok: boolean };
}

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

/** §36 projection-level ablation: replace the familiarity material with the frozen
 * ABSENT rendering in the model-facing subject data. Canonical state is untouched. */
export function applyFamiliarityAblation(userContent: string, expected: {
  readonly familiarity_entry_line: string;
  readonly influence_entry_line: string | null;
  readonly absent: AbsentRendering;
}): { readonly content: string; readonly removed: readonly string[] } {
  const removed: string[] = [];
  let content = userContent;
  check(content.includes(expected.familiarity_entry_line), "ablation: the PRESENT familiarity entry line must exist");
  content = content.replace(expected.familiarity_entry_line, expected.absent.familiarity_entry_line);
  removed.push(expected.familiarity_entry_line);
  if (expected.influence_entry_line !== null) {
    check(content.includes(expected.influence_entry_line), "ablation: the influence entry line must exist");
    content = content.replace(expected.influence_entry_line, expected.absent.influence_lines.join("\n"));
    removed.push(expected.influence_entry_line);
  }
  return { content, removed };
}

export async function runScene(runtime: Runtime, input: SceneInput): Promise<SceneObservation> {
    // The admitted observation identity is CONDITION-INDEPENDENT: the current
    // observation ref and the scene bytes must be identical across conditions.
  await admitObservation(runtime, `${input.scenario.id}-r${input.replicate}`, input.scenario.utterance);
  const snapshot = (await runtime.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as never as {
    runtime_metadata: { logical_time: number; state_revision: number };
    memory_state: { repository_revision: string };
    context: { current_observation_ref: string | null };
  };
  const manifest = await runtime.repo.readManifest(snapshot.memory_state.repository_revision as never);
  check(manifest !== null, "head manifest for capabilities");
  const bindings = [{
    repository_revision: snapshot.memory_state.repository_revision,
    repository_revision_hash: await computeRepositoryRevisionHash(manifest as never)
  }];

  const systemContents: string[] = [];
  const cognitionRequests: { readonly content: string }[] = [];
  const languageRequests: { readonly content: string }[] = [];
  const cognitionRaw: string[] = [];
  const languageRaw: (string | null)[] = [];
  let removedLines: readonly string[] = [];
  let familiarityEntryLine: string | null = null;
  let influenceEntryLine: string | null = null;

  const cognitionTransport = {
    complete: async (request: { readonly messages: readonly { readonly role: string; readonly content: string }[] }) => {
      const system = request.messages.find((message) => message.role === "system")?.content ?? "";
      let user = request.messages.find((message) => message.role === "user")?.content ?? "";
      familiarityEntryLine = /^-\s*entity:alice: presence=PRESENT level=\d+\/32$/m.exec(user)?.[0] ?? null;
      influenceEntryLine = /^-\s*entity:alice: context_resolution_strategy=\w+$/m.exec(user)?.[0] ?? null;
      if (input.ablation) {
        check(input.absent !== null, "ablation requires the frozen ABSENT rendering");
        check(familiarityEntryLine !== null, "ablation: PRESENT familiarity line captured");
        const transformed = applyFamiliarityAblation(user, {
          familiarity_entry_line: familiarityEntryLine,
          influence_entry_line: influenceEntryLine,
          absent: input.absent as AbsentRendering
        });
        user = transformed.content;
        removedLines = transformed.removed;
        // record the material AS SENT (post-ablation) in the observation
        familiarityEntryLine = /^-\s*entity:alice: presence=PRESENT level=\d+\/32$/m.exec(user)?.[0] ?? null;
        influenceEntryLine = /^-\s*entity:alice: context_resolution_strategy=\w+$/m.exec(user)?.[0] ?? null;
      }
      systemContents.push(system);
      cognitionRequests.push({ content: user });
      const response = await (input.cognitionTransport as {
        complete: (request: unknown) => Promise<{ readonly content: string }>;
      }).complete({ ...request, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
      cognitionRaw.push(response.content);
      return response;
    }
  };
  const languageTransport = {
    complete: async (request: { readonly messages: readonly { readonly role: string; readonly content: string }[] }) => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      languageRequests.push({ content: user });
      const response = await (input.languageTransport as {
        complete: (request: unknown) => Promise<{ readonly content: string }>;
      }).complete(request);
      languageRaw.push(response.content);
      return response;
    }
  };

  const root = new RuntimeCompositionRoot({
    subjectCore: runtime.assembly.facade as never,
    producerAuthorizationIssuer: runtime.issuer as never,
    memoryRepository: runtime.repo as never,
    retrieval: {
      retrieve: async (query: MemoryRetrievalQueryV0) => {
        // Memory-control (predeclared): the repository holds no additional admissible
        // counterpart-context evidence beyond the shared convention, which is already in
        // working refs. The priority query therefore adds nothing, keeping raw Memory
        // identical across conditions; only the familiarity material differs.
        const selected: string[] = [];
        const service = new InMemoryRetrievalService({
          rehearsals: [{
            repository_revision: runtime.binding.repository_revision,
            semantic_reference: ALICE as never,
            selected_memory_refs: selected as never,
            evidence: selected.map((ref) => ({ episode_ref: ref as never, reasons: [{ dimension: "ENTITY" as const, score: 0.8 as never }] })),
            candidate_count: selected.length,
            retrieval_trace_ref: null
          }]
        });
        return await service.retrieve(query);
      }
    } as never,
    cognitionProvider: { propose: async () => { throw new Error("experiment: ordinary cognition provider must not be called"); } } as never,
    conversationCognitionTransport: cognitionTransport as never,
    languageTransport: languageTransport as never,
    episodeContentReader: createEpisodeContentReaderV0(runtime.repo as never) as never,
    experiencePayloadRepository: runtime.repo as never
  } as never);

  const requestId = `req-fam-${input.condition}-${input.scenario.id}-r${input.replicate}`;
  const minter = createMiclStageMinter(runtime.assembly.facade as never, new InMemoryMiclWorkflowStore(), {
    micl_id: `micl-fam-${requestId}` as never,
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

  const directiveKind = (result.trace?.["communication_directive_kind"] as string | undefined) ?? null;
  let planPrimary: unknown = null;
  let languageSchema: string | null = null;
  let languageInputHash: string | null = null;
  if (languageRequests.length > 0) {
    const user = languageRequests[0]?.content ?? "";
    const parsed = parseLanguagePayload(user);
    planPrimary = parsed?.["realization_plan"] ?? null;
    languageSchema = typeof parsed?.["schema_version"] === "string" ? (parsed["schema_version"] as string) : null;
    languageInputHash = (result.trace?.["realization_input_hash"] as string | undefined) ?? null;
  }
  const rawWire = cognitionRaw[0] === undefined ? null : safeParse(cognitionRaw[0]);
  const planKind = planPrimary === null ? null : ((planPrimary as { primary?: { kind?: string } }).primary?.kind ?? null);
  const wireKind = (rawWire?.["response_semantics"] as { kind?: string } | undefined)?.kind ?? null;
  const atomKind = planKind
    ?? (result.kind === "OUTPUT_READY" && directiveKind === "CLARIFY_MISSING_CONTEXT" ? "PRIMARY_CLARIFICATION" : wireKind);
  const claimIndex = (planPrimary as { primary?: { claim_index?: number } } | null)?.primary?.claim_index ?? claimIndexFromWire(rawWire);
  const atomForClassification: { kind?: string; claim_index?: number } = {};
  if (atomKind !== null) atomForClassification.kind = atomKind;
  if (typeof claimIndex === "number") atomForClassification.claim_index = claimIndex;
  const claims = claimsFromWire(rawWire);
  const behaviorClass = result.kind !== "OUTPUT_READY"
    ? "UNCLASSIFIED"
    : atomKind === "PRIMARY_CLARIFICATION"
      ? "FRAMING_QUESTION"
      : classifyAtom({
        response_semantics: atomForClassification,
        ...(claims === undefined ? {} : { factual_assessment: claims })
      });

  const behaviorText = result.behavior?.text ?? null;
  const forbidden = behaviorText === null ? [] : forbiddenVocabulary(behaviorText);
  const userContent = cognitionRequests[0]?.content ?? "";
  const familiarityLines = userContent.split("\n").filter((line) => /interaction familiarity/.test(line) || /^- entity:alice: (presence|context_resolution_strategy)=/.test(line));
  const conventionSceneInRequest = userContent.includes("Use concise wording");
  const leaked = /\b(HIGH|LOW|ABLATED|condition=|experiment|replicate)\b/.test(userContent);

  return {
    schema_version: "familiarity-completion-scene-v0",
    condition: input.condition,
    scenario_id: input.scenario.id,
    replicate: input.replicate,
    ablation: input.ablation,
    request_id: requestId,
    result_kind: result.kind === "OUTPUT_READY" ? "OUTPUT_READY" : "FAILED",
    failure_stage: result.kind === "OUTPUT_READY" ? null : (result.stage ?? null),
    failure_detail: result.kind === "OUTPUT_READY" ? null : (result.detail ?? null),
    directive_kind: directiveKind,
    behavior_class: behaviorClass,
    atom_kind: atomKind,
    plan_primary: planPrimary,
    behavior_text: behaviorText,
    forbidden_vocabulary: forbidden,
    recognition: {
      familiarity_lines: familiarityLines,
      influence_lines: influenceEntryLine === null ? [] : [influenceEntryLine],
      convention_scene_in_cognition_request: conventionSceneInRequest,
      familiarity_material_present: familiarityEntryLine !== null,
      familiarity_material_ablated: input.ablation,
      condition_label_leak: leaked
    },
    cognition: {
      calls: cognitionRequests.length,
      system_hash: sha256(systemContents[0] ?? ""),
      user_content: userContent,
      projection_hash: /\[projection_hash\] (\S+)/.exec(userContent)?.[1] ?? null,
      familiarity_entry_line: familiarityEntryLine,
      influence_entry_line: influenceEntryLine,
      convention_handle: /^-\s*(F\d+):\s*episode:alice-convention-01$/m.exec(userContent)?.[1] ?? null,
      material_digest: sha256(userContent)
    },
    language: {
      calls: languageRequests.length,
      input_hash: languageInputHash,
      schema_version: languageSchema,
      model_user_content: languageRequests[0]?.content ?? null
    },
    concurrency: { reserved_ok: result.kind === "OUTPUT_READY" },
    ...(removedLines.length > 0 ? { ablation_removed: removedLines } : {})
  } as SceneObservation;
}

function safeParse(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function claimsFromWire(wire: Record<string, unknown> | null): { readonly claims?: readonly { readonly kind?: string; readonly text?: string }[] } | undefined {
  const assessment = wire?.["factual_assessment"];
  if (assessment === null || typeof assessment !== "object") return undefined;
  const claims = (assessment as { claims?: unknown }).claims;
  return Array.isArray(claims) ? { claims: claims as readonly { readonly kind?: string; readonly text?: string }[] } : undefined;
}

function claimIndexFromWire(wire: Record<string, unknown> | null): number | undefined {
  const atom = wire?.["response_semantics"];
  if (atom === null || typeof atom !== "object") return undefined;
  const index = (atom as { claim_index?: unknown }).claim_index;
  return typeof index === "number" ? index : undefined;
}

function parseLanguagePayload(user: string): Record<string, unknown> | null {
  const start = user.indexOf("{");
  if (start < 0) return null;
  const end = user.lastIndexOf("}");
  if (end <= start) return null;
  return safeParse(user.slice(start, end + 1));
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
