import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { cameraMotionSamples } from "./camera-motion-samples";
import { inspectCameraArtworkCoverage, cameraMotionArtworkChecks } from "./camera-motion-framing";
import { CameraMotionContactSheet } from "./components/CameraMotionContactSheet";
import { newCameraShot } from "./shot-director";
import { validateProject } from "./model";

describe("camera motion contact sheet", () => {
  it("samples three deterministic real scene times strictly within a shot", () => {
    expect(cameraMotionSamples({ start: 0, end: 2 })).toEqual([
      { id: "beginning", label: "Beginning", time: 0 },
      { id: "middle", label: "Middle", time: 1 },
      { id: "end", label: "End", time: 1.995 },
    ]);
    const tiny = cameraMotionSamples({ start: 0.5, end: 0.6 });
    expect(tiny).toHaveLength(3);
    expect(tiny[2].time).toBeLessThan(0.6);
    expect(tiny[2].time).toBeGreaterThan(tiny[1].time);
    expect(cameraMotionSamples({ start: 2, end: 2 })).toEqual([]);
    expect(cameraMotionSamples({ start: Number.NaN, end: 2 })).toEqual([]);
  });

  it("renders actual time-sampled Stage SVGs without modifying source data", () => {
    const project = cameraShotDemo();
    const scene = project.scenes[0];
    const shot = newCameraShot(project, scene, 0);
    const proposed = {
      ...shot, start: 0, end: Math.min(scene.duration, 2),
      style: "move" as const, move: Math.min(scene.duration, 2),
      fromFrame: { x: 400, y: 225, zoom: 1.45 },
      frame: { x: 400, y: 225, zoom: 1 },
      targets: [], follow: false, overlays: true as const,
    };
    const stagedScene = { ...scene, cameraShots: [proposed] };
    const stagedProject = { ...project, scenes: [stagedScene, ...project.scenes.slice(1)] };
    expect(validateProject(stagedProject)).toEqual(stagedProject);
    const before = JSON.stringify(stagedProject);
    const svg = renderToStaticMarkup(createElement(CameraMotionContactSheet, {
      project: stagedProject, scene: stagedScene, shot: proposed,
    }));
    expect(svg.match(/data-camera-shot=/g)).toHaveLength(3);
    expect(svg).toContain('data-camera-zoom="1.45"');
    expect(svg).toContain("Camera motion: beginning, middle");
    expect(svg).toContain('aria-label="Beginning frame"');
    expect(svg).toContain('aria-label="Middle frame"');
    expect(svg).toContain('aria-label="End frame"');
    expect(JSON.stringify(stagedProject)).toBe(before);
  });
});


describe("advisory camera artwork edge review",()=>{
  it("uses exact inverse Stage zoom geometry at all four edges",()=>{
    expect(inspectCameraArtworkCoverage({x:400,y:225,zoom:1.25}).edges).toEqual([]);
    expect(inspectCameraArtworkCoverage({x:345,y:225,zoom:1.25}).edges).toEqual([]);
    expect(inspectCameraArtworkCoverage({x:455,y:225,zoom:1.25}).edges).toEqual([]);
    expect(inspectCameraArtworkCoverage({x:400,y:225,zoom:1}).outsideFraction).toBe(0);
    expect(inspectCameraArtworkCoverage({x:100,y:225,zoom:1}).edges).toEqual(["left"]);
    expect(inspectCameraArtworkCoverage({x:700,y:225,zoom:1}).edges).toEqual(["right"]);
    expect(inspectCameraArtworkCoverage({x:400,y:0,zoom:1}).edges).toEqual(["top"]);
    expect(inspectCameraArtworkCoverage({x:400,y:450,zoom:1}).edges).toEqual(["bottom"]);
    const corner=inspectCameraArtworkCoverage({x:0,y:0,zoom:1});
    expect(corner.edges).toEqual(["left","top"]);
    expect(corner.outsideFraction).toBeCloseTo(0.75);
    expect(inspectCameraArtworkCoverage({x:400,y:225,zoom:0}).outsideFraction).toBe(1);
  });

  it("uses real Stage camera samples and keeps both saved and proposed data intact",()=>{
    const project=cameraShotDemo(), original=JSON.stringify(project);
    const scene=project.scenes[0];
    const shot={...newCameraShot(project,scene,0),style:"move" as const,
      start:0,end:Math.min(scene.duration,2),move:Math.min(scene.duration,2),
      frame:{x:400,y:225,zoom:1},fromFrame:{x:100,y:225,zoom:1},
      targets:[],follow:false,overlays:true as const};
    const planned={...scene,cameraShots:[shot]};
    const checks=cameraMotionArtworkChecks(project,planned,shot);
    expect(checks).toHaveLength(3);
    expect(checks[0].edges).toContain("left");
    expect(checks[1].outsideFraction).toBeGreaterThan(0);
    expect(checks[2].edges).toEqual([]);
    const markup=renderToStaticMarkup(createElement(CameraMotionContactSheet,
      {project,scene:planned,shot}));
    expect(markup).toContain("Artwork-edge check: 2 of 3 frames");
    expect(markup).toContain("Check artwork edge: left");
    expect(markup).toContain("Canvas edges covered");
    expect(JSON.stringify(project)).toBe(original);
    expect(scene.cameraShots).not.toEqual(planned.cameraShots);
    const saved=cameraMotionArtworkChecks(project,scene,shot);
    expect(saved).toHaveLength(3);
  });
});
