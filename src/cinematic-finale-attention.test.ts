import { describe, expect, it } from "vitest";
import { cinematicFinaleAttentionAt } from "./cinematic-finale-attention";
import { cinematicFaceAt } from "./cinematic-face";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { sceneFramesAt } from "./timeline";

function fixture() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const [scout, jo] = scene.elements.filter(item => !!item.characterId);
  scene.interactions = [];
  scene.cameraShots = [{
    id: "saved-finale", style: "wide", start: 25, end: 30,
    note: "End with both performers sharing the workshop.",
    targets: [], move: .82,
    frame: { x: 400, y: 225, zoom: 1.0 },
    follow: false, offset: { x: 0, y: 0 }, placement: "center",
  }];
  return { project, scene, scout, jo };
}

describe("PR #109 warm cinematic closing beat", () => {
  it("lets Scout and Jo gently attend to the audience after the real final camera move", () => {
    const { project, scene, scout, jo } = fixture();
    const original = JSON.stringify(project);
    const time = 27.5;
    const frames = sceneFramesAt(project, scene, time);
    const scoutCue = cinematicFinaleAttentionAt(
      project, scene, scout, frames, time, false)!;
    const joCue = cinematicFinaleAttentionAt(
      project, scene, jo, frames, time, false)!;
    expect(scoutCue).toEqual({ dx: 0, dy: 0, focus: .94 });
    expect(joCue).toEqual(scoutCue);
    const scoutFace = cinematicFaceAt(project, scene, scout,
      frames.get(scout.id)!, frames, time, false)!;
    const joFace = cinematicFaceAt(project, scene, jo,
      frames.get(jo.id)!, frames, time, false)!;
    expect(Math.abs(scoutFace.x)).toBeLessThan(.25);
    expect(Math.abs(joFace.x)).toBeLessThan(.25);
    expect(scoutFace.cheekLift).toBeGreaterThan(.1);
    expect(joFace.cheekLift).toBeGreaterThan(.1);
    expect(sceneFramesAt(project, scene, time)).toEqual(frames);
    expect(JSON.stringify(project)).toBe(original);
  });

  it("waits for the authored camera move and staggers the closing look", () => {
    const { project, scene, scout, jo } = fixture();
    const sample = (time: number) => {
      const frames = sceneFramesAt(project, scene, time);
      return [
        cinematicFinaleAttentionAt(project, scene, scout, frames, time, false)?.focus ?? 0,
        cinematicFinaleAttentionAt(project, scene, jo, frames, time, false)?.focus ?? 0,
      ];
    };
    expect(sample(25)).toEqual([0, 0]);
    expect(sample(25.8)).toEqual([0, 0]);
    const early = sample(26.2);
    expect(early[0]).toBeGreaterThan(early[1]);
    expect(sample(27.5)).toEqual([.94, .94]);
    expect(sample(30)).toEqual([0, 0]);
    expect(sample(27.5)).toEqual(sample(27.5));
  });

  it("does not change Classic, calm editing, painted faces, interactions or other shots", () => {
    const { project, scene, scout } = fixture();
    const frames = sceneFramesAt(project, scene, 27.5);
    const cue = () => cinematicFinaleAttentionAt(
      project, scene, scout, frames, 27.5, false);
    expect(cinematicFinaleAttentionAt(
      project, scene, scout, frames, 27.5, true)).toBeUndefined();
    project.visualStyle = undefined;
    expect(cue()).toBeUndefined();
    project.visualStyle = "storybook-cinematic";
    const character = project.characters.find(item => item.id === scout.characterId)!;
    const rig = character.puppet!;
    character.puppet = { ...rig,
      parts: rig.parts.map(part => part.role === "eyes"
        ? { ...part, assetId: "painted-eye-asset" }
        : part) };
    // If this rig doesn't have a separate eyes part, paint the head.
    if (!rig.parts.some(part => part.role === "eyes")) {
      character.puppet = { ...rig,
        parts: rig.parts.map(part => part.role === "head"
          ? { ...part, assetId: "painted-head-asset" }
          : part) };
    }
    expect(cue()).toBeUndefined();
    character.puppet = rig;
    const prop = scene.elements.find(item => item.kind === "prop")!;
    scene.interactions = [{
      id: "authored-gesture", kind: "point", actorId: scout.id,
      objectId: prop.id, start: 26, attach: 26.2, finish: 29,
      grip: { hand: "right", x: 0, y: 0 },
    }];
    expect(cue()).toBeUndefined();
    scene.interactions = [];
    scene.cameraShots![0].style = "pair";
    expect(cue()).toBeUndefined();
    scene.cameraShots![0].style = "wide";
    scene.cameraShots![0].end = 29;
    expect(cue()).toBeUndefined();
    scene.cameraShots![0].end = 30;
    scene.cameraShots![0].start = 29;
    expect(cue()).toBeUndefined();
  });
});
