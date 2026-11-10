import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { shotIssue } from "./camera-shots";
import { stageCameraAt } from "./timeline";
import { canStartFramefieldCinematicPush, framefieldGentleCinematicPush } from "./framefield-cinematic-push";
import { starterProject } from "./planner";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const asset = (prefix: string, i: number): Asset => ({
  id: prefix + i, name: prefix + i + ".png", type: "image",
  mime: "image/png", dataUrl: png, sourceWidth: 2, sourceHeight: 2,
});
function fixture() {
  const a = "shot01_frame_", b = "shot02_frame_";
  return projectFromFrameAssetShots([
    { prefix: a, assets: [asset(a, 1), asset(a, 2)] },
    { prefix: b, assets: [asset(b, 1), asset(b, 2)] },
  ], 2);
}
describe("Optional original-PNG cinematic camera push-in", () => {
  it("produces valid editable shots without touching the underlying PNGs or audio", () => {
    const p = fixture(), before = JSON.stringify(p), scene = p.scenes[0];
    expect(canStartFramefieldCinematicPush(p, scene)).toBe(true);
    const shot = framefieldGentleCinematicPush(p, scene);
    expect(shot).toMatchObject({
      style: "move", start: 0, end: scene.duration,
      move: scene.duration,
      frame: { x: 400, y: 225, zoom: 1.35 },
      targets: [], follow: false,
    });
    expect(shotIssue([shot], scene)).toBeUndefined();
    expect(JSON.stringify(p)).toBe(before);
    const changed = structuredClone(p);
    changed.scenes[0].cameraShots = [shot];
    expect(validateProject(changed)).toEqual(changed);
    const start = stageCameraAt(changed, changed.scenes[0], 0);
    const middle = stageCameraAt(changed, changed.scenes[0], scene.duration / 2);
    const end = stageCameraAt(changed, changed.scenes[0], scene.duration - 0.01);
    expect(start.zoom).toBeCloseTo(1);
    expect(middle.zoom).toBeGreaterThan(1);
    expect(middle.zoom).toBeLessThan(1.35);
    expect(end.zoom).toBeGreaterThan(1.34);
    expect(changed.scenes[0].elements).toEqual(scene.elements);
    expect(changed.scenes[1]).toEqual(p.scenes[1]);
  });
  it("refuses to overwrite authored camera tracks, existing shots and non-PNG projects", () => {
    const p = fixture(), scene = p.scenes[0];
    scene.cameraShots = [framefieldGentleCinematicPush(p, scene)];
    expect(canStartFramefieldCinematicPush(p, scene)).toBe(false);
    expect(() => framefieldGentleCinematicPush(p, scene)).toThrow(/without authored/);
    scene.cameraShots = undefined;
    scene.cameraAnimation = { keyframes: [], followId: scene.elements[0].id };
    expect(canStartFramefieldCinematicPush(p, scene)).toBe(false);
    const regular = starterProject();
    expect(canStartFramefieldCinematicPush(regular, regular.scenes[0])).toBe(false);
  });
});
