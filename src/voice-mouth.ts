import { clipGain, clipOffset, clipStart } from "./production";
import { clamp, sceneStart } from "./timeline";
import { VOICE_MOUTH_HZ, MAX_MOUTH_TRACKS, TALKING_PRESETS, voiceMouthSampleCount } from "./voice-mouth-model";
import type { VoiceMouthTrack, TalkingPreset } from "./voice-mouth-model";
import { MAX_AUDIO_SECONDS } from "./media-model";
import type { AudioClip } from "./media-model";
import type { Character, Project, Scene, SceneElement } from "./model";

export function supportsVoiceMouth(character: Character | undefined, element: SceneElement) {
  if (!character || (element.kind && element.kind !== "character")) return false;
  const rig = character.puppet;
  if (!rig) return !(element.assetId ?? character.assetId);
  const mouths = rig.parts.filter(part => part.role === "mouth");
  return mouths.length ? mouths.some(part => !part.assetId) :
    rig.face && rig.parts.some(part => part.role === "head");
}

// Decode only one existing original. Scan its trimmed PCM at a fixed rate.
export function analyzeVoiceEnvelope(buffer: Pick<AudioBuffer, "duration" | "length" | "numberOfChannels" | "sampleRate" | "getChannelData">,
  start: number, end: number) {
  if (!Number.isFinite(buffer.duration) || buffer.duration > MAX_AUDIO_SECONDS + 0.01 ||
      !Number.isFinite(buffer.sampleRate) || buffer.sampleRate < 1000 ||
      buffer.length * buffer.numberOfChannels * 4 > 64 * 1024 * 1024 ||
      ![1, 2].includes(buffer.numberOfChannels) ||
      !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end - start < 0.00999 ||
      end > MAX_AUDIO_SECONDS || end > buffer.duration + 0.2)
    throw new Error("Choose a valid short recording and trim. The audio has not been changed.");
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const levels = new Float32Array(voiceMouthSampleCount(start, end));
  for (let i = 0; i < levels.length; i++) {
    const from = Math.min(buffer.length, Math.floor((start + i / VOICE_MOUTH_HZ) * buffer.sampleRate));
    const to = Math.min(buffer.length, Math.floor(Math.min(end, start + (i + 1) / VOICE_MOUTH_HZ) * buffer.sampleRate));
    let squares = 0;
    for (const channel of channels) {
      for (let sample = from; sample < to; sample++) squares += channel[sample] ** 2;
    }
    levels[i] = to > from ? Math.sqrt(squares / ((to - from) * channels.length)) : 0;
  }
  const audible = Array.from(levels).filter(level => level > 0.004).sort((a, b) => a - b);
  const reference = audible[Math.floor((audible.length - 1) * 0.9)] ?? 0;
  const floor = Math.max(0.004, reference * 0.065);
  const gated = levels.map(level => level >= floor ? Math.min(1, level / Math.max(0.025, reference)) : 0);
  return Array.from(gated, (level, i) => {
    const previous = gated[i - 1] ?? level, next = gated[i + 1] ?? level;
    const smooth = level || (previous && next) ? previous * 0.16 + level * 0.68 + next * 0.16 : 0;
    return Math.round(smooth * 255).toString(16).padStart(2, "0");
  }).join("");
}

export function voiceRange(project: Project, scene: Scene, clip: AudioClip) {
  if (clip.sceneId && clip.sceneId !== scene.id) return;
  const index = project.scenes.findIndex(item => item.id === scene.id);
  if (index < 0) return;
  const start = sceneStart(project, index);
  const offset = clipStart(project, clip);
  const from = Math.max(0, start - offset);
  const to = Math.min(clip.duration, start + scene.duration - offset);
  return to - from > 0.001 ? { from, to, sceneStart: start, clipStart: offset } : undefined;
}

export function voiceClips(project: Project, scene: Scene) {
  return project.audioClips.filter(clip => (clip.category === "narration" || clip.category === "dialogue") &&
    !!voiceRange(project, scene, clip));
}

function linkedClip(project: Project, element: SceneElement, track: VoiceMouthTrack) {
  const clip = project.audioClips.find(item => item.id === track.clipId);
  if (!clip || clip.assetId !== track.sourceId || track.speakerId !== element.characterId ||
      (clip.category !== "narration" && clip.category !== "dialogue") ||
      (clip.characterId && clip.characterId !== element.characterId) ||
      clip.trimStart !== track.trimStart || clip.trimEnd !== track.trimEnd ||
      !project.audioAssets.some(asset => asset.id === clip.assetId)) return;
  return clip;
}

export function mouthTrackIsCurrent(project: Project, scene: Scene, element: SceneElement, track: VoiceMouthTrack) {
  const clip = linkedClip(project, element, track);
  const range = clip && voiceRange(project, scene, clip);
  return !!range && Math.min(range.to, track.end) > Math.max(range.from, track.start);
}

export function applyTalkingPreset(track: VoiceMouthTrack, preset: TalkingPreset): VoiceMouthTrack {
  const { sensitivity, minimum, maximum } = TALKING_PRESETS[preset];
  return { ...track, preset, sensitivity, minimum, maximum };
}

function readLevel(track: VoiceMouthTrack, offset: number) {
  const position = clamp((offset - track.trimStart) * VOICE_MOUTH_HZ - 0.5, 0, track.levels.length / 2 - 1);
  const index = Math.floor(position);
  const left = parseInt(track.levels.slice(index * 2, index * 2 + 2), 16);
  const right = parseInt(track.levels.slice(index * 2 + 2, index * 2 + 4), 16) || 0;
  return (left + (right - left) * (position - index)) / 255;
}

export function mouthOpeningAt(project: Project, clip: AudioClip, track: VoiceMouthTrack, elapsed: number) {
  const gain = clipGain(clip, elapsed) * project.mixer.voice * project.mixer.master;
  if (project.mixer.muted || gain <= 0) return 0;
  for (let i = track.corrections.length - 1; i >= 0; i--) {
    const cue = track.corrections[i];
    if (elapsed >= cue.start && elapsed < cue.end) return cue.opening;
  }
  const delayed = elapsed - track.delay;
  if (delayed < 0 || delayed >= clip.duration) return 0;
  const signal = readLevel(track, clipOffset(clip, delayed)) * gain * track.sensitivity;
  return signal < 0.075 ? 0 : clamp(signal * track.maximum, track.minimum, track.maximum);
}

export function voiceMouthAt(project: Project, scene: Scene, element: SceneElement, absolute: number, manual: boolean) {
  // Newer explicit selections take precedence where multiple clips overlap.
  for (let i = (element.voiceMouth?.length ?? 0) - 1; i >= 0; i--) {
    const track = element.voiceMouth![i];
    if (manual && !track.replaceManual) continue;
    const clip = linkedClip(project, element, track);
    if (!clip || (clip.sceneId && clip.sceneId !== scene.id)) continue;
    const elapsed = absolute - clipStart(project, clip);
    if (elapsed < track.start || elapsed >= Math.min(track.end, clip.duration)) continue;
    return { opening: mouthOpeningAt(project, clip, track, elapsed), expression: track.expression };
  }
}

export function hasManualMouth(element: SceneElement, start: number, end: number) {
  const keys = element.animation?.keyframes ?? [];
  return keys.some((key, index) => key.mouth !== "auto" && key.time < end &&
    (keys[index + 1]?.time ?? Infinity) > start);
}

export function withVoiceTrack(project: Project, scene: Scene, element: SceneElement, clipId: string, track?: VoiceMouthTrack) {
  const tracks = element.voiceMouth?.filter(item => item.clipId !== clipId) ?? [];
  if (track) tracks.push(track);
  if (tracks.length > MAX_MOUTH_TRACKS)
    throw new Error("This character already has 12 voice tracks in this scene. Remove a track before adding another.");
  return { ...project, scenes: project.scenes.map(item => item.id === scene.id ? {
    ...item, elements: item.elements.map(actor => actor.id === element.id ? {
      ...actor, voiceMouth: tracks.length ? tracks : undefined,
    } : actor),
  } : item) };
}

export function copySceneVoice(source: Scene, copy: Scene, oldClips: AudioClip[], newClips: AudioClip[]) {
  const ids = new Map(oldClips.map((clip, i) => [clip.id, newClips[i]?.id]));
  return { ...copy, elements: copy.elements.map((element, i) => {
    const tracks = source.elements[i].voiceMouth?.flatMap(track => {
      const clipId = ids.get(track.clipId);
      return clipId ? [{ ...track, clipId }] : [];
    });
    return tracks?.length ? { ...element, voiceMouth: tracks } : element;
  }) };
}
