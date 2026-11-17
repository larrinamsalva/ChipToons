import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import {
  addWorkshopBench, addWorkshopChair, addWorkshopSeat,
  isSeatFurniture, seatWorkshopAtFurniture,
} from "./workshop-seating-stage";

function fixture() {
  const hero = newWorkshopPuppetStarter();
  const scene = makeScene([hero]);
  scene.duration = 8;
  scene.elements[0].motion = "still";
  return { hero, scene, actor: scene.elements[0] };
}

describe("PR #157 choose illustrated workshop chair or bench", () => {
  it("adds one actual bench behind the performer without rewriting any scene objects", () => {
    const { scene, actor } = fixture();
    const original = JSON.stringify(scene);
    const { scene: next, seatId } = addWorkshopSeat(scene, actor, "bench");
    const bench = next.elements.find(item => item.id === seatId)!;
    expect(bench).toMatchObject({
      kind: "prop", prop: "bench", name: "Workshop bench",
      motion: "still", sceneryDepth: "behind",
      x: actor.x, y: Math.min(430, actor.y + 15),
      rotation: 0, flip: false, scale: 1,
    });
    expect(isSeatFurniture(bench)).toBe(true);
    expect(next.elements[0]).toEqual(actor);
    expect(next.elements).toHaveLength(scene.elements.length + 1);
    expect(JSON.stringify(scene)).toBe(original);
  });

  it("preserves existing Add Workshop Chair callers and supports choosing either seat", () => {
    const { hero, scene, actor } = fixture();
    const original = JSON.stringify(scene);
    const { scene: withChair, chairId } = addWorkshopChair(scene, actor);
    const { scene: withBoth, benchId } = addWorkshopBench(withChair, actor);
    expect(chairId).not.toBe(benchId);
    expect(withBoth.elements.map(item => item.prop).filter(Boolean))
      .toEqual(["chair", "bench"]);
    const chair = withBoth.elements.find(item => item.id === chairId)!;
    const bench = withBoth.elements.find(item => item.id === benchId)!;
    const aligned = seatWorkshopAtFurniture(withBoth, actor.id, benchId, hero.puppet!);
    const seated = aligned.elements.find(item => item.id === actor.id)!;
    expect(seated.animation?.keyframes).toHaveLength(13);
    expect(seated.animation?.keyframes.at(-1)?.pose).toBe("sitting");
    expect(aligned.elements.find(item => item.id === chairId)).toEqual(chair);
    expect(aligned.elements.find(item => item.id === benchId)).toEqual(bench);
    expect(JSON.stringify(scene)).toBe(original);
  });

  it("honors the 20-object scene limit and rejects a character missing from the scene", () => {
    const { scene, actor } = fixture();
    const { scene: oneSeat } = addWorkshopBench(scene, actor);
    const bench = oneSeat.elements[1];
    const full = {
      ...oneSeat,
      elements: [...oneSeat.elements, ...Array.from({ length: 18 }, (_, index) =>
        ({ ...bench, id: `extra-seat-${index}` }))],
    };
    expect(full.elements).toHaveLength(20);
    expect(() => addWorkshopSeat(full, actor, "chair")).toThrow(/20 objects/);
    expect(() => addWorkshopSeat(full, actor, "bench")).toThrow(/20 objects/);
    expect(() => addWorkshopSeat({ ...scene, elements: [] }, actor, "bench"))
      .toThrow(/Choose a character/);
  });
});
