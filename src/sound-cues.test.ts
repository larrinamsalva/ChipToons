import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { dataBytes } from "./audio-files";
import { episodePackage, restoreProjectFile } from "./episode-package";
import { gardenInteractionDemo } from "./garden-demo";
import { wateringWindow } from "./interaction-model";
import { audioSignature, MAX_AUDIO_ASSETS } from "./media-model";
import { parseBackup, uid, validateProject } from "./model";
import { participationExample } from "./participation-examples";
import { audioPlan, clipGain, clipStart, duplicateSceneMedia, reconcileProduction } from "./production";
import { productionReadiness } from "./readiness";
import { duplicateScript } from "./script";
import { gardenSoundDemo } from "./sound-garden-demo";
import { editSoundClip, soundCueTime } from "./sound-cues";
import type { SoundAnchor } from "./sound-cues";
import { originalSound, prepareSound, soundNotes } from "./sound-director";
import { builtInSound } from "./sounds";
import { duplicateAnimatedScene, sceneFramesAt } from "./timeline";
import { transformExample } from "./transform-examples";
import { placeLibraryItem } from "./library";
import { starterLocations } from "./world-starters";

describe("Sound Effects & Atmosphere Director", () => {
  it("produces distinct deterministic original WAVs and reuses matching inline or file-backed sources", () => {
    const urls = new Set<string>();
    for (const id of ["pour", "wheels", "pickup", "place", "paper", "sweep", "success", "room", "workshop"] as const) {
      const original = builtInSound(id), bytes = dataBytes(original.dataUrl);
      expect(audioSignature(bytes, "audio/wav")).toBe(true);
      expect(bytes.length).toBe(44 + Math.round(original.duration * 24000) * 2);
      expect(builtInSound(id).dataUrl).toBe(original.dataUrl);
      expect(originalSound({ audioAssets: [original] }, id).id).toBe(original.id);
      const stored = { ...original, dataUrl: "", file: { key: uid(), sha256: bytesToHex(sha256(bytes)), size: bytes.length } };
      expect(originalSound({ audioAssets: [stored] }, id).id).toBe(stored.id);
      urls.add(original.dataUrl);
    }
    expect(urls.size).toBe(9);
  });

  it("starts pouring where the real visible stream begins and reuses the footsteps source", () => {
    const project = gardenSoundDemo(), [scene] = project.scenes;
    const [action] = scene.interactions!;
    const { start, end } = wateringWindow(action);
    const clip = project.audioClips.find(clip => clip.soundCue?.anchor.kind === "action" && clip.soundCue.anchor.moment === "Pour")!;
    expect(clip.start).toBeCloseTo(start, 7);
    expect(clip.duration).toBeCloseTo(end - start, 7);
    expect(sceneFramesAt(project, scene, start - 0.03).get(action.objectId)?.watering).toBeUndefined();
    expect(sceneFramesAt(project, scene, start + 0.03).get(action.objectId)?.watering).toBeTruthy();
    expect(sceneFramesAt(project, scene, end + 0.03).get(action.objectId)?.watering).toBeUndefined();
    expect(project.audioClips.filter(clip => clip.name === "Little footsteps").map(clip => clip.assetId))
      .toEqual(Array(2).fill(project.audioAssets.find(asset => asset.name === "Little footsteps")!.id));
  });

  it("follows attachment and transfer, uses offsets, and retains a deleted cue's recording", () => {
    const base = gardenInteractionDemo(), [scene] = base.scenes;
    const [action] = scene.interactions!;
    const anchor: SoundAnchor = { kind: "action", id: action.id, moment: "Attach" };
    const source = builtInSound("pickup");
    const added = prepareSound(base, 0, { asset: source, anchor, offset: 0.16, at: 0, duration: 0.4, volume: 0.6, fadeIn: 0.03, fadeOut: 0.08 });
    expect(added.clip.start).toBeCloseTo(action.attach + 0.16);
    const edited = { ...scene, interactions: [{ ...action, attach: 2.8 }] };
    const moved = { ...added.project, scenes: [edited], ...reconcileProduction(added.project, [edited]) };
    expect(validateProject(moved).audioClips[0].start).toBeCloseTo(2.96);
    const transfer = { ...scene, interactions: [{ ...action, kind: "give" as const, release: undefined,
      transfer: { time: 4.1, actorId: scene.elements.find(item => item.characterId && item.id !== action.actorId)!.id, grip: action.grip } }] };
    expect(soundCueTime(transfer, { kind: "action", id: action.id, moment: "Transfer" })).toBe(4.1);
    const deleted = { ...edited, interactions: [] };
    const next = validateProject({ ...moved, scenes: [deleted], ...reconcileProduction(moved, [deleted]) });
    expect(next.audioClips[0]).toMatchObject({ assetId: source.id, soundReview: "event-removed", start: 2.96 });
    expect(next.audioClips[0].soundCue).toBeUndefined();
    expect(next.audioAssets).toEqual(added.project.audioAssets);
    expect(soundNotes(next).some(note => note.title.includes("Review sound timing"))).toBe(true);
  });

  it("resolves transformations and participation phases, including their edited times", () => {
    const p = participationExample("wagon"), scene = p.scenes[0], moment = scene.participation![0];
    const [track] = scene.objectTracks!;
    const source = builtInSound("success");
    const draft = { asset: source, offset: 0, at: 0, duration: 0.5, volume: 0.3, fadeIn: 0, fadeOut: 0.1 };
    const change = prepareSound(p, 0, { ...draft, anchor: { kind: "change", id: track.changes[0].id } });
    expect(change.clip.start).toBeCloseTo(track.changes[0].at);
    const reveal = prepareSound(change.project, 0, { ...draft, anchor: { kind: "participation", id: moment.id, moment: "reveal" } });
    expect(reveal.clip.start).toBeCloseTo(7.65);
    const scenes = [{ ...scene, participation: [{ ...moment, thinkFor: 3.7 }],
      objectTracks: [{ ...track, changes: [{ ...track.changes[0], at: 12.65 }] }] }, p.scenes[1]];
    const clips = reconcileProduction(reveal.project, scenes).audioClips;
    expect(clips.find(clip => clip.id === reveal.clip.id)?.start).toBeCloseTo(8.15);
    expect(clips.find(clip => clip.id === change.clip.id)?.start).toBeCloseTo(12.65);
  });

  it("keeps trim, gain, mute and fades on the actual scheduled clip and prevents duplicate linked effects", () => {
    const project = gardenSoundDemo(), scene = project.scenes[0];
    const effect = project.audioClips.find(clip => clip.soundCue)!;
    const source = project.audioAssets.find(asset => asset.id === effect.assetId)!;
    const trimmed = editSoundClip(effect, { trimStart: 0.12, trimEnd: 1.3, duration: 1.1 });
    const withTrim = validateProject({ ...project, audioClips: project.audioClips.map(clip => clip.id === effect.id ? trimmed : clip) });
    const draft = { asset: source, at: effect.start, offset: 0, anchor: effect.soundCue!.anchor,
      duration: 0.9, volume: 0.5, fadeIn: 0.2, fadeOut: 0.2 };
    expect(() => prepareSound(withTrim, 0, draft)).toThrow(/already attached/);
    const applied = prepareSound(withTrim, 0, { ...draft, clipId: effect.id });
    expect(applied.clip).toMatchObject({ trimStart: 0.12, trimEnd: 1.3, duration: 0.9, volume: 0.5 });
    expect(clipGain(applied.clip, 0.1)).toBeCloseTo(0.25);
    const start = clipStart(applied.project, applied.clip);
    expect(audioPlan(applied.project, start + 0.2, start + 0.3).find(item => item.clip.id === effect.id)?.offset).toBeCloseTo(0.32);
    expect(clipGain(editSoundClip(applied.clip, { muted: true }), 0.1)).toBe(0);
    expect(editSoundClip(applied.clip, { start: scene.duration / 2 }).soundCue).toBeUndefined();
  });

  it("keeps one ambience loop and its source phase across scenes, and marks invalidated ranges", () => {
    const project = gardenSoundDemo(), [first, last] = project.scenes;
    const ambience = project.audioClips.find(clip => clip.ambience)!;
    expect(ambience.sceneId).toBeUndefined();
    expect(ambience.duration).toBe(first.duration + last.duration);
    expect(clipGain(ambience, 0)).toBe(0);
    const cut = first.duration + 0.33;
    const continuing = audioPlan(project, cut, cut + 0.1).find(item => item.clip.id === ambience.id)!;
    expect(continuing.offset).toBeCloseTo(cut % ambience.trimEnd);
    const reversed = [last, first];
    const next = validateProject({ ...project, scenes: reversed, ...reconcileProduction(project, reversed) });
    expect(next.audioClips.find(clip => clip.id === ambience.id)).toMatchObject({ soundReview: "range-changed", loop: true });
    const moved = next.audioClips.find(clip => clip.soundCue)!;
    expect(clipStart(next, moved)).toBeCloseTo(last.duration + moved.start);
  });

  it("remaps every copied cue, keeps source IDs, and preserves valid metadata through both backups", async () => {
    const project = gardenSoundDemo(), [first, last] = project.scenes;
    const ids = new Map<string, string>();
    const copy = duplicateScript(duplicateAnimatedScene(first, ids), [], []);
    const media = duplicateSceneMedia(project, first, copy, ids);
    const result = validateProject({ ...project, scenes: [first, copy, last], ...media });
    const copied = result.audioClips.filter(clip => clip.sceneId === copy.id);
    expect(copied).toHaveLength(6);
    const original = result.audioClips.find(clip => clip.soundCue)!;
    expect(copied[0].assetId).toBe(original.assetId);
    expect(copied[0].soundCue?.anchor.id).not.toBe(original.soundCue?.anchor.id);
    expect(soundCueTime(copy, copied[0].soundCue!.anchor)).toBeCloseTo(copied[0].start);
    expect(parseBackup(JSON.stringify(result)).audioClips).toEqual(result.audioClips);
    const file = new File([await episodePackage(result)], "sounds.ctepisode");
    expect((await restoreProjectFile(file)).audioClips).toEqual(result.audioClips);
  });

  it("warns about timing and mix choices without blocking silence, and handles budget limits", () => {
    const p = gardenSoundDemo(), [scene] = p.scenes;
    const source = builtInSound("success");
    const timing = prepareSound(p, 0, { asset: source, at: 0, duration: 0.5, volume: 0.3, fadeIn: 0, fadeOut: 0,
      anchor: { kind: "action", id: scene.interactions![0].id, moment: "Release" }, offset: 9 });
    expect(timing.clip.soundReview).toBe("timing");
    expect(productionReadiness(timing.project, 60, true).find(item => item.id === `sound-timing:${timing.clip.id}`)?.blocking).toBe(false);
    const filled = { ...p, audioAssets: Array.from({ length: MAX_AUDIO_ASSETS }, () => builtInSound("pickup")) };
    expect(() => prepareSound(filled, 0, { asset: source, at: 0, duration: 0.5, volume: 0.3, fadeIn: 0, fadeOut: 0, offset: 0 }))
      .toThrow(/source budget/);
    expect(productionReadiness({ ...p, audioClips: [] }, 60, true).every(item => !item.blocking)).toBe(true);
  });

  it("validates imported anchors and keeps reusable locations separate from saved audio", () => {
    const original = transformExample("wagon");
    const selected = placeLibraryItem(original, 0, starterLocations().find(item => item.id === "starter-location-garden")!);
    expect(selected.scenes[0].suggestedAtmosphere).toBe("garden");
    expect(selected.audioClips).toEqual(original.audioClips);
    const p = gardenSoundDemo();
    const altered = { ...p, audioClips: p.audioClips.map((clip, i) => i ? clip : { ...clip, start: 0.1 }) };
    expect(() => validateProject(altered)).toThrow();
    expect(parseBackup(JSON.stringify(gardenInteractionDemo())).audioClips).toEqual([]);
  });
});
