import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Stage } from "./components/Stage";
import { PuppetArt } from "./components/PuppetArt";
import { littleFixersArticulatedWorkshop, articulatedWorkshopCharacter } from "./little-fixers-articulated-workshop";
import { fullBodyWorkshopCharacter, littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { handAt } from "./interaction-motion";
import { validateProject } from "./model";
import { validPuppet, sunnyRig } from "./puppet-model";
import { sceneFramesAt } from "./timeline";

const count = (s: string, marker: string) => s.split(marker).length - 1;

describe("PR #144 original, distinct workshop character head art", () => {
  it("renders Scout's short side-part and Jo's soft waves on their real jointed heads", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0];
    const original = JSON.stringify(project);
    expect(project.characters.map(c => c.puppet?.headStyle))
      .toEqual(["short-side-part", "soft-waves"]);
    expect(validateProject(project)).toBeTruthy();
    const art = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 7, labelled: false,
    }));
    expect(count(art, 'data-workshop-head-contour="cinematic"')).toBe(2);
    expect(count(art, 'data-workshop-jaw-highlight="true"')).toBe(2);
    expect(count(art, 'data-workshop-hairstyle="short-side-part"')).toBe(1);
    expect(count(art, 'data-workshop-hairstyle="soft-waves"')).toBe(1);
    expect(count(art, 'data-workshop-hair-silhouette="true"')).toBe(2);
    expect(count(art, 'data-workshop-hair-part="true"')).toBe(1);
    expect(count(art, 'data-workshop-hair-lock="true"')).toBe(1);
    // The existing actual lips, eyes, head joint and checklist handoff
    // remain animated independently of these new face outlines.
    expect(count(art, 'data-puppet-part="head"')).toBe(2);
    expect(art).toContain('data-eye-highlight="premium"');
    expect(art).toContain('data-cinematic-hand-grip="true"');
    const action = scene.interactions![0];
    const frames = sceneFramesAt(project, scene, 7);
    const scout = scene.elements.find(e => e.id === action.actorId)!;
    const held = frames.get(action.objectId)!;
    const anchor = handAt(project.characters[0], scout, frames.get(scout.id)!, action.grip);
    expect(held.x).toBeCloseTo(anchor.x, 7);
    expect(held.y).toBeCloseTo(anchor.y, 7);
    expect(sceneFramesAt(project, scene, 7)).toEqual(frames);
    expect(JSON.stringify(project)).toBe(original);
  });

  it("preserves Classic, ordinary unstyled rigs and old authors' head drawings", () => {
    const project = littleFixersArticulatedWorkshop();
    const saved = JSON.stringify(project);
    project.visualStyle = undefined;
    const classic = renderToStaticMarkup(createElement(Stage, {
      project, scene: project.scenes[0], time: 7, labelled: false,
    }));
    expect(classic).not.toContain("data-workshop-hairstyle");
    expect(classic).not.toContain("data-workshop-head-contour");
    project.visualStyle = "storybook-cinematic";
    expect(JSON.stringify(project)).toBe(saved);
    const legacy = articulatedWorkshopCharacter("jo");
    expect(legacy.puppet?.headStyle).toBeUndefined();
    const old = fullBodyWorkshopCharacter();
    expect(old.puppet?.headStyle).toBeUndefined();
    const plain = { ...old, puppet: sunnyRig() };
    const nonWorkshop = renderToStaticMarkup(createElement(PuppetArt, {
      character: plain, assets: [], emotion: "happy", premium: true,
    }));
    expect(nonWorkshop).not.toContain("data-workshop-hairstyle");
    const solo = littleFixersFullBodyPilot();
    expect(solo.characters[0].puppet?.headStyle).toBe("short-side-part");
    expect(solo.visualStyle).toBeUndefined();
  });

  it("stores an explicit hairstyle rather than deriving it from rename or colors, and validates it", () => {
    const project = littleFixersArticulatedWorkshop();
    const jo = project.characters[1];
    const initial = jo.puppet?.headStyle;
    jo.name = "A different name";
    jo.hair = "#ff6600";
    expect(jo.puppet?.headStyle).toBe(initial);
    const renamed = renderToStaticMarkup(createElement(PuppetArt, {
      character: jo, assets: [], emotion: "happy", premium: true,
    }));
    expect(renamed).toContain('data-workshop-hairstyle="soft-waves"');
    expect(validPuppet(jo.puppet!, new Set())).toBe(true);
    const unknown = { ...jo.puppet!, headStyle: "incorrect" };
    expect(validPuppet(unknown, new Set())).toBe(false);
    const noStyle = { ...jo.puppet!, headStyle: undefined };
    expect(validPuppet(noStyle, new Set())).toBe(true);
    const oldPaint = renderToStaticMarkup(createElement(PuppetArt, {
      character: { ...jo, puppet: noStyle }, assets: [], emotion: "happy", premium: true,
    }));
    expect(oldPaint).not.toContain("data-workshop-hairstyle");
  });
});
