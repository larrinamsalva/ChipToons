import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicGripAt } from "./cinematic-hand-grip";
import { Stage } from "./components/Stage";
import { handAt } from "./interaction-motion";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { sceneElementAt, sceneFramesAt } from "./timeline";

function fixture() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const action = scene.interactions![0];
  const scout = scene.elements.find(e => e.id === action.actorId)!;
  const jo = scene.elements.find(e => e.id === action.transfer!.actorId)!;
  return { project, scene, action, scout, jo };
}

describe("Cinematic hand grip and wrist acting", () => {
  it("curls Scout's real fingers and turns the wrist while the checklist remains on the animated hand", () => {
    const { project, scene, action, scout } = fixture();
    const snapshot = JSON.stringify(project);
    const t = 7;
    const frames = sceneFramesAt(project, scene, t);
    const performer = frames.get(scout.id)!;
    expect(performer.gripCurl?.right).toBeGreaterThan(0.7);
    expect(performer.joints?.rightHand?.angle).toBeGreaterThan(6);
    expect(performer.joints?.rightForearm).toBeDefined();
    const held = frames.get(action.objectId)!;
    const anchor = handAt(project.characters[0], scout, performer, action.grip);
    expect(held.heldBy).toBe(scout.id);
    expect(held.x).toBeCloseTo(anchor.x, 7);
    expect(held.y).toBeCloseTo(anchor.y, 7);
    expect(sceneFramesAt(project, scene, t)).toEqual(frames);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("shows Jo receiving with the left hand; finger and palm motion appears in real Stage output", () => {
    const { project, scene, action, jo } = fixture();
    const t = 9.65;
    const frames = sceneFramesAt(project, scene, t);
    const receiver = frames.get(jo.id)!;
    expect(receiver.gripCurl?.left).toBeGreaterThan(0);
    expect(receiver.joints?.leftHand?.angle).toBeLessThan(0);
    const svg = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: t, labelled: false,
    }));
    expect(svg).toContain('data-cinematic-hand-grip="true"');
    expect(svg).toMatch(/data-hand-curl="0\\.\\d+|data-hand-curl="1\\.00/);
    expect(svg).toContain('data-puppet-part="leftHand"');
    expect(svg).toContain('data-puppet-part="rightHand"');
    const after = sceneFramesAt(project, scene, 10.3);
    const held = after.get(action.objectId)!;
    const anchor = handAt(project.characters[1], jo, after.get(jo.id)!, action.transfer!.grip);
    expect(held.heldBy).toBe(jo.id);
    expect(held.x).toBeCloseTo(anchor.x, 7);
    expect(held.y).toBeCloseTo(anchor.y, 7);
  });

  it("never changes Classic, calm previews, authored wrist keys or one-piece puppet rigs", () => {
    const { project, scene, scout } = fixture();
    const t = 7;
    expect(sceneFramesAt(project, scene, t).get(scout.id)?.gripCurl?.right).toBeGreaterThan(0);
    const calm = sceneFramesAt(project, scene, t, 0, true).get(scout.id)!;
    expect(calm.gripCurl).toBeUndefined();
    project.visualStyle = undefined;
    const classic = sceneFramesAt(project, scene, t).get(scout.id)!;
    expect(classic.gripCurl).toBeUndefined();
    const classicSvg = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: t, labelled: false,
    }));
    expect(classicSvg).not.toContain("data-cinematic-hand-grip");
    project.visualStyle = "storybook-cinematic";
    const wrist = { x: 0, y: 0, angle: -31 };
    for (const key of scout.animation!.keyframes)
      key.joints = { ...key.joints, rightHand: wrist };
    const authored = sceneFramesAt(project, scene, t).get(scout.id)!;
    expect(authored.joints?.rightHand).toEqual(wrist);
    expect(authored.gripCurl).toBeUndefined();
    const onePiece = { ...project.characters[0].puppet!,
      parts: project.characters[0].puppet!.parts.filter(p =>
        p.role !== "rightForearm" && p.role !== "rightHand"),
    };
    const base = sceneElementAt(project, scene, scout, t, 0);
    expect(cinematicGripAt(project, onePiece, scout, base,
      { hand: "right", x: 0, y: 0 }, 1, false)).toEqual(base);
  });

  it("gracefully ignores painted hands, nonexistent arms and invalid action strength", () => {
    const { project, scene, scout } = fixture();
    const rig = project.characters[0].puppet!;
    const base = sceneElementAt(project, scene, scout, 7, 0);
    const grip = { hand: "right" as const, x: 0, y: 0 };
    const painted = { ...rig,
      parts: rig.parts.map(part => part.role === "rightHand"
        ? { ...part, assetId: "painted" } : part),
    };
    expect(cinematicGripAt(project, painted, scout, base, grip, 1, false)).toEqual(base);
    expect(cinematicGripAt(project, rig, scout, base, grip, Number.NaN, false)).toEqual(base);
    expect(cinematicGripAt(project, rig, scout, base,
      { ...grip, hand: "default" }, 1, false)).toEqual(base);
    expect(cinematicGripAt(project, rig, scout, base, grip, 0, false)).toEqual(base);
  });
});
