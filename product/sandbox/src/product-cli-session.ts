/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — CLI command/interaction session.
 *
 * Pure, readline-independent session logic: it receives ONE already-submitted
 * line, dispatches commands, or runs exactly one runtime turn. This is the unit
 * the offline tests exercise; `cli.ts` only wires readline + process signals to
 * it through the serial queue.
 */

import type { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import type { InteractiveTurnOutcomeV0 } from "@characteros-next/runtime";

export interface ProductCliSessionDepsV0 {
  readonly host: InteractiveSubjectHostV0;
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
  "  /help     show this help",
  "  /status   show subject + runtime status",
  "  /exit     finish the current turn, save, and quit",
  "Anything else is sent to the subject as a natural-language message."
]);

export class ProductCliSessionV0 {
  private exiting = false;

  constructor(private readonly deps: ProductCliSessionDepsV0) {}

  isExiting(): boolean {
    return this.exiting;
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
    const command = line.split(/\s+/, 1)[0] ?? line;
    if (command === "/exit") {
      this.exiting = true;
      const pending = this.deps.host.pendingLifecycleWork();
      if (pending > 0) {
        this.deps.write(
          `Warning: ${pending} mandatory lifecycle work item(s) still pending; refusing a clean exit.`
        );
        this.exiting = false;
        return { kind: "HANDLED" };
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
    this.deps.write(`Unknown command "${command}". Type /help for commands.`);
    return { kind: "HANDLED" };
  }

  private async handleUserMessage(text: string): Promise<void> {
    if (this.deps.host.isFailed()) {
      this.deps.write("The runtime is in a failed state and cannot take new messages. Use /exit, then relaunch.");
      return;
    }
    const outcome = await this.deps.host.send(text);
    this.deps.onTurnComplete?.(outcome);
    if (outcome.status !== "COMPLETE") {
      this.deps.write("Cognition generation failed; the interaction did not commit.");
      this.deps.write("The subject was not advanced. Use /exit and relaunch to resume from durable state.");
      if (this.deps.debug && outcome.failure !== null) this.deps.write(`[debug] ${outcome.failure}`);
      return;
    }
    this.deps.write(`Subject > ${outcome.subject_text}`);
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

  private async printStatus(): Promise<void> {
    const status = await this.deps.host.status();
    const lines = [
      `Subject: ${status.subject_id}`,
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
