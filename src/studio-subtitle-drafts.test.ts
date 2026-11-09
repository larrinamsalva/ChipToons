import { describe, expect, it } from "vitest";
import type { NumberedShot, ShotDirection } from "./studio-multishot";
import type { ShotBeat } from "./studio-shot-beats";
import { planStoryReel } from "./studio-story-reel";
import { draftSubtitleCues, storyboardSubtitleAt, storyboardSubtitleSrt } from "./studio-subtitle-drafts";

const shots: NumberedShot[] = [
  { prefix: "shot01_frame_", files: [
    new File(["one"], "shot01_frame_0001.png", { type: "image/png" }),
    new File(["two"], "shot01_frame_0002.png", { type: "image/png" }),
  ] },
  { prefix: "shot02_frame_", files: [
    new File(["three"], "shot02_frame_0001.png", { type: "image/png" }),
    new File(["four"], "shot02_frame_0002.png", { type: "image/png" }),
  ] },
];
const beats: ShotBeat[] = [
  { prefix: "shot01_frame_", title: "Scout checks", action: "", narration: "First, we inspect the wheel." },
  { prefix: "shot02_frame_", title: "Helper Jo", action: "", narration: "Ask a grown-up for help." },
];

describe("Local storyboard subtitle drafts", () => {
  it("uses real scene boundaries, shot reordering and final-frame holds", () => {
    const order: ShotDirection[] = [
      { prefix: "shot02_frame_", holdSeconds: 1 },
      { prefix: "shot01_frame_", holdSeconds: 2 },
    ];
    const plan = planStoryReel(shots, 2, order);
    const before = JSON.stringify(beats);
    expect(draftSubtitleCues(plan, beats)).toEqual([
      { start: 0, end: 3, text: "Ask a grown-up for help." },
      { start: 3, end: 7, text: "First, we inspect the wheel." },
    ]);
    expect(storyboardSubtitleSrt(plan, beats)).toBe(
      "1\n00:00:00,000 --> 00:00:03,000\nAsk a grown-up for help.\n\n" +
      "2\n00:00:03,000 --> 00:00:07,000\nFirst, we inspect the wheel.\n",
    );
    expect(storyboardSubtitleAt(plan, beats, 2.999))
      .toBe("Ask a grown-up for help.");
    expect(storyboardSubtitleAt(plan, beats, 3))
      .toBe("First, we inspect the wheel.");
    expect(JSON.stringify(beats)).toBe(before);
    expect(plan.duration).toBe(7);
  });

  it("skips empty narration without inserting fake words or a blank SRT cue", () => {
    const plan = planStoryReel(shots, 4);
    const minimal: ShotBeat[] = [
      { ...beats[0], narration: "  Welcome  back.\n  Let's help!  " },
      { ...beats[1], narration: " \t " },
    ];
    expect(draftSubtitleCues(plan, minimal)).toEqual([
      { start: 0, end: 2, text: "Welcome back. Let's help!" },
    ]);
    expect(storyboardSubtitleAt(plan, minimal, 2)).toBe("");
    expect(storyboardSubtitleSrt(plan, minimal)).toContain(
      "00:00:00,000 --> 00:00:02,000");
    expect(storyboardSubtitleSrt(plan, minimal)).not.toContain(
      "00:00:02,000 --> 00:00:04,000");
    const blank = minimal.map(beat => ({ ...beat, narration: "" }));
    expect(storyboardSubtitleSrt(plan, blank)).toBe("");
  });

  it("rejects stale, foreign and oversized notes instead of downloading misleading subtitles", () => {
    const plan = planStoryReel(shots, 2);
    expect(() => draftSubtitleCues(plan, [
      beats[0], { ...beats[1], prefix: "new_shot_" },
    ])).toThrow(/Invalid story beat/);
    expect(() => storyboardSubtitleSrt(plan, [beats[0]])).toThrow(/no longer match/);
    expect(() => storyboardSubtitleAt(plan, [
      beats[0], { ...beats[1], narration: "x".repeat(301) },
    ], 0)).toThrow(/Invalid story beat/);
  });
});
