import { describe, expect, it } from "vitest";
import type { NumberedShot } from "./studio-multishot";
import type { ShotBeat } from "./studio-shot-beats";
import { planStoryReel } from "./studio-story-reel";
import {
  draftSubtitleCues, storyboardSubtitleAt, storyboardSubtitleSrt,
  suggestedSubtitleAdjustment, validateSubtitleAdjustments,
} from "./studio-subtitle-drafts";
import type { SubtitleDraftAdjustment } from "./studio-subtitle-drafts";

const shots: NumberedShot[] = [
  { prefix: "shot01_frame_", files: [
    new File(["1"], "shot01_frame_0001.png", { type: "image/png" }),
    new File(["2"], "shot01_frame_0002.png", { type: "image/png" }),
  ] },
  { prefix: "shot02_frame_", files: [
    new File(["3"], "shot02_frame_0001.png", { type: "image/png" }),
    new File(["4"], "shot02_frame_0002.png", { type: "image/png" }),
  ] },
];
const beats: ShotBeat[] = [
  { prefix: "shot01_frame_", title: "Scout", action: "", narration: "Original Scout narration." },
  { prefix: "shot02_frame_", title: "Jo", action: "", narration: "Original Jo narration." },
];

describe("Optional, editable subtitle cue timing", () => {
  it("splits a shot into accurate millisecond SRT cues after reorder and hold", () => {
    const plan = planStoryReel(shots, 2, [
      { prefix: "shot02_frame_", holdSeconds: 1 },
      { prefix: "shot01_frame_", holdSeconds: 0 },
    ]);
    const adjustment: SubtitleDraftAdjustment = {
      prefix: "shot02_frame_", first: "Jo checks.", second: "Jo shows a safe fix.",
      splitPercent: 40,
    };
    const before = JSON.stringify(beats);
    expect(draftSubtitleCues(plan, beats, [adjustment])).toEqual([
      { start: 0, end: 1.2, text: "Jo checks." },
      { start: 1.2, end: 3, text: "Jo shows a safe fix." },
      { start: 3, end: 5, text: "Original Scout narration." },
    ]);
    expect(storyboardSubtitleSrt(plan, beats, [adjustment])).toBe(
      "1\n00:00:00,000 --> 00:00:01,200\nJo checks.\n\n" +
      "2\n00:00:01,200 --> 00:00:03,000\nJo shows a safe fix.\n\n" +
      "3\n00:00:03,000 --> 00:00:05,000\nOriginal Scout narration.\n",
    );
    expect(storyboardSubtitleAt(plan, beats, 1.199, [adjustment])).toBe("Jo checks.");
    expect(storyboardSubtitleAt(plan, beats, 1.2, [adjustment])).toBe("Jo shows a safe fix.");
    expect(storyboardSubtitleAt(plan, beats, 2.999, [adjustment])).toBe("Jo shows a safe fix.");
    expect(storyboardSubtitleAt(plan, beats, 3, [adjustment])).toBe("Original Scout narration.");
    expect(JSON.stringify(beats)).toBe(before);
    expect(shots[1].files[0].name).toBe("shot02_frame_0001.png");
    expect(plan.duration).toBe(5);
  });

  it("respects deliberate blank cues and has exact old behavior when customized captions are reset", () => {
    const plan = planStoryReel(shots, 2);
    const override: SubtitleDraftAdjustment = {
      prefix: "shot01_frame_", first: "", second: "After a pause.", splitPercent: 50,
    };
    expect(draftSubtitleCues(plan, beats, [override])).toEqual([
      { start: 1, end: 2, text: "After a pause." },
      { start: 2, end: 4, text: "Original Jo narration." },
    ]);
    expect(storyboardSubtitleAt(plan, beats, 0.9, [override])).toBe("");
    expect(storyboardSubtitleAt(plan, beats, 1, [override])).toBe("After a pause.");
    expect(storyboardSubtitleSrt(plan, beats, [])).toBe(storyboardSubtitleSrt(plan, beats));
    const defaultCaption = suggestedSubtitleAdjustment("shot01_frame_", beats[0].narration);
    expect(defaultCaption).toEqual({
      prefix: "shot01_frame_", first: beats[0].narration, second: "",
      splitPercent: 50,
    });
    expect(draftSubtitleCues(plan, beats, [defaultCaption]))
      .toEqual(draftSubtitleCues(plan, beats));
    expect(draftSubtitleCues(plan, beats, [{ ...defaultCaption, first: "" }]))
      .toEqual([{ start: 2, end: 4, text: beats[1].narration }]);
  });

  it("rejects stale, foreign, duplicated or malformed edits before creating an SRT", () => {
    const plan = planStoryReel(shots, 2);
    const base = suggestedSubtitleAdjustment("shot01_frame_", "Hello.");
    const invalid = (edits: unknown) =>
      expect(() => validateSubtitleAdjustments(plan, edits as SubtitleDraftAdjustment[]))
        .toThrow(/subtitle/i);
    invalid([base, base]);
    invalid([{ ...base, prefix: "someone_else_" }]);
    invalid([{ ...base, splitPercent: 0 }]);
    invalid([{ ...base, splitPercent: 25.5 }]);
    invalid([{ ...base, splitPercent: 81 }]);
    invalid([{ ...base, first: "x".repeat(301) }]);
    invalid([{ ...base, second: "bad\u0000text" }]);
    invalid([{ ...base, remote: "https://example.org" }]);
    invalid([null]);
    expect(validateSubtitleAdjustments(plan, [base]).get(base.prefix)?.first).toBe("Hello.");
    expect(() => storyboardSubtitleSrt(plan, beats, [
      { ...base, prefix: "other_" },
    ])).toThrow(/Invalid subtitle/);
  });
});
