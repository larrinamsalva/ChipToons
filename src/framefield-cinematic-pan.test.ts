import { describe, expect, it } from "vitest";
import { validateProject } from "./model";
import type { Asset } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { framefieldCinematicPanFrame, framefieldGentleCinematicPan,
  canStartFramefieldCinematicPush } from "./framefield-cinematic-push";
import { shotIssue } from "./camera-shots";
import { stageCameraAt } from "./timeline";
import { starterProject } from "./planner";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const asset = (prefix: string, i: number): Asset => ({
  id: prefix + i, name: prefix + i + ".png", type: "image",
  mime: "image/png", dataUrl: png, sourceWidth: 2, sourceHeight: 2,
});
const fixture = () => projectFromFrameAssetShots([
  { prefix: "shot01_", assets: [asset("shot01_",1),asset("shot01_",2)] },
  { prefix: "shot02_", assets: [asset("shot02_",1),asset("shot02_",2)] },
], 2);

describe("Optional cinematic side-pan of genuine imported PNG scenes", () => {
  it.each([
    ["left",345],["right",455],
  ] as const)("creates a valid %s camera pan without changing a saved project", (direction, x) => {
    const p = fixture(), before = JSON.stringify(p), scene = p.scenes[1];
    expect(canStartFramefieldCinematicPush(p, scene)).toBe(true);
    expect(framefieldCinematicPanFrame(direction)).toEqual({x, y:225, zoom:1.25});
    const shot = framefieldGentleCinematicPan(p, scene, direction);
    expect(shotIssue([shot], scene)).toBeUndefined();
    expect(shot).toMatchObject({
      style:"move",start:0,end:scene.duration,move:scene.duration,
      frame:{x,y:225,zoom:1.25},targets:[],follow:false,
    });
    expect(JSON.stringify(p)).toBe(before);
    const next = structuredClone(p);
    next.scenes[1].cameraShots=[shot];
    expect(validateProject(next)).toEqual(next);
    const initial = stageCameraAt(next,next.scenes[1],0);
    const halfway = stageCameraAt(next,next.scenes[1],scene.duration/2);
    const nearEnd = stageCameraAt(next,next.scenes[1],scene.duration-0.001);
    expect(initial.x).toBeCloseTo(400);
    expect(initial.zoom).toBeCloseTo(1);
    expect(halfway.x).toBeGreaterThan(Math.min(400,x));
    expect(halfway.x).toBeLessThan(Math.max(400,x));
    expect(halfway.zoom).toBeGreaterThan(1);
    expect(halfway.zoom).toBeLessThan(1.25);
    expect(nearEnd.x).toBeCloseTo(x,1);
    expect(nearEnd.zoom).toBeGreaterThan(1.249);
    expect(next.scenes[1].elements).toEqual(scene.elements);
    expect(next.scenes[0]).toEqual(p.scenes[0]);
  });
  it("refuses existing work, invalid direction, and non-imported projects", () => {
    const p=fixture(), scene=p.scenes[0];
    expect(() => framefieldCinematicPanFrame("up" as "left")).toThrow(/left or right/);
    const old=framefieldGentleCinematicPan(p,scene,"left");
    scene.cameraShots=[old];
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(false);
    expect(() => framefieldGentleCinematicPan(p,scene,"right")).toThrow(/without authored/);
    scene.cameraShots=undefined;
    scene.cameraAnimation={ keyframes:[], followId:scene.elements[0].id };
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(false);
    const regular=starterProject();
    expect(canStartFramefieldCinematicPush(regular,regular.scenes[0])).toBe(false);
  });
});
