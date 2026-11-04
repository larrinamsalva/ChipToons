import { numberIn, record } from "./art-model";
import { focusCueTime } from "./focus-model";
import { INTERACTION_LABELS, interactionEvents, wateringWindow } from "./interaction-model";
import type { AudioClip } from "./media-model";
import type { Scene } from "./model";
import { participationWindow } from "./participation-model";

export const ATMOSPHERES = {
  playground: { label: "Playground · gentle outdoor air", sound: "wind" },
  garden: { label: "Community Garden · quiet breeze", sound: "garden" },
  classroom: { label: "Classroom · quiet room tone", sound: "room" },
  workshop: { label: "Workshop · subtle room activity", sound: "workshop" },
  rain: { label: "Rainy Day · gentle rain", sound: "rain" },
  home: { label: "Cozy Home · peaceful indoor air", sound: "room" },
} as const;
export type AtmosphereId = keyof typeof ATMOSPHERES;
export type SoundAnchor = { kind: "action"; id: string; moment: string } |
  { kind: "change" | "step" | "key"; id: string } |
  { kind: "participation"; id: string; moment: "question" | "thinking" | "reveal" | "finish" };
export type SoundCue = { anchor: SoundAnchor; offset: number };
export type AmbienceRange = { first: string; last: string };
export type SoundReview = "event-removed" | "timing" | "range-changed";

export const isAtmosphere = (value: unknown): value is AtmosphereId =>
  typeof value === "string" && Object.hasOwn(ATMOSPHERES, value);
const id = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 100;
const fields = (value: object, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
export const soundAnchorKey = (anchor: SoundAnchor) => JSON.stringify([anchor.kind, anchor.id, "moment" in anchor ? anchor.moment : null]);

export function soundCueTime(scene: Scene, anchor: SoundAnchor) {
  if (anchor.kind === "action") {
    const action = scene.interactions?.find(item => item.id === anchor.id);
    if (!action) return;
    return anchor.moment === "Pour" && action.kind === "water" ? wateringWindow(action).start :
      interactionEvents(action).find(event => event.name === anchor.moment)?.time;
  }
  if (anchor.kind === "step" || anchor.kind === "change")
    return focusCueTime(scene, { kind: anchor.kind, id: anchor.id });
  if (anchor.kind === "key") {
    for (const element of scene.elements) {
      const key = element.animation?.keyframes.find(item => item.id === anchor.id);
      if (key) return key.time;
    }
    return scene.cameraAnimation?.keyframes.find(item => item.id === anchor.id)?.time;
  }
  if (anchor.kind === "participation") {
    const moment = scene.participation?.find(item => item.id === anchor.id);
    if (!moment) return;
    const window = participationWindow(moment);
    return { question: window.start, thinking: window.think, reveal: window.reveal, finish: window.end }[anchor.moment];
  }
}

export function atmosphereRange(scenes: Scene[], range: AmbienceRange) {
  const first = scenes.findIndex(scene => scene.id === range.first);
  const last = scenes.findIndex(scene => scene.id === range.last);
  if (first < 0 || last < first) return;
  return {
    start: scenes.slice(0, first).reduce((n, scene) => n + scene.duration, 0),
    duration: scenes.slice(first, last + 1).reduce((n, scene) => n + scene.duration, 0),
  };
}

function safePlacement(clip: AudioClip, at: number, length: number, limit: number) {
  const duration = Math.min(length, limit);
  const start = Math.max(0, Math.min(at, limit - duration, limit - 0.01));
  return { ...clip, start, duration, fadeIn: Math.min(clip.fadeIn, duration), fadeOut: Math.min(clip.fadeOut, duration) };
}

// Materialize one placement on the ordinary clip, before history or persistence.
// Preview and export use AudioClip.start through the existing mixer.
export function reconcileSoundClip(clip: AudioClip, scenes: Scene[]): AudioClip {
  if (clip.soundCue) {
    const scene = scenes.find(item => item.id === clip.sceneId);
    if (!scene) return clip;
    const time = soundCueTime(scene, clip.soundCue.anchor);
    if (time === undefined)
      return { ...safePlacement(clip, clip.start, clip.duration, scene.duration), soundCue: undefined, soundReview: "event-removed" };
    const at = time + clip.soundCue.offset;
    const placement = safePlacement(clip, at, clip.duration, scene.duration);
    return { ...placement, soundReview: Math.abs(placement.start - at) > 1e-6 ? "timing" : undefined };
  }
  if (clip.ambience) {
    const range = atmosphereRange(scenes, clip.ambience);
    if (range) return safePlacement(clip, range.start, range.duration, range.start + range.duration);
    const total = scenes.reduce((n, scene) => n + scene.duration, 0);
    return { ...safePlacement(clip, clip.start, clip.duration, total), ambience: undefined, soundReview: "range-changed" };
  }
  return clip;
}

export function reconcileSoundClips(clips: AudioClip[], scenes: Scene[]) {
  return clips.some(clip => clip.soundCue || clip.ambience) ? clips.map(clip => reconcileSoundClip(clip, scenes)) : clips;
}

export function editSoundClip(clip: AudioClip, patch: Partial<AudioClip>): AudioClip {
  const moved = (patch.start !== undefined && patch.start !== clip.start) ||
    (Object.hasOwn(patch, "sceneId") && patch.sceneId !== clip.sceneId) ||
    (patch.category !== undefined && patch.category !== clip.category);
  const unlink = moved || !!clip.ambience && (patch.duration !== undefined || patch.loop === false);
  return { ...clip, ...patch, ...(unlink ? { soundCue: undefined, ambience: undefined, soundReview: undefined } : {}) };
}

export function validSoundLinks(clips: AudioClip[], scenes: Scene[]) {
  const linked = new Set<string>();
  for (const clip of clips) {
    const { soundCue, ambience, soundReview } = clip;
    if (soundReview !== undefined && !["event-removed", "timing", "range-changed"].includes(soundReview)) return false;
    if (soundCue !== undefined) {
      if (!record(soundCue) || !fields(soundCue, ["anchor", "offset"]) || !numberIn(soundCue.offset, -10, 10) ||
        !record(soundCue.anchor) || !id(soundCue.anchor.id) || clip.category !== "effects" || !clip.sceneId || ambience !== undefined)
        return false;
      const anchor = soundCue.anchor;
      if (anchor.kind === "action" || anchor.kind === "participation") {
        if (!fields(anchor, ["kind", "id", "moment"]) || typeof anchor.moment !== "string" ||
          !(anchor.kind === "action" ? ["Start", "Attach", "Transfer", "Release", "Finish", "Pour"] :
            ["question", "thinking", "reveal", "finish"]).includes(anchor.moment)) return false;
      } else if (!fields(anchor, ["kind", "id"]) || !["change", "step", "key"].includes(anchor.kind)) return false;
      const scene = scenes.find(item => item.id === clip.sceneId);
      if (!scene || soundCueTime(scene, anchor) === undefined) return false;
      const key = JSON.stringify([clip.sceneId, clip.assetId, soundAnchorKey(anchor)]);
      if (linked.has(key)) return false;
      linked.add(key);
    }
    if (ambience !== undefined && (!record(ambience) || !fields(ambience, ["first", "last"]) ||
      !id(ambience.first) || !id(ambience.last) || clip.sceneId !== undefined ||
      (clip.category !== "effects" && clip.category !== "music") || !clip.loop || !atmosphereRange(scenes, ambience))) return false;
    if (soundCue || ambience) {
      const placement = reconcileSoundClip(clip, scenes);
      if (Math.abs(placement.start - clip.start) > 1e-5 || Math.abs(placement.duration - clip.duration) > 1e-5 ||
        placement.soundReview !== soundReview) return false;
    }
  }
  return true;
}

export const actionSoundLabel = (action: keyof typeof INTERACTION_LABELS, event: string) =>
  event === "Attach" ? "Pick up" : event === "Release" ? "Set down" :
    event === "Transfer" ? "Hand over" : event === "Pour" ? "Pour water" : `${INTERACTION_LABELS[action]} · ${event}`;
