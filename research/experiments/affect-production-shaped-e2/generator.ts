/**
 * PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — deterministic corpus generator.
 *
 * §11-§27: hash-counter generator (stateless, call-order independent, no PRNG,
 * no wall clock), amplitude classes/mixtures, goal mixtures with balanced
 * pairs, hash-based tick selection, and the eight families D1-D8. §34 history
 * pairs. §30-§33 case fixtures. Every generated event is validated against the
 * REAL production canonical Appraisal proposal validator (§9/§19 — no
 * validator bypass), and a complete synthetic canonical record fixture is
 * provable per family (§19).
 *
 * PRODUCTION-SHAPED DISCIPLINE (§10): this corpus is an engineering coverage
 * distribution, NOT an observed/calibrated/representative/provider-estimated
 * production distribution.
 */

/* eslint-disable no-restricted-imports -- Isolated research experiment host over frozen built roots (v1/E1 convention). */
import { createHash } from "node:crypto";
import { validateExperienceAppraisalProposalV0 } from "../../../packages/appraisal/dist/index.js";
import {
  AMPLITUDE_CLASSES, ATTRIBUTIONS, C1_EVENT, C2_EVENT, C3_COMMON, C3_GOALS,
  C4C5_COMMON, C4_FIELDS, C5_FIELDS, D1_AMPLITUDE_MIX, D2_GOAL_CYCLE,
  D6_AMPLITUDE_MIX, D6_GOAL_CYCLE, FAMILY_SEEDS, FAMILIES, GENERATOR_DOMAIN,
  HISTORY_PAIRS, ORDINARY_AMPLITUDE_MIX, SHARED_Q_PAIRS,
  type AmplitudeMix, type AppraisalEventE2, type E2Attribution, type FamilySpecE2
} from "./contract.ts";
import { check, sha256 } from "./fixtures.ts";

// ----------------------------------------------------------------------------------
// §11 hash-counter generator
// ----------------------------------------------------------------------------------

/** U(F,S,K) = int(first_13_hex(SHA256(UTF8(domain + F + '|' + S + '|' + K)))) / 2^52 ∈ [0,1). */
export function U(f: string, s: string, k: string): number {
  const digest = createHash("sha256").update(GENERATOR_DOMAIN + f + "|" + s + "|" + k, "utf8").digest("hex");
  const first13 = BigInt("0x" + digest.slice(0, 13));
  return Number(first13) / 2 ** 52;
}

/** §12 Uniform[a,b) = a + (b-a) * U(F,S,K). */
export function uniform(f: string, s: string, k: string, a: number, b: number): number {
  return a + (b - a) * U(f, s, k);
}

/** §12 TriMid[a,b) = a + (b-a)(U1+U2)/2 with explicit stable sub-keys. */
export function triMid(f: string, s: string, k: string, a: number, b: number): number {
  const u1 = U(f, s, k + "|tri:1");
  const u2 = U(f, s, k + "|tri:2");
  return a + (b - a) * ((u1 + u2) / 2);
}

// ----------------------------------------------------------------------------------
// §13 tick selection
// ----------------------------------------------------------------------------------

/** All ticks [0, T) minus the quiet-window tick sets. */
export function eligibleTicks(T: number, quiet: readonly { start: number; end: number }[]): number[] {
  const excluded = new Set<number>();
  for (const w of quiet) {
    for (let t = w.start; t <= Math.min(w.end, T - 1); t++) excluded.add(t);
  }
  const ticks: number[] = [];
  for (let t = 0; t < T; t++) {
    if (!excluded.has(t)) ticks.push(t);
  }
  return ticks;
}

/** §13: score_t = U(F,S,"slot:"+t); sort by (score, tick); take first K; ≤ 1 event/tick. */
export function selectTicks(f: string, s: string, eligible: readonly number[], k: number): number[] {
  check(k <= eligible.length, `tick selection: requested ${k} > ${eligible.length} eligible`);
  const scored = eligible.map((t) => ({ t, score: U(f, s, "slot:" + t) }));
  scored.sort((x, y) => (x.score - y.score) || (x.t - y.t));
  return scored.slice(0, k).map((x) => x.t);
}

// ----------------------------------------------------------------------------------
// §14/§15/§16/§17 field draws
// ----------------------------------------------------------------------------------

/** Amplitude class from a mixture via one deterministic hash draw (fixed class order). */
export function drawAmplitudeClass(f: string, s: string, k: string, mix: AmplitudeMix) {
  const u = U(f, s, k);
  let cum = 0;
  let fallback = AMPLITUDE_CLASSES[0];
  check(fallback !== undefined, "amplitude class table");
  for (const cls of AMPLITUDE_CLASSES) {
    if (mix[cls.id] > 0) fallback = cls;
    cum += mix[cls.id];
    if (u < cum) return cls;
  }
  // FP edge only: u < 1 but the cumulative sum rounded below u.
  return fallback;
}

function drawAmplitudePair(f: string, s: string, k: string, mix: AmplitudeMix): { relevance: number; intensity: number } {
  const cls = drawAmplitudeClass(f, s, k, mix);
  const loR = cls.relevance[0];
  const hiR = cls.relevance[1];
  const loI = cls.intensity[0];
  const hiI = cls.intensity[1];
  check(loR !== undefined && hiR !== undefined && loI !== undefined && hiI !== undefined, "amplitude class ranges");
  return {
    relevance: uniform(f, s, k + ":rel", loR, hiR),
    intensity: uniform(f, s, k + ":int", loI, hiI)
  };
}

function drawAttribution(f: string, s: string, k: string): E2Attribution {
  const u = U(f, s, k);
  const index = Math.min(2, Math.floor(u * 3));
  const attr = ATTRIBUTIONS[index];
  check(attr !== undefined, "attribution draw");
  return attr;
}

/** §16 ordinary goal-delta draw (bucket + uniform within bucket). */
export function drawDelta(f: string, s: string, k: string): number {
  const u = U(f, s, k + ":bucket");
  const range: readonly [number, number] = u < 0.5 ? [0, 0.1] : u < 0.9 ? [0.1, 0.35] : [0.35, 0.5];
  return uniform(f, s, k + ":delta", range[0], range[1]);
}

function drawConfidence(f: string, s: string, k: string): number {
  const u = U(f, s, k + ":confbucket");
  return u < 0.9 ? triMid(f, s, k + ":conf", 0.5, 1.0) : uniform(f, s, k + ":conf", 0, 0.5);
}

function auxiliaryFields(f: string, s: string, k: string): {
  attribution: E2Attribution; controllability: number; uncertainty: number; assessment_confidence: number;
} {
  return {
    attribution: drawAttribution(f, s, k + ":attr"),
    controllability: triMid(f, s, k + ":ctrl", 0, 1),
    uncertainty: triMid(f, s, k + ":unc", 0, 1),
    assessment_confidence: drawConfidence(f, s, k)
  };
}


function sharedPairDraw(f: string, s: string, k: string, cache: Map<string, { relevance: number; intensity: number }>, pairIndex: number, mix: AmplitudeMix): { relevance: number; intensity: number } {
  const key = String(pairIndex);
  const existing = cache.get(key);
  if (existing !== undefined) return existing;
  const drawn = drawAmplitudePair(f, s, k, mix);
  cache.set(key, drawn);
  return drawn;
}

function event(family: string, seed: string, index: number, tick: number, relevance: number, goal: number, intensity: number, aux: {
  attribution: E2Attribution; controllability: number; uncertainty: number; assessment_confidence: number;
}): AppraisalEventE2 {
  return {
    tick, event_id: `${family}#${seed}#${index}`,
    relevance, goal_congruence: goal, intensity,
    attribution: aux.attribution, controllability: aux.controllability,
    uncertainty: aux.uncertainty, assessment_confidence: aux.assessment_confidence
  };
}

/** §16/§17 machine check: |sum(q_i * (2g_i - 1))| <= 1e-12 for balanced distributions. */
export function weightedSignedSum(events: readonly AppraisalEventE2[]): number {
  let sum = 0;
  for (const e of events) {
    const q = e.relevance * e.intensity;
    sum += q * (2 * e.goal_congruence - 1);
  }
  return sum;
}

// ----------------------------------------------------------------------------------
// Family corpus builders
// ----------------------------------------------------------------------------------

export interface FamilyCorpusE2 {
  readonly family: string;
  readonly seed: string;
  readonly T: number;
  readonly quiet: readonly { start: number; end: number }[];
  readonly events: readonly AppraisalEventE2[];
  readonly balanced_weighted_signed_sum: number;
}

/** Builds one family lifetime (§20-§27). Deterministic in (family, seed).
 * D5 mirrors D4 exactly (§24): same seed/timing/q, goal_D5 = 1 - goal_D4. */
export function buildFamilyCorpus(family: FamilySpecE2, seed: string): FamilyCorpusE2 {
  const f = family.id;
  if (f === "D5") {
    const d4Spec = FAMILIES.find((x) => x.id === "D4");
    check(d4Spec !== undefined, "D4 family spec");
    const d4 = buildFamilyCorpus(d4Spec, seed);
    const mirrored = d4.events.map((e) => ({
      ...e, event_id: e.event_id.replace(/^D4#/, "D5#"), goal_congruence: 1 - e.goal_congruence
    }));
    return { family: f, seed, T: family.T, quiet: family.quiet, events: mirrored, balanced_weighted_signed_sum: weightedSignedSum(mirrored) };
  }
  const s = seed;
  const events: AppraisalEventE2[] = [];
  const evenBurstStore = new Map<string, { relevance: number; intensity: number; goal: number }>();
  const aux = (i: number) => auxiliaryFields(f, s, "e" + i);

  if (f === "D1" || f === "D3" || f === "D7") {
    // Hash-selected ticks; paired balanced goals; family amplitude mixture.
    const mix = f === "D1" ? D1_AMPLITUDE_MIX : f === "D7" ? { LOW: 0.4, MID: 0.45, STRONG: 0.14, EDGE: 0.01 } : ORDINARY_AMPLITUDE_MIX;
    const eligible = eligibleTicks(family.T, family.quiet);
    const ticks = selectTicks(f, s, eligible, family.event_count);
    const pairs = family.event_count / 2;
    let idx = 0;
    for (let p = 0; p < pairs; p++) {
      const amp = drawAmplitudePair(f, s, "pair" + p, mix);
      const delta = drawDelta(f, s, "pair" + p);
      const flip = U(f, s, "pair" + p + ":order") < 0.5;
      const tickA = ticks[2 * p];
      const tickB = ticks[2 * p + 1];
      check(tickA !== undefined && tickB !== undefined, `${f}/${s}: pair ticks`);
      const gA = 0.5 - delta;
      const gB = 0.5 + delta;
      events.push(event(f, s, idx, tickA as number, amp.relevance, flip ? gB : gA, amp.intensity, aux(idx)));
      idx += 1;
      events.push(event(f, s, idx, tickB as number, amp.relevance, flip ? gA : gB, amp.intensity, aux(idx)));
      idx += 1;
    }
  } else if (f === "D2") {
    // 1080 LOW events, fixed 8-goal cycle, complementary entries share q.
    const eligible = eligibleTicks(family.T, family.quiet);
    const ticks = selectTicks(f, s, eligible, family.event_count);
    const d2PairCache = new Map<string, { relevance: number; intensity: number }>();
    for (let i = 0; i < family.event_count; i++) {
      const tick = ticks[i];
      check(tick !== undefined, `D2/${s}: tick ${i}`);
      const position = i % 8;
      const goal = D2_GOAL_CYCLE[position];
      check(goal !== undefined, `D2/${s}: cycle goal ${position}`);
      let relevance: number;
      let intensity: number;
      const sharedPair = SHARED_Q_PAIRS.find(([a, b]) => a === position || b === position);
      if (sharedPair !== undefined) {
        const pairIndex = Math.floor(i / 8) * 3 + SHARED_Q_PAIRS.indexOf(sharedPair);
        const amp = sharedPairDraw(f, s, "cpair" + pairIndex, d2PairCache, pairIndex, { LOW: 1, MID: 0, STRONG: 0, EDGE: 0 });
        relevance = amp.relevance;
        intensity = amp.intensity;
      } else {
        const amp = drawAmplitudePair(f, s, "e" + i, { LOW: 1, MID: 0, STRONG: 0, EDGE: 0 });
        relevance = amp.relevance;
        intensity = amp.intensity;
      }
      events.push(event(f, s, i, tick as number, relevance, goal as number, intensity, aux(i)));
    }
  } else if (f === "D6") {
    // Fixed times 0,18,...,10566; 7-goal cycle x 84; LOW .70 / MID .30.
    const d6PairCache = new Map<string, { relevance: number; intensity: number }>();
    for (let i = 0; i < family.event_count; i++) {
      const tick = 18 * i;
      const position = i % 7;
      const goal = D6_GOAL_CYCLE[position];
      check(goal !== undefined, `D6/${s}: cycle goal ${position}`);
      let relevance: number;
      let intensity: number;
      const sharedPair = SHARED_Q_PAIRS.find(([a, b]) => a === position || b === position);
      if (sharedPair !== undefined) {
        const pairIndex = Math.floor(i / 7) * 3 + SHARED_Q_PAIRS.indexOf(sharedPair);
        const amp = sharedPairDraw(f, s, "cpair" + pairIndex, d6PairCache, pairIndex, D6_AMPLITUDE_MIX);
        relevance = amp.relevance;
        intensity = amp.intensity;
      } else {
        const amp = drawAmplitudePair(f, s, "e" + i, D6_AMPLITUDE_MIX);
        relevance = amp.relevance;
        intensity = amp.intensity;
      }
      events.push(event(f, s, i, tick, relevance, goal as number, intensity, aux(i)));
    }
  } else if (f === "D4") {
    // Background: 10 D1-like events in [0,1000); burst: 50 events every 2 ticks from 1000.
    // (D5 never generates here — it is derived from D4 below with mirrored goals.)
    const backgroundTicks = selectTicks(f, s, eligibleTicks(1000, []), 10);
    let idx = 0;
    for (let p = 0; p < 5; p++) {
      const amp = drawAmplitudePair(f, s, "bpair" + p, D1_AMPLITUDE_MIX);
      const delta = drawDelta(f, s, "bpair" + p);
      const flip = U(f, s, "bpair" + p + ":order") < 0.5;
      const tickA = backgroundTicks[2 * p];
      const tickB = backgroundTicks[2 * p + 1];
      check(tickA !== undefined && tickB !== undefined, `D4/${s}: background pair ticks`);
      events.push(event(f, s, idx, tickA as number, amp.relevance, flip ? 0.5 + delta : 0.5 - delta, amp.intensity, aux(idx)));
      idx += 1;
      events.push(event(f, s, idx, tickB as number, amp.relevance, flip ? 0.5 - delta : 0.5 + delta, amp.intensity, aux(idx)));
      idx += 1;
    }
    for (let k = 0; k < 50; k++) {
      const tick = 1000 + 2 * k;
      const relevance = uniform(f, s, "burst:" + k + ":rel", 0.75, 1);
      const intensity = uniform(f, s, "burst:" + k + ":int", 0.75, 1);
      const goal = uniform(f, s, "burst:" + k + ":goal", 0, 0.2);
      events.push(event(f, s, idx, tick, relevance, goal, intensity, aux(idx)));
      idx += 1;
    }
  } else if (f === "D8") {
    // 10 cycles; per cycle 4 D1-like + 80 D3-like + 100 D2-like + 50 burst + 18 D1-like.
    let idx = 0;
    for (let ci = 0; ci < 10; ci++) {
      const c = ci * 10000;
      const cycleIsEven = ci % 2 === 0;

      // Segment 1: 4 D1-like events in [c, c+2000).
      {
        const ticks = selectTicks(f, s, eligibleRange(c, 2000), 4);
        for (let p = 0; p < 2; p++) {
          const amp = drawAmplitudePair(f, s, `c${ci}:s1pair${p}`, D1_AMPLITUDE_MIX);
          const delta = drawDelta(f, s, `c${ci}:s1pair${p}`);
          const flip = U(f, s, `c${ci}:s1pair${p}:order`) < 0.5;
          const tickA = ticks[2 * p];
          const tickB = ticks[2 * p + 1];
          check(tickA !== undefined && tickB !== undefined, `D8/${s}: s1 pair ${p}`);
          events.push(event(f, s, idx, tickA as number, amp.relevance, flip ? 0.5 + delta : 0.5 - delta, amp.intensity, aux(idx)));
          idx += 1;
          events.push(event(f, s, idx, tickB as number, amp.relevance, flip ? 0.5 - delta : 0.5 + delta, amp.intensity, aux(idx)));
          idx += 1;
        }
      }
      // Segment 2: 80 D3-like events in [c+2000, c+6000).
      {
        const ticks = selectTicks(f, s, eligibleRange(c + 2000, 4000), 80);
        for (let p = 0; p < 40; p++) {
          const amp = drawAmplitudePair(f, s, `c${ci}:s2pair${p}`, ORDINARY_AMPLITUDE_MIX);
          const delta = drawDelta(f, s, `c${ci}:s2pair${p}`);
          const flip = U(f, s, `c${ci}:s2pair${p}:order`) < 0.5;
          const tickA = ticks[2 * p];
          const tickB = ticks[2 * p + 1];
          check(tickA !== undefined && tickB !== undefined, `D8/${s}: s2 pair ${p}`);
          events.push(event(f, s, idx, tickA as number, amp.relevance, flip ? 0.5 + delta : 0.5 - delta, amp.intensity, aux(idx)));
          idx += 1;
          events.push(event(f, s, idx, tickB as number, amp.relevance, flip ? 0.5 - delta : 0.5 + delta, amp.intensity, aux(idx)));
          idx += 1;
        }
      }
      // Segment 3: 100 D2-like events in [c+6000, c+7000).
      {
        const ticks = selectTicks(f, s, eligibleRange(c + 6000, 1000), 100);
        const d8PairCache = new Map<string, { relevance: number; intensity: number }>();
        for (let i = 0; i < 100; i++) {
          const tick = ticks[i];
          check(tick !== undefined, `D8/${s}: s3 tick ${i}`);
          const position = i % 8;
          const goal = D2_GOAL_CYCLE[position];
          check(goal !== undefined, `D8/${s}: s3 goal ${position}`);
          let relevance: number;
          let intensity: number;
          const sharedPair = SHARED_Q_PAIRS.find(([a, b]) => a === position || b === position);
          if (sharedPair !== undefined) {
            const pairIndex = Math.floor(i / 8) * 3 + SHARED_Q_PAIRS.indexOf(sharedPair);
            const amp = sharedPairDraw(f, s, `c${ci}:s3cpair${pairIndex}`, d8PairCache, pairIndex, { LOW: 1, MID: 0, STRONG: 0, EDGE: 0 });
            relevance = amp.relevance;
            intensity = amp.intensity;
          } else {
            const amp = drawAmplitudePair(f, s, `c${ci}:s3e${i}`, { LOW: 1, MID: 0, STRONG: 0, EDGE: 0 });
            relevance = amp.relevance;
            intensity = amp.intensity;
          }
          events.push(event(f, s, idx, tick as number, relevance, goal as number, intensity, aux(idx)));
          idx += 1;
        }
      }
      // Segment 4: 50 burst events every 2 ticks in [c+7000, c+7100).
      for (let k = 0; k < 50; k++) {
        const tick = c + 7000 + 2 * k;
        let relevance: number;
        let intensity: number;
        let goal: number;
        if (cycleIsEven) {
          relevance = uniform(f, s, `c${ci}:burst:${k}:rel`, 0.75, 1);
          intensity = uniform(f, s, `c${ci}:burst:${k}:int`, 0.75, 1);
          goal = uniform(f, s, `c${ci}:burst:${k}:goal`, 0, 0.2);
          evenBurstStore.set(`c${ci}:${k}`, { relevance, intensity, goal });
        } else {
          // §27: following odd cycle has the SAME q and mirrored goal.
          const even = evenBurstStore.get(`c${ci - 1}:${k}`);
          check(even !== undefined, `D8/${s}: mirrored burst slot c${ci - 1}:${k}`);
          relevance = even.relevance;
          intensity = even.intensity;
          goal = 1 - even.goal;
        }
        events.push(event(f, s, idx, tick, relevance, goal, intensity, aux(idx)));
        idx += 1;
      }
      // Segment 5: 18 D1-like events in [c+7100, c+8800).
      {
        const ticks = selectTicks(f, s, eligibleRange(c + 7100, 1700), 18);
        for (let p = 0; p < 9; p++) {
          const amp = drawAmplitudePair(f, s, `c${ci}:s5pair${p}`, D1_AMPLITUDE_MIX);
          const delta = drawDelta(f, s, `c${ci}:s5pair${p}`);
          const flip = U(f, s, `c${ci}:s5pair${p}:order`) < 0.5;
          const tickA = ticks[2 * p];
          const tickB = ticks[2 * p + 1];
          check(tickA !== undefined && tickB !== undefined, `D8/${s}: s5 pair ${p}`);
          events.push(event(f, s, idx, tickA as number, amp.relevance, flip ? 0.5 + delta : 0.5 - delta, amp.intensity, aux(idx)));
          idx += 1;
          events.push(event(f, s, idx, tickB as number, amp.relevance, flip ? 0.5 - delta : 0.5 + delta, amp.intensity, aux(idx)));
          idx += 1;
        }
      }
    }
  } else {
    check(false, `unknown family ${f}`);
  }

  // §13: at most one event per tick; strictly ascending times.
  const sorted = [...events].sort((a, b) => a.tick - b.tick);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    check(prev !== undefined && cur !== undefined && cur.tick > prev.tick, `${f}/${s}: duplicate or non-ascending event tick`);
  }
  check(events.length === family.event_count, `${f}/${s}: event count ${events.length} != ${family.event_count}`);
  return {
    family: f, seed, T: family.T, quiet: family.quiet, events: sorted,
    balanced_weighted_signed_sum: weightedSignedSum(sorted)
  };
}

function eligibleRange(start: number, length: number): number[] {
  const ticks: number[] = [];
  for (let t = start; t < start + length; t++) ticks.push(t);
  return ticks;
}

// ----------------------------------------------------------------------------------
// §19 canonical-envelope representability
// ----------------------------------------------------------------------------------

const E2_SUBJECT = "subject-e2";

/** Canonical proposal-shaped fixture for one synthetic event (validator-proven). */
export function proposalFixtureOf(e: AppraisalEventE2): Record<string, unknown> {
  const experienceRef = "experience:" + sha256("e2-experience|" + e.event_id).slice(0, 40);
  return {
    schema_version: "experience-appraisal-proposal-v0",
    status: "APPRAISED",
    subject_id: E2_SUBJECT,
    experience_ref: experienceRef,
    context_projection_hash: "sha256:" + sha256("e2-context|" + e.event_id),
    dimensions: {
      relevance: e.relevance,
      goal_congruence: e.goal_congruence,
      attribution: e.attribution,
      controllability: e.controllability,
      uncertainty: e.uncertainty,
      intensity: e.intensity
    },
    assessment_confidence: e.assessment_confidence,
    evidence_refs: [experienceRef]
  };
}

/** Complete synthetic canonical record fixture (§19) — validator-proven in tests. */
export function recordFixtureOf(e: AppraisalEventE2): Record<string, unknown> {
  const hex = (salt: string): string => "sha256:" + sha256(salt + "|" + e.event_id);
  const experienceRef = "experience:" + sha256("e2-experience|" + e.event_id).slice(0, 40);
  return {
    schema_version: "experience-appraisal-record-v0",
    appraisal_kind: "INITIAL",
    appraisal_ref: "appraisal:" + sha256("e2-appraisal|" + e.event_id).slice(0, 40),
    subject_id: E2_SUBJECT,
    experience_ref: experienceRef,
    experience_payload_hash: hex("exp"),
    grounding: {
      source_episode_ref: "episode:" + sha256("e2-episode|" + e.event_id).slice(0, 40),
      source_episode_payload_hash: hex("ep"),
      source_event_ref: "event:" + sha256("e2-event|" + e.event_id).slice(0, 40),
      source_event_payload_hash: hex("ev"),
      outcome_ref: "outcome:" + sha256("e2-outcome|" + e.event_id).slice(0, 40),
      behavior_delivery_id: "dlv-" + sha256("e2-dlv|" + e.event_id).slice(0, 16),
      behavior_payload_hash: hex("bh")
    },
    evaluated_at_logical_time: e.tick,
    source_state: { state_revision: 0, state_hash: hex("st"), repository_revision: "R0" },
    subject_context: { schema_version: "experience-appraisal-subject-context-v0", current_task: "e2-synthetic" },
    context_projection_hash: "sha256:" + sha256("e2-context|" + e.event_id),
    dimensions: {
      relevance: e.relevance,
      goal_congruence: e.goal_congruence,
      attribution: e.attribution,
      controllability: e.controllability,
      uncertainty: e.uncertainty,
      intensity: e.intensity
    },
    assessment_confidence: e.assessment_confidence,
    evidence_refs: [experienceRef].sort(),
    provenance: {
      provider_id: "e2-synthetic",
      provider_contract_version: "experience-appraisal-provider-v0",
      proposal_hash: hex("prop"),
      transition_id: "t-e2-" + sha256("e2-transition|" + e.event_id).slice(0, 24)
    }
  };
}

/** §19: every generated event must pass the REAL production proposal validator. */
export function validateCorpusEvents(corpus: readonly FamilyCorpusE2[]): void {
  for (const life of corpus) {
    for (const e of life.events) {
      const checked = validateExperienceAppraisalProposalV0(proposalFixtureOf(e));
      check(checked.ok, `corpus event ${e.event_id} rejected by the canonical proposal validator: ${checked.ok ? "" : checked.error.detail}`);
    }
  }
}

// ----------------------------------------------------------------------------------
// §30-§33 case fixtures + §34 history pairs
// ----------------------------------------------------------------------------------

export interface CaseRunE2 {
  readonly id: string;
  readonly T: number;
  readonly events: readonly AppraisalEventE2[];
}

export function buildCases(): readonly CaseRunE2[] {
  const mk = (id: string, tick: number, ev: Omit<AppraisalEventE2, "tick" | "event_id">): AppraisalEventE2 =>
    ({ ...ev, tick, event_id: `${id}#0` });
  const c1 = mk("C1", 0, C1_EVENT);
  const c2 = mk("C2", 0, C2_EVENT);
  const c3: AppraisalEventE2[] = C3_GOALS.map((g, i) => ({
    tick: 30 * i, event_id: `C3#${i}`,
    relevance: C3_COMMON.relevance, goal_congruence: g, intensity: C3_COMMON.intensity,
    attribution: C3_COMMON.attribution, controllability: C3_COMMON.controllability,
    uncertainty: C3_COMMON.uncertainty, assessment_confidence: C3_COMMON.assessment_confidence
  }));
  const c4c5 = (id: string, fields: { attribution: E2Attribution; controllability: number; uncertainty: number; assessment_confidence: number }): AppraisalEventE2[] =>
    Array.from({ length: 6 }, (_, i) => ({
      tick: 30 * i, event_id: `${id}#${i}`,
      relevance: C4C5_COMMON.relevance, goal_congruence: C4C5_COMMON.goal_congruence, intensity: C4C5_COMMON.intensity,
      attribution: fields.attribution, controllability: fields.controllability,
      uncertainty: fields.uncertainty, assessment_confidence: fields.assessment_confidence
    }));
  return [
    { id: "C1", T: 1200, events: [c1] },
    { id: "C2", T: 1200, events: [c2] },
    { id: "C3", T: 1380, events: c3 },
    { id: "C4", T: 1200, events: c4c5("C4", C4_FIELDS) },
    { id: "C5", T: 1200, events: c4c5("C5", C5_FIELDS) }
  ];
}

export interface HistoryPairE2 {
  readonly id: string;
  readonly end_tick: number;
  readonly history_a: readonly AppraisalEventE2[];
  readonly history_b: readonly AppraisalEventE2[];
  readonly common_final: AppraisalEventE2;
}

/** §34: 16 pairs; 32 hash-selected ticks + 8 fixed; shared q, mirrored goals; byte-identical final event. */
export function buildHistoryPairs(): readonly HistoryPairE2[] {
  const pairs: HistoryPairE2[] = [];
  for (let h = 0; h < HISTORY_PAIRS.count; h++) {
    const f = "HPAIR";
    const s = "H" + String(h).padStart(2, "0");
    const selected = selectTicks(f, s,
      Array.from({ length: HISTORY_PAIRS.hash_tick_range.maxExclusive }, (_, t) => t),
      HISTORY_PAIRS.hash_selected_ticks);
    const times: number[] = [...selected].sort((a, b) => a - b).concat([...HISTORY_PAIRS.shared_event_times_fixed]);
    const a: AppraisalEventE2[] = [];
    const b: AppraisalEventE2[] = [];
    for (let k = 0; k < times.length; k++) {
      const tick = times[k];
      check(tick !== undefined, `H${h}: tick ${k}`);
      const relevance = uniform(f, s, `ev${k}:rel`, HISTORY_PAIRS.relevance_intensity.min, HISTORY_PAIRS.relevance_intensity.maxExclusive);
      const intensity = uniform(f, s, `ev${k}:int`, HISTORY_PAIRS.relevance_intensity.min, HISTORY_PAIRS.relevance_intensity.maxExclusive);
      const delta = uniform(f, s, `ev${k}:delta`, HISTORY_PAIRS.delta.min, HISTORY_PAIRS.delta.maxExclusive);
      const shared = auxiliaryFields(f, s, `ev${k}`);
      a.push({ tick: tick as number, event_id: `H${h}A#${k}`, relevance, goal_congruence: 0.5 - delta, intensity, ...shared });
      b.push({ tick: tick as number, event_id: `H${h}B#${k}`, relevance, goal_congruence: 0.5 + delta, intensity, ...shared });
    }
    const cf = HISTORY_PAIRS.common_final_event;
    const commonFinal: AppraisalEventE2 = {
      tick: cf.tick, relevance: cf.relevance, goal_congruence: cf.goal_congruence, intensity: cf.intensity,
      attribution: cf.attribution, controllability: cf.controllability, uncertainty: cf.uncertainty,
      assessment_confidence: cf.assessment_confidence,
      event_id: ""
    };
    pairs.push({
      id: "H" + String(h).padStart(2, "0"), end_tick: HISTORY_PAIRS.end_tick,
      history_a: [...a, { ...commonFinal, event_id: `H${h}A#final` }],
      history_b: [...b, { ...commonFinal, event_id: `H${h}B#final` }],
      common_final: { ...commonFinal, event_id: `H${h}#final` }
    });
  }
  return pairs;
}

/** Builds the complete primary corpus (232 lifetimes) with exact counts. */
export function buildPrimaryCorpus(): { corpus: FamilyCorpusE2[]; lifetimes: number; events: number } {
  const corpus: FamilyCorpusE2[] = [];
  for (const family of FAMILIES) {
    for (const seed of FAMILY_SEEDS[family.id] as readonly string[]) {
      corpus.push(buildFamilyCorpus(family, seed));
    }
  }
  const lifetimes = corpus.length;
  const events = corpus.reduce((sum, c) => sum + c.events.length, 0);
  return { corpus, lifetimes, events };
}
