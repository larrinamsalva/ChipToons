import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Stage } from "./components/Stage";
import { PuppetArt } from "./components/PuppetArt";
import { fullBodyWorkshopCharacter, littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { sunnyRig } from "./puppet-model";
import { sceneFramesAt } from "./timeline";

const count = (markup: string, needle: string) =>
  markup.split(needle).length - 1;

describe("PR #142 sculpted knee sleeves and laced workshop boots", () => {
  it("draws distinct shins and boots for both animated characters in the actual Stage", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0];
    const before = JSON.stringify(project);
    const rendered = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 1.5, labelled: false,
    }));
    expect(rendered).toContain('data-visual-style="storybook-cinematic"');
    expect(count(rendered, 'data-workshop-knee-sleeve="cinematic"')).toBe(4);
    expect(count(rendered, 'data-workshop-knee-panel="true"')).toBe(4);
    expect(count(rendered, 'data-workshop-knee-folds="true"')).toBe(4);
    expect(count(rendered, 'data-workshop-boot-cuff="true"')).toBe(4);
    expect(count(rendered, 'data-workshop-boot-profile="cinematic"')).toBe(4);
    expect(count(rendered, 'data-workshop-boot-toe="true"')).toBe(4);
    expect(count(rendered, 'data-workshop-boot-lace="true"')).toBe(12);
    expect(count(rendered, 'data-workshop-boot-sole="true"')).toBe(4);
    expect(count(rendered, 'data-puppet-part="leftShin"')).toBe(2);
    expect(count(rendered, 'data-puppet-part="rightShin"')).toBe(2);

    for (const actor of scene.elements.filter(e => e.characterId)) {
      const frame = sceneFramesAt(project, scene, 1.5).get(actor.id)!;
      const repeat = sceneFramesAt(project, scene, 1.5).get(actor.id)!;
      expect(repeat).toEqual(frame);
      expect(Number.isFinite(frame.joints?.leftShin?.angle ?? 0)).toBe(true);
      expect(Number.isFinite(frame.joints?.rightShin?.angle ?? 0)).toBe(true);
    }
    expect(JSON.stringify(project)).toBe(before);
  });

  it("preserves Classic painted appearance and all saved characters when the option is disabled", () => {
    const project = littleFixersArticulatedWorkshop();
    const original = JSON.stringify(project);
    project.visualStyle = undefined;
    const plain = renderToStaticMarkup(createElement(Stage, {
      project, scene: project.scenes[0], time: 1.5, labelled: false,
    }));
    expect(count(plain, 'data-puppet-part="leftShin"')).toBe(2);
    expect(plain).not.toContain('data-workshop-knee-sleeve="cinematic"');
    expect(plain).not.toContain('data-workshop-boot-profile="cinematic"');
    project.visualStyle = "storybook-cinematic";
    expect(JSON.stringify(project)).toBe(original);

    const solo = littleFixersFullBodyPilot();
    const saved = JSON.stringify(solo);
    expect(solo.visualStyle).toBeUndefined();
    expect(JSON.stringify(solo)).toBe(saved);
  });

  it("keeps unarticulated workshop legs and ordinary character outfits intact", () => {
    const older = fullBodyWorkshopCharacter();
    const previous = JSON.stringify(older);
    const art = renderToStaticMarkup(createElement(PuppetArt, {
      character: older, assets: [], emotion: "happy", premium: true,
    }));
    expect(art).not.toContain('data-workshop-knee-sleeve="cinematic"');
    expect(count(art, 'data-workshop-boot-profile="cinematic"')).toBe(2);
    expect(JSON.stringify(older)).toBe(previous);

    const plain = { ...older, puppet: sunnyRig() };
    const simple = renderToStaticMarkup(createElement(PuppetArt, {
      character: plain, assets: [], emotion: "happy", premium: true,
    }));
    expect(simple).not.toContain("data-workshop-knee-sleeve");
    expect(simple).not.toContain("data-workshop-boot-profile");
    const classic = renderToStaticMarkup(createElement(PuppetArt, {
      character: older, assets: [], emotion: "happy", premium: false,
    }));
    expect(classic).not.toContain('data-workshop-boot-profile="cinematic"');
  });
});
