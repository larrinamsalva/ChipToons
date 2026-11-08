import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Asset, Project } from "./model";
import { validateProject } from "./model";
import { numberedPngFrames, projectFromFrameAssets } from "./studio-frame-sequence";
import { frameSequenceAssetIdAt, validFrameSequence } from "./frame-sequence-model";
import { rangeArtwork } from "./segments";
import { Stage } from "./components/Stage";
import { starterProject } from "./planner";

const pngs = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUc7vzn4GBgYGJAQoAIWoCQzlp8e8AAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8cEnjPwMDAwMTAxQAAC2QAu3XJMGWAAAAAElFTkSuQmCC",
];
const assets = (): Asset[] => Array.from({ length: 4 }, (_, i) => ({
  id: `png-${i + 1}`,
  name: `frame_${String(i + 1).padStart(4, "0")}.png`,
  type: "image",
  mime: "image/png",
  dataUrl: pngs[i],
  sourceWidth: 2,
  sourceHeight: 2,
}));

function fixture() {
  const project = projectFromFrameAssets(assets(), 2, "Framefield_");
  const scene = project.scenes[0];
  const art = scene.elements[0];
  return { project, scene, art };
}

describe("Portable PNG animation frames", () => {
  it("creates a separate editable cartoon with no old starter characters on screen", () => {
    const { project, scene, art } = fixture();
    expect(scene.elements).toHaveLength(1);
    expect(scene.duration).toBe(2);
    expect(art.kind).toBe("art");
    expect(art.frameSequence).toEqual({ fps: 2, assetIds: assets().map(a => a.id) });
    expect(art.assetId).toBe("png-1");
    expect(project.assets).toHaveLength(4);
    expect(project.creationSource).toBe("image");
    expect(validateProject(project)).toEqual(project);
    expect(starterProject().scenes[0].elements[0].frameSequence).toBeUndefined();
  });

  it("selects the exact numbered PNG deterministically at seek and export times", () => {
    const { project, scene, art } = fixture();
    const expected = [
      [0, "png-1"], [0.499, "png-1"], [0.5, "png-2"],
      [0.999, "png-2"], [1, "png-3"], [1.5, "png-4"], [2, "png-4"],
    ] as const;
    for (const [time, id] of expected) {
      expect(frameSequenceAssetIdAt(art, time)).toBe(id);
      const markup = renderToStaticMarkup(createElement(Stage, {
        project, scene, time, labelled: false,
      }));
      expect(markup).toContain('data-element-id="' + art.id + '"');
      const selected = project.assets.find(asset => asset.id === id)!;
      expect(markup).toContain('href="' + selected.dataUrl + '"');
      for (const other of project.assets.filter(asset => asset.id !== id))
        expect(markup).not.toContain('href="' + other.dataUrl + '"');
    }
    expect(frameSequenceAssetIdAt(art, Number.NaN)).toBe("png-1");
    expect(frameSequenceAssetIdAt(art, -5)).toBe("png-1");
    const all = rangeArtwork(project, { firstScene: 0, lastScene: 0 });
    expect(all.map(a => a.id)).toEqual(["png-1", "png-2", "png-3", "png-4"]);
  });

  it("rejects unsafe or corrupt backup graphs rather than dropping unverified frames", () => {
    const { project, art } = fixture();
    const bad = (sequence: unknown, mutate?: (p: Project) => void) => {
      const copy = structuredClone(project);
      copy.scenes[0].elements[0].frameSequence = sequence as typeof art.frameSequence;
      mutate?.(copy);
      expect(() => validateProject(copy)).toThrow(/invalid or unsupported/);
    };
    bad({ fps: 30, assetIds: art.frameSequence!.assetIds });
    bad({ fps: 2, assetIds: ["png-1", "png-2", "png-2", "png-4"] });
    bad({ fps: 2, assetIds: ["png-1", "png-2", "missing", "png-4"] });
    bad({ fps: 2, assetIds: ["png-2", "png-1", "png-3", "png-4"] });
    bad({ fps: 2, assetIds: art.frameSequence!.assetIds, remoteUrl: "https://example.test" });
    bad(art.frameSequence, p => { p.assets[1].sourceWidth = 2; });
    bad(art.frameSequence, p => { p.assets[1].mime = "image/jpeg"; });
    bad(art.frameSequence, p => { p.scenes[0].duration = 1.5; });
    expect(validFrameSequence(art.frameSequence, art,
      new Map(project.assets.map(asset => [asset.id, asset])), project.scenes[0].duration)).toBe(true);
  });

  it("sorts complete numbered local PNGs and rejects missing/ambiguous selection", () => {
    const file = (name: string, type = "image/png") =>
      new File([new Uint8Array(10)], name, { type });
    const reordered = [file("frame_0003.png"), file("frame_0001.png"),
      file("frame_0004.png"), file("frame_0002.png")];
    expect(numberedPngFrames(reordered).map(f => f.name)).toEqual([
      "frame_0001.png", "frame_0002.png", "frame_0003.png", "frame_0004.png",
    ]);
    expect(numberedPngFrames([file("shot-0000.png"), file("shot-0001.png")]))
      .toHaveLength(2);
    expect(() => numberedPngFrames([file("frame_0001.png"), file("frame_0003.png")]))
      .toThrow(/missing or duplicate/);
    expect(() => numberedPngFrames([file("frame_0001.png"), file("frame_0001.png")]))
      .toThrow(/missing or duplicate/);
    expect(() => numberedPngFrames([file("shot_0001.png"), file("frame_0002.png")]))
      .toThrow(/one frame filename prefix/);
    expect(() => numberedPngFrames([file("frame_001.png"), file("frame_0002.png")]))
      .toThrow(/same number of digits/);
    expect(() => numberedPngFrames([file("frame_0001.png"), file("frame_0002.jpg", "image/jpeg")]))
      .toThrow(/numbered PNG/);
    expect(() => numberedPngFrames([file("frame_0003.png"), file("frame_0004.png")]))
      .toThrow(/start at frame/);
    expect(() => numberedPngFrames([file("frame_0001.png")]))
      .toThrow(/2–24/);
  });
});
