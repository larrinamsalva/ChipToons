import { describe, expect, it } from "vitest";
import type { Scene } from "./model";
import { makeScene } from "./model";
import { sunnyRig, validJoints } from "./puppet-model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopSeat, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";
import { standAfterSeatedGreeting } from "./workshop-sit-wave-stand";
import { elementAt } from "./timeline";

function fixture(kind: "chair" | "bench" = "chair", duration = 10) {
  const hero = newWorkshopPuppetStarter();
  const scene = makeScene([hero]);
  scene.duration = duration;
  scene.elements[0].motion = "still";
  const actorId = scene.elements[0].id;
  const furniture = addWorkshopSeat(scene, scene.elements[0], kind);
  const sitting = seatWorkshopAtFurniture(
    furniture.scene, actorId, furniture.seatId, hero.puppet!,
  );
  const waving = waveWorkshopWhileSeated(
    sitting, actorId, furniture.seatId, hero.puppet!,
  );
  return { hero, scene: waving, actorId, seatId: furniture.seatId };
}

describe("PR #159 sit, wave hello, and stand from furniture", () => {
  it("preserves every sit and wave key, holds seated, and rises with actual legs and arms", () => {
    const { hero, scene, actorId, seatId } = fixture();
    const original = JSON.stringify(scene);
    const originalActor = scene.elements.find(item => item.id === actorId)!;
    const originalSeat = scene.elements.find(item => item.id === seatId)!;
    const old = originalActor.animation!.keyframes;
    const updated = standAfterSeatedGreeting(scene, actorId, seatId, hero.puppet!);
    const actor = updated.elements.find(item => item.id === actorId)!;
    const frames = actor.animation!.keyframes;
    expect(frames).toHaveLength(38);
    expect(frames.slice(0, 25)).toEqual(old);
    expect(new Set(frames.map(frame => frame.time)).size).toBe(frames.length);
    expect(new Set(frames.map(frame => frame.id)).size).toBe(frames.length);
    expect(frames.map(frame => frame.time)).toEqual(
      [...frames.map(frame => frame.time)].sort((a, b) => a - b),
    );
    const seated = old.at(-1)!;
    const hold = frames.find(frame => frame.time === 7)!;
    expect(hold.pose).toBe("sitting");
    expect(hold.y).toBeCloseTo(seated.y, 8);
    expect(hold.joints).toEqual(seated.joints);
    expect(elementAt(actor, 6.5, scene.duration).pose).toBe("sitting");
    expect(elementAt(actor, 8.5, scene.duration).pose).toBe("sitting");
    const midStand = frames.find(frame => frame.time === 8.5)!;
    expect(midStand.y).toBeCloseTo(actor.y + 10, 8);
    expect(midStand.joints!.leftShin!.angle).toBeGreaterThan(25);
    expect(midStand.joints!.rightShin!.angle).toBeGreaterThan(25);
    const finish = frames.at(-1)!;
    expect(finish.time).toBe(10);
    expect(finish.pose).toBe("standing");
    expect(finish.y).toBeCloseTo(actor.y, 8);
    expect(Object.values(finish.joints ?? {}).every(joint =>
      Math.abs(joint.angle) < 1e-8)).toBe(true);
    expect(elementAt(actor, 10, scene.duration).pose).toBe("standing");
    expect(frames.every(frame => frame.x === actor.x)).toBe(true);
    for (const frame of frames)
      expect(validJoints(frame.joints ?? {}, new Set(hero.puppet!.parts.map(p => p.id))))
        .toBe(true);
    expect(updated.elements.find(item => item.id === seatId)).toEqual(originalSeat);
    expect(JSON.stringify(scene)).toBe(original);
  });

  it("uses an exact nine-second sit-wave-stand on a bench without a duplicate boundary key", () => {
    const { hero, scene, actorId, seatId } = fixture("bench", 9);
    const output = standAfterSeatedGreeting(scene, actorId, seatId, hero.puppet!);
    const keys = output.elements.find(item => item.id === actorId)!.animation!.keyframes;
    expect(keys).toHaveLength(37);
    expect(keys.filter(key => key.time === 6)).toHaveLength(1);
    expect(keys.at(-1)!.time).toBe(9);
    expect(keys.at(-1)!.pose).toBe("standing");
    expect(output.elements.find(item => item.id === seatId))
      .toEqual(scene.elements.find(item => item.id === seatId));
  });

  it("refuses edited wave, moved furniture, duplicate action, incomplete rigs or short scenes", () => {
    const { hero, scene, actorId, seatId } = fixture();
    const completed = standAfterSeatedGreeting(scene, actorId, seatId, hero.puppet!);
    expect(() => standAfterSeatedGreeting(completed, actorId, seatId, hero.puppet!))
      .toThrow(/First use Wave Hello/);
    expect(() => standAfterSeatedGreeting(scene, actorId, seatId, sunnyRig()))
      .toThrow(/complete original workshop/);
    expect(() => standAfterSeatedGreeting({ ...scene, duration: 8 }, actorId, seatId, hero.puppet!))
      .toThrow(/nine seconds/);
    const customized: Scene = {
      ...scene,
      elements: scene.elements.map(item => item.id === actorId ? {
        ...item,
        animation: {
          ...item.animation!,
          keyframes: item.animation!.keyframes.map((frame, index) =>
            index === 19 ? { ...frame, rotation: frame.rotation + 3 } : frame),
        },
      } : item),
    };
    expect(() => standAfterSeatedGreeting(customized, actorId, seatId, hero.puppet!))
      .toThrow(/edited/);
    const moved: Scene = {
      ...scene,
      elements: scene.elements.map(item => item.id === seatId
        ? { ...item, x: item.x + 10 } : item),
    };
    expect(() => standAfterSeatedGreeting(moved, actorId, seatId, hero.puppet!))
      .toThrow(/seat or character moved/);
    expect(() => standAfterSeatedGreeting(scene, actorId, "unknown-seat", hero.puppet!))
      .toThrow(/chair or bench/);
    const linked: Scene = {
      ...scene,
      interactions: [{
        id: "linked", kind: "give", actorId, objectId: seatId,
        start: 0, attach: 1, finish: 2,
        grip: { hand: "right", x: 0, y: 0 },
      }],
    };
    expect(() => standAfterSeatedGreeting(linked, actorId, seatId, hero.puppet!))
      .toThrow(/timed interaction/);
  });
});
