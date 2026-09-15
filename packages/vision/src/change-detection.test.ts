import { describe, expect, it } from "vitest";
import {
  assessFrameChangeV0,
  fingerprintGrayV0,
  hammingDistanceV0,
  reduceGrayV0,
  roundChangeScoreV0
} from "./change-detection.js";

const WIDTH = 8;
const HEIGHT = 8;
const THRESHOLDS = { min_mean_abs_difference: 0.02, min_hash_distance: 0.12 };

function gray(fill: number): Uint8Array {
  return new Uint8Array(WIDTH * HEIGHT).fill(fill);
}

function splitGray(left: number, right: number): Uint8Array {
  const out = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) out[y * WIDTH + x] = x < WIDTH / 2 ? left : right;
  }
  return out;
}

describe("change detection", () => {
  it("treats the very first frame as significant (the scene was never looked at)", () => {
    const print = fingerprintGrayV0(gray(120), WIDTH, HEIGHT);
    const assessment = assessFrameChangeV0(null, print, THRESHOLDS);
    expect(assessment.significant).toBe(true);
    expect(assessment.mean_abs_difference).toBe(1);
  });

  it("drops an identical frame", () => {
    const first = fingerprintGrayV0(gray(120), WIDTH, HEIGHT);
    const second = fingerprintGrayV0(gray(120), WIDTH, HEIGHT);
    const assessment = assessFrameChangeV0(first, second, THRESHOLDS);
    expect(assessment.significant).toBe(false);
    expect(assessment.mean_abs_difference).toBe(0);
    expect(assessment.hash_distance).toBe(0);
  });

  it("drops a frame whose change stays under both thresholds", () => {
    const first = fingerprintGrayV0(gray(120), WIDTH, HEIGHT);
    const second = fingerprintGrayV0(gray(123), WIDTH, HEIGHT);
    const assessment = assessFrameChangeV0(first, second, THRESHOLDS);
    expect(assessment.significant).toBe(false);
    expect(assessment.mean_abs_difference).toBeCloseTo(3 / 255, 6);
  });

  it("accepts a frame that crosses the pixel threshold", () => {
    const first = fingerprintGrayV0(gray(120), WIDTH, HEIGHT);
    const second = fingerprintGrayV0(gray(200), WIDTH, HEIGHT);
    const assessment = assessFrameChangeV0(first, second, THRESHOLDS);
    expect(assessment.significant).toBe(true);
    expect(assessment.mean_abs_difference).toBeCloseTo(80 / 255, 6);
  });

  it("accepts a layout change that the mean difference alone could miss", () => {
    const flat = fingerprintGrayV0(gray(128), WIDTH, HEIGHT);
    const inverted = fingerprintGrayV0(splitGray(255, 0), WIDTH, HEIGHT);
    const assessment = assessFrameChangeV0(flat, inverted, { min_mean_abs_difference: 0.9, min_hash_distance: 0.1 });
    expect(assessment.mean_abs_difference).toBeLessThan(0.9);
    expect(assessment.hash_distance).toBeGreaterThanOrEqual(0.1);
    expect(assessment.significant).toBe(true);
  });

  it("keeps the perceptual hash stable across a uniform luminance shift", () => {
    const a = fingerprintGrayV0(splitGray(10, 60), WIDTH, HEIGHT);
    const b = fingerprintGrayV0(splitGray(40, 90), WIDTH, HEIGHT);
    expect(a.difference_hash).toBe(b.difference_hash);
  });

  it("reduces a gray image by box average", () => {
    const source = new Uint8Array([0, 100, 200, 255]);
    expect([...reduceGrayV0(source, 2, 2, 1, 1)]).toEqual([139]);
  });

  it("counts hamming distance exactly", () => {
    expect(hammingDistanceV0(0b1010n, 0b0011n)).toBe(2);
    expect(hammingDistanceV0(0n, 0n)).toBe(0);
  });

  it("rounds change scores for reporting without changing decisions", () => {
    expect(roundChangeScoreV0(0.123456789)).toBe(0.1235);
  });
});
