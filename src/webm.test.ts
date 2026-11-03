import { expect, it } from "vitest";
import { webmDuration } from "./webm";

it("adds finite seekable duration to a streaming WebM without changing encoded packets", () => {
  const bytes = Uint8Array.from(
    "1a45dfa3801853806701ffffffffffffff1549a966872ad7b1830f42401f43b67584abcdef12"
      .match(/../g)!
      .map((s) => parseInt(s, 16)),
  );
  const out = webmDuration(bytes, 4.15);
  expect(out.length).toBe(bytes.length + 11);
  expect([...out.slice(-8)]).toEqual([...bytes.slice(-8)]);
  const index = out.findIndex((v, i) => v === 0x44 && out[i + 1] === 0x89);
  expect(new DataView(out.buffer).getFloat64(index + 3)).toBeCloseTo(4150, 6);
  const again = webmDuration(out, 5);
  expect(again.length).toBe(out.length);
  expect(new DataView(again.buffer).getFloat64(index + 3)).toBe(5000);
  expect([...bytes]).not.toEqual([...out]);
});
it("rejects malformed movie metadata and non-finite duration", () => {
  expect(() => webmDuration(new Uint8Array([0, 1, 2]), 4)).toThrow();
  expect(() => webmDuration(new Uint8Array(), Infinity)).toThrow();
});
