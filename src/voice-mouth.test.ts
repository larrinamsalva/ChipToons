import { describe, expect, it } from "vitest";
import { planStory, DEFAULT_IDEA } from "./planner";
import { builtInSound } from "./sounds";
import { newAudioClip, reconcileProduction } from "./production";
import { elementAt, putElementKey, retimeScene, sceneElementAt, sceneStart } from "./timeline";
import { parseBackup, uid, validateProject } from "./model";
import { sunnyRig } from "./puppet-model";
import {
  analyzeVoiceEnvelope, applyTalkingPreset, hasManualMouth, mouthOpeningAt, mouthTrackIsCurrent,
  supportsVoiceMouth, voiceRange, withVoiceTrack,
} from "./voice-mouth";
import type { VoiceMouthTrack } from "./voice-mouth-model";

function pcm(seconds = 4) {
  const sampleRate = 8000;
  const samples = Float32Array.from({ length: sampleRate * seconds }, (_, i) => {
    const time = i / sampleRate;
    const amplitude = time >= 0.5 && time < 1.3 ? 0.1 : time >= 1.9 && time < 2.9 ? 0.35 : 0;
    return amplitude * Math.sin(2 * Math.PI * 200 * time);
  });
  return { duration: seconds, length: samples.length, numberOfChannels: 1, sampleRate, getChannelData: () => samples };
}
function fixture() {
  const project = planStory({ ...DEFAULT_IDEA, idea: "Shine invites a neighbor to sit." });
  const scene = project.scenes[0], element = scene.elements[0];
  const source = builtInSound("melody");
  const clip = {
    ...newAudioClip(project, source, "dialogue", 0, 0.6), duration: 4,
    trimStart: 0, trimEnd: 4, characterId: element.characterId, volume: 1,
  };
  project.audioAssets = [source];
  project.audioClips = [clip];
  const track: VoiceMouthTrack = {
    clipId: clip.id, sourceId: source.id, speakerId: element.characterId,
    trimStart: clip.trimStart, trimEnd: clip.trimEnd, levels: analyzeVoiceEnvelope(pcm(), 0, 4),
    start: 0, end: 4, delay: 0, preset: "normal", sensitivity: 1,
    minimum: 0.08, maximum: 0.82, expression: "keep", replaceManual: false, corrections: [],
  };
  return { project, scene, element, source, clip, track };
}

describe("audio-driven mouth timing", () => {
  it("measures silence, quieter speech and stronger speech from real PCM levels", () => {
    const { project, clip, track } = fixture();
    expect(track.levels).toHaveLength(200);
    expect(mouthOpeningAt(project, clip, track, 0.25)).toBe(0);
    expect(mouthOpeningAt(project, clip, track, 1.55)).toBe(0);
    expect(mouthOpeningAt(project, clip, track, 0.8)).toBeGreaterThan(0.1);
    expect(mouthOpeningAt(project, clip, track, 2.2)).toBeGreaterThan(mouthOpeningAt(project, clip, track, 0.8));
    const expressive = applyTalkingPreset(track, "expressive");
    expect(mouthOpeningAt(project, clip, expressive, 0.8)).toBeGreaterThan(mouthOpeningAt(project, clip, track, 0.8));
    expect(mouthOpeningAt(project, clip, expressive, 1.55)).toBe(0);
  });

  it("respects source trims, episode offsets, repeat timing, gain and mute", () => {
    const { project, scene, clip, track } = fixture();
    const loop = { ...clip, sceneId: undefined, start: 1, trimStart: 0.5, trimEnd: 1.7, loop: true, duration: 6 };
    const trimmed = { ...track, trimStart: loop.trimStart, trimEnd: loop.trimEnd, end: loop.duration,
      levels: analyzeVoiceEnvelope(pcm(), loop.trimStart, loop.trimEnd) };
    expect(voiceRange(project, scene, loop)?.clipStart).toBe(1);
    expect(mouthOpeningAt(project, loop, trimmed, 0.4)).toBeCloseTo(mouthOpeningAt(project, loop, trimmed, 1.6));
    expect(mouthOpeningAt(project, loop, trimmed, 0.4)).toBeGreaterThan(0.2);
    expect(mouthOpeningAt(project, loop, trimmed, 1.05)).toBe(0);
    expect(mouthOpeningAt(project, { ...loop, muted: true }, trimmed, 0.4)).toBe(0);
    expect(mouthOpeningAt(project, { ...loop, fadeIn: 1 }, trimmed, 0.4)).toBeLessThan(mouthOpeningAt(project, loop, trimmed, 0.4));
    expect(mouthOpeningAt(project, { ...loop, volume: 0.5 }, trimmed, 0.4)).toBeLessThan(mouthOpeningAt(project, loop, trimmed, 0.4));
    expect(mouthOpeningAt({ ...project, mixer: { ...project.mixer, muted: true } }, loop, trimmed, 0.4)).toBe(0);
  });

  it("keeps clips and animation in sync after reordering and retiming scenes", () => {
    const { project, scene, element, clip, track } = fixture();
    const edited = withVoiceTrack(project, scene, element, clip.id, track);
    const moved = { ...edited, scenes: [edited.scenes[1], edited.scenes[0], ...edited.scenes.slice(2)] };
    const movedScene = moved.scenes[1], actor = movedScene.elements[0];
    const start = sceneStart(moved, 1);
    const time = clip.start + 2.2;
    expect(sceneElementAt(moved, movedScene, actor, time, start).voiceOpening).toBeGreaterThan(0.4);
    const shorter = retimeScene(movedScene, movedScene.duration * 0.75);
    const scenes = moved.scenes.map(item => item.id === shorter.id ? shorter : item);
    const retimed = { ...moved, scenes, ...reconcileProduction(moved, scenes) };
    expect(sceneElementAt(retimed, shorter, shorter.elements[0], retimed.audioClips[0].start + 2.2, start).voiceOpening)
      .toBe(sceneElementAt(moved, movedScene, actor, time, start).voiceOpening);
    const global = { ...clip, sceneId: undefined, start: start - 1, duration: 4 };
    expect(voiceRange(moved, movedScene, global)).toMatchObject({ from: 1, to: 4 });
    const absoluteProject = { ...moved, audioClips: [global] };
    expect(sceneElementAt(absoluteProject, movedScene, actor, 1.2, start).voiceOpening).toBeGreaterThan(0.4);
  });

  it("makes changed clips and missing originals inactive while keeping cues available for review", () => {
    const { project, scene, element, clip, track } = fixture();
    const edited = withVoiceTrack(project, scene, element, clip.id, track);
    const next = edited.scenes[0], actor = next.elements[0];
    for (const changed of [
      { ...edited, audioClips: [] },
      { ...edited, audioClips: [{ ...clip, assetId: uid() }] },
      { ...edited, audioClips: [{ ...clip, trimStart: 0.2 }] },
      { ...edited, audioAssets: [] },
    ]) {
      expect(mouthTrackIsCurrent(changed, next, actor, track)).toBe(false);
      expect(sceneElementAt(changed, next, actor, 2.8, 0).voiceOpening).toBeUndefined();
      expect(actor.voiceMouth).toEqual([track]);
    }
    expect(validateProject({ ...edited, audioClips: [] }).scenes[0].elements[0].voiceMouth).toEqual([track]);
  });

  it("leaves manual keys, joints and other acting intact, with explicit precedence and correction", () => {
    const { project, scene, element, clip, track } = fixture();
    const actor = { ...element, animation: putElementKey(element, 0, scene.duration, { mouth: "smile", gesture: "wave", heart: "warm" }) };
    scene.elements[0] = actor;
    expect(hasManualMouth(actor, 0, 2)).toBe(true);
    const time = 2.8;
    const current = elementAt(actor, time, scene.duration);
    const proposed = withVoiceTrack(project, scene, actor, clip.id, track);
    expect(sceneElementAt(proposed, proposed.scenes[0], proposed.scenes[0].elements[0], time, 0)).toEqual(current);
    const approved = withVoiceTrack(project, scene, actor, clip.id, { ...track, replaceManual: true,
      corrections: [{ start: 2.1, end: 2.3, opening: 0 }] });
    const proposedActor = approved.scenes[0].elements[0];
    expect(proposedActor.animation).toEqual(actor.animation);
    const frame = sceneElementAt(approved, approved.scenes[0], proposedActor, time, 0);
    expect(frame).toMatchObject({ mouth: "closed", voiceOpening: 0, armAngle: current.armAngle, heartOpacity: current.heartOpacity });
    expect(sceneElementAt(approved, approved.scenes[0], proposedActor, time, 0)).toEqual(frame);
    expect(sceneElementAt(approved, approved.scenes[0], proposedActor, time, 0, true).mouth).toBe("smile");
    expect(project.scenes[0].elements[0].voiceMouth).toBeUndefined();
  });

  it("supports original shape faces and puppet overlays, and rejects invalid or oversized input", () => {
    const { project, scene, element, clip, track } = fixture();
    const character = project.characters[0];
    expect(supportsVoiceMouth(character, element)).toBe(true);
    expect(supportsVoiceMouth({ ...character, assetId: "raster" }, element)).toBe(false);
    const rig = sunnyRig();
    expect(supportsVoiceMouth({ ...character, puppet: rig }, element)).toBe(true);
    expect(supportsVoiceMouth({ ...character, puppet: { ...rig, face: false } }, element)).toBe(false);
    expect(() => analyzeVoiceEnvelope({ ...pcm(), duration: 121 }, 0, 4)).toThrow();
    expect(() => analyzeVoiceEnvelope(pcm(), 4, 3)).toThrow();
    expect(() => analyzeVoiceEnvelope({ ...pcm(), numberOfChannels: 7 }, 0, 4)).toThrow();
    expect(() => validateProject(withVoiceTrack(project, scene, element, clip.id, { ...track, levels: "bad" }))).toThrow();
    expect(() => validateProject(withVoiceTrack(project, scene, element, clip.id, { ...track, speakerId: uid() }))).toThrow();
  });

  it("round-trips portable tracks without changing old projects or the original audio", () => {
    const { project, scene, element, clip, track } = fixture();
    expect(validateProject(project).scenes[0].elements[0].voiceMouth).toBeUndefined();
    const approved = withVoiceTrack(project, scene, element, clip.id, track);
    const reopened = parseBackup(JSON.stringify(approved));
    expect(reopened.scenes[0].elements[0].voiceMouth).toEqual([track]);
    expect(reopened.audioAssets).toEqual(project.audioAssets);
    expect(reopened.audioClips).toEqual(project.audioClips);
  });
});
