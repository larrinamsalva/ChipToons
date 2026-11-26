import { describe, expect, it } from "vitest";
import { finishCutoutPixels } from "./cartoon-finish";

describe("optional local picture finish", () => {
  it("keeps the original untouched and preserves every cutout alpha value", () => {
    const pixels = new Uint8ClampedArray([
      183, 121, 77, 255, 192, 127, 85, 128,
      204, 135, 92, 255, 0, 0, 0, 0,
    ]);
    const before = new Uint8ClampedArray(pixels);
    expect(finishCutoutPixels(pixels, 2, 2, "original")).toEqual(before);
    for (const finish of ["storybook", "ink"] as const) {
      const result = finishCutoutPixels(pixels, 2, 2, finish);
      expect([result[3], result[7], result[11], result[15]]).toEqual([255, 128, 255, 0]);
      expect(result).not.toEqual(before);
      expect(pixels).toEqual(before);
    }
  });

  it("draws a dark ink edge inside a cutout without filling its transparent background", () => {
    const pixels = new Uint8ClampedArray(5 * 5 * 4);
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++)
      pixels.set([190, 150, 110, 255], (y * 5 + x) * 4);
    const result = finishCutoutPixels(pixels, 5, 5, "ink");
    expect(result[(1 * 5 + 2) * 4]).toBeLessThan(result[(2 * 5 + 2) * 4] / 2);
    expect(result[3]).toBe(0);
  });
});
