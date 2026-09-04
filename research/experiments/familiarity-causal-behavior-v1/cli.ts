/* eslint-disable no-restricted-imports -- Experiment CLI only; frozen public transport class. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { OllamaNativeCognitionTransportV0 } from "../../../packages/runtime/dist/index.js";
import { check, equal, neutralWorld } from "./fixtures.ts";
import { MODEL, NEUTRAL } from "./contract.ts";
import { observeResponse, errorRecord, objectHash } from "./observe.ts";
import { preflight, preflightHash, fixedLanguage, assertNoExperimentContract } from "./preflight.ts";
import { makeManifest, protocol, type Manifest } from "./manifest.ts";
import { executePrimary } from "./runner.ts";
import { validateExecutionAmendmentV0, type ExecutionAmendmentV0 } from "./amendment.ts";
import { verifyFreezeBaselineV1, verifyExecutionFreezeBaselineV1 } from "./freeze-baseline.ts";
import { ROOT, EXPERIMENT_PATH, TEST_PATH, git, readJson, writeJson, saver, freshDirectory, committedBaseline,
  frozenIntegrity, sourceFingerprint, builtFingerprint, verifyGates, probeProvider, type Gates } from "./artifacts.ts";

function transport() {
  return new OllamaNativeCognitionTransportV0({ base_url: MODEL.base_url, model: MODEL.model,
    timeout_ms: MODEL.timeout_ms, num_predict: MODEL.num_predict });
}
function lock(kind: string, hash: string, value: unknown) {
  const directory = join(ROOT, "tmp/familiarity-v1-locks");
  mkdirSync(directory, { recursive: true });
  writeJson(join(directory, `${kind}-${hash.replace("sha256:", "")}.json`), value);
}
function verifyFrozen(manifest: Manifest, amendment?: ExecutionAmendmentV0) {
  // Centralized V1 execution freeze verification (Phase 2: current authorization).
  verifyExecutionFreezeBaselineV1({
    readiness_source_fingerprint: manifest.freeze.source_fingerprint,
    readiness_built_fingerprint: manifest.freeze.built_fingerprint,
    readiness_protocol_hash: manifest.freeze.protocol_hash,
    current_source_fingerprint: sourceFingerprint(),
    current_built_fingerprint: builtFingerprint(),
    current_protocol_hash: objectHash(protocol()),
    amendment
  });
  frozenIntegrity();
}
async function prepare(gatesPath: string, outputPath: string) {
  const head = committedBaseline();
  const gates = readJson(gatesPath) as Gates;
  verifyGates(gates);
  const p = await preflight();
  const provider = await probeProvider(); // version/digest only, no generation
  const manifest = makeManifest({ harnessCommit: head, gates, preflight: p, provider });
  const directory = freshDirectory(outputPath);
  const save = saver(directory);
  await save("manifest", manifest); await save("preflight", p); await save("gates", gates);
  const manifestHash = objectHash(manifest);
  console.log(`MANIFEST_FROZEN ${manifestHash}; formal primary NOT started`);
  lock("neutral", manifest.freeze.source_fingerprint, { manifest_hash: manifestHash, directory, maximum_generation_calls: 2 });
  const assertGuard = async () => {
    verifyFrozen(manifest);
    check(git("rev-parse", "HEAD") === head, "harness HEAD fixed during readiness");
    check(equal(await probeProvider(), provider), "provider lock stable");
  };
  const o = await observeResponse(await neutralWorld(), { cognition: transport(), language: transport() }, {
    requestId: NEUTRAL.response_request_id, save: (name, value) => save(`conformance/${name}`, value),
    guard: async (stage, actual) => {
      await assertGuard();
      assertNoExperimentContract(actual);
      check(equal(actual.projection, p.neutral_fixture.projection) && equal(actual.retrieval_trace, p.neutral_fixture.retrieval_trace), "exact frozen neutral fixture");
      if (stage === "language") check(actual.language && p.neutral_fixture.language &&
        equal(fixedLanguage(actual.language.input), fixedLanguage(p.neutral_fixture.language.input)), "neutral actual language input from production");
    }
  });
  let guardError = null;
  try { await assertGuard(); } catch (error) { guardError = errorRecord(error); }
  const passed = !guardError && o.validity === "VALID_BEHAVIOR" && o.validated_cognition !== null && o.validated_draft !== null &&
    o.cognition_stage.calls === 1 && o.language_stage.calls === 1 && o.result?.kind === "OUTPUT_READY" && o.result.behavior.text.trim().length > 0;
  const verdict = passed ? "EXPERIMENT_V1_READY" :
    guardError || o.validity === "HOST_CAUSAL_TRACE_FAILURE" ? "BLOCKED_PREFLIGHT" : "EXPERIMENT_V1_BLOCKED_PROVIDER_PROTOCOL";
  await save("readiness", { verdict, manifest_hash: manifestHash, preflight_hash: preflightHash(p), harness_commit: head,
    calls: { cognition: o.cognition_stage.calls, language: o.language_stage.calls, evaluator: 0 },
    validity: o.validity, guard_error: guardError, primary_trials_started: 0, formal_primary_v1_started: false,
    conformance_quality_graded: false, completed_at: new Date().toISOString() });
  writeFileSync(join(directory, "SUMMARY.md"), `# V1 production-behavior readiness\n\n${verdict}\n\nManifest frozen before conformance: ${manifestHash}\nHarness: ${head}\nNeutral generation calls: cognition ${o.cognition_stage.calls}, language ${o.language_stage.calls}; evaluator 0.\nDeterministic A/B and controls: PASS, real calls 0.\nFormal-primary-v1: NOT STARTED (0/16). No output tuning or retries.\nV0 remains INVALID_EXPERIMENT, unchanged.\n`, { flag: "wx" });
  console.log(verdict, directory);
  if (!passed) process.exitCode = 1;
}

/** Deliberate second authorization flag. This task never invokes this operation. */
async function run(manifestPath: string, outputPath: string, authorization: string | undefined,
  executionAmendmentPath?: string, executionIdentity?: string) {
  check(authorization === "--authorize-formal-primary-v1", "future explicit primary authorization required");
  const head = committedBaseline();
  const manifest = readJson(manifestPath) as Manifest;
  const readyDirectory = join(manifestPath, "..");
  const readiness = readJson(join(readyDirectory, "readiness.json")) as { verdict: string; manifest_hash: string };
  check(readiness.verdict === "EXPERIMENT_V1_READY" && readiness.manifest_hash === objectHash(manifest), "committed successful readiness");
  for (const name of ["manifest.json", "readiness.json", "preflight.json", "gates.json"]) {
    const path = relative(ROOT, join(readyDirectory, name)).replaceAll("\\", "/");
    check(path.startsWith(`${EXPERIMENT_PATH}/evidence/`), "committed V1 readiness path");
    check(git("show", `HEAD:${path}`) === readFileSync(join(readyDirectory, name), "utf8").trim(), "exact committed readiness files");
  }
  git("merge-base", "--is-ancestor", manifest.harness_commit, head);

  // ---- execution amendment (explicit, strict, instance-bound) ------------------------
  let amendmentObj: ExecutionAmendmentV0 | undefined;
  if (executionAmendmentPath !== undefined) {
    check(executionIdentity !== undefined, "--execution-identity is required when --execution-amendment is provided");
    const rawAmendment = readJson(resolve(ROOT, executionAmendmentPath));
    const readinessFilesVerify = () => {
      for (const name of ["manifest.json", "readiness.json", "preflight.json", "gates.json"]) {
        const path = relative(ROOT, join(readyDirectory, name)).replaceAll("\\", "/");
        check(git("show", `HEAD:${path}`) === readFileSync(join(readyDirectory, name), "utf8").trim(),
          `readiness file ${name} byte-for-byte verification`);
      }
    };
    const repairScopeVerify = () => {
      const changes = git("diff", "--name-only", manifest.harness_commit, "HEAD").split("\n").filter(Boolean);
      const allowed = (p: string) =>
        p.startsWith(`${EXPERIMENT_PATH}/`) || p === TEST_PATH ||
        p.startsWith("research/experiments/familiarity-causal-behavior-v0/");
      check(changes.length > 0 && changes.every(allowed),
        `repair-scope isolation: all changes from readiness commit within experiment/V0/TEST paths, got: ${changes.join(", ")}`);
    };
    validateExecutionAmendmentV0({
      raw_amendment: rawAmendment,
      manifest_source_fingerprint: manifest.freeze.source_fingerprint,
      manifest_built_fingerprint: manifest.freeze.built_fingerprint,
      manifest_protocol_hash: manifest.freeze.protocol_hash,
      current_source_fingerprint: sourceFingerprint(),
      current_built_fingerprint: builtFingerprint(),
      current_protocol_hash: objectHash(protocol()),
      requested_execution_identity: executionIdentity,
      readiness_files_verify: readinessFilesVerify,
      repair_scope_files_verify: repairScopeVerify
    });
    amendmentObj = rawAmendment as ExecutionAmendmentV0;
  }

  // ---- centralized Phase 1 + Phase 2 freeze verification ------------------------------
  const gates = readJson(join(readyDirectory, "gates.json")) as Gates;
  verifyFreezeBaselineV1({
    readiness_source_fingerprint: manifest.freeze.source_fingerprint,
    readiness_built_fingerprint: manifest.freeze.built_fingerprint,
    readiness_protocol_hash: manifest.freeze.protocol_hash,
    current_source_fingerprint: sourceFingerprint(),
    current_built_fingerprint: builtFingerprint(),
    current_protocol_hash: objectHash(protocol()),
    amendment: amendmentObj,
    gates_source_fingerprint: gates.source_fingerprint,
    gates_built_fingerprint: gates.built_fingerprint
  });
  // Gates structure/commands only (fingerprints verified above).
  verifyGates(gates);
  check(objectHash(gates) === manifest.freeze.gates_hash, "frozen green gates");
  const p = await preflight(); check(preflightHash(p) === manifest.freeze.preflight_hash, "fresh deterministic preflight matches freeze");
  check(equal(await probeProvider(), manifest.freeze.provider_probe), "exact provider artifact");
  const directory = freshDirectory(outputPath);
  check(relative(ROOT, directory).replaceAll("\\", "/").startsWith("tmp/"), "primary runs in exclusive tmp child to keep source clean");
  lock("primary", objectHash(manifest), { directory, source_commit: head });
  const guard = async () => {
    verifyFrozen(manifest, amendmentObj); check(git("status", "--porcelain") === "" && git("rev-parse", "HEAD") === head, "clean fixed source during primary");
    check(equal(await probeProvider(), manifest.freeze.provider_probe), "exact provider per-stage lock");
  };
  const result = await executePrimary({ preflight: p, cognition: transport(), language: transport(), evaluator: transport(),
    guard, save: saver(directory), sourceCommit: head });
  console.log(result.interpretation, directory);
}
const [operation, first, second, authorization] = process.argv.slice(2);
check(first && second, "usage: cli.ts prepare <green-gates.json> <new-v1-readiness-dir> OR run <committed-manifest.json> <new-tmp-output> --authorize-formal-primary-v1 [--execution-identity <id> --execution-amendment <path>]");
if (operation === "prepare") await prepare(first, second);
else if (operation === "run") {
  const flagArgs = process.argv.slice(2);
  let executionAmendmentPath: string | undefined;
  let executionIdentity: string | undefined;
  for (let i = 0; i < flagArgs.length; i++) {
    if (flagArgs[i] === "--execution-amendment" && i + 1 < flagArgs.length) { executionAmendmentPath = flagArgs[i + 1]; i++; }
    else if (flagArgs[i] === "--execution-identity" && i + 1 < flagArgs.length) { executionIdentity = flagArgs[i + 1]; i++; }
  }
  check(executionAmendmentPath === undefined || executionIdentity !== undefined,
    "--execution-identity is required when --execution-amendment is provided");
  await run(first, second, authorization, executionAmendmentPath, executionIdentity);
}
else throw new Error("Unknown operation; no model calls made");
