import { describe, expect, it } from "vitest";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { blankLine, withScript } from "./script";
import { elementBase, sceneElementAt, sceneFramesAt } from "./timeline";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { cinematicVoiceBodyAt } from "./cinematic-voice-body";
import type { VoiceMouthTrack } from "./voice-mouth-model";

function fixture() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const scout = scene.elements.find(item => !!item.characterId)!;
  scene.interactions = [];
  scout.motion = "still";
  scout.animation = {
    idle: "none", blink: true,
    keyframes: [{
      ...elementBase(scout), id: "voice-body-author-pose",
      time: 0, easing: "linear",
    }],
  };
  const original = builtInSound("melody");
  const clip = {
    ...newAudioClip(project, original, "dialogue", 0, .6),
    duration: 4, trimStart: 0, trimEnd: 4, volume: 1,
    characterId: scout.characterId,
  };
  project.audioAssets = [original];
  project.audioClips = [clip];
  const track: VoiceMouthTrack = {
    clipId: clip.id, sourceId: original.id,
    speakerId: scout.characterId, trimStart: 0, trimEnd: 4,
    levels: "ff".repeat(100), start: 0, end: 4, delay: 0,
    preset: "normal", sensitivity: 1, minimum: .08,
    maximum: .82, expression: "keep", replaceManual: false,
    corrections: [],
  };
  scout.voiceMouth = [track];
  scene.script = withScript(scene, {
    acting: "Friendly workshop dialogue", emotion: "Warm",
    lines: [{
      ...blankLine("dialogue", "Look at our safe workshop!"),
      speakerId: scout.characterId,
    }],
  }).script;
  scene.cameraShots = [{
    id: "original-take-close", style: "close",
    start: clip.start, end: clip.start + 3.8, move: .48,
    note: "Scout's original recorded close-up", targets: [scout.id],
    lineId: scene.script!.lines[0].id,
    frame: { x: 400, y: 225, zoom: 2 },
    follow: false, offset: { x: 0, y: 0 }, placement: "left",
  }];
  return { project, scene, scout, track, clip };
}

describe("PR #110 genuine recorded voice body performance", () => {
  it("adds small deterministic breathing and roll while retaining hand-authored joints", () => {
    const { project, scene, scout } = fixture();
    const before = JSON.stringify(project);
    const t = 1.4;
    const speaking = sceneElementAt(project, scene, scout, t, 0);
    const silent = sceneElementAt(project, scene, {
      ...scout, voiceMouth: undefined,
    }, t, 0);
    expect(speaking.voiceOpening).toBeGreaterThan(.3);
    expect(speaking.y).toBeLessThan(silent.y - .25);
    expect(speaking.scale).toBeGreaterThan(silent.scale + .003);
    expect(Math.abs(speaking.rotation - silent.rotation)).toBeLessThanOrEqual(.68);
    expect(speaking.x).toBe(silent.x);
    expect(speaking.joints?.leftArm).toEqual(silent.joints?.leftArm);
    expect(speaking.joints?.rightArm).toEqual(silent.joints?.rightArm);
    expect(sceneFramesAt(project, scene, t).get(scout.id)).toEqual(speaking);
    expect(sceneElementAt(project, scene, scout, t, 0)).toEqual(speaking);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("respects original shot timing, silence, muted recordings and stale sources", () => {
    const { project, scene, scout, track, clip } = fixture();
    const t = 1.4;
    const baseline = () => sceneElementAt(project, scene, {
      ...scout, voiceMouth: undefined,
    }, t, 0);
    const body = () => sceneElementAt(project, scene, scout, t, 0);
    expect(sceneElementAt(project, scene, scout, .6, 0).y)
      .toBeCloseTo(sceneElementAt(project, scene, {
        ...scout, voiceMouth: undefined,
      }, .6, 0).y);
    expect(sceneElementAt(project, scene, scout, 4.4, 0).y)
      .toBeCloseTo(sceneElementAt(project, scene, {
        ...scout, voiceMouth: undefined,
      }, 4.4, 0).y);
    scout.voiceMouth = [{ ...track, levels: "00".repeat(100) }];
    expect(body().y).toBe(baseline().y);
    scout.voiceMouth = [track];
    project.mixer.muted = true;
    expect(body().y).toBe(baseline().y);
    project.mixer.muted = false;
    project.audioClips = [{ ...clip, trimStart: .2 }];
    expect(body().y).toBe(baseline().y);
    project.audioClips = [clip];
    scene.cameraShots![0].lineId = undefined;
    expect(body().y).toBe(baseline().y);
  });

  it("leaves Classic, calm preview, painted torso and authored prop work alone", () => {
    const { project, scene, scout } = fixture();
    const time = 1.4;
    const frame = sceneElementAt(project, scene, scout, time, 0);
    expect(cinematicVoiceBodyAt(project, scene, scout, frame,
      time, 0, true)).toBe(frame);
    project.visualStyle = undefined;
    const classic = sceneElementAt(project, scene, scout, time, 0);
    const quiet = sceneElementAt(project, scene, {
      ...scout, voiceMouth: undefined,
    }, time, 0);
    expect(classic.y).toBe(quiet.y);
    project.visualStyle = "storybook-cinematic";
    const originalRig = project.characters[0].puppet!;
    project.characters[0].puppet = {
      ...originalRig,
      parts: originalRig.parts.map(p =>
        p.role === "torso" ? { ...p, assetId: "painted-torso" } : p),
    };
    expect(sceneElementAt(project, scene, scout, time, 0).y).toBe(
      sceneElementAt(project, scene, {
        ...scout, voiceMouth: undefined,
      }, time, 0).y);
    project.characters[0].puppet = originalRig;
    scene.interactions = [{
      id: "author-point", kind: "point", actorId: scout.id,
      objectId: scene.elements.find(item => item.kind === "prop")!.id,
      start: 6, attach: 6.1, finish: 7,
      grip: { hand: "right", x: 0, y: 0 },
    }];
    expect(sceneElementAt(project, scene, scout, time, 0).y).toBe(
      sceneElementAt(project, scene, {
        ...scout, voiceMouth: undefined,
      }, time, 0).y);
  });
});
