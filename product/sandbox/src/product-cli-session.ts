/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — CLI command/interaction session.
 *
 * Pure, readline-independent session logic: it receives ONE already-submitted
 * line, dispatches commands, or runs exactly one runtime turn. This is the unit
 * the offline tests exercise; `cli.ts` only wires readline + process signals to
 * it through the serial queue.
 */

import type { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import type { InteractiveTurnOutcomeV0, LivedMemoryEntryV0, LivedMemoryInspectionV0 } from "@characteros-next/runtime";
import type { ProductLifeOperationsV0 } from "./product-life-operations.js";
import type { ExternalStructuredObservationRequestV0 } from "./external-observation-ingress.js";
import {
  ProviderDiagnosticsV0,
  classifyProviderFailureV0,
  extractFailureStageV0
} from "./provider-diagnostics.js";
import {
  formatConfigurationLinesV0,
  type ProductConfigSourceV0,
  type ProductConfigurationV0
} from "./product-configuration.js";

export interface ProductCliSessionDepsV0 {
  readonly host: InteractiveSubjectHostV0;
  /**
   * CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_V0 — optional life operations
   * (observe / time / environment / state / life). Omitted ⇒ those commands
   * report that the capability is not configured in this session.
   */
  readonly life?: ProductLifeOperationsV0;
  /**
   * CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_V0 — optional
   * product provider diagnostics (/diagnostics) and stage-aware failure UX.
   */
  readonly diagnostics?: ProviderDiagnosticsV0;
  /**
   * CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0 — effective product
   * configuration read view (/config). Read-only product metadata; omitted ⇒
   * /config reports that the view is unavailable.
   */
  readonly configuration?: ProductConfigurationV0;
  /** Where the open subject's identity came from (product metadata only). */
  readonly subjectIdentity?: { readonly source: ProductConfigSourceV0; readonly origin: string };
  readonly subjectDurableState?: "NONE" | "PRESENT" | "UNKNOWN";
  /** Provider metadata preflight result at startup; defaults to READY. */
  readonly providerReady?: boolean;
  /** Conversation prefix label (display name); defaults to "Subject". */
  readonly subjectLabel?: string;
  readonly model: string;
  readonly providerLabel: string;
  readonly contextWindowTokens: number;
  readonly maxOutputTokens: number;
  readonly debug: boolean;
  /** Output sink (stdout in production, an array in tests). */
  readonly write: (line: string) => void;
  /** Optional operator evidence hook (local operational ledger), never UI. */
  readonly onTurnComplete?: (outcome: InteractiveTurnOutcomeV0) => void;
}

export type ProductCliLineResultV0 = { readonly kind: "EXIT" } | { readonly kind: "HANDLED" };

export const PRODUCT_CLI_HELP_LINES: readonly string[] = Object.freeze([
  "Commands:",
  "  /help        show this help",
  "  /status      show subject + runtime status",
  "  /state       show the subject's canonical state (read-only)",
  "  /life        show this subject's current life (read-only)",
  "  /memory      show recent durable lived memories (read-only)",
  "  /observe     submit one structured external observation",
  "               /observe source=front-door event=entered-001 entities=alice scene=\"Alice entered.\"",
  "  /environment run deterministic environment interaction(s): /environment [count]",
  "  /time        advance explicit canonical ticks: /time <ticks>",
  "  /demo        run the bounded one-life acceptance scenario",
  "  /config      show effective product configuration and where each value came from (read-only)",
  "  /diagnostics show what happened during provider calls: stage status, latency, last failure (alias /provider)",
  "  /exit        finish the current turn, save, and quit",
  "Anything else is sent to the subject as a natural-language message."
]);

const DEFAULT_MEMORY_LIMIT_V0 = 10;
const MAX_MEMORY_LIMIT_V0 = 100;
const MAX_DISPLAY_TEXT_LENGTH_V0 = 600;

/**
 * Read-only presentation sanitization: never alters canonical content; only
 * replaces terminal-unsafe control characters and caps the DISPLAYED length
 * with an explicit marker. The structured projection retains full text.
 */
function sanitizeDisplayTextV0(text: string): string {
  let out = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? " " : character;
  }
  return out.length > MAX_DISPLAY_TEXT_LENGTH_V0
    ? `${out.slice(0, MAX_DISPLAY_TEXT_LENGTH_V0)} …[truncated for display]`
    : out;
}

/** Product-facing next action for a classified provider failure. */
export function suggestionForFailureV0(category: string): string {
  switch (category) {
    case "PROVIDER_UNAVAILABLE":
      return "Check that Ollama is running and the configured model is installed, then relaunch.";
    case "PROVIDER_TIMEOUT":
      return "The local model exceeded the configured timeout; see /diagnostics, then retry or raise CHARACTEROS_TIMEOUT_MS.";
    case "PROVIDER_MALFORMED_RESPONSE":
      return "The model returned invalid structured output; see /diagnostics, then retry.";
    case "PROVIDER_REJECTED_OUTPUT":
      return "The model output was rejected by the frozen validator; see /diagnostics, then retry.";
    default:
      return "See /diagnostics, then /exit and relaunch to resume from durable state.";
  }
}

/**
 * PRODUCT observation UX: one line of `key=value` pairs (quoted values allowed) * parsed into the EXISTING structured-observation request. Bare names are
 * normalized to canonical ref prefixes; the ingress validator remains the
 * authority for what is lawful.
 */
export function parseObservationCommandV0(
  argument: string
): { readonly ok: true; readonly request: ExternalStructuredObservationRequestV0 } | { readonly ok: false; readonly detail: string } {
  const fields = new Map<string, string>();
  const pattern = /([A-Za-z_][A-Za-z0-9_]*)=("([^"]*)"|\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(argument)) !== null) {
    fields.set(match[1] as string, match[3] !== undefined ? match[3] : (match[2] as string));
  }
  const source = fields.get("source");
  const event = fields.get("event");
  const scene = fields.get("scene");
  const entities = fields.get("entities");
  if (source === undefined) return { ok: false, detail: "missing source=<source>" };
  if (event === undefined) return { ok: false, detail: "missing event=<event>" };
  if (scene === undefined || scene.length === 0) return { ok: false, detail: 'missing scene="<text>"' };
  if (entities === undefined) return { ok: false, detail: "missing entities=<a,b>" };
  const normalize = (value: string, prefix: string): string => (value.includes(":") ? value : `${prefix}:${value}`);
  const list = (value: string, prefix: string): string[] =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => normalize(entry, prefix));
  const entityRefs = list(entities, "entity");
  if (entityRefs.length === 0) return { ok: false, detail: "entities must name at least one entity" };
  const focus = fields.get("focus");
  const environment = fields.get("environment");
  const taskRaw = fields.get("task");
  return {
    ok: true,
    request: {
      source_ref: normalize(source, "source"),
      event_ref: normalize(event, "event"),
      entity_refs: entityRefs,
      scene,
      task: taskRaw === undefined || taskRaw.length === 0 ? null : taskRaw,
      ...(focus === undefined ? {} : { focus_refs: list(focus, "entity") }),
      ...(environment === undefined ? {} : { environment_refs: list(environment, "environment") })
    }
  };
}

export class ProductCliSessionV0 {
  private exiting = false;
  private lastTurnOutcome: InteractiveTurnOutcomeV0 | null = null;

  constructor(private readonly deps: ProductCliSessionDepsV0) {}

  isExiting(): boolean {
    return this.exiting;
  }

  private label(): string {
    const configured = this.deps.subjectLabel?.trim();
    return configured !== undefined && configured.length > 0 ? configured : "Subject";
  }

  /** Exactly one submitted line → at most one command or one turn. */
  async handleLine(rawLine: string): Promise<ProductCliLineResultV0> {
    const line = rawLine.trim();
    if (line.length === 0) return { kind: "HANDLED" };
    if (line.startsWith("/")) return this.handleCommand(line);
    await this.handleUserMessage(line);
    return { kind: "HANDLED" };
  }

  private async handleCommand(line: string): Promise<ProductCliLineResultV0> {
    const [command = line, ...rest] = line.split(/\s+/);
    const argument = rest.join(" ").trim();
    if (command === "/exit") {
      this.exiting = true;
      const pending = this.deps.host.pendingLifecycleWork();
      if (pending > 0) {
        this.deps.write(
          `Note: ${pending} mandatory lifecycle work item(s) remain from a failed turn; that partial work is NOT persisted and will be discarded.`
        );
      }
      this.deps.write("Goodbye.");
      return { kind: "EXIT" };
    }
    if (command === "/help") {
      for (const helpLine of PRODUCT_CLI_HELP_LINES) this.deps.write(helpLine);
      return { kind: "HANDLED" };
    }
    if (command === "/status") {
      await this.printStatus();
      return { kind: "HANDLED" };
    }
    if (command === "/memory") {
      await this.printLivedMemory(argument);
      return { kind: "HANDLED" };
    }
    if (command === "/state") {
      await this.printState();
      return { kind: "HANDLED" };
    }
    if (command === "/life") {
      await this.printLife();
      return { kind: "HANDLED" };
    }
    if (command === "/observe") {
      await this.runObserve(argument);
      return { kind: "HANDLED" };
    }
    if (command === "/time") {
      await this.runTime(argument);
      return { kind: "HANDLED" };
    }
    if (command === "/environment") {
      await this.runEnvironment(argument);
      return { kind: "HANDLED" };
    }
    if (command === "/demo") {
      await this.runDemo();
      return { kind: "HANDLED" };
    }
    if (command === "/config") {
      await this.printConfiguration();
      return { kind: "HANDLED" };
    }
    if (command === "/diagnostics" || command === "/provider") {
      this.printDiagnostics();
      return { kind: "HANDLED" };
    }
    this.deps.write(`Unknown command "${command}". Type /help for commands.`);
    return { kind: "HANDLED" };
  }

  private lifeOrNull(): ProductLifeOperationsV0 | null {
    return this.deps.life ?? null;
  }

  private writeLifeFailure(label: string, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    this.deps.write(`${label} refused: ${detail}`);
    if (detail.includes("NO_SUBJECT")) {
      this.deps.write("  hint: no durable subject yet — send the subject a message first.");
    }
  }

  private async printState(): Promise<void> {
    const life = this.lifeOrNull();
    if (life === null) {
      this.deps.write("State inspection is not configured in this session.");
      return;
    }
    const view = await life.stateView();
    const state = view.state;
    const out = (line: string): void => this.deps.write(line);
    out("State (canonical, read-only)");
    out("  Identity");
    out(`    subject: ${state.identity.subject_id}`);
    out(`    display name: ${state.identity.display_name.trim().length > 0 ? state.identity.display_name : "ABSENT"}`);
    out(`    identity anchors: ${state.identity.identity_anchors.length > 0 ? state.identity.identity_anchors.join(", ") : "ABSENT"}`);
    out("  Time");
    out(`    logical time: ${state.logical_time}`);
    out(`    state revision: ${state.state_revision}`);
    out(`    repository revision: ${state.repository_revision}`);
    out(`    shared revision: ${view.shared_revision === null ? "ABSENT" : String(view.shared_revision)}`);
    out("  Affect");
    out(`    valence: ${state.affect.valence}`);
    out(`    activation: ${state.affect.activation}`);
    out("  Regulation");
    out(`    energy: ${state.regulation.energy} stress: ${state.regulation.stress} arousal: ${state.regulation.arousal} fatigue: ${state.regulation.fatigue}`);
    out("  Personality");
    if (state.personality.length === 0) out("    ABSENT");
    else for (const dimension of state.personality) out(`    ${dimension.dimension_id}: ${dimension.value}`);
    const traitIds = Object.keys(state.traits_seed).sort();
    out("  Traits seed (P0)");
    if (traitIds.length === 0) out("    ABSENT");
    else for (const id of traitIds) out(`    ${id}: ${state.traits_seed[id]}`);
    out(`  Beliefs (${state.beliefs.length})`);
    if (state.beliefs.length === 0) out("    ABSENT");
    else for (const item of state.beliefs) out(`    ${item.proposition_label} [${item.proposition_id}] credence=${item.credence}`);
    out(`  Relationships (${state.relationships.length})`);
    if (state.relationships.length === 0) out("    ABSENT");
    else {
      for (const counterpart of state.relationships) {
        out(`    ${counterpart.counterpart_ref}`);
        if (counterpart.dimensions.length === 0) out("      (no dimensions)");
        else for (const dimension of counterpart.dimensions) out(`      ${dimension.dimension_id}: ${dimension.value}`);
      }
    }
    if (this.deps.debug && this.lastTurnOutcome !== null) {
      out("  Last cognition request (debug)");
      out(`    provider_request_hash: ${this.lastTurnOutcome.provider_request_hash ?? "ABSENT"}`);
      out(`    identity_match: ${this.lastTurnOutcome.provider_request_identity_match}`);
    }
  }

  private async printLife(): Promise<void> {
    const life = this.lifeOrNull();
    if (life === null) {
      this.deps.write("Life view is not configured in this session.");
      return;
    }
    const view = await life.lifeView();
    const out = (line: string): void => this.deps.write(line);
    out(`${view.display_name.trim().length > 0 ? view.display_name : view.subject_id} — one life`);
    out(`  Status: ${view.origin === "SUBJECT_RESTORED" ? "RESTORED (same subject)" : "NEW"}`);
    out(`  Subject: ${view.subject_id}`);
    out(`  Logical time: ${view.logical_time} canonical ticks`);
    out(`  State revision: ${view.state_revision}  Repository: ${view.repository_revision}  Shared: ${view.shared_revision === null ? "ABSENT" : view.shared_revision}`);
    out(`  Affect: valence=${view.affect.valence} activation=${view.affect.activation}`);
    out(`  Regulation: energy=${view.regulation.energy} stress=${view.regulation.stress} arousal=${view.regulation.arousal} fatigue=${view.regulation.fatigue}`);
    out(`  Beliefs: ${view.beliefs.length === 0 ? "ABSENT" : view.beliefs.map((item) => `${item.proposition_label}(${item.credence})`).join(", ")}`);
    out(`  Personality: ${view.personality.length === 0 ? "ABSENT" : view.personality.map((dimension) => `${dimension.dimension_id}=${dimension.value}`).join(", ")}`);
    out(`  Relationships: ${view.relationships.length === 0 ? "ABSENT" : view.relationships.map((counterpart) => counterpart.counterpart_ref).join(", ")}`);
    const memory = view.recent_memory;
    out(`  Lived memory: ${memory.total_episode_count} episode(s)${memory.total_episode_count > memory.displayed_count ? ` (showing ${memory.displayed_count} most recent)` : ""}`);
    for (const entry of memory.entries) {
      if (entry.kind === "OBSERVATION") out(`    - ${sanitizeDisplayTextV0(entry.scene)}`);
      else out(`    - delivered: "${sanitizeDisplayTextV0(entry.delivered_behavior_text)}" | replied: "${sanitizeDisplayTextV0(entry.outcome_reply_text)}"`);
    }
  }

  private async runObserve(argument: string): Promise<void> {
    const life = this.lifeOrNull();
    if (life === null) {
      this.deps.write("Structured observation is not configured in this session.");
      return;
    }
    const parsed = parseObservationCommandV0(argument);
    if (!parsed.ok) {
      this.deps.write(`Usage: /observe source=<source> event=<event> entities=<a,b> scene="<text>" [task="<text>"]`);
      this.deps.write(`  ${parsed.detail}`);
      return;
    }
    try {
      const outcome = await life.observe(parsed.request);
      if (outcome.kind === "FIRST") {
        this.deps.write(
          `observation FIRST: observation_ref=${outcome.observation_ref} episode_ref=${outcome.episode_ref} revision=${outcome.base_revision}`
        );
      } else if (outcome.kind === "REPLAY") {
        this.deps.write(`observation REPLAY (already recorded): observation_ref=${outcome.observation_ref} revision=${outcome.base_revision}`);
      } else {
        this.deps.write(`observation CONFLICT: ${outcome.detail}`);
      }
    } catch (error) {
      this.writeLifeFailure("observation", error);
    }
  }

  private async runTime(argument: string): Promise<void> {
    const life = this.lifeOrNull();
    if (life === null) {
      this.deps.write("Canonical time advance is not configured in this session.");
      return;
    }
    const ticks = Number.parseInt(argument, 10);
    if (!Number.isSafeInteger(ticks) || ticks < 0 || (argument.length > 0 && String(ticks) !== argument)) {
      this.deps.write("Usage: /time <canonical ticks>");
      return;
    }
    try {
      const result = await life.time(ticks);
      this.deps.write(
        `time: advanced ${result.ticks} canonical tick(s)${result.no_op ? " (NO_OP)" : ""} ` +
          `logical_time ${result.logical_time_before} -> ${result.logical_time_after} ` +
          `valence ${result.valence_before} -> ${result.valence_after}`
      );
    } catch (error) {
      this.writeLifeFailure("time advance", error);
    }
  }

  private async runEnvironment(argument: string): Promise<void> {
    const life = this.lifeOrNull();
    if (life === null) {
      this.deps.write("Environment interaction is not configured in this session.");
      return;
    }
    const parsed = argument.length === 0 ? 1 : Number.parseInt(argument, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 100) {
      this.deps.write("Usage: /environment [count] (1..100)");
      return;
    }
    try {
      const run = await life.environment(parsed);
      this.deps.write(`environment: ${run.environment_id} (${run.resolution})`);
      for (const outcome of run.outcomes) {
        this.deps.write(
          `  [${outcome.interaction_index}] ${outcome.status} behavior=${JSON.stringify(outcome.behavior_text.slice(0, 80))} ` +
            `episode=${outcome.episode_ref ?? "(none)"}`
        );
      }
      this.deps.write(
        `done: interaction_index=${run.status.interaction_index}/${run.status.interaction_count} ` +
          `state_revision=${run.status.state_revision} repository=${run.status.repository_revision}`
      );
    } catch (error) {
      this.writeLifeFailure("environment", error);
    }
  }

  /**
   * Bounded one-life acceptance scenario using the SAME product operations as
   * normal commands. Restart continuity is manual: the demo ends by asking the
   * user to /exit and relaunch, then run /life.
   */
  private async runDemo(): Promise<void> {
    const life = this.lifeOrNull();
    const out = (line: string): void => this.deps.write(line);
    out("demo: one persistent subject, one life");
    if (life === null) {
      out("demo unavailable: life operations are not configured in this session.");
      return;
    }
    out("[1/7] initial state");
    await this.printState();
    out("[2/7] human experience");
    await this.handleUserMessage("Hello — I would like to see what you are like today.");
    out("[3/7] structured external observation");
    await this.runObserve('source=demo-sensor event=demo-001 entities=alice scene="A quiet room with a desk." task="observe current situation"');
    out("[4/7] environment interaction");
    await this.runEnvironment("1");
    out("[5/7] recent lived memory");
    await this.printLivedMemory("");
    out("[6/7] advance canonical time");
    await this.runTime("30");
    out("[7/7] current life");
    await this.printLife();
    out("demo complete: /exit, then relaunch and run /life to see the same subject continue.");
  }

  /** Read-only lived-memory inspection. No provider call, no subject mutation. */
  private async printLivedMemory(argument: string): Promise<void> {
    let limit = DEFAULT_MEMORY_LIMIT_V0;
    if (argument.length > 0) {
      const parsed = Number.parseInt(argument, 10);
      if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== argument) {
        this.deps.write("Usage: /memory [count] — count is a positive integer (default 10).");
        return;
      }
      limit = Math.min(MAX_MEMORY_LIMIT_V0, parsed);
    }
    let inspection: LivedMemoryInspectionV0;
    try {
      inspection = await this.deps.host.livedMemory({ limit });
    } catch (error) {
      this.deps.write("Memory inspection failed.");
      if (this.deps.debug) this.deps.write(`[debug] ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const label = this.label();
    if (inspection.total_episode_count === 0) {
      this.deps.write(`${label} has no durable lived memories yet.`);
      return;
    }
    const noun = inspection.total_episode_count === 1 ? "episode" : "episodes";
    this.deps.write(
      inspection.total_episode_count > inspection.displayed_count
        ? `${label} remembers ${inspection.total_episode_count} lived ${noun}. Showing the ${inspection.displayed_count} most recent:`
        : `${label} remembers ${inspection.total_episode_count} lived ${noun}:`
    );
    this.deps.write("");
    inspection.entries.forEach((entry: LivedMemoryEntryV0, index: number) => {
      const position = index + 1;
      if (entry.kind === "OBSERVATION") {
        this.deps.write(`${position}. ${sanitizeDisplayTextV0(entry.scene)}`);
      } else {
        this.deps.write(`${position}. ${label} said:`);
        this.deps.write(`   "${sanitizeDisplayTextV0(entry.delivered_behavior_text)}"`);
        this.deps.write("   You replied:");
        this.deps.write(`   "${sanitizeDisplayTextV0(entry.outcome_reply_text)}"`);
      }
      if (this.deps.debug) this.deps.write(`   [${entry.episode_ref}]`);
      if (position < inspection.entries.length) this.deps.write("");
    });
  }

  private async handleUserMessage(text: string): Promise<void> {
    if (this.deps.host.isFailed()) {
      this.deps.write("The runtime is in a failed state and cannot take new messages. Inspection commands still work; use /exit, then relaunch.");
      return;
    }
    const outcome = await this.deps.host.send(text);
    this.lastTurnOutcome = outcome;
    this.deps.onTurnComplete?.(outcome);
    const belief = outcome.belief_adaptation;
    if (belief !== null && this.deps.diagnostics !== undefined) {
      this.deps.diagnostics.noteReported(
        "BELIEF_ADAPTATION",
        belief.status === "DISABLED" ? "DISABLED" : belief.failure === null ? "OK" : "FAILED",
        belief.failure === null ? belief.status : `${belief.status} — ${belief.failure}`
      );
    }
    if (outcome.status !== "COMPLETE") {
      await this.printTurnFailureSummary(outcome);
      return;
    }
    this.deps.write(`${this.label()} > ${outcome.subject_text}`);
    if (this.deps.debug) this.deps.write(this.debugTurnLine(outcome));
    if (this.deps.host.isFailed()) {
      this.deps.write("Warning: the reply was produced but durable state could not be saved. Relaunch to resume.");
    }
  }

  private debugTurnLine(outcome: InteractiveTurnOutcomeV0): string {
    const trace = outcome.provider_terminal_trace;
    return [
      `[debug] turn=${outcome.turn_index}`,
      `directive=${outcome.directive ?? "(none)"}`,
      `retrieved=${outcome.working_episode_refs.length}`,
      `repo=${outcome.repository_revision_after}`,
      `prompt_tokens=${trace?.ollama.prompt_eval_count ?? "?"}`,
      `eval_tokens=${trace?.ollama.eval_count ?? "?"}`,
      `done_reason=${trace?.ollama.done_reason ?? "?"}`,
      `identity_match=${outcome.provider_request_identity_match}`
    ].join(" ");
  }

  /**
   * Read-only effective product configuration (/config). Reports the SAME
   * resolution the CLI uses (env → default) plus the persisted product subject
   * config for identity; mutates nothing and never dumps the environment.
   */
  private async printConfiguration(): Promise<void> {
    const configuration = this.deps.configuration;
    if (configuration === undefined) {
      this.deps.write("Configuration view is not available in this session.");
      return;
    }
    for (const line of formatConfigurationLinesV0(configuration, {
      subject_id: this.deps.host.subjectId(),
      display_name: this.deps.host.displayName(),
      status: this.deps.host.resolution() === "SUBJECT_RESTORED" ? "RESTORED" : "NEW",
      durable_state: this.deps.subjectDurableState ?? "UNKNOWN",
      identity: this.deps.subjectIdentity ?? { source: "PERSISTED_PRODUCT_CONFIG", origin: "subject-config.json" },
      data_location: this.deps.host.storageLocation(),
      provider_ready: this.deps.providerReady !== false
    })) {
      this.deps.write(line);
    }
  }

  /** Per-stage provider diagnostics (/diagnostics, /provider). Read-only. */
  private printDiagnostics(): void {
    const diagnostics = this.deps.diagnostics;
    if (diagnostics === undefined) {
      this.deps.write("Provider diagnostics are not configured in this session.");
      return;
    }
    this.deps.write("What happened during provider calls; see /config for effective settings.");
    for (const line of diagnostics.formatLines()) this.deps.write(line);
    const last = this.lastTurnOutcome;
    if (last !== null) {
      this.deps.write(`Last turn: index=${last.turn_index} status=${last.status}`);
      if (last.failure !== null) {
        this.deps.write(`Last failure stage: ${extractFailureStageV0(last.failure) ?? "UNKNOWN"}`);
        this.deps.write(`Last failure detail: ${sanitizeDisplayTextV0(last.failure)}`);
      }
    }
  }

  /**
   * Bounded, truthful failure summary: which stage failed, whether canonical
   * work committed or remains pending, why, and what the user can do next.
   */
  private async printTurnFailureSummary(outcome: InteractiveTurnOutcomeV0): Promise<void> {
    const out = (line: string): void => this.deps.write(line);
    const failure = outcome.failure;
    const stage = extractFailureStageV0(failure);
    const recorded = stage === null ? null : this.deps.diagnostics?.last(stage) ?? null;
    const classified =
      recorded !== null && recorded.category !== null
        ? { category: recorded.category, detail: recorded.detail ?? "" }
        : classifyProviderFailureV0(failure ?? "unknown provider failure");
    const canonicalChanged =
      outcome.repository_revision_after !== outcome.repository_revision_before ||
      outcome.state_revision_after !== outcome.state_revision_before;
    const pending = this.deps.host.pendingLifecycleWork();
    out(`Turn failed during: ${stage ?? "UNKNOWN"}`);
    out(
      `Subject persistence: ${
        !canonicalChanged && pending === 0
          ? "SAFE (durable state unchanged since the last completed turn)"
          : "PARTIAL (this failed turn is not persisted; relaunch resumes from the last completed boundary)"
      }`
    );
    out(`  Canonical revision: ${outcome.repository_revision_before} -> ${outcome.repository_revision_after}`);
    out(`  State revision: ${outcome.state_revision_before} -> ${outcome.state_revision_after}`);
    out(`  Pending lifecycle work: ${pending}`);
    out(`Reason: ${classified.category}${this.deps.debug ? ` — ${sanitizeDisplayTextV0(classified.detail)}` : ""}`);
    out(`Suggested action: ${suggestionForFailureV0(classified.category)}`);
    out("Inspection commands still work: /status /state /life /memory /diagnostics /exit.");
  }

  private async printStatus(): Promise<void> {    const status = await this.deps.host.status();
    const displayName = this.deps.host.displayName();
    const lines = [
      `Display name: ${displayName.length > 0 ? displayName : "(unset)"}`,
      `Subject ID: ${status.subject_id}`,
      `Status: ${status.origin === "NEW_SUBJECT" ? "NEW" : "RESTORED"}`,
      `Turns: ${status.completed_turns} completed (next index ${status.turn_index})`,
      `Repository revision: ${status.repository_revision}`,
      `State revision: ${status.state_revision}`,
      `Pending behavior outcome: ${status.pending_behavior_outcome ? "yes (awaiting your next message)" : "no"}`,
      `Pending lifecycle work: ${status.pending_lifecycle_work}`,
      `Affect: valence=${status.affect.valence} activation=${status.affect.activation}`,
      `Provider: ${this.deps.providerLabel} / ${this.deps.model}`,
      `Context window tokens: ${this.deps.contextWindowTokens}`,
      `Max output tokens: ${this.deps.maxOutputTokens}`,
      `Data: ${this.deps.host.storageLocation() ?? "(in-memory)"}`
    ];
    for (const line of lines) this.deps.write(line);
  }
}
