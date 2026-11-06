import { describe, expect, it } from "vitest";
import { elementBase, elementAt, sceneElementAt, sceneFramesAt } from "./timeline";
import { cinematicMotionAt } from "./cinematic-motion";
import { starterProject } from "./demo-starter";
import { neutralJoint, sunnyRig } from "./puppet-model";
import { uid } from "./model";

function walkingFixture() {
  const project = starterProject();
  const scene = project.scenes[0];
  scene.duration = 5;
  const actor = scene.elements[0];
  project.characters[0].puppet = sunnyRig();
  actor.motion = "still";
  actor.x = 170; actor.y = 365;
  actor.animation = {
    blink: true, idle: "none",
    keyframes: [
      { ...elementBase(actor), id: uid(), time: 0, easing: "linear",
        x: 170, joints: { head: { ...neutralJoint, angle: 5 } } },
      { ...elementBase(actor), id: uid(), time: 3, easing: "linear",
        x: 350, joints: { head: { ...neutralJoint, angle: 5 } } },
      { ...elementBase(actor), id: uid(), time: 4, easing: "ease-in-out",
        x: 350, joints: { head: { ...neutralJoint, angle: 5 } } },
    ],
  };
  return { project, scene, actor };
}

describe("Cinematic Storybook secondary movement", () => {
  it("only polishes explicitly opted-in rigged characters and preserves the authored movement path", () => {
    const { project, scene, actor } = walkingFixture();
    const classic = sceneFramesAt(project, scene, 1.13).get(actor.id)!;
    project.visualStyle = "storybook-cinematic";
    const originalSnapshot = JSON.stringify(project);
    const cinematic = sceneFramesAt(project, scene, 1.13).get(actor.id)!;
    expect(cinematic.x).toBeCloseTo(classic.x, 6);
    expect(Math.abs(cinematic.y - classic.y) + Math.abs(cinematic.rotation - classic.rotation))
      .toBeGreaterThan(0.15);
    expect(cinematic.joints?.head?.angle).not.toBe(classic.joints?.head?.angle);
    expect(cinematic.mouth).toBe(classic.mouth);
    expect(cinematic.emotion).toBe(classic.emotion);
    expect(cinematic.blink).toBe(classic.blink);
    expect(JSON.stringify(project)).toBe(originalSnapshot);
    const sameFrame = sceneFramesAt(project, scene, 1.13).get(actor.id)!;
    expect(sameFrame).toEqual(cinematic);
  });

  it("keeps old projects and calm authoring/keyframe snapshots exactly unchanged", () => {
    const { project, scene, actor } = walkingFixture();
    const classic = sceneElementAt(project, scene, actor, 1.13, 0);
    const raw = elementAt(actor, 1.13, scene.duration);
    expect(classic).toEqual(raw);
    project.visualStyle = "storybook-cinematic";
    const calm = sceneElementAt(project, scene, actor, 1.13, 0, true);
    expect(calm).toEqual(elementAt(actor, 1.13, scene.duration, true));
  });

  it("does not move standalone props, raster artwork or imaginary characters", () => {
    const { project, scene, actor } = walkingFixture();
    project.visualStyle = "storybook-cinematic";
    const prop = scene.elements.find(e => !e.characterId);
    if (prop) {
      expect(sceneElementAt(project, scene, prop, 1, 0)).toEqual(elementAt(prop, 1, scene.duration));
    }
    const noRig = { ...project, characters: project.characters.map(c =>
      c.id === actor.characterId ? { ...c, puppet: undefined } : c) };
    expect(sceneElementAt(noRig, scene, actor, 1, 0)).toEqual(elementAt(actor, 1, scene.duration));
  });

  it("never inserts a duplicate head joint when the puppet doesn't have a head part", () => {
    const { project, scene, actor } = walkingFixture();
    project.visualStyle = "storybook-cinematic";
    const rig = project.characters[0].puppet!;
    project.characters[0].puppet = { ...rig, parts: rig.parts.filter(part => part.role !== "head") };
    const base = elementAt(actor, 1.1, scene.duration);
    const polished = cinematicMotionAt(project, actor, base, 1.1, scene.duration, false,
      time => elementAt(actor, time, scene.duration, true));
    expect(polished.joints).toEqual(base.joints);
    expect(polished.x).toBe(base.x);
  });
});
