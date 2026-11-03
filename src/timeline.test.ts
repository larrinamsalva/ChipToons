import { describe, expect, it } from "vitest";
import { starterProject } from "./demo-starter";
import { frameAt, motionAt, sceneStart } from "./timeline";

describe("deterministic cartoon playback", () => {
  const p = starterProject();
  it("uses scene durations at every boundary, including the exact ending", () => {
    expect(frameAt(p, -5).index).toBe(0);
    expect(frameAt(p, 9.99).index).toBe(0);
    expect(frameAt(p, 10).index).toBe(1);
    expect(sceneStart(p, 3)).toBe(30);
    expect(frameAt(p, 60).index).toBe(5);
    expect(frameAt(p, 600).progress).toBe(1);
    p.scenes.forEach((s, index) => {
      const frame = frameAt(p, sceneStart(p, index));
      expect(frame.scene.id).toBe(s.id);
      expect(frame.progress).toBe(0);
    });
  });
  it("reproduces every supported movement at a given timeline position without mutating the element", () => {
    const base = p.scenes[0].elements[0];
    for (const motion of [
      "still",
      "enter-left",
      "enter-right",
      "walk",
      "bounce",
      "spin",
      "grow",
      "fade",
    ] as const) {
      const el = { ...base, motion };
      expect(motionAt(el, 0.35)).toEqual(motionAt(el, 0.35));
      expect(el.x).toBe(base.x);
      expect(Object.values(motionAt(el, 0.8)).every(Number.isFinite)).toBe(
        true,
      );
    }
    expect(motionAt({ ...base, motion: "enter-left" }, 0).x).toBe(base.x - 800);
    expect(motionAt({ ...base, motion: "enter-left" }, 1).x).toBe(base.x);
    expect(motionAt({ ...base, motion: "fade" }, 0).opacity).toBe(0);
    expect(motionAt({ ...base, motion: "fade" }, 1).opacity).toBe(1);
    expect(motionAt({ ...base, motion: "bounce" }, 0.125).y).toBeLessThan(
      base.y,
    );
  });
});
