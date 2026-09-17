/**
 * REAL_LANGUAGE_SMOKE — the bounded REAL product smoke for
 * AUTHORIZED_CLAIM_LANGUAGE_REALIZATION_V0. PRESERVED HERE ON PURPOSE: the smoke
 * harness is part of the evidence, not a throwaway script.
 *
 * DISABLED BY DEFAULT. It runs ONLY when `CHARACTEROS_REAL_SMOKE=1`, so the normal
 * gate (`pnpm test`) makes 0 model calls. To reproduce:
 *
 *   CHARACTEROS_REAL_SMOKE=1 npx vitest run product/sandbox/src/real-language-smoke.test.ts
 *
 * WHAT IT DOES, and what it does NOT do:
 *   - two subjects (A/B) get DIFFERENT offline-seeded lived history (0 calls);
 *   - each subject then faces the SAME current request in a FRESH process
 *     (restart), through the REAL product executor configuration
 *     (`resolveProductConfigurationV0` + `createProductTransportsV0`, so the
 *     family/model/endpoint are whatever the product would really use);
 *   - the REAL language stage runs too — this smoke exists to exercise the
 *     GENERATIVE-authorized-claim relaxation end to end;
 *   - the Appraisal stage stays the deterministic constant provider (0 calls) and
 *     is held IDENTICAL for both subjects, so any difference is attributable to
 *     Memory, not to affect;
 *   - HARD CALL CAP = 4 (cognition + language per subject). A fifth call is
 *     refused and fails that turn closed.
 *
 * SCOPE OF ANY RESULT: `PRODUCT_REAL_LANGUAGE_HISTORY_DEPENDENT_BEHAVIOR_OBSERVED`
 * at most. This is product acceptance, NOT a scientific causal law, NOT a model
 * comparison: no provider is switched for it and no benchmark is run.
 *
 * Artifact: tmp/real-language-smoke.json (machine-local, printed with its hash).
 */

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import {
  InteractiveSubjectHostV0,
  type InteractiveSubjectHostConfigV0
} from "./interactive-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import { processEnvironmentV0, resolveProductConfigurationV0 } from "./product-configuration.js";
import { createProductTransportsV0 } from "./product-providers.js";

const ENABLED = process.env["CHARACTEROS_REAL_SMOKE"] === "1";
/**
 * TOTAL real-call budget for this smoke run. Default 4 (cognition + language for
 * each subject). A smaller value is lawful, and is how a re-attempt after an
 * environmental failure stays inside the slice's own cap: subjects are attempted
 * in order and any subject the remaining budget cannot cover is recorded as
 * `NOT_RUN_BUDGET`, never silently dropped and never faked.
 */
const CALL_CAP = (() => {
  const raw = Number.parseInt(process.env["CHARACTEROS_REAL_SMOKE_CALL_CAP"] ?? "4", 10);
  return Number.isSafeInteger(raw) && raw > 0 ? raw : 4;
})();

const FACT_A = "I keep a red notebook on the desk.";
const FACT_B = "I keep a blue notebook on the desk.";
const SAME_SCENE = "Where do I keep my notebook?";
const CONSEQUENCE_A = "I checked the desk just now - the notebook is not there.";
const CONSEQUENCE_B = "I checked the desk again and the notebook is still there.";
const LATER_SCENE = "What do you know about my notebook?";
const SUBJECT_A = "alice-real-smoke";
const SUBJECT_B = "bob-real-smoke";

function config(root: string, subjectId: string): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: subjectId,
    display_name: subjectId,
    session_id: `sess-${subjectId}`,
    storage_root: root,
    interval_ticks: 1
  };
}

/** Offline history seed: a plain acknowledgement that admits the message durably. */
function seedCognition(): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> => ({
      content: JSON.stringify({
        response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
        schema_version: "conversation-cognition-proposal-v8",
        subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
        factual_assessment: { claims: [] },
        cognition: {
          schema_version: "cognition-proposal-v0",
          reasoning_summary: "history seed",
          relevant_memory_handles: [],
          considered_handles: [],
          current_intent: "acknowledge",
          confidence: 0.6,
          uncertainty: 0.4,
          action_intent: null,
          evidence_handles: []
        },
        communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
        clarification_basis: null
      }),
      model: "deterministic-history-seed"
    })
  };
}

function seedLanguage(): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> => ({
      content: JSON.stringify({
        schema_version: "language-realization-semantic-draft-v1",
        text: "Understood, noted.",
        evidence_refs: []
      }),
      model: "deterministic-history-seed"
    })
  };
}

interface CallCounter {
  count: number;
}

/** Hard per-process call cap: the (CAP+1)th real call is refused, never sent. */
function capped(inner: ModelTransportV0, counter: CallCounter): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      if (counter.count >= CALL_CAP) {
        throw new Error(`REAL_SMOKE_CALL_CAP: refusing real call ${String(counter.count + 1)} (cap ${String(CALL_CAP)})`);
      }
      counter.count += 1;
      return inner.complete(request);
    }
  };
}

/** HEAD without spawning git: read `.git/HEAD` and, for a ref, its ref file. */
function readRepoHead(): string {
  try {
    const head = readFileSync(join(process.cwd(), ".git", "HEAD"), "utf8").trim();
    const match = /^ref: (.+)$/.exec(head);
    if (match === null) return head;
    return readFileSync(join(process.cwd(), ".git", match[1] as string), "utf8").trim();
  } catch {
    return "(unknown)";
  }
}

describe.skipIf(!ENABLED)("REAL_LANGUAGE_SMOKE — bounded A/B with the real language stage", () => {
  it("same scene, two histories, real cognition + real language (<= 4 calls)", async () => {
    const environment = processEnvironmentV0();
    const rootA = mkdtempSync(join(tmpdir(), "real-lang-a-"));
    const rootB = mkdtempSync(join(tmpdir(), "real-lang-b-"));
    const counter: CallCounter = { count: 0 };
    try {
      const configuration = resolveProductConfigurationV0({
        environment,
        default_data_root: rootA,
        default_data_root_origin: "real-language-smoke"
      });
      const transports = createProductTransportsV0({
        executor: configuration.executor.effective,
        ...(configuration.executor.effective === "deepseek"
          ? { api_key: environment.get("MODEL_API_KEY") ?? null }
          : {}),
        base_url: configuration.endpoint.value,
        model: configuration.model.value,
        timeout_ms: configuration.timeout_ms.value,
        num_predict: configuration.num_predict.value,
        context_window_tokens: configuration.context_window_tokens.value
      });
      const realCognition = capped(transports.cognition, counter);
      const realLanguage = capped(transports.language, counter);

      // ---- offline history seeds (0 real calls) ---------------------------
      const seeded = async (root: string, subjectId: string, fact: string) => {
        const host = await InteractiveSubjectHostV0.open(config(root, subjectId), {
          conversationCognitionTransport: seedCognition(),
          languageTransport: seedLanguage(),
          appraisalProvider: createConstantAppraisalProviderV0(),
          sharedSourceStore: new FileSharedSubjectSourceStoreV0(root, subjectId),
          provider_identity: { model: "deterministic-history-seed", num_predict: 2048 },
          clock: () => "2026-01-01T00:00:00.000Z"
        });
        const outcome = await host.send(fact);
        return { status: outcome.status, episode_ref: outcome.observational_experience_ref };
      };
      const seedA = await seeded(rootA, SUBJECT_A, FACT_A);
      const seedB = await seeded(rootB, SUBJECT_B, FACT_B);

      // ---- the real post-restart turn, one subject at a time ---------------
      const realTurn = async (root: string, subjectId: string) => {
        const host = await InteractiveSubjectHostV0.open(config(root, subjectId), {
          conversationCognitionTransport: realCognition,
          languageTransport: realLanguage,
          // Deterministic and IDENTICAL for both subjects: affect is held constant.
          appraisalProvider: createConstantAppraisalProviderV0(),
          sharedSourceStore: new FileSharedSubjectSourceStoreV0(root, subjectId),
          provider_identity: { model: configuration.model.value, num_predict: configuration.num_predict.value },
          clock: () => "2026-01-01T00:00:00.000Z"
        });
        const callsBefore = counter.count;
        const outcome = await host.send(SAME_SCENE);
        return { resolution: host.resolution(), outcome, real_calls: counter.count - callsBefore };
      };
      const a = await realTurn(rootA, SUBJECT_A);
      // Budget gate: a subject the remaining calls cannot cover is NOT_RUN, never
      // approximated with deterministic output.
      const b =
        counter.count + 2 <= CALL_CAP
          ? await realTurn(rootB, SUBJECT_B)
          : ({ resolution: "NOT_RUN_BUDGET", outcome: null, real_calls: 0 } as const);

      const rawA = a.outcome?.raw_cognition_response ?? "";
      const rawB = b.outcome?.raw_cognition_response ?? "";
      const observed = (side: typeof a | typeof b) =>
        side.outcome === null
          ? { resolution: side.resolution as string, status: "NOT_RUN_BUDGET", failure: null, real_calls: 0 }
          : {
              resolution: side.resolution as string,
              status: side.outcome.status,
              failure: side.outcome.failure,
              real_calls: side.real_calls
            };
      const artifact = {
        schema_version: "real-language-smoke-v0",
        slice: "AUTHORIZED_CLAIM_LANGUAGE_REALIZATION_V0",
        harness: "product/sandbox/src/real-language-smoke.test.ts",
        repo_head: readRepoHead(),
        executor: {
          family: configuration.executor.effective,
          model: configuration.model.value,
          endpoint_host: (() => {
            try {
              return new URL(configuration.endpoint.value).host;
            } catch {
              return "(unparseable)";
            }
          })(),
          timeout_ms: configuration.timeout_ms.value,
          num_predict: configuration.num_predict.value,
          context_window_tokens: configuration.context_window_tokens.value,
          language_stage: "REAL (product transport, same family/model as cognition)",
          appraisal_stage: "deterministic constant provider (0 calls, identical for both subjects)"
        },
        scene: SAME_SCENE,
        histories: { subject_a: FACT_A, subject_b: FACT_B },
        seeding: { subject_a: seedA, subject_b: seedB },
        call_accounting: { real_calls: counter.count, cap: CALL_CAP, budget_source: "CHARACTEROS_REAL_SMOKE_CALL_CAP (default 4)" },
        subject_a: {
          ...observed(a),
          retrieved_refs: a.outcome?.retrieved_refs ?? [],
          provider_memory_section_present: a.outcome?.provider_memory_section_present ?? false,
          cognition_mentions_own_fact: rawA.includes(FACT_A),
          cognition_mentions_other_fact: rawA.includes(FACT_B),
          raw_cognition_response: rawA,
          raw_language_response: a.outcome?.raw_language_response ?? null,
          delivered_text: a.outcome?.subject_text ?? "",
          delivered_fact_used: (a.outcome?.subject_text ?? "").includes(FACT_A)
        },
        subject_b: {
          ...observed(b),
          retrieved_refs: b.outcome?.retrieved_refs ?? [],
          provider_memory_section_present: b.outcome?.provider_memory_section_present ?? false,
          cognition_mentions_own_fact: rawB.includes(FACT_B),
          cognition_mentions_other_fact: rawB.includes(FACT_A),
          raw_cognition_response: rawB,
          raw_language_response: b.outcome?.raw_language_response ?? null,
          delivered_text: b.outcome?.subject_text ?? "",
          delivered_fact_used: (b.outcome?.subject_text ?? "").includes(FACT_B)
        },
        delivered_text_different:
          a.outcome !== null && b.outcome !== null && a.outcome.subject_text !== b.outcome.subject_text
      };
      const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
      writeFileSync(join(process.cwd(), "tmp", "real-language-smoke.json"), serialized, "utf8");
      const summary = {
        real_calls: counter.count,
        cap: CALL_CAP,
        sha256: createHash("sha256").update(serialized, "utf8").digest("hex"),
        a: {
          status: a.outcome?.status ?? "NOT_RUN_BUDGET",
          delivered: a.outcome?.subject_text ?? "",
          own_fact: artifact.subject_a.cognition_mentions_own_fact
        },
        b: {
          status: b.outcome?.status ?? "NOT_RUN_BUDGET",
          delivered: b.outcome?.subject_text ?? "",
          own_fact: artifact.subject_b.cognition_mentions_own_fact
        },
        delivered_text_different: artifact.delivered_text_different
      };
      console.log("REAL_LANGUAGE_SMOKE", JSON.stringify(summary, null, 2));
    } finally {
      rmSync(rootA, { recursive: true, force: true });
      rmSync(rootB, { recursive: true, force: true });
    }
  }, 1_800_000);
});

/* -------------------------------------------------------------------------- */
/* CONSEQUENCE SCENARIO (CLOSED_LOOP_LIVED_INTERACTION_V0)                     */
/*                                                                             */
/* Same bounded harness, different scene: the subject first acts from memory,  */
/* then a counterpart CONSEQUENCE to that behavior is admitted through the real */
/* path (0 real calls), and the ONE real turn asks whether the model uses the   */
/* consequence it now durably carries. Budget 2 = one subject's cognition +     */
/* language; the other subject is recorded NOT_RUN_BUDGET.                      */
/* -------------------------------------------------------------------------- */

/** Deterministic context follower: cites the newest lived outcome the host supplied. */
function seedOutcomeFollower(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const blockStart = user.indexOf("[BEGIN HISTORICAL FACTUAL CONTENT");
      const blockEnd = blockStart < 0 ? -1 : user.indexOf("[END HISTORICAL FACTUAL CONTENT]", blockStart);
      const block = blockStart < 0 ? "" : user.slice(blockStart, blockEnd < 0 ? user.length : blockEnd);
      const marker = "- A delivered behavior was followed by this actor's exact reply:";
      const at = block.lastIndexOf(marker);
      const record = at < 0 ? "" : block.slice(at);
      const valueOf = (key: string): string | null => {
        const keyAt = record.indexOf(`${key}: `);
        if (keyAt < 0) return null;
        const quoteAt = record.indexOf('"', keyAt + key.length);
        if (quoteAt < 0) return null;
        let scan = quoteAt;
        for (;;) {
          scan = record.indexOf('"', scan + 1);
          if (scan < 0) return null;
          let backslashes = 0;
          let probe = scan - 1;
          while (probe >= quoteAt && record[probe] === "\\") {
            backslashes += 1;
            probe -= 1;
          }
          if (backslashes % 2 === 0) break;
        }
        try {
          return JSON.parse(record.slice(quoteAt, scan + 1)) as string;
        } catch {
          return null;
        }
      };
      const outcome = at < 0 ? null : valueOf("outcome_reply_text");
      const episodeRef = at < 0 ? null : valueOf("episode_ref");
      if (outcome === null || episodeRef === null) {
        return seedCognition().complete(request);
      }
      // The cited factual source must be BOUND in both the considered and the
      // evidence refs (host law), and the handle must be the one advertised for the
      // OUTCOME episode — quoting the outcome text while citing some other episode
      // would be an unauthorised source binding.
      const escapedRef = episodeRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const handleMatch = new RegExp(`- (F\\d+): ${escapedRef}`).exec(user);
      if (handleMatch === null) {
        return seedCognition().complete(request);
      }
      const handle = handleMatch[1] as string;
      return {
        content: JSON.stringify({
          response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "GENERATIVE" },
          schema_version: "conversation-cognition-proposal-v8",
          subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
          factual_assessment: {
            claims: [{ kind: "SOURCE_QUOTE", text: outcome, source_handles: [handle] }]
          },
          cognition: {
            schema_version: "cognition-proposal-v0",
            reasoning_summary: "answer from what happened last time",
            relevant_memory_handles: [handle],
            considered_handles: [handle],
            current_intent: `answer with what happened: ${outcome}`,
            confidence: 0.8,
            uncertainty: 0.2,
            action_intent: null,
            evidence_handles: [handle]
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
          clarification_basis: null
        }),
        model: "deterministic-history-seed"
      };
    }
  };
}

describe.skipIf(!ENABLED)("REAL_LANGUAGE_SMOKE — consequence scenario (bounded)", () => {
  it("a real turn after a lived consequence, one subject within a 2-call budget", async () => {
    const environment = processEnvironmentV0();
    const rootA = mkdtempSync(join(tmpdir(), "real-cons-a-"));
    const rootB = mkdtempSync(join(tmpdir(), "real-cons-b-"));
    const counter: CallCounter = { count: 0 };
    try {
      const configuration = resolveProductConfigurationV0({
        environment,
        default_data_root: rootA,
        default_data_root_origin: "real-consequence-smoke"
      });
      const transports = createProductTransportsV0({
        executor: configuration.executor.effective,
        ...(configuration.executor.effective === "deepseek"
          ? { api_key: environment.get("MODEL_API_KEY") ?? null }
          : {}),
        base_url: configuration.endpoint.value,
        model: configuration.model.value,
        timeout_ms: configuration.timeout_ms.value,
        num_predict: configuration.num_predict.value,
        context_window_tokens: configuration.context_window_tokens.value
      });

      const offlineDeps = (root: string, subjectId: string) => ({
        conversationCognitionTransport: seedOutcomeFollower(),
        languageTransport: seedLanguage(),
        // Deterministic and IDENTICAL for both subjects: affect is held constant.
        appraisalProvider: createConstantAppraisalProviderV0(),
        sharedSourceStore: new FileSharedSubjectSourceStoreV0(root, subjectId),
        provider_identity: { model: "deterministic-history-seed", num_predict: 2048 },
        clock: () => "2026-01-01T00:00:00.000Z"
      });

      const seedHistory = async (root: string, subjectId: string, fact: string) => {
        const host = await InteractiveSubjectHostV0.open(config(root, subjectId), offlineDeps(root, subjectId));
        return (await host.send(fact)).observational_experience_ref;
      };
      const actFromMemory = async (root: string, subjectId: string) => {
        const host = await InteractiveSubjectHostV0.open(config(root, subjectId), offlineDeps(root, subjectId));
        const outcome = await host.send(SAME_SCENE);
        return { status: outcome.status, delivered: outcome.subject_text };
      };
      const admitConsequence = async (root: string, subjectId: string, text: string) => {
        const host = await InteractiveSubjectHostV0.open(config(root, subjectId), offlineDeps(root, subjectId));
        const outcome = await host.send(text);
        return {
          status: outcome.status,
          affected: outcome.affect_after,
          closed: outcome.completed_prior_outcome?.episode_ref ?? null
        };
      };

      const historyA = await seedHistory(rootA, SUBJECT_A, FACT_A);
      const historyB = await seedHistory(rootB, SUBJECT_B, FACT_B);
      const actedA = await actFromMemory(rootA, SUBJECT_A);
      const actedB = await actFromMemory(rootB, SUBJECT_B);
      const consequenceA = await admitConsequence(rootA, SUBJECT_A, CONSEQUENCE_A);
      const consequenceB = await admitConsequence(rootB, SUBJECT_B, CONSEQUENCE_B);
      if (counter.count !== 0) throw new Error(`offline seeding made ${String(counter.count)} real calls`);

      const realTurn = async (root: string, subjectId: string) => {
        const host = await InteractiveSubjectHostV0.open(config(root, subjectId), {
          conversationCognitionTransport: capped(transports.cognition, counter),
          languageTransport: capped(transports.language, counter),
          appraisalProvider: createConstantAppraisalProviderV0(),
          sharedSourceStore: new FileSharedSubjectSourceStoreV0(root, subjectId),
          provider_identity: { model: configuration.model.value, num_predict: configuration.num_predict.value },
          clock: () => "2026-01-01T00:00:00.000Z"
        });
        const callsBefore = counter.count;
        const outcome = await host.send(LATER_SCENE);
        return { resolution: host.resolution(), outcome, real_calls: counter.count - callsBefore };
      };
      const a = await realTurn(rootA, SUBJECT_A);
      const b = counter.count + 2 <= CALL_CAP ? await realTurn(rootB, SUBJECT_B) : null;

      const artifact = {
        schema_version: "real-consequence-smoke-v0",
        slice: "CLOSED_LOOP_LIVED_INTERACTION_V0",
        harness: "product/sandbox/src/real-language-smoke.test.ts",
        repo_head: readRepoHead(),
        executor: {
          family: configuration.executor.effective,
          model: configuration.model.value,
          timeout_ms: configuration.timeout_ms.value,
          language_stage: "REAL (product transport)",
          appraisal_stage: "deterministic constant provider (0 calls)"
        },
        scene: LATER_SCENE,
        offline_history: {
          subject_a: { fact: FACT_A, episode_ref: historyA, acted: actedA, consequence: consequenceA },
          subject_b: { fact: FACT_B, episode_ref: historyB, acted: actedB, consequence: consequenceB }
        },
        call_accounting: { real_calls: counter.count, cap: CALL_CAP },
        subject_a: {
          resolution: a.resolution,
          status: a.outcome.status,
          failure: a.outcome.failure,
          real_calls: a.real_calls,
          provider_memory_section_present: a.outcome.provider_memory_section_present,
          raw_cognition_response: a.outcome.raw_cognition_response,
          raw_language_response: a.outcome.raw_language_response,
          delivered_text: a.outcome.subject_text,
          uses_consequence: a.outcome.subject_text.includes(CONSEQUENCE_A)
        },
        subject_b:
          b === null
            ? { resolution: "NOT_RUN_BUDGET", status: "NOT_RUN_BUDGET", real_calls: 0 }
            : {
                resolution: b.resolution,
                status: b.outcome.status,
                failure: b.outcome.failure,
                real_calls: b.real_calls,
                provider_memory_section_present: b.outcome.provider_memory_section_present,
                raw_cognition_response: b.outcome.raw_cognition_response,
                raw_language_response: b.outcome.raw_language_response,
                delivered_text: b.outcome.subject_text,
                uses_consequence: b.outcome.subject_text.includes(CONSEQUENCE_B)
              }
      };
      const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
      writeFileSync(join(process.cwd(), "tmp", "real-consequence-smoke.json"), serialized, "utf8");
      console.log(
        "REAL_CONSEQUENCE_SMOKE",
        JSON.stringify(
          {
            real_calls: counter.count,
            cap: CALL_CAP,
            sha256: createHash("sha256").update(serialized, "utf8").digest("hex"),
            a: { status: a.outcome.status, delivered: a.outcome.subject_text, uses: artifact.subject_a.uses_consequence }
          },
          null,
          2
        )
      );
    } finally {
      rmSync(rootA, { recursive: true, force: true });
      rmSync(rootB, { recursive: true, force: true });
    }
  }, 1_800_000);
});
