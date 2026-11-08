import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { arrangeShotDirections, groupNumberedShots, projectFromFrameAssetShots } from "./studio-multishot";
import { frameSequenceAssetIdAt } from "./frame-sequence-model";
import { rangeArtwork, exportRange } from "./segments";
import { frameAt } from "./timeline";
import { Stage } from "./components/Stage";
import { starterProject } from "./planner";

const pngs = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
];

function assets(prefix: string, first: number): Asset[] {
  return [0, 1].map(i => ({
    id: `${prefix}-asset-${i + 1}`,
    name: `${prefix}${String(i + 1).padStart(4, "0")}.png`,
    type: "image" as const,
    mime: "image/png" as const,
    dataUrl: pngs[first + i],
    sourceWidth: 2,
    sourceHeight: 2,
  }));
}

function fixture() {
  const original = starterProject();
  const project = projectFromFrameAssetShots([
    { prefix: "shot01_frame_", assets: assets("shot01_frame_", 0) },
    { prefix: "shot02_frame_", assets: assets("shot02_frame_", 2) },
  ], 2);
  return { original, project };
}

describe("Framefield multi-shot storyboard", () => {
  it("groups unordered files into ascending numbered shots and preserves all frames", () => {
    const file = (name: string, type = "image/png") =>
      new File([new Uint8Array(15)], name, { type });
    const input = [
      file("shot10_frame_0002.png"),
      file("shot2_frame_0001.png"),
      file("shot10_frame_0001.png"),
      file("shot2_frame_0002.png"),
    ];
    const shots = groupNumberedShots(input);
    expect(shots.map(shot => shot.prefix)).toEqual(["shot2_frame_", "shot10_frame_"]);
    expect(shots.map(shot => shot.files.map(f => f.name))).toEqual([
      ["shot2_frame_0001.png", "shot2_frame_0002.png"],
      ["shot10_frame_0001.png", "shot10_frame_0002.png"],
    ]);
    expect(groupNumberedShots([...input].reverse()).map(s => s.files.map(f => f.name)))
      .toEqual(shots.map(s => s.files.map(f => f.name)));
  });

  it("rejects gaps, duplicate names, non-PNG, a fourth shot and overbudget collections", () => {
    const file = (name: string, type = "image/png") =>
      new File([new Uint8Array(15)], name, { type });
    const valid = ["a_0001.png", "a_0002.png", "b_0001.png", "b_0002.png"].map(n => file(n));
    expect(groupNumberedShots(valid)).toHaveLength(2);
    expect(() => groupNumberedShots(valid.slice(0, 2))).toThrow(/4–40/);
    expect(() => groupNumberedShots([file("a_0001.png"), file("a_0003.png"),
      ...valid.slice(2)])).toThrow(/missing or duplicate/);
    expect(() => groupNumberedShots([file("a_0001.png"), file("a_0001.png"),
      ...valid.slice(2)])).toThrow(/missing or duplicate/);
    expect(() => groupNumberedShots([file("a_0001.png"), file("a_0002.jpg", "image/jpeg"),
      ...valid.slice(2)])).toThrow(/Name each shot/);
    expect(() => groupNumberedShots([...valid, ...["c", "d"].flatMap(prefix =>
      [file(`${prefix}_0001.png`), file(`${prefix}_0002.png`)])]))
      .toThrow(/2–3 distinct shot/);
    const overflowing = Array.from({ length: 41 }, (_, i) =>
      file(`shot${i < 21 ? "01" : "02"}_frame_${String(i + 1).padStart(4, "0")}.png`));
    expect(() => groupNumberedShots(overflowing)).toThrow(/4–40/);
  });

  it("creates two independently editable scenes with intact local frame assets and accurate scene cuts", () => {
    const { original, project } = fixture();
    const serialized = JSON.stringify(project);
    expect(project.scenes).toHaveLength(2);
    expect(project.assets).toHaveLength(4);
    expect(project.scenes.map(scene => scene.duration)).toEqual([2, 2]);
    expect(project.scenes.map(scene => scene.transition)).toEqual(["cut", "cut"]);
    expect(project.scenes.map(scene => scene.elements.length)).toEqual([1, 1]);
    expect(project.scenes[0].elements[0].frameSequence?.assetIds)
      .toEqual(project.assets.slice(0, 2).map(asset => asset.id));
    expect(project.scenes[1].elements[0].frameSequence?.assetIds)
      .toEqual(project.assets.slice(2).map(asset => asset.id));
    expect(project.scenes[0].elements[0].id).not.toBe(project.scenes[1].elements[0].id);
    expect(validateProject(project)).toEqual(project);
    expect(JSON.stringify(project)).toBe(serialized);
    expect(original.scenes[0].elements[0].frameSequence).toBeUndefined();
    expect(original.assets).toHaveLength(0);
    const overall = exportRange(project);
    expect(overall).toMatchObject({ firstScene: 0, lastScene: 1, start: 0, end: 4 });
    expect(rangeArtwork(project, { firstScene: 0, lastScene: 0 }).map(a => a.id))
      .toEqual(project.assets.slice(0, 2).map(a => a.id));
    expect(rangeArtwork(project, { firstScene: 1, lastScene: 1 }).map(a => a.id))
      .toEqual(project.assets.slice(2).map(a => a.id));
  });

  it("samples different source images on each side of the scene boundary using the real Stage", () => {
    const { project } = fixture();
    for (const [globalTime, sceneIndex, selectedIndex] of [
      [0.05, 0, 0], [0.6, 0, 1], [1.95, 0, 1],
      [2.05, 1, 2], [2.6, 1, 3], [3.95, 1, 3],
    ] as const) {
      const { scene, localTime, index } = frameAt(project, globalTime);
      expect(index).toBe(sceneIndex);
      const art = scene.elements[0];
      const asset = project.assets[selectedIndex];
      expect(frameSequenceAssetIdAt(art, localTime)).toBe(asset.id);
      const svg = renderToStaticMarkup(createElement(Stage, {
        project, scene, time: localTime, labelled: false,
      }));
      expect(svg).toContain(`href="${asset.dataUrl}"`);
      for (const other of project.assets.filter(item => item.id !== asset.id))
        expect(svg).not.toContain(`href="${other.dataUrl}"`);
    }
  });

  it("lets creators direct scene order and short end holds without touching original frames", () => {
    const originalShots = [
      { prefix: "shot01_frame_", assets: assets("shot01_frame_", 0) },
      { prefix: "shot02_frame_", assets: assets("shot02_frame_", 2) },
    ];
    const snapshot = JSON.stringify(originalShots);
    const direction = [
      { prefix: "shot02_frame_", holdSeconds: 1 },
      { prefix: "shot01_frame_", holdSeconds: 2 },
    ] as const;
    const project = projectFromFrameAssetShots(originalShots, 2, direction);
    expect(project.scenes.map(scene => scene.title)).toEqual([
      "Shot 1 · shot02_frame_", "Shot 2 · shot01_frame_",
    ]);
    expect(project.scenes.map(scene => scene.duration)).toEqual([3, 4]);
    expect(project.scenes.map(scene => scene.transition)).toEqual(["cut", "cut"]);
    expect(project.assets.map(asset => asset.name)).toEqual([
      "shot02_frame_0001.png", "shot02_frame_0002.png",
      "shot01_frame_0001.png", "shot01_frame_0002.png",
    ]);
    expect(exportRange(project).end).toBe(7);
    const endOfHeldFirstShot = frameAt(project, 2.8);
    expect(endOfHeldFirstShot.index).toBe(0);
    expect(frameSequenceAssetIdAt(endOfHeldFirstShot.scene.elements[0],
      endOfHeldFirstShot.localTime)).toBe("shot02_frame_-asset-2");
    const nextShot = frameAt(project, 3.05);
    expect(nextShot.index).toBe(1);
    expect(frameSequenceAssetIdAt(nextShot.scene.elements[0],
      nextShot.localTime)).toBe("shot01_frame_-asset-1");
    expect(rangeArtwork(project, { firstScene: 0, lastScene: 0 }).map(a => a.id))
      .toEqual(["shot02_frame_-asset-1", "shot02_frame_-asset-2"]);
    expect(rangeArtwork(project, { firstScene: 1, lastScene: 1 }).map(a => a.id))
      .toEqual(["shot01_frame_-asset-1", "shot01_frame_-asset-2"]);
    expect(validateProject(project)).toEqual(project);
    expect(JSON.stringify(originalShots)).toBe(snapshot);
    const original = projectFromFrameAssetShots(originalShots, 2);
    expect(original.scenes.map(scene => scene.duration)).toEqual([2, 2]);
    expect(original.assets[0].name).toBe("shot01_frame_0001.png");
  });

  it("rejects stale, repeated, foreign or unsafe Shot Director plans before import", () => {
    const shots = [
      { prefix: "shot01_frame_", assets: assets("shot01_frame_", 0) },
      { prefix: "shot02_frame_", assets: assets("shot02_frame_", 2) },
    ];
    const plan = (a: string, b: string, holdSeconds: number = 0) =>
      [
        { prefix: a, holdSeconds },
        { prefix: b, holdSeconds: 0 },
      ] as never;
    expect(arrangeShotDirections(shots).map(item => item.shot.prefix))
      .toEqual(["shot01_frame_", "shot02_frame_"]);
    expect(() => projectFromFrameAssetShots(shots, 2,
      plan("shot01_frame_", "shot01_frame_"))).toThrow(/invalid/);
    expect(() => projectFromFrameAssetShots(shots, 2,
      plan("foreign_", "shot02_frame_"))).toThrow(/invalid/);
    expect(() => projectFromFrameAssetShots(shots, 2,
      plan("shot01_frame_", "shot02_frame_", -1))).toThrow(/invalid/);
    expect(() => projectFromFrameAssetShots(shots, 2,
      plan("shot01_frame_", "shot02_frame_", 4))).toThrow(/invalid/);
    expect(() => projectFromFrameAssetShots(shots, 2,
      [{ prefix: "shot02_frame_", holdSeconds: 0 }])).toThrow(/no longer matches/);
    expect(() => projectFromFrameAssetShots(shots, 2,
      [{ prefix: "shot01_frame_", holdSeconds: 2 },
        { prefix: "shot02_frame_", holdSeconds: Number.NaN as never }]))
      .toThrow(/invalid/);
  });

  it("rejects mismatched dimensions, missing frames and repeated asset IDs during full project validation", () => {
    const shots = [
      { prefix: "a_", assets: assets("a_", 0) },
      { prefix: "b_", assets: assets("b_", 2) },
    ];
    const bad = (mutate: (value: typeof shots) => void) => {
      const copy = structuredClone(shots);
      mutate(copy);
      expect(() => projectFromFrameAssetShots(copy, 2)).toThrow();
    };
    bad(v => { v[1].assets[1].sourceWidth = 3; });
    bad(v => { v[0].assets[0].id = ""; });
    bad(v => { v[1].assets[0].id = v[0].assets[0].id; });
    bad(v => { v[1].assets[1].mime = "image/jpeg"; });
    expect(() => projectFromFrameAssetShots(shots, 24 as never)).toThrow(/supported/);
    expect(() => projectFromFrameAssetShots([shots[0]], 2)).toThrow(/2–3/);
  });
});
