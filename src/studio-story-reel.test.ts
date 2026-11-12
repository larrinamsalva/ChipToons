import { describe, expect, it } from "vitest";
import { planStoryReel, storyReelFrameAt } from "./studio-story-reel";
import { projectFromFrameAssetShots } from "./studio-multishot";
import type { NumberedShot, ShotDirection } from "./studio-multishot";
import type { Asset } from "./model";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
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

describe("Local silent playable Shot Director reel", () => {
  it("samples original numbered PNGs at the same exact times as real exported scenes", () => {
    const direction: ShotDirection[] = [
      { prefix: "shot02_frame_", holdSeconds: 1 },
      { prefix: "shot01_frame_", holdSeconds: 2 },
    ];
    const reel = planStoryReel(shots, 2, direction);
    expect(reel.duration).toBe(7);
    expect(reel.shots.map(item => [item.prefix, item.start, item.duration]))
      .toEqual([["shot02_frame_", 0, 3], ["shot01_frame_", 3, 4]]);
    const samples = [
      [0, 0, 0, false],
      [0.49, 0, 0, false],
      [0.5, 0, 1, false],
      [1.5, 0, 1, true],
      [2.95, 0, 1, true],
      [3, 1, 0, false],
      [3.5, 1, 1, false],
      [4.25, 1, 1, true],
      [6.99, 1, 1, true],
      [7, 1, 1, true],
    ] as const;
    for (const [time, shotIndex, frameIndex, holding] of samples) {
      const frame = storyReelFrameAt(reel, time);
      expect(frame.shotIndex).toBe(shotIndex);
      expect(frame.frameIndex).toBe(frameIndex);
      expect(frame.holding).toBe(holding);
      expect(frame.frame).toBe(
        shots.find(shot => shot.prefix === reel.shots[shotIndex].prefix)!.files[frameIndex]);
      expect(storyReelFrameAt(reel, time)).toEqual(frame);
    }
    expect(storyReelFrameAt(reel, -100).frame.name).toBe("shot02_frame_0001.png");
    expect(storyReelFrameAt(reel, Number.NaN).frame.name).toBe("shot02_frame_0001.png");
    expect(storyReelFrameAt(reel, 1000).frame.name).toBe("shot01_frame_0002.png");

    const assets = shots.map(shot => ({
      prefix: shot.prefix,
      assets: shot.files.map((file, i): Asset => ({
        id: `${shot.prefix}-${i}`, name: file.name, mime: "image/png",
        type: "image", dataUrl: png, sourceWidth: 2, sourceHeight: 2,
      })),
    }));
    const actual = projectFromFrameAssetShots(assets, 2, direction);
    expect(actual.scenes.map(scene => scene.duration))
      .toEqual(reel.shots.map(shot => shot.duration));
    expect(actual.scenes.map(scene => scene.title))
      .toEqual(reel.shots.map((shot, i) => `Shot ${i + 1} · ${shot.prefix}`));
  });

  it("preserves unmodified default shot order and rejects invalid rates or stale plans", () => {
    const original = shots.map(s => s.files.map(f => f.name));
    const defaultPlan = planStoryReel(shots, 2);
    expect(defaultPlan.shots.map(shot => shot.prefix))
      .toEqual(["shot01_frame_", "shot02_frame_"]);
    expect(defaultPlan.duration).toBe(4);
    expect(storyReelFrameAt(defaultPlan, 2).frame.name)
      .toBe("shot02_frame_0001.png");
    expect(() => planStoryReel(shots, 30)).toThrow(/supported/);
    expect(() => planStoryReel(shots.slice(0, 1), 2)).toThrow(/2–8/);
    expect(() => planStoryReel(shots, 2, [
      { prefix: "shot01_frame_", holdSeconds: 0 },
      { prefix: "shot01_frame_", holdSeconds: 0 },
    ])).toThrow(/invalid/);
    expect(() => planStoryReel(shots, 2, [
      { prefix: "shot01_frame_", holdSeconds: 0 },
      { prefix: "outside_", holdSeconds: 0 },
    ])).toThrow(/invalid/);
    expect(shots.map(s => s.files.map(f => f.name))).toEqual(original);
  });
});
