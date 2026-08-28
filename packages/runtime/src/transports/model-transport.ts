/**
 * P2-next — ModelTransportV0: the model transport layer for the real LLM
 * cognition provider (provider integration slice).
 *
 * Layering (frozen):
 *   CognitionProviderV0 ↑ LlmCognitionProviderV0 ↓ ModelTransportV0 ↓
 *   OpenAI-compatible HTTP transport
 *
 * The transport is COGNITION-SEMANTICS-FREE: it moves prompt text to a model
 * endpoint and returns raw text. It never interprets, never mutates canonical
 * state, never retries (single attempt per call; retry policy belongs to the
 * host), and never persists secrets anywhere near canonical state — the API
 * key lives only in the transport config held by the host composition.
 *
 * OpenAI-compatible request shape is deliberately generic so the same
 * transport can target local gateways (Ollama-compatible / llama.cpp server /
 * LM Studio / vLLM) and remote providers (DeepSeek / Qwen-compatible / others).
 * No vendor SDK dependency — plain fetch.
 */

/** Transport configuration (host-held; NEVER persisted into canonical state). */
export interface ModelTransportConfigV0 {
  /** OpenAI-compatible base URL, e.g. "http://127.0.0.1:11434/v1". */
  readonly base_url: string;
  readonly model: string;
  /** Auth reference (e.g. "Bearer sk-..."); optional for local gateways. */
  readonly api_key: string | null;
  /** Request timeout in milliseconds; a per-call abort enforces it. */
  readonly timeout_ms: number;
  /** Deterministic-leaning generation config (NOT a determinism claim). */
  readonly temperature: number;
  /**
   * Max output tokens. HOST CONFIGURATION — no universal constant. Live-smoke
   * note (qwen3:8b): budgets near 512 truncated structured JSON mid-string;
   * 2048 produced complete output. Hosts should size this to their model and
   * the proposal schema, and treat truncation as MODEL_MALFORMED_JSON-class
   * provider failure, never as success.
   */
  readonly max_output_tokens: number;
}

/** One chat message for the completion request. */
export interface ModelTransportMessageV0 {
  readonly role: "system" | "user";
  readonly content: string;
}

/** Raw completion request (semantics-free). */
export interface ModelTransportRequestV0 {
  readonly messages: readonly ModelTransportMessageV0[];
}

/** Raw completion response. */
export interface ModelTransportResponseV0 {
  readonly content: string;
  readonly model: string;
}

/** Stable transport failure codes (observable as provider failures). */
export type ModelTransportFailureCode =
  | "MODEL_TIMEOUT"
  | "MODEL_CONNECTION_FAILURE"
  | "MODEL_HTTP_FAILURE"
  | "MODEL_EMPTY_RESPONSE";

export class ModelTransportErrorV0 extends Error {
  readonly code: ModelTransportFailureCode;
  readonly http_status: number | null;

  constructor(code: ModelTransportFailureCode, httpStatus: number | null, detail: string) {
    super(`MODEL_TRANSPORT_${code}: ${detail}`);
    this.name = "ModelTransportErrorV0";
    this.code = code;
    this.http_status = httpStatus;
  }
}

/** The narrow transport port implemented by real (HTTP) and fake transports. */
export interface ModelTransportV0 {
  complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0>;
}

function extractContent(body: unknown): string {
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ModelTransportErrorV0("MODEL_EMPTY_RESPONSE", 200, "completion response has no choices");
  }
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first?.message?.content;
  if (typeof content !== "string") {
    throw new ModelTransportErrorV0("MODEL_EMPTY_RESPONSE", 200, "completion message content is not a string");
  }
  if (content.length === 0) {
    throw new ModelTransportErrorV0("MODEL_EMPTY_RESPONSE", 200, "completion content is empty");
  }
  return content;
}

/** Generic OpenAI-compatible HTTP transport (single attempt, timeout-enforced). */
export class OpenAiCompatibleTransportV0 implements ModelTransportV0 {
  constructor(private readonly config: ModelTransportConfigV0) {}

  async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.config.timeout_ms);
    let response: Response;
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (this.config.api_key !== null) {
        headers["authorization"] = `Bearer ${this.config.api_key}`;
      }
      response = await fetch(`${this.config.base_url.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.config.model,
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: this.config.temperature,
          max_tokens: this.config.max_output_tokens
        }),
        signal: abort.signal
      });
    } catch (error) {
      if (abort.signal.aborted) {
        throw new ModelTransportErrorV0("MODEL_TIMEOUT", null, `transport timed out after ${this.config.timeout_ms}ms`);
      }
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        `transport connection failed: ${(error as Error).message}`
      );
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      throw new ModelTransportErrorV0(
        "MODEL_HTTP_FAILURE",
        response.status,
        `model endpoint returned HTTP ${response.status}`
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new ModelTransportErrorV0(
        "MODEL_HTTP_FAILURE",
        response.status,
        `model endpoint returned non-JSON body: ${(error as Error).message}`
      );
    }
    return { content: extractContent(body), model: this.config.model };
  }
}
