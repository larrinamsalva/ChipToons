import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Stage } from "./components/Stage";
import { PuppetArt } from "./components/PuppetArt";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { handAt } from "./interaction-motion";
import { sunnyRig } from "./puppet-model";
import { sceneFramesAt } from "./timeline";

const count = (markup: string, marker: string) =>
  markup.split(marker).length - 1;

describe("PR #143 sculpted workshop sleeves, forearms and resting palms", () => {
  it("paints both performers' original moving shoulders, elbows and hands in Stage", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0];
    const before = JSON.stringify(project);
    const art = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 1.5, labelled: false,
    }));
    expect(art).toContain('data-visual-style="storybook-cinematic"');
    expect(count(art, 'data-workshop-shirt-sleeve="cinematic"')).toBe(4);
    expect(count(art, 'data-workshop-arm-fold="true"')).toBe(4);
    expect(count(art, 'data-workshop-sleeve-cuff="true"')).toBe(4);
    expect(count(art, 'data-workshop-forearm="cinematic"')).toBe(4);
    expect(count(art, 'data-workshop-elbow-crease="true"')).toBe(4);
    expect(count(art, 'data-workshop-open-hand="cinematic"')).toBe(4);
    expect(count(art, 'data-workshop-palm-thumb="true"')).toBe(4);
    expect(count(art, 'data-workshop-finger-line="true"')).toBe(12);
    for (const role of ["leftArm", "rightArm", "leftForearm", "rightForearm", "leftHand", "rightHand"])
      expect(count(art, `data-puppet-part="${role}"`)).toBe(2);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("preserves curved gripping hands and handoff anchors without moving the animated prop", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0];
    const action = scene.interactions![0];
    const snapshot = JSON.stringify(project);
    const frames = sceneFramesAt(project, scene, 7);
    const scout = scene.elements.find(e => e.id === action.actorId)!;
    const frame = frames.get(scout.id)!;
    expect(frame.gripCurl?.right).toBeGreaterThan(.7);
    const held = frames.get(action.objectId)!;
    const grip = handAt(project.characters[0], scout, frame, action.grip);
    expect(held.heldBy).toBe(scout.id);
    expect(held.x).toBeCloseTo(grip.x, 7);
    expect(held.y).toBeCloseTo(grip.y, 7);
    const art = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 7, labelled: false,
    }));
    expect(art).toContain('data-cinematic-hand-grip="true"');
    expect(count(art, 'data-workshop-open-hand="cinematic"')).toBeGreaterThan(0);
    expect(count(art, 'data-workshop-open-hand="cinematic"')).toBeLessThan(4);
    expect(art).toContain('data-workshop-forearm="cinematic"');
    expect(sceneFramesAt(project, scene, 7)).toEqual(frames);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("leaves Classic, old rigs and non-workshop costumes unchanged", () => {
    const project = littleFixersArticulatedWorkshop();
    const snapshot = JSON.stringify(project);
    project.visualStyle = undefined;
    const classic = renderToStaticMarkup(createElement(Stage, {
      project, scene: project.scenes[0], time: 1.5, labelled: false,
    }));
    for (const marker of [
      "data-workshop-shirt-sleeve", "data-workshop-forearm",
      "data-workshop-open-hand", "data-workshop-palm-thumb",
    ]) expect(classic).not.toContain(marker);
    project.visualStyle = "storybook-cinematic";
    expect(JSON.stringify(project)).toBe(snapshot);

    const original = littleFixersFullBodyPilot();
    original.visualStyle = "storybook-cinematic";
    const oldSvg = renderToStaticMarkup(createElement(Stage, {
      project: original, scene: original.scenes[0], time: 5.2, labelled: false,
    }));
    expect(count(oldSvg, 'data-workshop-shirt-sleeve="cinematic"')).toBe(2);
    expect(oldSvg).not.toContain('data-workshop-forearm="cinematic"');
    expect(oldSvg).not.toContain('data-workshop-open-hand="cinematic"');

    const plain = { ...project.characters[0], puppet: sunnyRig() };
    const normal = renderToStaticMarkup(createElement(PuppetArt, {
      character: plain, assets: [], emotion: "happy", premium: true,
    }));
    expect(normal).not.toContain("data-workshop-shirt-sleeve");
    expect(normal).not.toContain("data-workshop-forearm");
    expect(normal).not.toContain("data-workshop-open-hand");
  });
});
