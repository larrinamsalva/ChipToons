import { describe, expect, it } from "vitest";
import { makeScene } from "./model";
import type { SceneElement } from "./model";
import { puppetTransforms, sunnyRig } from "./puppet-model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopChair, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { elementAt } from "./timeline";

function fixture() {
  const hero = newWorkshopPuppetStarter();
  const scene = makeScene([hero]);
  scene.duration = 8;
  scene.elements[0].motion = "still";
  const actor = scene.elements[0];
  const withChair = addWorkshopChair(scene, actor);
  return { hero, scene: withChair.scene, actor, chairId: withChair.chairId };
}

describe("PR #155 chair and bench seated alignment", () => {
  it("adds a real chair without altering characters or other scene data", () => {
    const { scene, chairId, actor } = fixture();
    expect(scene.elements).toHaveLength(2);
    const chair = scene.elements.find(e => e.id === chairId)!;
    expect(chair.prop).toBe("chair");
    expect(chair.sceneryDepth).toBe("behind");
    expect(chair.kind).toBe("prop");
    expect(scene.elements[0].id).toBe(actor.id);
  });

  it("matches actual rendered pelvis to a chosen chair seat and saves editable sitting keys", () => {
    const { scene, actor, hero, chairId } = fixture();
    const original = JSON.stringify(scene);
    const updated = seatWorkshopAtFurniture(scene, actor.id, chairId, hero.puppet!);
    const sit = updated.elements.find(e => e.id === actor.id)!;
    const chair = updated.elements.find(e => e.id === chairId)!;
    expect(sit.animation?.keyframes).toHaveLength(13);
    expect(sit.animation?.keyframes[0].time).toBe(0);
    const last = sit.animation!.keyframes.find(k => k.time === 3)!;
    expect(last.pose).toBe("sitting");
    expect(last.y).toBeCloseTo(sit.y + 20, 8);
    // The root origin is not the pelvis center. Verify the *rendered*
    // seated hip anchor is centered over the furniture, not the actor's
    // arbitrary origin (which is offset several pixels in this rig).
    const hipWorld = puppetTransforms(hero.puppet!, last.joints ?? {});
    const hipPoints = ["leftLeg", "rightLeg"].map(role => {
      const index = hero.puppet!.parts.findIndex(p => p.role === role);
      return hipWorld[index];
    });
    const stageHipX = sit.x + ((hipPoints[0].x + hipPoints[1].x) / 2) * sit.scale;
    expect(stageHipX).toBeCloseTo(chair.x, 6);
    expect(chair.sceneryDepth).toBe("behind");
    expect(updated.elements.find(e => e.id === actor.id)?.animation).toBeDefined();
    const transform = puppetTransforms(hero.puppet!, last.joints ?? {});
    const hips = ["leftLeg", "rightLeg"].map(role => {
      const index = hero.puppet!.parts.findIndex(p => p.role === role);
      return transform[index];
    });
    const stageHipY = last.y + ((hips[0].y + hips[1].y) / 2) * sit.scale;
    expect(stageHipY).toBeCloseTo(chair.y - 44 * chair.scale - 8 * sit.scale, 6);
    expect(elementAt(sit, 3, scene.duration).pose).toBe("sitting");
    expect(JSON.stringify(scene)).toBe(original);
  });

  it("aligns a bench just as safely, without touching another prop", () => {
    const { scene, actor, hero, chairId } = fixture();
    const bench: SceneElement = {
      ...scene.elements[1], id: "seat_bench", prop: "bench",
      x: 570, y: 380, scale: 1.2, name: "Garden bench",
      sceneryDepth: "front",
    };
    const original = JSON.stringify(scene);
    const withBench = { ...scene, elements: [...scene.elements, bench] };
    const updated = seatWorkshopAtFurniture(withBench, actor.id, bench.id, hero.puppet!);
    const seated = updated.elements[0];
    const resultBench = updated.elements.find(e => e.id === bench.id)!;
    expect(resultBench.sceneryDepth).toBe("behind");
    expect(updated.elements.find(e => e.id === chairId)).toEqual(scene.elements[1]);
    expect(seated.animation?.keyframes.at(-1)?.pose).toBe("sitting");
    expect(seated.x).toBeGreaterThan(530);
    expect(seated.x).toBeLessThan(610);
    expect(JSON.stringify(scene)).toBe(original);
  });

  it("refuses to overwrite existing animation, active handoffs, or legacy puppets", () => {
    const { scene, actor, hero, chairId } = fixture();
    const animated = seatWorkshopAtFurniture(scene, actor.id, chairId, hero.puppet!);
    expect(() => seatWorkshopAtFurniture(animated, actor.id, chairId, hero.puppet!))
      .toThrow(/already has movement/);
    expect(() => seatWorkshopAtFurniture(scene, actor.id, chairId, sunnyRig()))
      .toThrow(/complete original workshop/);
    const linked = {
      ...scene,
      interactions: [{
        id: "fake_interaction", kind: "give" as const,
        actorId: actor.id, objectId: chairId,
        start: 0, attach: 1, finish: 2, grip: { hand: "right" as const, x: 0, y: 0 },
      }],
    };
    expect(() => seatWorkshopAtFurniture(linked, actor.id, chairId, hero.puppet!))
      .toThrow(/timed interaction/);
    const moving = {
      ...scene,
      elements: scene.elements.map(e => e.id === chairId
        ? { ...e, rotation: 12 } : e),
    };
    expect(() => seatWorkshopAtFurniture(moving, actor.id, chairId, hero.puppet!))
      .toThrow(/unrotated/);
  });
});
