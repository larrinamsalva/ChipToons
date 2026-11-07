import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Stage } from "./components/Stage";
import { handAt } from "./interaction-motion";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { sceneFramesAt } from "./timeline";
import { validateProject } from "./model";

describe("Little Fixers articulated workshop showcase", () => {
  it("creates a real original 30-second project with two separate full-body articulated puppets", () => {
    const project = littleFixersArticulatedWorkshop();
    expect(validateProject(project)).toBeTruthy();
    expect(project.visualStyle).toBe("storybook-cinematic");
    expect(project.characters).toHaveLength(2);
    expect(project.scenes).toHaveLength(1);
    expect(project.scenes[0].duration).toBe(30);
    expect(project.scenes[0].interactions?.[0]?.kind).toBe("give");
    for (const character of project.characters) {
      const rig = character.puppet!;
      expect(rig.costume).toBe("workshop");
      for (const side of ["left", "right"] as const) {
        const upper = rig.parts.find(part => part.role === `${side}Arm`)!;
        const elbow = rig.parts.find(part => part.role === `${side}Forearm`)!;
        const hand = rig.parts.find(part => part.role === `${side}Hand`)!;
        expect(elbow.parentId).toBe(upper.id);
        expect(hand.parentId).toBe(elbow.id);
      }
    }
    expect(project.scenes[0].elements.filter(item => item.characterId)).toHaveLength(2);
    expect(project.scenes[0].elements.some(item => item.name?.includes("adult-only"))).toBe(false);
  });

  it("animates both elbows toward the shared picture plan before the handoff and attaches the object to Jo after", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0];
    const action = scene.interactions![0];
    const snapshot = JSON.stringify(project);
    const frames = sceneFramesAt(project, scene, 9.5);
    const scout = frames.get(action.actorId)!;
    const jo = frames.get(action.transfer!.actorId)!;
    expect(scout.joints?.rightArm).toBeDefined();
    expect(scout.joints?.rightForearm).toBeDefined();
    expect(jo.joints?.leftArm).toBeDefined();
    expect(jo.joints?.leftForearm).toBeDefined();
    expect(scout.joints?.rightForearm?.angle).not.toBe(0);
    expect(jo.joints?.leftForearm?.angle).not.toBe(0);
    expect(sceneFramesAt(project, scene, 9.5)).toEqual(frames);
    const transferFrames = sceneFramesAt(project, scene, 10.2);
    const recipient = scene.elements.find(item => item.id === action.transfer!.actorId)!;
    const prop = transferFrames.get(action.objectId)!;
    const grip = handAt(project.characters[1], recipient,
      transferFrames.get(recipient.id)!, action.transfer!.grip);
    expect(prop.heldBy).toBe(recipient.id);
    expect(prop.x).toBeCloseTo(grip.x, 7);
    expect(prop.y).toBeCloseTo(grip.y, 7);
    const released = sceneFramesAt(project, scene, 13.5).get(action.objectId)!;
    expect(released.heldBy).toBeUndefined();
    expect(released.x).toBeCloseTo(action.release!.position.x, 8);
    expect(released.y).toBeCloseTo(action.release!.position.y, 8);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("disables elbow IK in calm editing and Classic mode, preserving original full-body pilot", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0];
    const action = scene.interactions![0];
    const calm = sceneFramesAt(project, scene, 9.5, 0, true);
    expect(calm.get(action.actorId)?.joints?.rightForearm).toBeUndefined();
    expect(calm.get(action.transfer!.actorId)?.joints?.leftForearm).toBeUndefined();
    project.visualStyle = undefined;
    const classic = sceneFramesAt(project, scene, 9.5);
    expect(classic.get(action.actorId)?.joints?.rightForearm).toBeUndefined();
    expect(classic.get(action.transfer!.actorId)?.joints?.leftForearm).toBeUndefined();
    const prior = littleFixersFullBodyPilot();
    expect(prior.visualStyle).toBeUndefined();
    expect(prior.characters[0].puppet!.parts.some(part => part.role.includes("Forearm"))).toBe(false);
  });

  it("renders two genuinely articulated vector puppets in the same SVG Stage used by video export", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0];
    const svg = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 9.5, labelled: false,
    }));
    expect(svg).toContain('data-visual-style="storybook-cinematic"');
    expect(svg).toContain('data-cinematic-workshop-lighting="true"');
    expect(svg).toContain('data-puppet-part="rightForearm"');
    expect(svg).toContain('data-puppet-part="leftForearm"');
    expect(svg).toContain('data-puppet-part="rightHand"');
    expect(svg).toContain('data-puppet-part="leftHand"');
    expect(svg).not.toContain("<foreignObject");
    expect(svg).not.toContain("https://");
  });
});
