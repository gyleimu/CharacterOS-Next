/**
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — statistics.
 *
 * Deterministic, closed-form, dependency-free. NO p-value shopping: exactly ONE
 * primary analysis law (below); any other number this module can produce is
 * secondary robustness reporting only.
 *
 *   per cell        Wilson score interval for the binomial proportion
 *   contrast        Newcombe hybrid-score interval for the difference of two
 *                   independent proportions (the same family as Wilson, so the
 *                   per-cell and contrast statements are coherent)
 *   superiority     one-sided minimum-effect test at alpha:
 *                       lower bound of the (1 - alpha) interval for p_hi - p_lo
 *                       must EXCEED the claim threshold delta_min
 *   equivalence     TOST: the (1 - 2*alpha_eq) interval for p_B - p_D must fit
 *                   ENTIRELY inside (-epsilon, +epsilon)
 *
 * Power is computed by EXACT enumeration over the joint binomial support
 * (no Monte Carlo, no simulation seed, no external statistics package).
 */

export interface Interval {
  readonly lo: number;
  readonly hi: number;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Wilson score interval for x successes in n independent trials. */
export function wilson(x: number, n: number, z: number): Interval {
  if (n <= 0) return { lo: 0, hi: 1 };
  const p = x / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return { lo: clamp01(center - half), hi: clamp01(center + half) };
}

/**
 * Newcombe hybrid-score interval for the difference p2 - p1 of two INDEPENDENT
 * samples (square-and-add of the two Wilson intervals). Closed form; no
 * continuity correction; identical to the published method 10 formulation.
 */
export function newcombeDifference(x1: number, n1: number, x2: number, n2: number, z: number): Interval {
  const p1 = n1 <= 0 ? 0 : x1 / n1;
  const p2 = n2 <= 0 ? 0 : x2 / n2;
  const w1 = wilson(x1, n1, z);
  const w2 = wilson(x2, n2, z);
  const difference = p2 - p1;
  const lo = difference - Math.sqrt((p2 - w2.lo) ** 2 + (w1.hi - p1) ** 2);
  const hi = difference + Math.sqrt((w2.hi - p2) ** 2 + (p1 - w1.lo) ** 2);
  return { lo, hi };
}

/** Exact binomial probability mass function. */
export function binomialPmf(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  // log-space accumulation for numerical stability at large n
  let logCoefficient = 0;
  for (let index = 1; index <= k; index += 1) {
    logCoefficient += Math.log(n - k + index) - Math.log(index);
  }
  return Math.exp(logCoefficient + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

export function binomialDistribution(n: number, p: number): readonly number[] {
  const out: number[] = [];
  for (let k = 0; k <= n; k += 1) out.push(binomialPmf(k, n, p));
  return out;
}

/** One-sided minimum-effect superiority decision for p_hi - p_lo > deltaMin. */
export function superiorityPasses(
  xLo: number,
  nLo: number,
  xHi: number,
  nHi: number,
  deltaMin: number,
  z: number
): boolean {
  return newcombeDifference(xLo, nLo, xHi, nHi, z).lo > deltaMin;
}

/** TOST equivalence decision for |p1 - p2| < epsilon. */
export function equivalencePasses(
  x1: number,
  n1: number,
  x2: number,
  n2: number,
  epsilon: number,
  z: number
): boolean {
  const interval = newcombeDifference(x1, n1, x2, n2, z);
  return interval.lo > -epsilon && interval.hi < epsilon;
}

export interface TwoSampleDesign {
  readonly x_lo: number;
  readonly n_lo: number;
  readonly x_hi: number;
  readonly n_hi: number;
}

/** ONE primary analysis law: superiority of the higher cell over the lower one. */
export function primarySuperiorityTest(design: TwoSampleDesign, deltaMin: number, z: number): boolean {
  return superiorityPasses(design.x_lo, design.n_lo, design.x_hi, design.n_hi, deltaMin, z);
}

export function primaryEquivalenceTest(
  x1: number,
  n1: number,
  x2: number,
  n2: number,
  epsilon: number,
  zEquivalence: number
): boolean {
  return equivalencePasses(x1, n1, x2, n2, epsilon, zEquivalence);
}

export interface ContrastPower {
  readonly power: number;
  readonly expected_ci_width: number | null;
}

/**
 * EXACT power of the superiority rule for two independent binomial samples.
 * Enumerates the full support: exact, reproducible, no seed.
 */
export function exactSuperiorityPower(
  pLo: number,
  pHi: number,
  nLo: number,
  nHi: number,
  deltaMin: number,
  z: number
): ContrastPower {
  const pmfLo = binomialDistribution(nLo, pLo);
  const pmfHi = binomialDistribution(nHi, pHi);
  let power = 0;
  let widthAccumulator = 0;
  for (let xLo = 0; xLo <= nLo; xLo += 1) {
    const weightLo = pmfLo[xLo] ?? 0;
    if (weightLo === 0) continue;
    for (let xHi = 0; xHi <= nHi; xHi += 1) {
      const weight = weightLo * (pmfHi[xHi] ?? 0);
      if (weight === 0) continue;
      const interval = newcombeDifference(xLo, nLo, xHi, nHi, z);
      widthAccumulator += weight * (interval.hi - interval.lo);
      if (interval.lo > deltaMin) power += weight;
    }
  }
  return { power, expected_ci_width: widthAccumulator };
}

/** EXACT power of the TOST equivalence rule for two independent binomial samples. */
export function exactEquivalencePower(
  p1: number,
  p2: number,
  n1: number,
  n2: number,
  epsilon: number,
  z: number
): ContrastPower {
  const pmf1 = binomialDistribution(n1, p1);
  const pmf2 = binomialDistribution(n2, p2);
  let power = 0;
  let widthAccumulator = 0;
  for (let x1 = 0; x1 <= n1; x1 += 1) {
    const weight1 = pmf1[x1] ?? 0;
    if (weight1 === 0) continue;
    for (let x2 = 0; x2 <= n2; x2 += 1) {
      const weight = weight1 * (pmf2[x2] ?? 0);
      if (weight === 0) continue;
      const interval = newcombeDifference(x1, n1, x2, n2, z);
      widthAccumulator += weight * (interval.hi - interval.lo);
      if (interval.lo > -epsilon && interval.hi < epsilon) power += weight;
    }
  }
  return { power, expected_ci_width: widthAccumulator };
}

export interface CellCounts {
  readonly realize: number;
  /** Host-valid draws for the cell (the only denominator the law uses). */
  readonly host_valid: number;
}

export interface FourCellCounts {
  readonly A: CellCounts;
  readonly B: CellCounts;
  readonly C: CellCounts;
  readonly D: CellCounts;
}

export interface ConjunctiveDecision {
  readonly C1_AB_superiority: boolean;
  readonly C2_BC_superiority: boolean;
  readonly C3_BD_equivalence: boolean;
  readonly C4_DA_superiority: boolean;
  readonly joint: boolean;
  readonly estimates: {
    readonly pA: number;
    readonly pB: number;
    readonly pC: number;
    readonly pD: number;
    readonly delta_AB: number;
    readonly delta_BC: number;
    readonly delta_DA: number;
    readonly delta_BD: number;
  };
  readonly intervals: {
    readonly AB: Interval;
    readonly BC: Interval;
    readonly DA: Interval;
    readonly BD: Interval;
  };
}

/**
 * THE conjunctive decision law. Every contrast is evaluated on host-valid
 * outcomes only; the joint claim requires ALL FOUR to pass simultaneously.
 */
export function conjunctiveDecision(input: {
  readonly counts: FourCellCounts;
  readonly deltaMin: number;
  readonly epsilon: number;
  readonly zSuperiority: number;
  readonly zEquivalence: number;
}): ConjunctiveDecision {
  const { A, B, C, D } = input.counts;
  const AB = newcombeDifference(A.realize, A.host_valid, B.realize, B.host_valid, input.zSuperiority);
  const BC = newcombeDifference(C.realize, C.host_valid, B.realize, B.host_valid, input.zSuperiority);
  const DA = newcombeDifference(A.realize, A.host_valid, D.realize, D.host_valid, input.zSuperiority);
  const BD = newcombeDifference(D.realize, D.host_valid, B.realize, B.host_valid, input.zEquivalence);
  const C1 = AB.lo > input.deltaMin;
  const C2 = BC.lo > input.deltaMin;
  const C4 = DA.lo > input.deltaMin;
  const C3 = BD.lo > -input.epsilon && BD.hi < input.epsilon;
  return {
    C1_AB_superiority: C1,
    C2_BC_superiority: C2,
    C3_BD_equivalence: C3,
    C4_DA_superiority: C4,
    joint: C1 && C2 && C3 && C4,
    estimates: {
      pA: A.host_valid === 0 ? Number.NaN : A.realize / A.host_valid,
      pB: B.host_valid === 0 ? Number.NaN : B.realize / B.host_valid,
      pC: C.host_valid === 0 ? Number.NaN : C.realize / C.host_valid,
      pD: D.host_valid === 0 ? Number.NaN : D.realize / D.host_valid,
      delta_AB: B.host_valid === 0 || A.host_valid === 0 ? Number.NaN : B.realize / B.host_valid - A.realize / A.host_valid,
      delta_BC: B.host_valid === 0 || C.host_valid === 0 ? Number.NaN : B.realize / B.host_valid - C.realize / C.host_valid,
      delta_DA: D.host_valid === 0 || A.host_valid === 0 ? Number.NaN : D.realize / D.host_valid - A.realize / A.host_valid,
      delta_BD: B.host_valid === 0 || D.host_valid === 0 ? Number.NaN : B.realize / B.host_valid - D.realize / D.host_valid
    },
    intervals: { AB, BC, DA, BD }
  };
}

/**
 * EXACT joint probability of the conjunctive law under a fixed alternative.
 *
 * Factorized exact enumeration (no Monte Carlo, no seed): the four criteria
 * couple the cells as A-(C1,C4), B-(C1,C2,C3), C-(C2), D-(C3,C4), so the sum
 *
 *   sum_{a,b,c,d} pmfA(a) pmfB(b) pmfC(c) pmfD(d) · C1(a,b) · C2(c,b) · C4(a,d) · C3(b,d)
 *
 * factorizes into an O(n^3) inner accumulation for the (a,d) pair followed by an
 * O(n^2) outer sum. Feasible for the protocol's N; above JOIN_T_SUPPORT_MAX the
 * caller is told the exact joint is not computed rather than given a guess.
 */
export const JOIN_T_SUPPORT_MAX = 800;

export function exactJointSuccessProbability(input: {
  readonly pA: number;
  readonly pB: number;
  readonly pC: number;
  readonly pD: number;
  readonly n: number;
  readonly deltaMin: number;
  readonly epsilon: number;
  readonly zSuperiority: number;
  readonly zEquivalence: number;
}): number {
  const n = input.n;
  if (n > JOIN_T_SUPPORT_MAX) {
    throw new Error();
  }
  const width = n + 1;
  const superiority = new Uint8Array(width * width);
  const equivalence = new Uint8Array(width * width);
  const at = (lo: number, hi: number): number => lo * width + hi;
  for (let lo = 0; lo <= n; lo += 1) {
    for (let hi = 0; hi <= n; hi += 1) {
      superiority[at(lo, hi)] = newcombeDifference(lo, n, hi, n, input.zSuperiority).lo > input.deltaMin ? 1 : 0;
      const interval = newcombeDifference(lo, n, hi, n, input.zEquivalence);
      equivalence[at(lo, hi)] = interval.lo > -input.epsilon && interval.hi < input.epsilon ? 1 : 0;
    }
  }
  const pmfA = binomialDistribution(n, input.pA);
  const pmfB = binomialDistribution(n, input.pB);
  const pmfC = binomialDistribution(n, input.pC);
  const pmfD = binomialDistribution(n, input.pD);

  // innerC[b] = P(C2 passes | b) = sum_c pmfC(c) · superiority(c, b)
  const innerC = new Float64Array(width);
  for (let b = 0; b <= n; b += 1) {
    let total = 0;
    for (let c = 0; c <= n; c += 1) {
      const weight = pmfC[c] ?? 0;
      if (weight === 0) continue;
      if (superiority[at(c, b)] === 1) total += weight;
    }
    innerC[b] = total;
  }

  // innerD[a][b] = P(C3 and C4 pass | a, b) = sum_d pmfD(d) · C4(a,d) · C3(b,d)
  const innerD = new Float64Array(width * width);
  for (let a = 0; a <= n; a += 1) {
    for (let b = 0; b <= n; b += 1) {
      let total = 0;
      for (let d = 0; d <= n; d += 1) {
        const weight = pmfD[d] ?? 0;
        if (weight === 0) continue;
        if (superiority[at(a, d)] === 0) continue;
        if (equivalence[at(b, d)] === 0) continue;
        total += weight;
      }
      innerD[a * width + b] = total;
    }
  }

  let joint = 0;
  for (let a = 0; a <= n; a += 1) {
    const weightA = pmfA[a] ?? 0;
    if (weightA === 0) continue;
    for (let b = 0; b <= n; b += 1) {
      const weightB = pmfB[b] ?? 0;
      if (weightB === 0) continue;
      if (superiority[at(a, b)] === 0) continue;
      const c2 = innerC[b] ?? 0;
      if (c2 === 0) continue;
      const cd = innerD[a * width + b] ?? 0;
      if (cd === 0) continue;
      joint += weightA * weightB * c2 * cd;
    }
  }
  return joint;
}
