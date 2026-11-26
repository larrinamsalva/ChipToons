import { describe, expect, it } from "vitest";
import { clearConnectedBackground } from "./simple-background";

describe("plain-background cleanup", () => {
  it("removes only matching pixels connected to the picked spot and keeps the source", () => {
    const image = new Uint8ClampedArray(5 * 3 * 4);
    for (let i = 0; i < 15; i++) image.set([40, 180, 80, 255], i * 4);
    for (let y = 0; y < 3; y++) image.set([220, 60, 50, 255], (y * 5 + 2) * 4);
    const before = new Uint8ClampedArray(image);
    const result = clearConnectedBackground(image, 5, 3, 0, 1, 20);
    expect(result[(1 * 5 + 0) * 4 + 3]).toBe(0);
    expect(result[(1 * 5 + 2) * 4 + 3]).toBe(255);
    expect(result[(1 * 5 + 4) * 4 + 3]).toBe(255);
    expect(image).toEqual(before);
  });

  it("preserves a differently colored subject and rejects a transparent or destructive pick", () => {
    const image = new Uint8ClampedArray([
      30, 170, 60, 255, 34, 174, 63, 255,
      220, 65, 50, 255, 0, 0, 0, 0,
    ]);
    const result = clearConnectedBackground(image, 4, 1, 0, 0, 20);
    expect([result[3], result[7], result[11], result[15]]).toEqual([0, 0, 255, 0]);
    expect(() => clearConnectedBackground(image, 4, 1, 3, 0, 20)).toThrow(/visible background spot/);
    expect(() => clearConnectedBackground(new Uint8ClampedArray([30, 170, 60, 255]),
      1, 1, 0, 0, 20)).toThrow(/removed all visible artwork/);
  });
});
