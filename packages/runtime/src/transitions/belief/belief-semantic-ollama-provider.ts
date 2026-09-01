/**
 * Native Ollama provider for the frozen Belief Semantic Target Resolution V0
 * provider contract (`BeliefSemanticTargetResolutionProviderV0`).
 *
 * Sibling-in-spirit of OllamaRelationshipSemanticChannelProviderV0: this
 * dedicated provider exists because `think: false` is an Ollama-native runtime
 * capability — the generic OpenAI-compatible transport (`ModelTransportRequestV0`
 * carries only `{ messages }`) is NOT widened. Instead this provider performs
 * its own narrow single-shot HTTP call to the Ollama-native endpoint
 * `POST {base_url}/api/chat`.
 *
 * Fixed request policy (NONE caller-controlled in V0 beyond base_url/model/
 * bounded timeout): think = false (reasoning EXPLICITLY disabled),
 * stream = false, temperature = 0, num_predict = 512. Exactly one request per
 * invocation; no retry, no repair, no fallback, no structured output schema
 * transport, no tool calls, no streaming.
 *
 * Provider-visible surface is EXACTLY the frozen provider input: the evidence
 * projection (episode_ref / occurrence_logical_time / scene) and the
 * CharacterOS-built proposition catalog (proposition_id / proposition_label —
 * NEVER credence), plus the two host fingerprints the model must echo
 * byte-exactly. No SubjectState, Personality, Relationship, Affect, Regulation
 * or cognition surface is ever visible. The prompt is fully deterministic for
 * a given frozen input.
 *
 * Response authority: ONLY `message.content`. A separate Ollama `thinking`
 * field, if present, is ignored entirely and NEVER becomes semantic output.
 * Empty / missing / non-string content fails closed with a typed provider
 * failure; the content must be DIRECTLY valid JSON (no markdown stripping, no
 * regex salvage, no repair). The parsed object is returned as-is — final
 * semantic validation authority (closed schema, catalog membership, label
 * contract, fingerprint equality, capability minting) remains EXCLUSIVELY with
 * the frozen runBeliefSemanticTargetResolutionV0 runner. This provider mints
 * NO semantic capability and holds NO canonical mutation authority.
 */

import {
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0
} from "./belief-semantic-target-resolution.js";

export const OLLAMA_BELIEF_SEMANTIC_PROVIDER_NUM_PREDICT = 512 as const;
export const OLLAMA_BELIEF_SEMANTIC_PROVIDER_TIMEOUT_MS = 60_000 as const;

/** Typed fail-closed provider error codes (diagnostics only; never semantic). */
export const BELIEF_SEMANTIC_OLLAMA_PROVIDER_ERROR_CODES = [
  "PROVIDER_INVALID_CONFIG",
  "PROVIDER_TIMEOUT",
  "PROVIDER_TRANSPORT_FAILURE",
  "PROVIDER_HTTP_FAILURE",
  "PROVIDER_INVALID_ENVELOPE",
  "PROVIDER_EMPTY_CONTENT",
  "PROVIDER_MALFORMED_JSON"
] as const;

export type BeliefSemanticOllamaProviderErrorCodeV0 =
  (typeof BELIEF_SEMANTIC_OLLAMA_PROVIDER_ERROR_CODES)[number];

export class BeliefSemanticOllamaProviderErrorV0 extends Error {
  readonly code: BeliefSemanticOllamaProviderErrorCodeV0;

  constructor(code: BeliefSemanticOllamaProviderErrorCodeV0, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "BeliefSemanticOllamaProviderErrorV0";
    this.code = code;
  }
}

/** Host-only, noncanonical live-provider configuration (explicit; no ambient env reads). */
export interface OllamaBeliefSemanticProviderConfigV0 {
  /** Ollama base URL, e.g. "http://127.0.0.1:11434" (explicit; no default). */
  readonly base_url: string;
  /** Model ID, e.g. "qwen3.5:9b" (explicit; no hard dependency). */
  readonly model: string;
  /** Bounded request timeout; defaults to 60s. No infinite wait. */
  readonly timeout_ms?: number;
}

type OllamaChatResponse = {
  message?: { content?: unknown; thinking?: unknown };
};

const SYSTEM_PROMPT = `You are a belief semantic bearing classifier inside CharacterOS.
Your ONLY role is to classify whether an exact verified evidence set semantically bears on a supplied bounded proposition catalog.

Hard authority restrictions:
- You NEVER mint proposition identities. For an existing proposition you may only copy a proposition_id EXACTLY from the supplied catalog.
- You NEVER output credence, next_credence, delta, confidence, weight, probability, or proposition_key.
- You NEVER decide numeric change or canonical mutation. Numeric belief adaptation is NOT your role.
- Your output is NOT objective truth and NOT a Bayesian probability. It is a semantic bearing classification only.

Decision definitions:
- For AT MOST ONE existing catalog proposition:
  - SUPPORTS means: the exact evidence set semantically tends to increase the subject's endorsement of that proposition.
  - CONTRADICTS means: the exact evidence set semantically tends to decrease the subject's endorsement of that proposition.
  - If several catalog propositions appear relevant, select the single proposition most directly and materially borne on by the exact evidence set. Never emit arrays of targets.
- If the evidence does not materially bear on any supplied proposition and does not clearly justify a new persistent proposition: return NO_BEARING. NO_BEARING is the ONLY lawful abstention. Do NOT use UNKNOWN, MAYBE, LOW_CONFIDENCE, NONE, or SKIP.
- If the evidence clearly expresses a potentially persistent proposition that is NOT represented in the supplied catalog: return NEW_PROPOSITION_CANDIDATE with a proposed_label ONLY. Do NOT invent a proposition_id or proposition_key.

Exact output schemas (one of the three):
EXISTING_PROPOSITION:
{"schema_version":"${BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION}","kind":"EXISTING_PROPOSITION","proposition_id":"<EXACT ID COPIED FROM THE CATALOG>","relation":"SUPPORTS|CONTRADICTS","semantic_context_fingerprint":"<EXACT PROVIDED VALUE>","candidate_catalog_fingerprint":"<EXACT PROVIDED VALUE>"}
NO_BEARING:
{"schema_version":"${BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION}","kind":"NO_BEARING","semantic_context_fingerprint":"<EXACT PROVIDED VALUE>","candidate_catalog_fingerprint":"<EXACT PROVIDED VALUE>"}
NEW_PROPOSITION_CANDIDATE:
{"schema_version":"${BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION}","kind":"NEW_PROPOSITION_CANDIDATE","proposed_label":"<descriptive proposition label>","semantic_context_fingerprint":"<EXACT PROVIDED VALUE>","candidate_catalog_fingerprint":"<EXACT PROVIDED VALUE>"}`;

/**
 * Deterministic Ollama chat messages for one frozen provider input.
 * Pure function of the input: same input → byte-identical messages.
 */
export function buildBeliefSemanticOllamaPromptMessages(
  input: BeliefSemanticTargetResolutionProviderInputV0
): readonly { readonly role: "system" | "user"; readonly content: string }[] {
  const evidenceLines = input.evidence.evidence.map((entry) => {
    return `- episode_ref: ${entry.episode_ref}\n  occurrence_logical_time: ${entry.occurrence_logical_time}\n  scene: ${entry.scene}`;
  });
  const catalogLines =
    input.catalog.propositions.length === 0
      ? ["(The supplied proposition catalog is EMPTY. EXISTING_PROPOSITION is impossible; the only lawful choices are NEW_PROPOSITION_CANDIDATE or NO_BEARING.)"]
      : input.catalog.propositions.map(
          (candidate) => `- proposition_id: ${candidate.proposition_id}\n  proposition_label: ${candidate.proposition_label}`
        );
  const userContent = [
    "semantic_context_fingerprint:",
    input.semantic_context_fingerprint,
    "candidate_catalog_fingerprint:",
    input.candidate_catalog_fingerprint,
    "",
    "Verified episodic evidence (exact, complete; do not assume any other evidence exists):",
    ...evidenceLines,
    "",
    "Candidate proposition catalog (exact, complete; do not assume any other proposition exists):",
    ...catalogLines,
    "",
    "Respond with ONE JSON OBJECT ONLY: no markdown fence, no analysis, no reasoning, no commentary, no prefix, no suffix, no explanation."
  ].join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent }
  ];
}

export class OllamaBeliefSemanticProviderV0 implements BeliefSemanticTargetResolutionProviderV0 {
  constructor(private readonly config: OllamaBeliefSemanticProviderConfigV0) {
    if (typeof config.base_url !== "string" || config.base_url.trim().length === 0) {
      throw new BeliefSemanticOllamaProviderErrorV0("PROVIDER_INVALID_CONFIG", "base_url: non-empty string required");
    }
    if (typeof config.model !== "string" || config.model.trim().length === 0) {
      throw new BeliefSemanticOllamaProviderErrorV0("PROVIDER_INVALID_CONFIG", "model: non-empty string required");
    }
    if (config.timeout_ms !== undefined && (!Number.isFinite(config.timeout_ms) || config.timeout_ms <= 0)) {
      throw new BeliefSemanticOllamaProviderErrorV0("PROVIDER_INVALID_CONFIG", "timeout_ms: positive finite number required");
    }
  }

  async propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown> {
    const timeoutMs = this.config.timeout_ms ?? OLLAMA_BELIEF_SEMANTIC_PROVIDER_TIMEOUT_MS;
    const base = this.config.base_url.replace(/\/$/, "");
    let response: Response;
    try {
      response = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          messages: buildBeliefSemanticOllamaPromptMessages(input).map((message) => ({
            role: message.role,
            content: message.content
          })),
          think: false,
          stream: false,
          options: {
            temperature: 0,
            num_predict: OLLAMA_BELIEF_SEMANTIC_PROVIDER_NUM_PREDICT
          }
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "TimeoutError") {
        throw new BeliefSemanticOllamaProviderErrorV0(
          "PROVIDER_TIMEOUT",
          `ollama model transport timed out after ${timeoutMs}ms`
        );
      }
      throw new BeliefSemanticOllamaProviderErrorV0(
        "PROVIDER_TRANSPORT_FAILURE",
        `ollama model transport failed: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    }
    if (!response.ok) {
      throw new BeliefSemanticOllamaProviderErrorV0(
        "PROVIDER_HTTP_FAILURE",
        `ollama model endpoint returned HTTP ${response.status}`
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new BeliefSemanticOllamaProviderErrorV0(
        "PROVIDER_INVALID_ENVELOPE",
        `ollama model endpoint returned a non-JSON body: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    }
    if (body === null || typeof body !== "object") {
      throw new BeliefSemanticOllamaProviderErrorV0(
        "PROVIDER_INVALID_ENVELOPE",
        "ollama response envelope is not an object"
      );
    }
    const message = (body as OllamaChatResponse).message;
    if (message === null || typeof message !== "object") {
      throw new BeliefSemanticOllamaProviderErrorV0(
        "PROVIDER_INVALID_ENVELOPE",
        "ollama response envelope is missing message"
      );
    }
    // Response authority: message.content ONLY. message.thinking is ignored
    // entirely and NEVER becomes semantic output or a fallback.
    const content = message.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new BeliefSemanticOllamaProviderErrorV0(
        "PROVIDER_EMPTY_CONTENT",
        "ollama final message.content is empty or missing"
      );
    }
    // Direct JSON.parse only: no markdown stripping, no regex salvage, no repair.
    let candidate: unknown;
    try {
      candidate = JSON.parse(content) as unknown;
    } catch (error) {
      throw new BeliefSemanticOllamaProviderErrorV0(
        "PROVIDER_MALFORMED_JSON",
        `ollama final content is not valid JSON: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    }
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new BeliefSemanticOllamaProviderErrorV0(
        "PROVIDER_MALFORMED_JSON",
        "ollama final content is not a JSON object"
      );
    }
    return candidate;
  }
}
