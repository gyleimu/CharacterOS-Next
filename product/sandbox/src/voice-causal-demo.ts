/**
 * CHARACTEROS_VOICE_CAUSAL_DEMO_V0 — the experiment that decides whether Voice
 * is really a CharacterOS behaviour channel or just a TTS hookup.
 *
 * ONE sentence, FOUR lawful CharacterOS states, and the ONLY thing that varies
 * between them is canonical affect:
 *
 *   A  valence -0.6  activation 0.1   low valence, low activation
 *   B  valence -0.6  activation 0.9   low valence, high activation
 *   C  valence +0.6  activation 0.1   high valence, low activation
 *   D  valence +0.6  activation 0.9   high valence, high activation
 *
 * Regulation is held at the subject's real genesis values (energy 1, stress 0,
 * arousal 0.5, fatigue 0) so these are states a subject can actually be in
 * rather than invented numbers.
 *
 * The chain under test is
 *
 *   state -> SpeechExpressionProjection -> SpeechExpressionV0
 *         -> CosyVoice delivery directive -> audio
 *
 * and it is deliberately NOT "state -> emotion label -> voice": no variant
 * selects an emotion word.
 *
 * WHY EVERY VARIANT IS REPEATED. Neural TTS is not deterministic: repeating one
 * fixture already moves the output duration by hundreds of milliseconds. A
 * single sample per fixture would therefore "prove" any difference at all, so
 * each fixture is generated several times, the median is reported, and every
 * cross-fixture claim is checked against the within-fixture spread. Comparisons
 * that do not clear that floor are reported as NOT DISTINGUISHED rather than
 * quietly counted as evidence.
 *
 * Audio is written to the artifacts directory and is NOT committed; the JSON
 * record next to it is the reproducible evidence.
 *
 * Usage:  node dist/voice-causal-demo.js [outputDir] [runsPerFixture]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  CosyVoiceTtsAdapterV0,
  DEFAULT_VOICE_RUNTIME_CONFIG_V0,
  VoiceRuntimeClientV0,
  buildCosyVoiceInstructionV0,
  projectSpeechExpressionV0,
  speechExpressionFingerprintV0,
  type SpeechExpressionInputsV0,
  type SpeechExpressionV0
} from "@characteros-next/voice";

/**
 * Regulation at subject genesis, read from `createInteractiveSubjectSeedV0`
 * rather than assumed. Held constant so the only moving part is affect.
 */
const GENESIS_REGULATION = {
  energy: 1,
  stress: 0,
  arousal: 0.5,
  fatigue: 0
} as const;

const SENTENCE = "我没事。";
const VOICE_ID = "characteros-default";

interface FixtureV0 {
  readonly id: "A" | "B" | "C" | "D";
  readonly label: string;
  readonly valence: number;
  readonly activation: number;
}

const FIXTURES: readonly FixtureV0[] = [
  { id: "A", label: "low valence, low activation", valence: -0.6, activation: 0.1 },
  { id: "B", label: "low valence, high activation", valence: -0.6, activation: 0.9 },
  { id: "C", label: "high valence, low activation", valence: 0.6, activation: 0.1 },
  { id: "D", label: "high valence, high activation", valence: 0.6, activation: 0.9 }
];

interface AcousticFeaturesV0 {
  readonly audio_ms: number;
  readonly rms: number;
  readonly peak: number;
}

function measureFloat32Pcm(base64: string): AcousticFeaturesV0 {
  const bytes = Buffer.from(base64, "base64");
  const usable = bytes.byteLength - (bytes.byteLength % 4);
  const samples = new Float32Array(bytes.buffer, bytes.byteOffset, usable / 4);
  let sumSquares = 0;
  let peak = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
    const magnitude = Math.abs(sample);
    if (magnitude > peak) peak = magnitude;
  }
  return {
    audio_ms: Math.round((samples.length / 24000) * 1000),
    rms: Number(Math.sqrt(sumSquares / Math.max(1, samples.length)).toFixed(6)),
    peak: Number(peak.toFixed(6))
  };
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[mid] ?? Number.NaN;
  return (((ordered[mid - 1] ?? 0) + (ordered[mid] ?? 0)) / 2);
}

const round1 = (value: number): number => Number(value.toFixed(1));
const round6 = (value: number): number => Number(value.toFixed(6));

async function main(): Promise<number> {
  const outputDir = process.argv[2] ?? join(process.cwd(), "artifacts", "voice-causal-demo");
  const runsPerFixture = Number(process.argv[3] ?? process.env["VOICE_CAUSAL_RUNS"] ?? 3);
  mkdirSync(outputDir, { recursive: true });

  const baseUrl = process.env["CHARACTEROS_VOICE_RUNTIME_URL"] ?? DEFAULT_VOICE_RUNTIME_CONFIG_V0.base_url;
  const client = new VoiceRuntimeClientV0({ ...DEFAULT_VOICE_RUNTIME_CONFIG_V0, base_url: baseUrl });
  const tts = new CosyVoiceTtsAdapterV0({ client });

  // A null health means the service is not reachable at all; the demo cannot
  // produce evidence from a runtime that is not running.
  const health = await client.health().catch(() => null);
  if (health === null) {
    console.error(`voice runtime is not reachable at ${baseUrl}`);
    console.error("start it first: see docs/voice/README.md");
    return 1;
  }

  interface FixtureRecordV0 {
    fixture: string;
    label: string;
    state: SpeechExpressionInputsV0;
    expression: SpeechExpressionV0;
    expression_fingerprint: string;
    instruct: string;
    runs: AcousticFeaturesV0[];
    median: AcousticFeaturesV0;
    spread: { audio_ms: number; rms: number };
  }

  const records: FixtureRecordV0[] = [];

  for (const fixture of FIXTURES) {
    const inputs: SpeechExpressionInputsV0 = {
      valence: fixture.valence,
      activation: fixture.activation,
      ...GENESIS_REGULATION,
      familiarity: null
    };
    const expression = projectSpeechExpressionV0(inputs, { state_revision: null });
    const instruct = buildCosyVoiceInstructionV0(expression);
    const runs: AcousticFeaturesV0[] = [];

    for (let run = 0; run < runsPerFixture; run += 1) {
      const result = await tts.synthesize(
        {
          schema_version: "speech-output-request-v0",
          request_ref: `causal-demo:${fixture.id}:${run}`,
          text: SENTENCE,
          language: "zh",
          voice_id: VOICE_ID,
          expression,
          streaming: false
        },
        {
          save_path: join(outputDir, runsPerFixture === 1 ? `${fixture.id}.wav` : `${fixture.id}-${run}.wav`),
          return_audio: true
        }
      );
      if (result.audio === null) continue;
      const features = measureFloat32Pcm(Buffer.from(result.audio).toString("base64"));
      runs.push(features);
      console.log(
        `  [${fixture.id}] run ${run}: audio_ms=${features.audio_ms} rms=${features.rms} peak=${features.peak}`
      );
    }

    const audioMs = runs.map((run) => run.audio_ms);
    const rmsValues = runs.map((run) => run.rms);
    const record: FixtureRecordV0 = {
      fixture: fixture.id,
      label: fixture.label,
      state: inputs,
      expression,
      expression_fingerprint: speechExpressionFingerprintV0(expression),
      instruct,
      runs,
      median: {
        audio_ms: round1(median(audioMs)),
        rms: round6(median(rmsValues)),
        peak: round6(median(runs.map((run) => run.peak)))
      },
      spread: {
        audio_ms: round1(Math.max(...audioMs) - Math.min(...audioMs)),
        rms: round6(Math.max(...rmsValues) - Math.min(...rmsValues))
      }
    };
    records.push(record);
    console.log(
      `[${fixture.id}] ${fixture.label}\n` +
        `     expression: rate=${expression.speaking_rate} volume=${expression.volume} ` +
        `warmth=${expression.warmth} intensity=${expression.intensity} pause=${expression.pause_bias}\n` +
        `     instruct  : ${instruct}\n` +
        `     audio     : median ${record.median.audio_ms}ms rms=${record.median.rms} ` +
        `(within-fixture spread ${record.spread.audio_ms}ms / ${record.spread.rms})`
    );
  }

  const byId = new Map(records.map((record) => [record.fixture, record]));
  const comparisons = [
    { pair: "A→B", note: "same valence, activation up", from: "A", to: "B" },
    { pair: "C→D", note: "same valence, activation up", from: "C", to: "D" },
    { pair: "A→C", note: "same activation, valence up", from: "A", to: "C" },
    { pair: "B→D", note: "same activation, valence up", from: "B", to: "D" }
  ].map(({ pair, note, from, to }) => {
    const a = byId.get(from);
    const b = byId.get(to);
    if (a === undefined || b === undefined) {
      return { pair, note, distinguished: false, detail: "missing fixture" };
    }
    const deltaAudio = round1(b.median.audio_ms - a.median.audio_ms);
    const deltaRms = round6(b.median.rms - a.median.rms);
    const noiseFloorAudio = Math.max(a.spread.audio_ms, b.spread.audio_ms);
    const noiseFloorRms = Math.max(a.spread.rms, b.spread.rms);
    const sameInstruct = a.instruct === b.instruct;
    const distinguished = Math.abs(deltaAudio) > noiseFloorAudio || Math.abs(deltaRms) > noiseFloorRms;
    return {
      pair,
      note,
      identical_instruct: sameInstruct,
      delta_audio_ms: deltaAudio,
      delta_rms: deltaRms,
      noise_floor_audio_ms: round1(noiseFloorAudio),
      noise_floor_rms: round6(noiseFloorRms),
      distinguished,
      detail: distinguished
        ? "audio differs beyond the within-fixture spread"
        : "audio difference does NOT clear the within-fixture spread (neural TTS run-to-run variation)"
    };
  });

  const distinctExpressions = new Set(records.map((record) => record.expression_fingerprint)).size;
  const record = {
    schema_version: "voice-causal-demo-v0",
    sentence: SENTENCE,
    voice_id: VOICE_ID,
    runs_per_fixture: runsPerFixture,
    runtime: { base_url: baseUrl, health },
    regulation_held_at_genesis: GENESIS_REGULATION,
    note:
      "Regulation is held at the subject's real genesis values so the only varying input is " +
      "canonical affect. No variant selects an emotion word: the delivery directive is built " +
      "from continuous tempo/loudness parameters. Neural TTS is not deterministic, so each " +
      "fixture is repeated and every cross-fixture claim is checked against the within-fixture spread.",
    distinct_expressions: distinctExpressions,
    fixtures: records,
    comparisons
  };
  const recordPath = join(outputDir, "expression.json");
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  console.log(`\ndistinct expressions: ${distinctExpressions}/${FIXTURES.length}`);
  console.log("comparisons:");
  for (const comparison of comparisons) {
    console.log(
      `  ${comparison.pair} (${comparison.note}): ${comparison.distinguished ? "DISTINGUISHED" : "NOT DISTINGUISHED"}` +
        ` d_audio=${comparison.delta_audio_ms}ms noise=${comparison.noise_floor_audio_ms}ms` +
        `${comparison.identical_instruct ? " [identical directive]" : ""}`
    );
  }
  console.log(`record: ${recordPath}`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
