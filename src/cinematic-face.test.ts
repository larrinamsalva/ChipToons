import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicFaceAt } from "./cinematic-face";
import { PuppetArt } from "./components/PuppetArt";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementAt, sceneFramesAt } from "./timeline";

function fixture() {
  const project = littleFixersFullBodyPilot();
  const scene = project.scenes[0];
  const actor = scene.elements.find(e => e.characterId)!;
  const frames = sceneFramesAt(project, scene, 6);
  return { project, scene, actor, frames, frame: frames.get(actor.id)! };
}

describe("Cinematic Storybook facial acting", () => {
  it("is opt-in, non-destructive and disabled in calm authoring previews", () => {
    const { project, scene, actor, frames, frame } = fixture();
    expect(cinematicFaceAt(project, scene, actor, frame, frames, 6, false)).toBeUndefined();
    project.visualStyle = "storybook-cinematic";
    const snapshot = JSON.stringify(project);
    const first = cinematicFaceAt(project, scene, actor, frame, frames, 6, false);
    expect(first).toBeDefined();
    expect(first).toEqual(cinematicFaceAt(project, scene, actor, frame, frames, 6, false));
    expect(cinematicFaceAt(project, scene, actor, frame, frames, 6, true)).toBeUndefined();
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("glances toward a nearby prop and varies attention instead of sliding pupils continuously", () => {
    const { project, scene, actor } = fixture();
    project.visualStyle = "storybook-cinematic";
    const target = scene.elements.find(e => e.kind === "prop")!;
    const sample = (dx: number, time: number) => {
      const frame = elementAt(actor, time, scene.duration, true);
      const look = new Map([
        [actor.id, frame],
        [target.id, { ...elementAt(target, time, scene.duration, true),
          x: frame.x + dx, y: frame.y - 55 }],
      ]);
      return cinematicFaceAt(project, { elements: [actor, target] }, actor, frame, look, time, false)!;
    };
    const times = Array.from({ length: 108 }, (_, index) => index * 0.05);
    const strongest = times.reduce((best, time) =>
      Math.abs(sample(160, time).x) > Math.abs(sample(160, best).x) ? time : best, 0);
    expect(sample(160, strongest).x).toBeGreaterThan(1.5);
    expect(sample(-160, strongest).x).toBeLessThan(-1.5);
    const faces = times.map(time => sample(160, time));
    expect(faces.some(face => Math.abs(face.x) < 0.3)).toBe(true);
    expect(faces.every(face => Math.abs(face.x) <= 2.6 && Math.abs(face.y) <= 1.6 &&
      face.brow >= 0 && face.brow <= 1.9)).toBe(true);
  });

  it("honors blink-off and leaves image-backed eyes alone", () => {
    const { project, scene, actor, frame, frames } = fixture();
    project.visualStyle = "storybook-cinematic";
    const noBlink = { ...actor, animation: { ...actor.animation!, blink: false } };
    for (let i = 0; i < 108; i++) {
      const face = cinematicFaceAt(project, scene, noBlink, { ...frame, blink: false },
        frames, i * 0.05, false);
      expect(face?.blink).toBe(false);
    }
    const original = project.characters[0];
    project.characters[0] = { ...original, puppet: { ...original.puppet!,
      parts: [...original.puppet!.parts, {
        id: "painted-eyes", role: "eyes", parentId: "head", x: 0, y: 0,
        pivotX: 0, pivotY: 0, width: 25, height: 14, assetId: "external-art",
      }] } };
    expect(cinematicFaceAt(project, scene, actor, frame, frames, 2.5, false)).toBeUndefined();
  });

  it("renders moving generated pupils without changing Classic faces or authored mouth shapes", () => {
    const { project } = fixture();
    const character = project.characters[0];
    const regular = renderToStaticMarkup(createElement(PuppetArt, {
      character, assets: [], emotion: "happy", premium: false,
    }));
    const polished = renderToStaticMarkup(createElement(PuppetArt, {
      character, assets: [], emotion: "happy", mouth: "smile", premium: true,
      gaze: { x: 1.6, y: -0.8, brow: 1.25, blink: false },
    }));
    expect(regular).not.toContain("data-cinematic-pupil");
    expect(polished).toContain('data-cinematic-pupil="true"');
    expect(polished).toContain('data-eye-highlight="premium"');
    expect(polished).toContain("M-9 12q9 13 18 0");
  });
});
