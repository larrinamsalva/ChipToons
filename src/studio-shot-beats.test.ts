import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { emptyShotBeat, validateShotBeats } from "./studio-shot-beats";
import type { ShotBeat } from "./studio-shot-beats";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const image = (prefix: string, number: number): Asset => ({
  id: `${prefix}-asset-${number}`,
  name: `${prefix}${String(number).padStart(4, "0")}.png`,
  mime: "image/png",
  type: "image",
  dataUrl: png,
  sourceWidth: 2,
  sourceHeight: 2,
});
const shots = [
  { prefix: "shot01_frame_", assets: [image("shot01_frame_", 1), image("shot01_frame_", 2)] },
  { prefix: "shot02_frame_", assets: [image("shot02_frame_", 1), image("shot02_frame_", 2)] },
];
const beats: ShotBeat[] = [
  {
    prefix: "shot01_frame_",
    title: "Scout checks the bicycle",
    action: "Scout checks the tire and asks for help.",
    narration: "First, we check our bike before we ride.",
  },
  {
    prefix: "shot02_frame_",
    title: "Jo shows how to help",
    action: "Helper Jo points to the loose part.",
    narration: "We ask a grown-up when a repair needs extra help.",
  },
];

describe("Optional multi-shot story beats", () => {
  it("keeps notes attached to their shots after reorder and preserves actual frame timing", () => {
    const saved = JSON.stringify(shots);
    const order = [
      { prefix: "shot02_frame_", holdSeconds: 1 as const },
      { prefix: "shot01_frame_", holdSeconds: 2 as const },
    ];
    const project = projectFromFrameAssetShots(shots, 2, order, beats);
    expect(project.scenes.map(scene => scene.title)).toEqual([
      "Jo shows how to help", "Scout checks the bicycle",
    ]);
    expect(project.scenes.map(scene => scene.action)).toEqual([
      "Helper Jo points to the loose part.",
      "Scout checks the tire and asks for help.",
    ]);
    expect(project.scenes.map(scene => scene.narration)).toEqual([
      "We ask a grown-up when a repair needs extra help.",
      "First, we check our bike before we ride.",
    ]);
    expect(project.scenes.map(scene => scene.duration)).toEqual([3, 4]);
    expect(project.scenes.map(scene => scene.elements[0].frameSequence!.assetIds))
      .toEqual([shots[1].assets.map(a => a.id), shots[0].assets.map(a => a.id)]);
    expect(project.scenes.every(scene => scene.audioRefs.length === 0)).toBe(true);
    expect(project.assets.map(a => a.id))
      .toEqual([...shots[1].assets, ...shots[0].assets].map(a => a.id));
    expect(validateProject(project)).toEqual(project);
    expect(JSON.stringify(shots)).toBe(saved);
    expect(JSON.parse(JSON.stringify(project)).scenes.map(
      (scene: { narration: string }) => scene.narration,
    )).toEqual(project.scenes.map(scene => scene.narration));
  });

  it("preserves original one-shot/multi-shot scene text when no beats are supplied", () => {
    const legacy = projectFromFrameAssetShots(shots, 2);
    const blank = projectFromFrameAssetShots(shots, 2,
      undefined, shots.map(shot => emptyShotBeat(shot.prefix)));
    expect(blank.scenes.map(scene => scene.narration))
      .toEqual(legacy.scenes.map(scene => scene.narration));
    expect(blank.scenes.map(scene => scene.title))
      .toEqual(legacy.scenes.map(scene => scene.title));
    expect(blank.scenes.map(scene => scene.action))
      .toEqual(legacy.scenes.map(scene => scene.action));
    expect(blank.scenes.map(scene => scene.duration))
      .toEqual(legacy.scenes.map(scene => scene.duration));
    expect(blank.scenes.map(scene => scene.elements[0].frameSequence))
      .toEqual(legacy.scenes.map(scene => scene.elements[0].frameSequence));
  });

  it("rejects stale, duplicated, foreign, oversized or malformed notes", () => {
    const invalid = (notes: unknown) =>
      expect(() => validateShotBeats(shots, notes as ShotBeat[])).toThrow(/beat|notes|shots/i);
    invalid([beats[0]]);
    invalid([beats[0], beats[0]]);
    invalid([{ ...beats[0], prefix: "different_" }, beats[1]]);
    invalid([{ ...beats[0], narration: "n".repeat(301) }, beats[1]]);
    invalid([{ ...beats[0], action: "a".repeat(241) }, beats[1]]);
    invalid([{ ...beats[0], title: "t".repeat(81) }, beats[1]]);
    invalid([{ ...beats[0], title: "bad\u0000" }, beats[1]]);
    invalid([{ ...beats[0], extraRemoteUrl: "https://invalid.example" }, beats[1]]);
    invalid([null, beats[1]]);
    const good = validateShotBeats(shots, beats);
    expect(good.size).toBe(2);
    expect(good.get("shot02_frame_")?.narration).toBe(beats[1].narration);
    expect(() => projectFromFrameAssetShots(shots, 2, undefined,
      [{ ...beats[0], narration: "x".repeat(301) }, beats[1]])).toThrow(/Invalid story beat/);
  });
});
