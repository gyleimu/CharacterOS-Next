/**
 * Cheap change detection — the gate that keeps the VLM off the frame loop.
 *
 * A still is reduced to a small grayscale thumbnail once (see `imaging.ts`); all
 * comparison below is pure arithmetic over that thumbnail. Two independent
 * signals are combined so that both "something moved" (mean absolute pixel
 * difference) and "the layout changed" (perceptual hash distance) can trigger an
 * analysis. Neither signal ever inspects image content.
 */

export interface FrameFingerprintV0 {
  readonly gray: Uint8Array;
  readonly width: number;
  readonly height: number;
  /** 64-bit average hash (luminance vs. mean of an 8x8 reduction). */
  readonly average_hash: bigint;
  /** 64-bit difference hash (horizontal gradients of a 9x8 reduction). */
  readonly difference_hash: bigint;
}

export interface ChangeThresholdsV0 {
  /** Mean absolute thumbnail difference (0..1) above which the frame is interesting. */
  readonly min_mean_abs_difference: number;
  /** Normalized Hamming distance (0..1) above which the frame is interesting. */
  readonly min_hash_distance: number;
}

export interface ChangeAssessmentV0 {
  /** Mean absolute difference normalized to 0..1. */
  readonly mean_abs_difference: number;
  /** dHash Hamming distance normalized to 0..1. */
  readonly hash_distance: number;
  readonly significant: boolean;
}

/** Box-averaged grayscale reduction. `gray` is a `width*height` luminance buffer. */
export function reduceGrayV0(
  gray: Uint8Array,
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number
): Uint8Array {
  const out = new Uint8Array(targetWidth * targetHeight);
  for (let ty = 0; ty < targetHeight; ty += 1) {
    const y0 = Math.floor((ty * height) / targetHeight);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / targetHeight));
    for (let tx = 0; tx < targetWidth; tx += 1) {
      const x0 = Math.floor((tx * width) / targetWidth);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / targetWidth));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1 && y < height; y += 1) {
        const row = y * width;
        for (let x = x0; x < x1 && x < width; x += 1) {
          sum += gray[row + x] ?? 0;
          count += 1;
        }
      }
      out[ty * targetWidth + tx] = count === 0 ? 0 : Math.round(sum / count);
    }
  }
  return out;
}

function averageHashV0(reduced: Uint8Array): bigint {
  let sum = 0;
  for (const value of reduced) sum += value;
  const mean = sum / reduced.length;
  let hash = 0n;
  for (let index = 0; index < 64; index += 1) {
    const bit = (reduced[index] ?? 0) > mean ? 1n : 0n;
    hash = (hash << 1n) | bit;
  }
  return hash;
}

function differenceHashV0(reduced9x8: Uint8Array): bigint {
  let hash = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = reduced9x8[y * 9 + x] ?? 0;
      const right = reduced9x8[y * 9 + x + 1] ?? 0;
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

/** Builds the comparison fingerprint for one grayscale thumbnail. */
export function fingerprintGrayV0(gray: Uint8Array, width: number, height: number): FrameFingerprintV0 {
  const eight = reduceGrayV0(gray, width, height, 8, 8);
  const nine = reduceGrayV0(gray, width, height, 9, 8);
  return {
    gray,
    width,
    height,
    average_hash: averageHashV0(eight),
    difference_hash: differenceHashV0(nine)
  };
}

export function hammingDistanceV0(a: bigint, b: bigint): number {
  let value = a ^ b;
  let count = 0;
  while (value !== 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

/**
 * Compares the new thumbnail against the previous one. `previous === null` (the
 * first frame of a source) is always significant: the adapter has never looked
 * at this scene, so its first look must be reported.
 */
export function assessFrameChangeV0(
  previous: FrameFingerprintV0 | null,
  current: FrameFingerprintV0,
  thresholds: ChangeThresholdsV0
): ChangeAssessmentV0 {
  if (previous === null || previous.gray.length !== current.gray.length) {
    return { mean_abs_difference: 1, hash_distance: 1, significant: true };
  }
  let total = 0;
  for (let index = 0; index < current.gray.length; index += 1) {
    total += Math.abs((current.gray[index] ?? 0) - (previous.gray[index] ?? 0));
  }
  const meanAbsDifference = total / current.gray.length / 255;
  const hashDistance = hammingDistanceV0(previous.difference_hash, current.difference_hash) / 64;
  return {
    mean_abs_difference: meanAbsDifference,
    hash_distance: hashDistance,
    significant:
      meanAbsDifference >= thresholds.min_mean_abs_difference ||
      hashDistance >= thresholds.min_hash_distance
  };
}

/** Rounds a change score for logs/metrics (never used for decisions). */
export function roundChangeScoreV0(value: number): number {
  return Math.round(value * 10000) / 10000;
}
