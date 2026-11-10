import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { cameraMotionSamples } from "./camera-motion-samples";
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
