import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopSeat, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { standWorkshopFromFurniture } from "./workshop-seat-stand";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";
import { standAfterSeatedGreeting } from "./workshop-sit-wave-stand";
import { workshopSeatingReviewMoments } from "./workshop-seating-review";

function fixture(duration = 10, kind: "chair" | "bench" = "chair") {
  const hero = newWorkshopPuppetStarter();
  const scene = makeScene([hero]);
  scene.duration = duration;
  scene.elements[0].motion = "still";
  const actorId = scene.elements[0].id;
  const { scene: withSeat, seatId } = addWorkshopSeat(scene, scene.elements[0], kind);
  const sitting = seatWorkshopAtFurniture(withSeat, actorId, seatId, hero.puppet!);
  return { hero, scene: sitting, actorId, seatId };
}

describe("PR #160 read-only sitting/waving/standing moment review", () => {
  it("identifies real saved keyframe moments in a complete chair scene without modifying it", () => {
    const { scene, actorId, seatId, hero } = fixture(10);
    const waving = waveWorkshopWhileSeated(scene, actorId, seatId, hero.puppet!);
    const final = standAfterSeatedGreeting(waving, actorId, seatId, hero.puppet!);
    const before = JSON.stringify(final);
    const moments = workshopSeatingReviewMoments(final, actorId);
    expect(moments).toEqual([
      { id: "seated", label: "Review sitting", seconds: 3 },
      { id: "wave", label: "Review wave", seconds: 4.5 },
      { id: "rise", label: "Review rising", seconds: 8.5 },
      { id: "standing", label: "Review standing", seconds: 10 },
    ]);
    for (const moment of moments)
      expect(final.elements[0].animation?.keyframes.some(key =>
        Math.abs(key.time - moment.seconds) < .001)).toBe(true);
    expect(JSON.stringify(final)).toBe(before);
  });

  it("finds a seated hello's settled pose, but does not invent standing", () => {
    const { scene, actorId, seatId, hero } = fixture(8, "bench");
    const waved = waveWorkshopWhileSeated(scene, actorId, seatId, hero.puppet!);
    expect(workshopSeatingReviewMoments(waved, actorId)).toEqual([
      { id: "seated", label: "Review sitting", seconds: 3 },
      { id: "wave", label: "Review wave", seconds: 4.5 },
      { id: "settled", label: "Review settled pose", seconds: 6 },
    ]);
  });

  it("provides sitting alone and a true rising beat for sit-and-stand on a bench", () => {
    const { scene, actorId, seatId, hero } = fixture(8, "bench");
    expect(workshopSeatingReviewMoments(scene, actorId)).toEqual([
      { id: "seated", label: "Review sitting", seconds: 3 },
    ]);
    const standing = standWorkshopFromFurniture(scene, actorId, seatId, hero.puppet!);
    expect(workshopSeatingReviewMoments(standing, actorId)).toEqual([
      { id: "seated", label: "Review sitting", seconds: 3 },
      { id: "rise", label: "Review rising", seconds: 6.5 },
      { id: "standing", label: "Review standing", seconds: 8 },
    ]);
  });

  it("does not guess review beats for unanimated or unrelated character movement", () => {
    const { scene, actorId } = fixture(10);
    const plain = {
      ...scene,
      elements: scene.elements.map(item => item.id === actorId
        ? { ...item, animation: undefined } : item),
    };
    expect(workshopSeatingReviewMoments(plain, actorId)).toEqual([]);
    expect(workshopSeatingReviewMoments(scene, "no-such-character")).toEqual([]);
    const altered = {
      ...scene,
      elements: scene.elements.map(item => item.id === actorId
        ? {
          ...item,
          animation: { ...item.animation!, keyframes: item.animation!.keyframes.map(key =>
            key.time === 3 ? { ...key, joints: undefined } : key),
          },
        } : item),
    };
    expect(workshopSeatingReviewMoments(altered, actorId)).toEqual([]);
  });
});
