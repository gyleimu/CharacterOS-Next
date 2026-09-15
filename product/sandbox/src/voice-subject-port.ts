/**
 * CHARACTEROS_VOICE_SUBJECT_PORT_BRIDGE_V0 — the product-side adapter that lets
 * the voice layer read state and run turns WITHOUT importing anything from it.
 *
 * The dependency arrow is deliberately one-way:
 *
 *   packages/voice  defines VoiceSubjectPortV0 (a narrow port, no CharacterOS imports)
 *   product/sandbox implements it here, over the EXISTING interactive host
 *
 * So the speech layer cannot reach into the core even by accident, and no core
 * semantics are modified to accommodate speech. This adapter adds no state, no
 * commit path and no authority: it reads the existing read-only state view and
 * calls the existing text ingress.
 */

import { INTERACTION_FAMILIARITY_DIMENSION_ID_V0 } from "@characteros-next/runtime";
import type {
  SpeechExpressionInputsV0,
  VoiceSubjectPortV0,
  VoiceTurnResultV0
} from "@characteros-next/voice";

import type { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";

/**
 * Reads the bounded projection inputs from the host's existing read-only state
 * view.
 *
 * `familiarity` is only reported when the subject has EXACTLY ONE counterpart,
 * because only then is it unambiguous that the counterpart is the person being
 * spoken to. With several counterparts the product cannot tell which one this
 * utterance addresses, so the port reports `null` and the projection falls back
 * to its documented neutral default rather than guessing.
 */
export class HostVoiceSubjectPortV0 implements VoiceSubjectPortV0 {
  constructor(private readonly host: InteractiveSubjectHostV0) {}

  async readSpeechExpressionInputs(): Promise<SpeechExpressionInputsV0> {
    const view = await this.host.subjectStateView();
    const counterparts = view.relationships;
    let familiarity: number | null = null;
    if (counterparts.length === 1) {
      const only = counterparts[0];
      const entry = only?.dimensions.find(
        (dimension) => dimension.dimension_id === INTERACTION_FAMILIARITY_DIMENSION_ID_V0
      );
      familiarity = entry === undefined ? null : entry.value;
    }
    return {
      valence: view.affect.valence,
      activation: view.affect.activation,
      energy: view.regulation.energy,
      stress: view.regulation.stress,
      arousal: view.regulation.arousal,
      fatigue: view.regulation.fatigue,
      familiarity
    };
  }

  /**
   * Runs ONE existing text turn through the frozen interactive host.
   *
   * Identical to what a typed message does, including the delivery bookkeeping:
   * the spoken reply is the SAME delivery, so the single deferred
   * `pending_behavior_outcome` slot stays correct. Speech does not create a
   * second delivery.
   */
  async submitUserText(text: string): Promise<VoiceTurnResultV0> {
    const outcome = await this.host.send(text);
    return {
      status: outcome.status === "COMPLETE" ? "COMPLETED" : "FAILED",
      reply_text: outcome.status === "COMPLETE" ? outcome.subject_text : null,
      state_revision: outcome.state_revision_after,
      failure: outcome.failure
    };
  }
}
