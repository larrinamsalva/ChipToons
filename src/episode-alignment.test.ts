import { it, expect } from "vitest";
import { alignment } from "../tests/episode-alignment";
it("measures a known fractional-sample speech-like delay and rejects unrelated sound", () => {
  const reference = Buffer.alloc(32000 * 4),
    movie = Buffer.alloc(48000 * 4),
    unrelated = Buffer.alloc(48000 * 4),
    delay = 1306.25;
  const signal = (t: number) =>
    Math.sin(t * 0.47) * 0.21 +
    Math.sin(t * 1.31) * 0.17 +
    Math.sin(t * t * 0.000019) * 0.13;
  for (let i = 0; i < 32000; i++) reference.writeFloatLE(signal(i), i * 4);
  for (let i = 0; i < 48000; i++) {
    movie.writeFloatLE(
      i >= delay && i - delay < 32000 ? signal(i - delay) : 0,
      i * 4,
    );
    unrelated.writeFloatLE(Math.sin(i * i * 0.0031), i * 4);
  }
  const measured = alignment(reference, movie, 0);
  expect(measured.correlation).toBeGreaterThan(0.9);
  expect(Math.abs(measured.delay - delay / 8000)).toBeLessThan(0.0001);
  expect(alignment(reference, unrelated, 0).correlation).toBeLessThan(0.15);
});
