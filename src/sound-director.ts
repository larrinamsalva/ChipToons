import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { dataBytes } from "./audio-files";
import { MAX_EPISODE_AUDIO_BYTES, MAX_EPISODE_AUDIO_CLIPS, MAX_EPISODE_AUDIO_SECONDS, MAX_EPISODE_AUDIO_SOURCES, sourceBytes } from "./audio-vault";
import { focusCueChoices } from "./focus-studio";
import { interactionEvents, wateringWindow } from "./interaction-model";
import { elementName } from "./library";
import { MAX_AUDIO_ASSETS, MAX_AUDIO_CLIPS, MAX_TOTAL_AUDIO_SECONDS } from "./media-model";
import type { AudioAsset } from "./media-model";
import { validateProject } from "./model";
import type { Project, Scene } from "./model";
import { participationWindow } from "./participation-model";
import { categoryBus, clipStart, newAudioClip } from "./production";
import { actionSoundLabel, atmosphereRange, reconcileSoundClip, soundAnchorKey } from "./sound-cues";
import type { AmbienceRange, SoundAnchor } from "./sound-cues";
import { builtInSound } from "./sounds";
import type { SoundId } from "./sounds";

export const SOUND_DIRECTOR_TITLE = "Add Sounds to My Cartoon";
export const SOUND_LEVELS = {
  quiet: { label: "Quiet Background", volume: 0.22 },
  story: { label: "Normal Story Sound", volume: 0.52 },
  emphasis: { label: "Gentle Emphasis", volume: 0.72 },
} as const;

type SoundMoment = { anchor: SoundAnchor; at: number; label: string; suggested?: SoundId; duration?: number };

export function soundMoments(project: Project, scene: Scene): SoundMoment[] {
  const result: SoundMoment[] = [];
  for (const action of scene.interactions ?? []) {
    const object = scene.elements.find(item => item.id === action.objectId);
    const name = object ? elementName(project, object) : "Story object";
    const events = interactionEvents(action);
    if (action.kind === "water") {
      const window = wateringWindow(action);
      events.push({ name: "Pour", time: window.start });
    }
    for (const event of events) result.push({
      anchor: { kind: "action", id: action.id, moment: event.name }, at: event.time,
      label: `${name} · ${actionSoundLabel(action.kind, event.name)}`,
      suggested: event.name === "Attach" ? "pickup" : event.name === "Release" ? "place" :
        event.name === "Transfer" ? "pickup" : event.name === "Pour" ? "pour" : undefined,
      duration: event.name === "Pour" ? wateringWindow(action).end - event.time : undefined,
    });
  }
  for (const item of focusCueChoices(project, scene)) {
    const cue = item.cue;
    if (cue.kind === "action") continue;
    const prop = cue.kind === "change" ? scene.elements.find(element =>
      scene.objectTracks?.some(track => track.objectId === element.id &&
        track.changes.some(change => change.id === cue.id)))?.prop : undefined;
    result.push({ anchor: cue, at: item.at, label: item.name,
      suggested: prop === "paper-bridge" ? "paper" : prop === "table" || prop === "shelf" ? "sweep" : "success" });
  }
  for (const element of scene.elements) {
    const keys = element.animation?.keyframes ?? [];
    for (const [i, key] of keys.entries()) {
      const next = keys[i + 1], prior = keys[i - 1];
      const heart = key.heart !== "off" && key.heart !== prior?.heart;
      const travel = next && Math.abs(next.x - key.x) >= 14 && (element.characterId || element.prop === "toy-wagon");
      const label = heart ? "Heart glows" : travel ? element.characterId ? "Walk or move" : "Wheels roll" :
        element.prop === "door" ? "Door movement" : "Animation key";
      result.push({
        anchor: { kind: "key", id: key.id }, at: key.time, label: `${elementName(project, element)} · ${label}`,
        suggested: heart ? "success" : travel ? element.characterId ? "steps" : "wheels" :
          element.prop === "door" ? "door" : undefined,
      });
    }
  }
  for (const key of scene.cameraAnimation?.keyframes ?? [])
    result.push({ anchor: { kind: "key", id: key.id }, at: key.time, label: "Camera key" });
  for (const moment of scene.participation ?? []) {
    const { start, think, reveal, end } = participationWindow(moment);
    for (const [part, at, label, suggested] of [
      ["question", start, "Question begins", "notice"], ["thinking", think, "Thinking time begins", "reassure"],
      ["reveal", reveal, "Thinking ends and the answer appears", "success"], ["finish", end, "Participation ends", "reassure"],
    ] as const) result.push({
      anchor: { kind: "participation", id: moment.id, moment: part }, at, label, suggested,
    });
  }
  return result.sort((a, b) => a.at - b.at);
}

export function originalSound(project: Pick<Project, "audioAssets">, id: SoundId) {
  const generated = builtInSound(id);
  const inline = project.audioAssets.find(asset => !asset.file && asset.dataUrl === generated.dataUrl);
  if (inline) return inline;
  const candidates = project.audioAssets.filter(asset => asset.file && asset.mime === generated.mime &&
    asset.sampleRate === generated.sampleRate && asset.duration === generated.duration);
  if (!candidates.length) return generated;
  const digest = bytesToHex(sha256(dataBytes(generated.dataUrl)));
  return candidates.find(asset => asset.file?.sha256 === digest) ?? generated;
}

export type SoundDraft = {
  asset: AudioAsset; clipId?: string; anchor?: SoundAnchor; offset: number; at: number; duration: number;
  volume: number; fadeIn: number; fadeOut: number; ambience?: AmbienceRange; muted?: boolean;
};

export function prepareSound(project: Project, index: number, draft: SoundDraft) {
  const scene = project.scenes[index];
  if (!scene) throw new Error("Choose a scene for this sound.");
  const existing = project.audioClips.find(clip => clip.id === draft.clipId);
  const sameSource = existing?.assetId === draft.asset.id;
  const audioAssets = project.audioAssets.some(asset => asset.id === draft.asset.id)
    ? project.audioAssets : [...project.audioAssets, draft.asset];
  const long = project.mediaVersion === 1;
  const clipsMax = long ? MAX_EPISODE_AUDIO_CLIPS : MAX_AUDIO_CLIPS;
  const sourceMax = long ? MAX_EPISODE_AUDIO_SOURCES : MAX_AUDIO_ASSETS;
  const secondsMax = long ? MAX_EPISODE_AUDIO_SECONDS : MAX_TOTAL_AUDIO_SECONDS;
  if (audioAssets.length > sourceMax || audioAssets.reduce((n, asset) => n + asset.duration, 0) > secondsMax + 0.001 ||
    (long && audioAssets.reduce((n, asset) => n + sourceBytes(asset), 0) > MAX_EPISODE_AUDIO_BYTES))
    throw new Error(`This project’s audio source budget is full (${sourceMax} sources and ${secondsMax / 60} minutes of original audio${long ? " within 256 MB" : ""}). Reuse a saved sound or work in a separate chapter.`);
  if (!existing && project.audioClips.length >= clipsMax)
    throw new Error(`This project already has ${clipsMax} audio clips. Replace a clip or work in a separate chapter.`);
  if (draft.anchor && project.audioClips.some(clip => clip.id !== existing?.id && clip.sceneId === scene.id &&
    clip.assetId === draft.asset.id && clip.soundCue && soundAnchorKey(clip.soundCue.anchor) === soundAnchorKey(draft.anchor!)))
    throw new Error("This sound is already attached to that event. Select the existing clip to adjust it.");

  const base = existing ?? newAudioClip(project, draft.asset, "effects", index, draft.at);
  const trimStart = sameSource ? base.trimStart : 0;
  const trimEnd = sameSource ? base.trimEnd : draft.asset.duration;
  const range = draft.ambience && atmosphereRange(project.scenes, draft.ambience);
  if (draft.ambience && !range) throw new Error("Choose consecutive scenes in playback order.");
  const duration = range?.duration ?? Math.min(draft.duration, trimEnd - trimStart, scene.duration);
  const start = range?.start ?? Math.max(0, Math.min(draft.at, scene.duration - duration));
  const clip = reconcileSoundClip({
    ...base, sceneId: range ? undefined : scene.id, characterId: undefined, category: range ? "music" : "effects",
    name: sameSource ? base.name : draft.asset.name.slice(0, 100), assetId: draft.asset.id, start, duration,
    trimStart, trimEnd, loop: !!range, volume: draft.volume, muted: draft.muted ?? false,
    fadeIn: Math.min(draft.fadeIn, duration), fadeOut: Math.min(draft.fadeOut, duration),
    soundCue: draft.anchor ? { anchor: draft.anchor, offset: draft.offset } : undefined, ambience: draft.ambience, soundReview: undefined,
  }, project.scenes);
  const audioClips = existing ? project.audioClips.map(item => item.id === existing.id ? clip : item) : [...project.audioClips, clip];
  const next = { ...project, audioAssets, audioClips };
  try { validateProject(next); }
  catch (error) {
    if (error instanceof Error && error.message.includes("64 MB")) throw error;
    throw new Error("This sound would exceed a timing or mix limit. Check its event and trim, or reduce the number of clips playing together.", { cause: error });
  }
  return { project: next, clip };
}

export type SoundNote = { id: string; title: string; detail: string; sceneIndex?: number };

export function soundNotes(project: Project): SoundNote[] {
  const clips = project.audioClips.filter(clip => !clip.muted && clip.volume > 0);
  const active = clips.map(clip => ({ clip, start: clipStart(project, clip),
    gain: clip.volume * project.mixer[categoryBus(clip.category)] }));
  const result: SoundNote[] = [];
  for (const clip of project.audioClips) {
    const index = project.scenes.findIndex(scene => scene.id === (clip.sceneId ?? clip.ambience?.first));
    const sceneIndex = index >= 0 ? index : undefined;
    if (clip.soundReview) result.push({
      id: `sound-timing:${clip.id}`, title: `Review sound timing: ${clip.name}`, sceneIndex,
      detail: clip.soundReview === "event-removed" ? "Its event was removed. The clip and original audio were kept." :
        clip.soundReview === "range-changed" ? "Its atmosphere range changed. Review which scenes should share this sound." :
          "Its event or offset would take the clip outside the scene. The clip is fitted within the scene.",
    });
    if (clip.ambience && (clip.fadeIn < 0.2 || clip.fadeOut < 0.2)) result.push({
      id: `sound-fade:${clip.id}`, title: `Check the atmosphere transition: ${clip.name}`, sceneIndex,
      detail: "Listen at the start and end. A short fade can soften a sudden change.",
    });
  }
  const starts = new Map<string, number>();
  for (const { clip, start } of active.filter(item => item.clip.category === "effects")) {
    const key = `${clip.assetId}:${Math.round(start * 50)}`;
    if (starts.has(key)) result.push({
      id: `sound-double:${clip.id}`, title: `Same effect at the same time: ${clip.name}`,
      detail: "Listen for an unintended double sound or remove a duplicate clip. The source stays available.",
    });
    starts.set(key, start);
  }
  if (!project.mixer.muted && project.mixer.master > 0) {
    for (const { clip: voice, start, gain } of active.filter(item => categoryBus(item.clip.category) === "voice" && item.gain > 0)) {
      const crossing = active.filter(item => (item.clip.category === "effects" || item.clip.ambience) &&
        item.start < start + voice.duration && item.start + item.clip.duration > start);
      const times = [start, ...crossing.map(item => Math.max(start, item.start))];
      if (times.some(time => crossing.reduce((n, item) => item.start <= time && item.start + item.clip.duration > time
        ? n + item.gain : n, 0) > Math.max(0.43, gain * 0.72))) result.push({
        id: `sound-voice:${voice.id}`, title: `Listen for loud sounds over dialogue: ${voice.name}`,
        detail: "Use Quiet Background or lower the clip levels, then preview with voices before applying.",
      });
    }
  }
  return result;
}
