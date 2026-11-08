import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicContactsAt } from "./cinematic-contact";
import { Stage } from "./components/Stage";
import { handAt } from "./interaction-motion";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { sceneFramesAt } from "./timeline";

function fixture() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const action = scene.interactions![0];
  return { project, scene, action };
}

describe("Cinematic foreground finger contact", () => {
  it("adds a small foreground fingertip grip exactly where Scout holds the real checklist", () => {
    const { project, scene, action } = fixture();
    const snapshot = JSON.stringify(project);
    const time = 7;
    const frames = sceneFramesAt(project, scene, time);
    const contacts = cinematicContactsAt(project, scene, frames, time, false);
    expect(contacts).toHaveLength(1);
    const touch = contacts[0];
    const prop = frames.get(action.objectId)!;
    const owner = scene.elements.find(item => item.id === action.actorId)!;
    const puppet = frames.get(owner.id)!;
    const anchor = handAt(project.characters[0], owner, puppet, action.grip);
    expect(touch).toMatchObject({ objectId: action.objectId, ownerId: owner.id, side: "right" });
    expect(touch.x).toBeCloseTo(prop.x, 8);
    expect(touch.y).toBeCloseTo(prop.y, 8);
    expect(touch.x).toBeCloseTo(anchor.x, 8);
    expect(touch.y).toBeCloseTo(anchor.y, 8);
    expect(touch.curl).toBeGreaterThan(0.6);
    expect(contacts).toEqual(cinematicContactsAt(project, scene, frames, time, false));
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("moves contact to Helper Jo's left hand at the real transfer and disappears after release", () => {
    const { project, scene, action } = fixture();
    const before = sceneFramesAt(project, scene, 9.7);
    expect(cinematicContactsAt(project, scene, before, 9.7, false)[0].ownerId)
      .toBe(action.actorId);
    const transferred = sceneFramesAt(project, scene, 10.3);
    const contact = cinematicContactsAt(project, scene, transferred, 10.3, false);
    expect(contact).toHaveLength(1);
    expect(contact[0]).toMatchObject({
      ownerId: action.transfer!.actorId, side: "left", objectId: action.objectId,
    });
    const recipient = scene.elements.find(item => item.id === action.transfer!.actorId)!;
    const anchor = handAt(project.characters[1], recipient,
      transferred.get(recipient.id)!, action.transfer!.grip);
    expect(contact[0].x).toBeCloseTo(anchor.x, 8);
    expect(contact[0].y).toBeCloseTo(anchor.y, 8);
    for (const time of [0, 5, 12, 13.5, 29.5]) {
      expect(cinematicContactsAt(project, scene, sceneFramesAt(project, scene, time),
        time, false)).toEqual([]);
    }
  });

  it("shows two briefly overlapping hands before transfer while ownership remains with Scout", () => {
    const { project, scene, action } = fixture();
    const time = 9.7;
    const snapshot = JSON.stringify(project);
    const frames = sceneFramesAt(project, scene, time);
    expect(frames.get(action.objectId)?.heldBy).toBe(action.actorId);
    const contacts = cinematicContactsAt(project, scene, frames, time, false);
    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toMatchObject({
      ownerId: action.actorId, phase: "holding", side: "right",
    });
    expect(contacts[1]).toMatchObject({
      ownerId: action.transfer!.actorId, phase: "receiving", side: "left",
    });
    expect(contacts.every(contact => contact.opacity > 0 && contact.opacity <= 1)).toBe(true);
    expect(contacts[0].x).toBeCloseTo(contacts[1].x, 8);
    expect(contacts[0].y).toBeCloseTo(contacts[1].y, 8);
    const beforeOverlap = cinematicContactsAt(project, scene,
      sceneFramesAt(project, scene, 9.3), 9.3, false);
    expect(beforeOverlap).toHaveLength(1);
    const after = sceneFramesAt(project, scene, 10.3);
    expect(after.get(action.objectId)?.heldBy).toBe(action.transfer!.actorId);
    expect(cinematicContactsAt(project, scene, after, 10.3)).toHaveLength(1);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("fades finger visibility near release rather than snapping at the exact release frame", () => {
    const { project, scene } = fixture();
    const sample = (time: number) => cinematicContactsAt(
      project, scene, sceneFramesAt(project, scene, time), time, false,
    );
    const strong = sample(11.4);
    const gentle = sample(11.9);
    expect(strong).toHaveLength(1);
    expect(gentle).toHaveLength(1);
    expect(gentle[0].opacity).toBeGreaterThan(0);
    expect(gentle[0].opacity).toBeLessThan(strong[0].opacity);
    expect(sample(12)).toEqual([]);
    expect(sample(12.2)).toEqual([]);
  });

  it("paints both noninteractive hands in the correct order without copying the actual prop", () => {
    const { project, scene, action } = fixture();
    const svg = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 9.7, labelled: false,
    }));
    expect(svg.match(/data-cinematic-prop-contact="true"/g)).toHaveLength(2);
    expect(svg).toContain('data-contact-phase="receiving"');
    expect(svg).toContain('data-contact-phase="holding"');
    expect(svg).toContain(`data-contact-owner="${action.transfer!.actorId}"`);
    const propIndex = svg.indexOf(`data-element-id="${action.objectId}"`);
    const contactIndex = svg.indexOf('data-cinematic-prop-contact="true"');
    expect(propIndex).toBeGreaterThan(-1);
    expect(propIndex).toBeLessThan(contactIndex);
    const held = sceneFramesAt(project, scene, 9.7).get(action.objectId)!;
    expect(held.heldBy).toBe(action.actorId);
  });

  it("renders skin-toned fingers ON TOP of the actual book while keeping interaction visuals selectable", () => {
    const { project, scene, action } = fixture();
    const markup = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 7, labelled: false,
    }));
    expect(markup).toContain('data-cinematic-prop-contact="true"');
    expect(markup).toContain(`data-contact-object="${action.objectId}"`);
    expect(markup).toContain(`data-contact-owner="${action.actorId}"`);
    expect(markup).toContain('pointer-events="none"');
    // Foreground fingertips are painted after the real held prop element.
    expect(markup.indexOf(`data-element-id="${action.objectId}"`))
      .toBeLessThan(markup.indexOf('data-cinematic-prop-contact="true"'));
    const beforePickup = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 3, labelled: false,
    }));
    expect(beforePickup).not.toContain("data-cinematic-prop-contact");
    const afterRelease = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 12.5, labelled: false,
    }));
    expect(afterRelease).not.toContain("data-cinematic-prop-contact");
  });

  it("protects Classic, calm preview, missing/pictured hands, and actions without a real hold", () => {
    const { project, scene } = fixture();
    const time = 7;
    const frames = sceneFramesAt(project, scene, time);
    expect(cinematicContactsAt(project, scene, frames, time, true)).toEqual([]);
    project.visualStyle = undefined;
    expect(cinematicContactsAt(project, scene, frames, time, false)).toEqual([]);
    const classic = renderToStaticMarkup(createElement(Stage, {
      project, scene, time, labelled: false,
    }));
    expect(classic).not.toContain("data-cinematic-prop-contact");
    project.visualStyle = "storybook-cinematic";
    const original = project.characters[0];
    project.characters[0] = { ...original, puppet: {
      ...original.puppet!, parts: original.puppet!.parts.map(part =>
        part.role === "rightHand" ? { ...part, assetId: "drawn-palm" } : part),
    } };
    expect(cinematicContactsAt(project, scene, frames, time, false)).toEqual([]);
    project.characters[0] = original;
    const noHold = new Map(frames);
    noHold.set(scene.interactions![0].objectId, {
      ...frames.get(scene.interactions![0].objectId)!, heldBy: undefined,
    });
    expect(cinematicContactsAt(project, scene, noHold, time, false)).toEqual([]);
  });
});
