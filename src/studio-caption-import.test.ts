import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import type { ShotBeat } from "./studio-shot-beats";
import { attachStoryboardCaptionDrafts, verifiedImportCaptionCues } from "./studio-caption-import";
import { srt, sceneCaptionText } from "./production";
import type { SubtitleTimingPlan, SubtitleDraftAdjustment } from "./studio-subtitle-drafts";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const image = (prefix: string, number: number): Asset => ({
  id: `${prefix}-asset-${number}`, name: `${prefix}${String(number).padStart(4,"0")}.png`,
  mime: "image/png", type: "image", dataUrl: png, sourceWidth: 2, sourceHeight: 2,
});
const shots = [
  { prefix: "shot01_frame_", assets: [image("shot01_frame_", 1), image("shot01_frame_", 2)] },
  { prefix: "shot02_frame_", assets: [image("shot02_frame_", 1), image("shot02_frame_", 2)] },
];
const order = [
  { prefix: "shot02_frame_", holdSeconds: 1 as const },
  { prefix: "shot01_frame_", holdSeconds: 0 as const },
];
const beats: ShotBeat[] = [
  { prefix: "shot01_frame_", title: "Scout", action: "", narration: "Scout checks the wheel." },
  { prefix: "shot02_frame_", title: "Helper Jo", action: "", narration: "Original Jo narration." },
];
const adjustments: SubtitleDraftAdjustment[] = [
  { prefix: "shot02_frame_", first: "Jo checks.", second: "Jo explains the next step.", splitPercent: 40 },
];
const timing: SubtitleTimingPlan = {
  shots: [
    { prefix: "shot02_frame_", start: 0, duration: 3 },
    { prefix: "shot01_frame_", start: 3, duration: 2 },
  ],
  duration: 5,
};

describe("Opt-in storyboard captions added only to a new cartoon", () => {
  it("preserves real scene and audio timing and produces the exact independent .srt", () => {
    const original = projectFromFrameAssetShots(shots, 2, order, beats);
    const sourceSnapshot = JSON.stringify(original);
    expect(original.captions).toHaveLength(0);
    const created = attachStoryboardCaptionDrafts(
      original, ["shot02_frame_", "shot01_frame_"], beats, adjustments);
    expect(created.captions).toHaveLength(3);
    expect(created.captions.map(c => [c.sceneId, c.start, c.end, c.text]))
      .toEqual([
        [created.scenes[0].id, 0, 1.2, "Jo checks."],
        [created.scenes[0].id, 1.2, 3, "Jo explains the next step."],
        [created.scenes[1].id, 0, 2, "Scout checks the wheel."],
      ]);
    expect(srt(created)).toBe(
      "1\n00:00:00,000 --> 00:00:01,200\nJo checks.\n\n" +
      "2\n00:00:01,200 --> 00:00:03,000\nJo explains the next step.\n\n" +
      "3\n00:00:03,000 --> 00:00:05,000\nScout checks the wheel.\n");
    expect(sceneCaptionText(created, created.scenes[0], 0.5)).toBe("Jo checks.");
    expect(sceneCaptionText(created, created.scenes[0], 1.2)).toBe("Jo explains the next step.");
    expect(sceneCaptionText(created, created.scenes[1], 0.2)).toBe("Scout checks the wheel.");
    expect(created.scenes.map(scene => scene.duration)).toEqual([3,2]);
    expect(created.scenes.map(scene => scene.narration))
      .toEqual(original.scenes.map(scene => scene.narration));
    expect(created.scenes.map(scene => scene.elements[0].frameSequence))
      .toEqual(original.scenes.map(scene => scene.elements[0].frameSequence));
    expect(created.audioClips).toEqual(original.audioClips);
    expect(created.audioAssets).toEqual(original.audioAssets);
    expect(JSON.stringify(original)).toBe(sourceSnapshot);
    expect(validateProject(created)).toEqual(created);
    expect(JSON.parse(JSON.stringify(created)).captions).toEqual(created.captions);
  });

  it("keeps blank captions blank without modifying existing source projects", () => {
    const original = projectFromFrameAssetShots(shots, 2, order, beats);
    const one = attachStoryboardCaptionDrafts(original,
      ["shot02_frame_", "shot01_frame_"], beats, [
        { prefix: "shot02_frame_", first: "", second: "Later!", splitPercent: 50 },
        { prefix: "shot01_frame_", first: "", second: "", splitPercent: 50 },
      ]);
    expect(one.captions).toHaveLength(1);
    expect(one.captions[0]).toMatchObject({
      sceneId: one.scenes[0].id, start: 1.5, end: 3, text: "Later!",
    });
    expect(original.captions).toEqual([]);
  });

  it("rejects overlong editor captions rather than silently truncating words", () => {
    const overlong: ShotBeat[] = [
      { ...beats[0], narration: "x".repeat(281) }, beats[1],
    ];
    expect(() => verifiedImportCaptionCues(timing, overlong, adjustments))
      .toThrow(/280 characters/);
    expect(() => attachStoryboardCaptionDrafts(
      projectFromFrameAssetShots(shots,2,order,overlong),
      ["shot02_frame_", "shot01_frame_"], overlong, adjustments,
    )).toThrow(/280 characters/);
    expect(() => verifiedImportCaptionCues(timing, beats, [
      { ...adjustments[0], prefix: "not_selected_" },
    ])).toThrow(/Invalid subtitle/);
    const original = projectFromFrameAssetShots(shots, 2, order, beats);
    expect(() => attachStoryboardCaptionDrafts(
      original, ["shot02_frame_", "shot02_frame_"], beats, adjustments,
    )).toThrow(/Caption shots/);
    expect(original.captions).toHaveLength(0);
  });
});
