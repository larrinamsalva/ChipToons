import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import type { Scene, SceneElement } from "./model";
import { sunnyRig, validJoints } from "./puppet-model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopChair, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { standWorkshopFromFurniture } from "./workshop-seat-stand";
import { elementAt } from "./timeline";

function seatedFixture(duration = 8, seatType: "chair" | "bench" = "chair") {
  const hero = newWorkshopPuppetStarter();
  const scene = makeScene([hero]);
  scene.duration = duration;
  scene.elements[0].motion = "still";
  const actorId = scene.elements[0].id;
  const { scene: furnished, chairId } = addWorkshopChair(scene, scene.elements[0]);
  const withSeat: Scene = {
    ...furnished,
    elements: furnished.elements.map(element =>
      element.id === chairId ? { ...element, prop: seatType } : element),
  };
  const seated = seatWorkshopAtFurniture(withSeat, actorId, chairId, hero.puppet!);
  return { hero, scene: seated, actorId, seatId: chairId };
}

function actor(scene: Scene, actorId: string): SceneElement {
  return scene.elements.find(element => element.id === actorId)!;
}

describe("PR #156 append stand up from a real chair or bench", () => {
  it("retains every original sit key, holds on the chair, and stands up for the last three seconds", () => {
    const { hero, scene, actorId, seatId } = seatedFixture();
    const original = JSON.stringify(scene);
    const seated = actor(scene, actorId);
    const sitKeys = seated.animation!.keyframes;
    const furniture = scene.elements.find(element => element.id === seatId)!;

    const updated = standWorkshopFromFurniture(scene, actorId, seatId, hero.puppet!);
    const rising = actor(updated, actorId);
    const frames = rising.animation!.keyframes;
    expect(frames).toHaveLength(26);
    expect(frames.slice(0, 13)).toEqual(sitKeys);
    expect(frames.map(key => key.time)).toEqual([...frames.map(key => key.time)].sort((a, b) => a - b));
    expect(new Set(frames.map(key => key.time)).size).toBe(frames.length);
    expect(new Set(frames.map(key => key.id)).size).toBe(frames.length);

    const hold = frames.find(key => key.time === 5)!;
    expect(hold.pose).toBe("sitting");
    expect(hold.y).toBeCloseTo(sitKeys.at(-1)!.y, 8);
    expect(hold.joints).toEqual(sitKeys.at(-1)!.joints);
    expect(elementAt(rising, 4, scene.duration).pose).toBe("sitting");

    const halfStand = frames.find(key => key.time === 6.5)!;
    expect(halfStand.y).toBeCloseTo(rising.y + 10, 8);
    expect(halfStand.joints!.leftShin!.angle).toBeGreaterThan(25);
    expect(halfStand.joints!.rightShin!.angle).toBeGreaterThan(25);
    expect(halfStand.joints!.torso!.angle).toBeGreaterThan(3);

    const finish = frames.at(-1)!;
    expect(finish.time).toBe(8);
    expect(finish.pose).toBe("standing");
    expect(finish.y).toBeCloseTo(rising.y, 8);
    expect(Object.values(finish.joints ?? {}).every(j => Math.abs(j.angle) < 1e-8)).toBe(true);
    expect(elementAt(rising, 8, scene.duration).pose).toBe("standing");
    expect(frames.every(key => key.x === rising.x)).toBe(true);
    for (const key of frames)
      expect(validJoints(key.joints ?? {}, new Set(hero.puppet!.parts.map(part => part.id)))).toBe(true);
    expect(updated.elements.find(element => element.id === seatId)).toEqual(furniture);
    expect(JSON.stringify(scene)).toBe(original);
  });

  it("handles a six-second scene with continuous sit-to-stand at three seconds", () => {
    const { hero, scene, actorId, seatId } = seatedFixture(6);
    const updated = standWorkshopFromFurniture(scene, actorId, seatId, hero.puppet!);
    const keys = actor(updated, actorId).animation!.keyframes;
    expect(keys).toHaveLength(25);
    expect(keys.filter(key => key.time === 3)).toHaveLength(1);
    expect(keys.at(-1)?.time).toBe(6);
    expect(keys.at(-1)?.pose).toBe("standing");
  });

  it("works for a bench without moving the bench or changing existing sit keys", () => {
    const { hero, scene, actorId, seatId } = seatedFixture(8, "bench");
    const original = JSON.stringify(scene);
    const updated = standWorkshopFromFurniture(scene, actorId, seatId, hero.puppet!);
    expect(actor(updated, actorId).animation!.keyframes.slice(0, 13))
      .toEqual(actor(scene, actorId).animation!.keyframes);
    expect(updated.elements.find(item => item.id === seatId))
      .toEqual(scene.elements.find(item => item.id === seatId));
    expect(JSON.stringify(scene)).toBe(original);
  });

  it("refuses customized motion, moved furniture, duplicate actions and incomplete rigs", () => {
    const { hero, scene, actorId, seatId } = seatedFixture();
    const customized: Scene = {
      ...scene,
      elements: scene.elements.map(item => item.id === actorId
        ? {
          ...item, animation: {
            ...item.animation!,
            keyframes: item.animation!.keyframes.map((frame, index) =>
              index === 6 ? { ...frame, rotation: frame.rotation + 2 } : frame),
          },
        }
        : item),
    };
    expect(() => standWorkshopFromFurniture(customized, actorId, seatId, hero.puppet!))
      .toThrow(/edited/);
    const moved: Scene = {
      ...scene,
      elements: scene.elements.map(item => item.id === seatId
        ? { ...item, x: item.x + 25 } : item),
    };
    expect(() => standWorkshopFromFurniture(moved, actorId, seatId, hero.puppet!))
      .toThrow(/seat or character moved/);
    expect(() => standWorkshopFromFurniture(scene, actorId, seatId, sunnyRig()))
      .toThrow(/complete original workshop/);
    const once = standWorkshopFromFurniture(scene, actorId, seatId, hero.puppet!);
    expect(() => standWorkshopFromFurniture(once, actorId, seatId, hero.puppet!))
      .toThrow(/edited/);
    expect(() => standWorkshopFromFurniture({ ...scene, duration: 5.5 }, actorId, seatId, hero.puppet!))
      .toThrow(/six seconds/);
    expect(() => standWorkshopFromFurniture(scene, actorId, "not-a-seat", hero.puppet!))
      .toThrow(/chair or bench/);
    expect(() => standWorkshopFromFurniture({
      ...scene, interactions: [{ id: "linked", kind: "give", actorId,
        objectId: seatId, start: 0, attach: 1, finish: 2,
        grip: { hand: "right", x: 0, y: 0 } }],
    }, actorId, seatId, hero.puppet!)).toThrow(/timed interaction/);
  });
});
