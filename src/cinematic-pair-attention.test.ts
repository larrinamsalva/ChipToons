import { describe, expect, it } from "vitest";
import { cinematicPairAttentionAt } from "./cinematic-pair-attention";
import { cinematicFaceAt } from "./cinematic-face";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { sceneFramesAt } from "./timeline";

function fixture() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const [scout, jo] = scene.elements.filter(item => !!item.characterId);
  scene.interactions = [];
  scene.cameraShots = [{
    id: "two-shot", style: "pair", start: 2, end: 6,
    note: "Let both performers listen together.",
    targets: [scout.id, jo.id], move: 0,
    frame: { x: 400, y: 225, zoom: 1.4 },
    follow: false, offset: { x: 0, y: 0 },
    placement: "center",
  }];
  return { project, scene, scout, jo };
}

describe("PR #107 cinematic pair-shot attention", () => {
  it("keeps both original performers subtly looking toward each other in a real pair shot", () => {
    const { project, scene, scout, jo } = fixture();
    const before = JSON.stringify(project);
    const time = 4;
    const frames = sceneFramesAt(project, scene, time);
    const a = cinematicPairAttentionAt(project, scene, scout, frames, time, false)!;
    const b = cinematicPairAttentionAt(project, scene, jo, frames, time, false)!;
    expect(a.partnerId).toBe(jo.id);
    expect(b.partnerId).toBe(scout.id);
    expect(a.dx).toBeGreaterThan(0);
    expect(b.dx).toBeLessThan(0);
    expect(a.focus).toBeGreaterThan(.7);
    expect(b.focus).toBeCloseTo(a.focus);
    const scoutFace = cinematicFaceAt(project, scene, scout, frames.get(scout.id)!,
      frames, time, false)!;
    const joFace = cinematicFaceAt(project, scene, jo, frames.get(jo.id)!,
      frames, time, false)!;
    expect(scoutFace.x).toBeGreaterThan(1);
    expect(joFace.x).toBeLessThan(-1);
    expect(sceneFramesAt(project, scene, time)).toEqual(frames);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("staggered paired glances enter and exit in a natural order without saving new keys", () => {
    const { project, scene, scout, jo } = fixture();
    const snapshot = JSON.stringify(project);
    const sample = (t: number) => {
      const frames = sceneFramesAt(project, scene, t);
      return {
        scout: cinematicPairAttentionAt(project, scene, scout, frames, t, false)?.focus ?? 0,
        jo: cinematicPairAttentionAt(project, scene, jo, frames, t, false)?.focus ?? 0,
      };
    };
    const early = sample(2.2);
    const middle = sample(4);
    const late = sample(5.75);
    expect(early.scout).toBeGreaterThan(early.jo + .2);
    expect(middle.scout).toBeCloseTo(middle.jo);
    expect(middle.scout).toBeGreaterThan(.7);
    expect(late.jo).toBeGreaterThan(late.scout + .15);
    expect(sample(4)).toEqual(middle);
    expect(JSON.stringify(project)).toBe(snapshot);
    // Short establishing shots must retain the prior simultaneous cue.
    scene.cameraShots![0].end = 3;
    const shortFrames = sceneFramesAt(project, scene, 2.5);
    const a = cinematicPairAttentionAt(project, scene, scout, shortFrames, 2.5, false);
    const b = cinematicPairAttentionAt(project, scene, jo, shortFrames, 2.5, false);
    expect(a?.focus).toBeCloseTo(b!.focus);
  });

  it("fades at shot boundaries and respects calm mode, Classic and painted eyes", () => {
    const { project, scene, scout, jo } = fixture();
    const sample = (t: number) => cinematicPairAttentionAt(project, scene, scout,
      sceneFramesAt(project, scene, t), t, false);
    expect(sample(2)).toBeUndefined();
    expect(sample(6)).toBeUndefined();
    expect(sample(2.1)?.focus).toBeLessThan(sample(4)!.focus);
    expect(sample(5.9)?.focus).toBeLessThan(sample(4)!.focus);
    const frames = sceneFramesAt(project, scene, 4);
    expect(cinematicPairAttentionAt(project, scene, scout, frames, 4, true))
      .toBeUndefined();
    project.visualStyle = undefined;
    expect(sample(4)).toBeUndefined();
    project.visualStyle = "storybook-cinematic";
    const character = project.characters.find(item => item.id === scout.characterId)!;
    const rig = character.puppet!;
    character.puppet = { ...rig, parts: rig.parts.map(part =>
      part.role === "head" ? { ...part, assetId: "author-painted-head" } : part) };
    expect(sample(4)).toBeUndefined();
    character.puppet = rig;
    const away = { ...frames.get(jo.id)!, opacity: 0 };
    expect(cinematicPairAttentionAt(project, scene, scout,
      new Map(frames).set(jo.id, away), 4, false)).toBeUndefined();
  });

  it("does not compete with authored actions or arbitrary camera coverage", () => {
    const { project, scene, scout, jo } = fixture();
    const frames = sceneFramesAt(project, scene, 4);
    const gesture = { ...frames.get(scout.id)!, gesture: "wave" as const };
    expect(cinematicPairAttentionAt(project, scene, scout,
      new Map(frames).set(scout.id, gesture), 4, false)).toBeUndefined();
    const prop = scene.elements.find(item => item.kind === "prop")!;
    scene.interactions = [{
      id: "point", kind: "point", actorId: scout.id, objectId: prop.id,
      start: 3, attach: 3.2, finish: 5,
      grip: { hand: "right", x: 0, y: 0 },
    }];
    expect(cinematicPairAttentionAt(project, scene, scout, frames, 4, false))
      .toBeUndefined();
    scene.interactions = [];
    scene.cameraShots![0].targets = [scout.id, prop.id];
    expect(cinematicPairAttentionAt(project, scene, scout, frames, 4, false))
      .toBeUndefined();
    scene.cameraShots![0].targets = [scout.id, jo.id];
    scene.cameraShots![0].style = "wide";
    expect(cinematicPairAttentionAt(project, scene, scout, frames, 4, false))
      .toBeUndefined();
  });
});
