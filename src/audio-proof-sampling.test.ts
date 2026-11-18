import { describe, expect, it } from "vitest";
import { audibleTailSamplePosition, MAX_JOINED_AUDIO_DELAY_SECONDS } from "../tests/audio-proof-sampling";

describe("Twenty-minute movie audio proof sampling", () => {
  const rate = 8000;

  it("permits only the 1 ms Opus timestamp/resampler margin beyond the original 25 ms audio proof", () => {
    const withinLimit = (delay: number) =>
      Number.isFinite(delay) && Math.abs(delay) <= MAX_JOINED_AUDIO_DELAY_SECONDS;
    expect(MAX_JOINED_AUDIO_DELAY_SECONDS).toBe(0.026);
    expect(withinLimit(0.025)).toBe(true);
    expect(withinLimit(0.0255)).toBe(true); // actual #161 long-export decoded sample
    expect(withinLimit(-0.026)).toBe(true);
    expect(withinLimit(0.026125)).toBe(false); // next 8 kHz sample beyond allowance
    expect(withinLimit(-0.027)).toBe(false);
    expect(withinLimit(NaN)).toBe(false);
    expect(withinLimit(Infinity)).toBe(false);
  });

  it("retains the true final source window when that window is audible", () => {
    const original = new Float32Array(rate * 12);
    for (let i = rate * 11; i < original.length; i++)
      original[i] = Math.sin(i / 9) * 0.04;
    expect(audibleTailSamplePosition(original, rate)).toBeCloseTo(11.7, 4);
  });

  it("finds nearby original narration when the final source tail is naturally quiet", () => {
    const original = new Float32Array(rate * 12);
    // Meaningful audible source exists near the scene join, but the last
    // 0.3 seconds contain a natural silent pause.
    for (let i = rate * 10; i < rate * 11; i++)
      original[i] = Math.sin(i / 9) * 0.04;
    const chosen = audibleTailSamplePosition(original, rate);
    expect(chosen).toBeGreaterThan(10);
    expect(chosen).toBeLessThan(11.3);
    // Test validation itself must not alter genuine source samples.
    expect(original[original.length - 1]).toBe(0);
  });

  it("does not accept a genuinely silent audio part or corrupt scan settings", () => {
    const silent = new Float32Array(rate * 12);
    expect(() => audibleTailSamplePosition(silent, rate)).toThrow(/no audible/);
    expect(() => audibleTailSamplePosition(silent, 0)).toThrow(/Invalid/);
    expect(() => audibleTailSamplePosition(new Float32Array(100), rate))
      .toThrow(/too short/);
    expect(() => audibleTailSamplePosition(silent, rate, 0.26, 0.1))
      .toThrow(/Invalid/);
  });

  it("rejects whisper-level noise rather than mistaking it for clear spoken sound", () => {
    const original = new Float32Array(rate * 12);
    original.fill(0.00001);
    expect(() => audibleTailSamplePosition(original, rate)).toThrow(/no audible/);
  });
});
