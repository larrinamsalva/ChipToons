import { describe, expect, it } from "vitest";
import { cinematicActionHeadAt } from "./cinematic-head-attention";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { sceneElementAt, sceneFramesAt } from "./timeline";

function setup() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const share = scene.interactions![0];
  const scout = scene.elements.find(item => item.id === share.actorId)!;
  const jo = scene.elements.find(item => item.id === share.transfer!.actorId)!;
  return { project, scene, share, scout, jo };
}

describe("Cinematic action head attention", () => {
  it("adds subtle head acting to Scout's checklist pickup and Jo's receiving gesture", () => {
    const { project, scene, scout, jo } = setup();
    const snapshot = JSON.stringify(project);
    for (const [actor, t] of [[scout, 7], [jo, 10.3]] as const) {
      const before = sceneElementAt(project, scene, actor, t, 0);
      const after = sceneFramesAt(project, scene, t).get(actor.id)!;
      expect(after.joints?.head).toBeDefined();
      const difference = (after.joints?.head?.angle ?? 0) -
        (before.joints?.head?.angle ?? 0);
      expect(Math.abs(difference)).toBeGreaterThan(0.1);
      expect(Math.abs(difference)).toBeLessThanOrEqual(5.5);
      expect(sceneFramesAt(project, scene, t).get(actor.id)).toEqual(after);
    }
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("looks to either side of the actual moving story prop and mirrors with the character", () => {
    const { project, scene, share, scout } = setup();
    const t = 7;
    const base = sceneElementAt(project, scene, scout, t, 0);
    const frames = sceneFramesAt(project, scene, t);
    const prop = frames.get(share.objectId)!;
    const look = (dx: number, flipped: boolean) =>
      cinematicActionHeadAt(project, scene, { ...scout, flip: flipped }, base,
        new Map(frames).set(share.objectId, {
          ...prop, x: base.x + dx, y: base.y - 60,
        }), t, false);
    const original = base.joints?.head?.angle ?? 0;
    const left = look(-120, false).joints?.head?.angle ?? 0;
    const right = look(120, false).joints?.head?.angle ?? 0;
    const mirrored = look(120, true).joints?.head?.angle ?? 0;
    expect(left).toBeLessThan(original - 2);
    expect(right).toBeGreaterThan(original + 2);
    expect(mirrored - original).toBeCloseTo(original - right, 8);
    expect(Math.abs(right - original)).toBeLessThanOrEqual(5.5);
  });

  it("eases completely away at action boundaries and after release, keeping old head poses", () => {
    const { project, scene, scout, jo } = setup();
    for (const [actor, times] of [
      [scout, [0, 4, 9.8, 13.5]],
      [jo, [0, 9.25, 12, 13.5]],
    ] as const) {
      for (const t of times) {
        const original = sceneElementAt(project, scene, actor, t, 0);
        const result = sceneFramesAt(project, scene, t).get(actor.id)!;
        expect(result.joints?.head?.angle).toBeCloseTo(original.joints?.head?.angle ?? 0, 7);
      }
    }
  });

  it("respects Classic mode, calm previews, image-backed heads and invalid targets", () => {
    const { project, scene, share, scout } = setup();
    const t = 7;
    const base = sceneElementAt(project, scene, scout, t, 0);
    const frames = sceneFramesAt(project, scene, t);
    const unchanged = (calm: boolean) =>
      cinematicActionHeadAt(project, scene, scout, base, frames, t, calm);
    expect(unchanged(true)).toEqual(base);
    project.visualStyle = undefined;
    expect(unchanged(false)).toEqual(base);
    project.visualStyle = "storybook-cinematic";
    const original = project.characters[0];
    project.characters[0] = { ...original, puppet: {
      ...original.puppet!, parts: original.puppet!.parts.map(part =>
        part.role === "head" ? { ...part, assetId: "painted-head" } : part),
    } };
    expect(unchanged(false)).toEqual(base);
    project.characters[0] = original;
    expect(cinematicActionHeadAt(project, { interactions: undefined },
      scout, base, frames, t, false)).toEqual(base);
    const badFrames = new Map(frames);
    badFrames.set(share.objectId, {
      ...badFrames.get(share.objectId)!, opacity: 0,
    });
    expect(cinematicActionHeadAt(project, scene, scout, base, badFrames, t, false)).toEqual(base);
  });
});
