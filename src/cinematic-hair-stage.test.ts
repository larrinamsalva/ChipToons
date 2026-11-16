import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Stage } from "./components/Stage";
import { PuppetArt } from "./components/PuppetArt";
import { cinematicHairFollowThroughAt } from "./cinematic-hair-follow-through";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementAt, sceneFramesAt } from "./timeline";
import { handAt } from "./interaction-motion";

const count = (s: string, marker: string) => s.split(marker).length - 1;

describe("PR #145 hair follows authored movements without moving face or props", () => {
  it("renders genuine per-character follow-through in the real Scout workshop Stage", () => {
    const project = littleFixersFullBodyPilot();
    const scene = project.scenes[0];
    const actor = scene.elements.find(e => e.characterId)!;
    const source = JSON.stringify(project);
    const initial = elementAt(actor, 5.2, scene.duration);
    project.visualStyle = "storybook-cinematic";
    const frame = sceneFramesAt(project, scene, 5.2).get(actor.id)!;
    const motion = cinematicHairFollowThroughAt(5.2, scene.duration,
      at => elementAt(actor, at, scene.duration, true));
    expect(Math.abs(motion.angle) + motion.lift).toBeGreaterThan(.05);
    const html = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 5.2, labelled: false,
    }));
    expect(html).toContain('data-workshop-hairstyle="short-side-part"');
    expect(html).toContain('data-cinematic-hair-follow="true"');
    expect(html).toContain(`transform="translate(0 ${-motion.lift}) rotate(${motion.angle} 0 -32)"`);
    expect(html).toContain('data-puppet-part="head"');
    // An intentional blink removes the eye catchlight only for a short
    // interval. Preserve the existing facial rendering contract by
    // checking a second deterministic time rather than assuming t=5.2
    // cannot coincide with an ID-phased blink.
    const otherEyes = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 5.65, labelled: false,
    }));
    expect([html, otherEyes].some(svg =>
      svg.includes('data-eye-highlight="premium"'))).toBe(true);
    expect(frame.x).toBeCloseTo(initial.x, 8);
    expect(frame.mouth).toBe(initial.mouth);
    expect(renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 5.2, labelled: false,
    }))).toBe(html);
    project.visualStyle = undefined;
    expect(JSON.stringify(project)).toBe(source);
  });

  it("keeps two different original hairstyles moving while their handoff anchor stays exact", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0];
    const original = JSON.stringify(project);
    const svg = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 1.5, labelled: false,
    }));
    expect(count(svg, 'data-cinematic-hair-follow="true"')).toBe(2);
    expect(count(svg, 'data-workshop-hairstyle="short-side-part"')).toBe(1);
    expect(count(svg, 'data-workshop-hairstyle="soft-waves"')).toBe(1);
    const handoff = scene.interactions![0];
    const scout = scene.elements.find(e => e.id === handoff.actorId)!;
    const frames = sceneFramesAt(project, scene, 7);
    const held = frames.get(handoff.objectId)!;
    const grip = handAt(project.characters[0], scout, frames.get(scout.id)!, handoff.grip);
    expect(held.x).toBeCloseTo(grip.x, 7);
    expect(held.y).toBeCloseTo(grip.y, 7);
    expect(JSON.stringify(project)).toBe(original);
  });

  it("has no secondary hair movement in Classic, calm preview or unstyled puppets", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0];
    const calm = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 1.5, labelled: false, calmPreview: true,
    }));
    expect(calm).toContain('data-workshop-hairstyle="soft-waves"');
    expect(calm).not.toContain("data-cinematic-hair-follow");
    project.visualStyle = undefined;
    const classic = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 1.5, labelled: false,
    }));
    expect(classic).not.toContain("data-cinematic-hair-follow");

    const unstyled = { ...project.characters[0], puppet: {
      ...project.characters[0].puppet!, headStyle: undefined,
    } };
    const art = renderToStaticMarkup(createElement(PuppetArt, {
      character: unstyled, assets: [], emotion: "happy", premium: true,
      hairFollow: { angle: 3, lift: .8 },
    }));
    expect(art).not.toContain("data-cinematic-hair-follow");
    expect(art).not.toContain("data-workshop-hairstyle");
  });
});
