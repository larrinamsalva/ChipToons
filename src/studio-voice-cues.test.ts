import { describe, expect, it } from "vitest";
import { planStoryReel } from "./studio-story-reel";
import type { NumberedShot, ShotDirection } from "./studio-multishot";
import { emptyShotBeat } from "./studio-shot-beats";
import { formatVoiceCueSheet, narrationTiming } from "./studio-voice-cues";

const shots: NumberedShot[] = [
  { prefix: "shot01_frame_", files: [
    new File(["a"], "shot01_frame_0001.png", { type: "image/png" }),
    new File(["b"], "shot01_frame_0002.png", { type: "image/png" }),
  ] },
  { prefix: "shot02_frame_", files: [
    new File(["c"], "shot02_frame_0001.png", { type: "image/png" }),
    new File(["d"], "shot02_frame_0002.png", { type: "image/png" }),
  ] },
];

describe("Framefield local narration planning and voice cue sheet", () => {
  it("offers a rough, non-blocking estimate, never synthetic speech", () => {
    expect(narrationTiming("", 2)).toEqual({
      words: 0, estimatedSeconds: 0, shotSeconds: 2, estimatedOverrun: false,
    });
    expect(narrationTiming("Hello there, my friend!", 2)).toEqual({
      words: 4, estimatedSeconds: 2, shotSeconds: 2, estimatedOverrun: false,
    });
    expect(narrationTiming("Hello there my friend, how are you today?", 2))
      .toEqual({ words: 8, estimatedSeconds: 4, shotSeconds: 2, estimatedOverrun: true });
    expect(narrationTiming("A kind word!\nA happy heart.", 3))
      .toEqual({ words: 6, estimatedSeconds: 3, shotSeconds: 3, estimatedOverrun: false });
  });

  it("writes a real ordered time-coded script using original numbered shot identities", () => {
    const direction: ShotDirection[] = [
      { prefix: "shot02_frame_", holdSeconds: 1 },
      { prefix: "shot01_frame_", holdSeconds: 0 },
    ];
    const plan = planStoryReel(shots, 2, direction);
    const notes = [
      { prefix: "shot01_frame_", title: "Scout learns", action: "A careful check.", narration: "Look before you ride." },
      { prefix: "shot02_frame_", title: "Jo helps", action: "Jo explains a repair.", narration: "We can always ask a trusted adult for help with a tricky repair." },
    ];
    const original = JSON.stringify(notes);
    const text = formatVoiceCueSheet(plan, notes);
    expect(text).toContain("Shots: 2 | Total storyboard: 5.00s | PNG rate: 2 fps");
    expect(text).toContain("SHOT 1 — Jo helps\nTime: 0.00s to 3.00s (3.00s)");
    expect(text).toContain("SHOT 2 — Scout learns\nTime: 3.00s to 5.00s (2.00s)");
    expect(text).toContain("Frames: 2 | Final-frame hold: +1s");
    expect(text).toContain("Action / lesson: Jo explains a repair.");
    expect(text).toContain("Written narration: We can always ask a trusted adult");
    expect(text).toContain("TIMING NOTE: Narration may be too long");
    expect(text).toContain("Written narration: Look before you ride.");
    expect(text).toContain("Timing note: Estimated words fit the shot");
    expect(text).toContain("not a voice recording");
    expect(text.indexOf("SHOT 1 — Jo helps")).toBeLessThan(text.indexOf("SHOT 2 — Scout learns"));
    expect(JSON.stringify(notes)).toBe(original);
    expect(plan.shots[0].prefix).toBe("shot02_frame_");
    expect(plan.shots[1].start).toBe(3);
  });

  it("does not confuse embedded lines with the time-coded cue fields", () => {
    const plan = planStoryReel(shots, 2);
    const notes = [
      { ...emptyShotBeat("shot01_frame_"), action: "Stop\nNew line", narration: "A\nB" },
      emptyShotBeat("shot02_frame_"),
    ];
    const output = formatVoiceCueSheet(plan, notes);
    expect(output).toContain("Action / lesson: Stop New line");
    expect(output).toContain("Written narration: A B");
    expect(output).not.toContain("Stop\nNew line");
    expect(output).toContain("Written narration: (none written)");
    expect(output).not.toContain("NaN");
  });

  it("rejects stale, corrupt and unexpected notes without producing a file", () => {
    const plan = planStoryReel(shots, 2);
    expect(() => formatVoiceCueSheet(plan, [
      emptyShotBeat("shot01_frame_"), emptyShotBeat("someone_else_"),
    ])).toThrow(/Invalid story beat/);
    expect(() => formatVoiceCueSheet(plan, [
      emptyShotBeat("shot01_frame_"),
    ])).toThrow(/no longer match/);
    expect(() => formatVoiceCueSheet(plan, [
      emptyShotBeat("shot01_frame_"),
      { ...emptyShotBeat("shot02_frame_"), narration: "too long ".repeat(100) },
    ])).toThrow(/Invalid story beat/);
  });
});
