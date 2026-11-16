import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicFaceAt } from "./cinematic-face";
import { PuppetArt } from "./components/PuppetArt";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementAt, elementBase, sceneFramesAt } from "./timeline";
import { starterProject } from "./demo-starter";
import { sunnyRig } from "./puppet-model";
import { uid } from "./model";

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

  it("lets eyes lead an explicitly authored walk without moving saved artwork or overriding Classic", () => {
    const project = starterProject();
    const scene = project.scenes[0];
    scene.duration = 5;
    const actor = scene.elements[0];
    scene.elements = [actor];
    project.characters[0].puppet = sunnyRig();
    actor.x = 170;
    actor.y = 365;
    actor.motion = "still";
    actor.animation = {
      blink: true, idle: "none",
      keyframes: [
        { ...elementBase(actor), id: uid(), time: 0, easing: "linear", x: 170 },
        { ...elementBase(actor), id: uid(), time: 1, easing: "linear", x: 170 },
        { ...elementBase(actor), id: uid(), time: 3, easing: "linear", x: 290 },
        { ...elementBase(actor), id: uid(), time: 4, easing: "linear", x: 290 },
      ],
    };
    const source = JSON.stringify(project);
    const classicFrame = sceneFramesAt(project, scene, .85);
    expect(cinematicFaceAt(project, scene, actor, classicFrame.get(actor.id)!, classicFrame, .85, false))
      .toBeUndefined();
    project.visualStyle = "storybook-cinematic";
    const frames = sceneFramesAt(project, scene, .85);
    const glance = cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames, .85, false)!;
    expect(glance.x).toBeGreaterThan(1.5);
    expect(glance.x).toBeLessThanOrEqual(2.6);
    expect(cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames, .85, false))
      .toEqual(glance);
    expect(cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames, .85, true))
      .toBeUndefined();
    const moving = sceneFramesAt(project, scene, 1.5);
    const during = cinematicFaceAt(project, scene, actor, moving.get(actor.id)!, moving, 1.5, false)!;
    expect(Math.abs(during.x)).toBeLessThan(.4);
    expect(sceneFramesAt(project, scene, .85).get(actor.id)!.x).toBeCloseTo(170, 6);
    project.visualStyle = undefined;
    expect(JSON.stringify(project)).toEqual(source);
  });

  it("lets eyes finish an authored walk without changing the original position or recording", () => {
    const project = starterProject();
    const scene = project.scenes[0];
    scene.duration = 5;
    const actor = scene.elements[0];
    scene.elements = [actor];
    project.characters[0].puppet = sunnyRig();
    actor.x = 170;
    actor.y = 365;
    actor.motion = "still";
    actor.animation = {
      blink: true, idle: "none",
      keyframes: [
        { ...elementBase(actor), id: uid(), time: 0, easing: "linear", x: 170 },
        { ...elementBase(actor), id: uid(), time: 1, easing: "linear", x: 170 },
        { ...elementBase(actor), id: uid(), time: 3, easing: "linear", x: 290 },
        { ...elementBase(actor), id: uid(), time: 4, easing: "linear", x: 290 },
      ],
    };
    const original = JSON.stringify(project);
    const classic = sceneFramesAt(project, scene, 3.2);
    expect(cinematicFaceAt(project, scene, actor, classic.get(actor.id)!, classic, 3.2, false))
      .toBeUndefined();
    project.visualStyle = "storybook-cinematic";
    const frames = sceneFramesAt(project, scene, 3.2);
    const finish = cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames, 3.2, false)!;
    expect(finish.x).toBeGreaterThan(.9);
    expect(finish.x).toBeLessThanOrEqual(2.6);
    expect(frames.get(actor.id)!.x).toBeCloseTo(290, 6);
    expect(cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames, 3.2, false))
      .toEqual(finish);
    const later = sceneFramesAt(project, scene, 4.2);
    const relaxed = cinematicFaceAt(project, scene, actor, later.get(actor.id)!, later, 4.2, false)!;
    expect(Math.abs(relaxed.x)).toBeLessThan(.4);
    expect(cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames, 3.2, true))
      .toBeUndefined();
    project.visualStyle = undefined;
    expect(JSON.stringify(project)).toBe(original);
  });

  it("turnaround pupils follow the new authored direction, even when stop-arrival looks still point backward", () => {
    const project = starterProject();
    const scene = project.scenes[0];
    scene.duration = 5;
    const actor = scene.elements[0];
    scene.elements = [actor];
    project.characters[0].puppet = sunnyRig();
    actor.x = 170;
    actor.y = 365;
    actor.motion = "still";
    actor.animation = {
      blink: true, idle: "none",
      keyframes: [
        { ...elementBase(actor), id: uid(), time: 0, easing: "linear", x: 170 },
        { ...elementBase(actor), id: uid(), time: 2, easing: "linear", x: 290 },
        { ...elementBase(actor), id: uid(), time: 4, easing: "linear", x: 170 },
      ],
    };
    const original = JSON.stringify(project);
    const classic = sceneFramesAt(project, scene, 2);
    expect(cinematicFaceAt(project, scene, actor, classic.get(actor.id)!, classic, 2, false))
      .toBeUndefined();
    project.visualStyle = "storybook-cinematic";
    const frames = sceneFramesAt(project, scene, 2);
    const face = cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames, 2, false)!;
    // #135's arrival eye looks right on a rightward stop.
    // #137's real reversal must instead look left, into the return walk.
    expect(face.x).toBeLessThan(-1.1);
    expect(face.x).toBeGreaterThanOrEqual(-2.6);
    expect(frames.get(actor.id)!.x).toBeCloseTo(290, 6);
    expect(cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames, 2, false))
      .toEqual(face);
    expect(cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames, 2, true))
      .toBeUndefined();
    project.visualStyle = undefined;
    expect(JSON.stringify(project)).toBe(original);
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
    const blinking = renderToStaticMarkup(createElement(PuppetArt, {
      character, assets: [], emotion: "happy", mouth: "smile", premium: true,
      blink: true, gaze: { x: 1.6, y: -0.8, brow: 1.25, blink: true },
    }));
    expect(blinking).not.toContain('data-eye-highlight="premium"');
    expect(blinking).toContain("M-19 -2h8");
    expect(polished).toContain("M-9 12q9 13 18 0");
  });
});
