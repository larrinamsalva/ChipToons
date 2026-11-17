import { describe, expect, it } from "vitest";
import type { Scene } from "./model";
import { makeScene } from "./model";
import { sunnyRig, validJoints } from "./puppet-model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopSeat, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { standWorkshopFromFurniture } from "./workshop-seat-stand";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";
import { elementAt } from "./timeline";

function fixture(kind: "chair" | "bench" = "chair", duration = 8) {
  const hero = newWorkshopPuppetStarter();
  const scene = makeScene([hero]);
  scene.duration = duration;
  scene.elements[0].motion = "still";
  const actorId = scene.elements[0].id;
  const furniture = addWorkshopSeat(scene, scene.elements[0], kind);
  const seated = seatWorkshopAtFurniture(furniture.scene, actorId, furniture.seatId, hero.puppet!);
  return { hero, scene: seated, actorId, seatId: furniture.seatId };
}

describe("PR #158 seated hello and real articulated waving", () => {
  it("preserves seated hips, legs and original 13 keys while waving right arm, elbow and wrist", () => {
    const { hero, scene, actorId, seatId } = fixture();
    const input = JSON.stringify(scene);
    const original = scene.elements.find(item => item.id === actorId)!;
    const furniture = scene.elements.find(item => item.id === seatId)!;
    const sittingKeys = original.animation!.keyframes;
    const output = waveWorkshopWhileSeated(scene, actorId, seatId, hero.puppet!);
    const actor = output.elements.find(item => item.id === actorId)!;
    const frames = actor.animation!.keyframes;
    expect(frames).toHaveLength(25);
    expect(frames.slice(0, 13)).toEqual(sittingKeys);
    expect(new Set(frames.map(frame => frame.id)).size).toBe(25);
    expect(new Set(frames.map(frame => frame.time)).size).toBe(25);
    const baseJoints = sittingKeys.at(-1)!.joints!;
    const halfway = frames.find(frame => frame.time === 4.5)!;
    const wristBeat = frames.find(frame => frame.time === 4.25)!;
    expect(halfway.pose).toBe("sitting");
    expect(halfway.y).toBeCloseTo(sittingKeys.at(-1)!.y, 8);
    expect(halfway.x).toBe(original.x);
    expect(halfway.joints!.rightArm!.angle).toBeLessThan(-70);
    // The elbow is neutral at the wave midpoint, but flexes on the
    // offbeat. Compare the animated elbow against its real seated angle
    // rather than expecting an unrelated -35 degree threshold.
    expect(wristBeat.joints!.rightForearm!.angle)
      .toBeLessThan(baseJoints.rightForearm!.angle - 4);
    expect(Math.abs(wristBeat.joints!.rightHand!.angle - baseJoints.rightHand!.angle))
      .toBeGreaterThan(1);
    for (const frame of frames.slice(13)) {
      expect(frame.pose).toBe("sitting");
      expect(frame.joints!.leftLeg).toEqual(baseJoints.leftLeg);
      expect(frame.joints!.rightLeg).toEqual(baseJoints.rightLeg);
      expect(frame.joints!.leftShin).toEqual(baseJoints.leftShin);
      expect(frame.joints!.rightShin).toEqual(baseJoints.rightShin);
      expect(frame.joints!.leftFoot).toEqual(baseJoints.leftFoot);
      expect(frame.joints!.rightFoot).toEqual(baseJoints.rightFoot);
      expect(validJoints(frame.joints ?? {}, new Set(hero.puppet!.parts.map(part => part.id))))
        .toBe(true);
    }
    expect(frames.at(-1)!.joints).toEqual(baseJoints);
    expect(frames.at(-1)!.pose).toBe("sitting");
    expect(elementAt(actor, 4.5, scene.duration).pose).toBe("sitting");
    expect(elementAt(actor, 7.5, scene.duration).pose).toBe("sitting");
    expect(output.elements.find(item => item.id === seatId)).toEqual(furniture);
    expect(JSON.stringify(scene)).toBe(input);
  });

  it("supports a bench and a 6-second scene without changing the seat or finish pose", () => {
    const { hero, scene, actorId, seatId } = fixture("bench", 6);
    const original = JSON.stringify(scene);
    const result = waveWorkshopWhileSeated(scene, actorId, seatId, hero.puppet!);
    const actor = result.elements.find(item => item.id === actorId)!;
    expect(actor.animation!.keyframes).toHaveLength(25);
    expect(actor.animation!.keyframes.at(-1)!.time).toBe(6);
    expect(actor.animation!.keyframes.at(-1)!.pose).toBe("sitting");
    expect(result.elements.find(item => item.id === seatId))
      .toEqual(scene.elements.find(item => item.id === seatId));
    expect(JSON.stringify(scene)).toBe(original);
  });

  it("refuses customized, repeated, moved-seat, handoff, legacy and too-short scenes", () => {
    const { hero, scene, actorId, seatId } = fixture();
    const output = waveWorkshopWhileSeated(scene, actorId, seatId, hero.puppet!);
    expect(() => waveWorkshopWhileSeated(output, actorId, seatId, hero.puppet!))
      .toThrow(/edited/);
    expect(() => standWorkshopFromFurniture(output, actorId, seatId, hero.puppet!))
      .toThrow(/edited/);
    expect(() => waveWorkshopWhileSeated(scene, actorId, seatId, sunnyRig()))
      .toThrow(/complete original workshop/);
    expect(() => waveWorkshopWhileSeated({ ...scene, duration: 5 }, actorId, seatId, hero.puppet!))
      .toThrow(/six seconds/);
    const customized: Scene = {
      ...scene,
      elements: scene.elements.map(item => item.id === actorId
        ? {
          ...item,
          animation: {
            ...item.animation!,
            keyframes: item.animation!.keyframes.map((key, i) =>
              i === 6 ? { ...key, y: key.y + 3 } : key),
          },
        }
        : item),
    };
    expect(() => waveWorkshopWhileSeated(customized, actorId, seatId, hero.puppet!))
      .toThrow(/edited/);
    const moved: Scene = {
      ...scene,
      elements: scene.elements.map(item =>
        item.id === seatId ? { ...item, y: item.y + 10 } : item),
    };
    expect(() => waveWorkshopWhileSeated(moved, actorId, seatId, hero.puppet!))
      .toThrow(/seat or character moved/);
    expect(() => waveWorkshopWhileSeated({
      ...scene,
      interactions: [{
        id: "linked", kind: "give", actorId, objectId: seatId,
        start: 0, attach: 1, finish: 2, grip: { hand: "right", x: 0, y: 0 },
      }],
    }, actorId, seatId, hero.puppet!)).toThrow(/timed interaction/);
  });
});
