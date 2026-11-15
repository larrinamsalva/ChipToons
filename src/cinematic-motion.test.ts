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

  it("briefly settles the head and torso when the actual walk stops without moving its saved destination", () => {
    const { project, scene, actor } = walkingFixture();
    const before = JSON.stringify(project);
    const classicStop = sceneFramesAt(project, scene, 3.2).get(actor.id)!;
    project.visualStyle = "storybook-cinematic";
    const settling = sceneFramesAt(project, scene, 3.2).get(actor.id)!;
    expect(settling.x).toBeCloseTo(classicStop.x, 6);
    expect(settling.rotation).toBeGreaterThan(classicStop.rotation + .5);
    expect(settling.joints?.head?.angle).not.toBe(classicStop.joints?.head?.angle);
    expect(settling.emotion).toBe(classicStop.emotion);
    expect(settling.mouth).toBe(classicStop.mouth);
    expect(settling.blink).toBe(classicStop.blink);
    const later = sceneFramesAt(project, scene, 4.2).get(actor.id)!;
    expect(later.x).toBeCloseTo(classicStop.x, 6);
    expect(sceneFramesAt(project, scene, 3.2).get(actor.id)).toEqual(settling);
    project.visualStyle = undefined;
    expect(JSON.stringify(project)).toBe(before);
  });

  it("adds a tiny pre-step lean before an authored walk without changing original paths, voices or keyframes", () => {
    const { project, scene, actor } = walkingFixture();
    actor.animation!.keyframes = [
      { ...elementBase(actor), id: uid(), time: 0, easing: "linear",
        x: 170, joints: { head: { ...neutralJoint, angle: 5 } } },
      { ...elementBase(actor), id: uid(), time: 1, easing: "linear",
        x: 170, joints: { head: { ...neutralJoint, angle: 5 } } },
      { ...elementBase(actor), id: uid(), time: 3, easing: "linear",
        x: 290, joints: { head: { ...neutralJoint, angle: 5 } } },
      { ...elementBase(actor), id: uid(), time: 4, easing: "linear",
        x: 290, joints: { head: { ...neutralJoint, angle: 5 } } },
    ];
    const snapshot = JSON.stringify(project);
    const classic = sceneFramesAt(project, scene, .85).get(actor.id)!;
    project.visualStyle = "storybook-cinematic";
    const ready = sceneFramesAt(project, scene, .85).get(actor.id)!;
    expect(ready.x).toBeCloseTo(classic.x, 6);
    expect(ready.y).toBeCloseTo(classic.y, 6);
    expect(ready.rotation).toBeLessThan(classic.rotation - .3);
    expect(ready.joints?.head?.angle).not.toBe(classic.joints?.head?.angle);
    expect(ready.mouth).toBe(classic.mouth);
    expect(ready.emotion).toBe(classic.emotion);
    expect(ready.blink).toBe(classic.blink);
    expect(sceneFramesAt(project, scene, .85).get(actor.id)).toEqual(ready);
    const calm = sceneElementAt(project, scene, actor, .85, 0, true);
    expect(calm).toEqual(elementAt(actor, .85, scene.duration, true));
    project.visualStyle = undefined;
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("makes a real authored direction reversal feel less abrupt without moving the character off its track", () => {
    const { project, scene, actor } = walkingFixture();
    actor.animation!.keyframes = [
      { ...elementBase(actor), id: uid(), time: 0, easing: "linear", x: 170,
        joints: { head: { ...neutralJoint, angle: 5 } } },
      { ...elementBase(actor), id: uid(), time: 2, easing: "linear", x: 290,
        joints: { head: { ...neutralJoint, angle: 5 } } },
      { ...elementBase(actor), id: uid(), time: 4, easing: "linear", x: 170,
        joints: { head: { ...neutralJoint, angle: 5 } } },
    ];
    const snapshot = JSON.stringify(project);
    const regular = sceneFramesAt(project, scene, 2).get(actor.id)!;
    project.visualStyle = "storybook-cinematic";
    const turned = sceneFramesAt(project, scene, 2).get(actor.id)!;
    // The new head lead and torso counterbalance are additive to the
    // already-tested stop-settle impulse; the author's position is exact.
    expect(turned.x).toBeCloseTo(regular.x, 6);
    expect(turned.y).toBeCloseTo(regular.y, 6);
    expect(turned.rotation).toBeGreaterThan(regular.rotation + 1.7);
    expect(turned.joints?.head?.angle).toBeLessThan(
      (regular.joints?.head?.angle ?? 0) - 2,
    );
    expect(turned.mouth).toBe(regular.mouth);
    expect(turned.emotion).toBe(regular.emotion);
    expect(turned.blink).toBe(regular.blink);
    expect(sceneFramesAt(project, scene, 2).get(actor.id)).toEqual(turned);
    expect(sceneElementAt(project, scene, actor, 2, 0, true))
      .toEqual(elementAt(actor, 2, scene.duration, true));
    project.visualStyle = undefined;
    expect(JSON.stringify(project)).toEqual(snapshot);
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
