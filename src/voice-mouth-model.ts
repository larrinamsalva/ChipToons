import { numberIn, record } from "./art-model";
import { EMOTIONS } from "./animation-model";
import { MAX_AUDIO_SECONDS } from "./media-model";
import type { Emotion } from "./model";

export const VOICE_MOUTH_HZ = 25;
export const MAX_MOUTH_TRACKS = 12;
export const MAX_MOUTH_CORRECTIONS = 32;
export const MAX_MOUTH_SAMPLE_BYTES = 1_000_000;
export const TALKING_PRESETS = {
  gentle: { label: "Gentle Talking", sensitivity: 0.8, minimum: 0.04, maximum: 0.55 },
  normal: { label: "Normal Talking", sensitivity: 1, minimum: 0.08, maximum: 0.82 },
  expressive: { label: "Expressive Talking", sensitivity: 1.35, minimum: 0.15, maximum: 1 },
} as const;
export type TalkingPreset = keyof typeof TALKING_PRESETS;
export interface MouthCorrection {
  start: number;
  end: number;
  opening: number;
}
export interface VoiceMouthTrack {
  clipId: string;
  sourceId: string;
  speakerId: string;
  trimStart: number;
  trimEnd: number;
  // Fixed-rate hexadecimal RMS bytes. The time origin is trimStart.
  levels: string;
  start: number;
  end: number;
  delay: number;
  preset: TalkingPreset;
  sensitivity: number;
  minimum: number;
  maximum: number;
  expression: Emotion | "keep";
  replaceManual: boolean;
  corrections: MouthCorrection[];
}
const id = (value: unknown): value is string => typeof value === "string" && !!value.trim() && value.length <= 100;
const time = (value: unknown): value is number => numberIn(value, 0, 120 * 120);
export const voiceMouthSampleCount = (start: number, end: number) => Math.ceil((end - start) * VOICE_MOUTH_HZ - 1e-7);

export function validVoiceMouthTracks(value: unknown, characterId: unknown, countBytes: (length: number) => boolean) {
  if (!id(characterId) || !Array.isArray(value) || value.length > MAX_MOUTH_TRACKS) return false;
  const ids = new Set<string>();
  for (const track of value) {
    if (!record(track) || !id(track.clipId) || ids.has(track.clipId) ||
        !id(track.sourceId) || track.speakerId !== characterId ||
        !time(track.trimStart) || !numberIn(track.trimEnd, 0, MAX_AUDIO_SECONDS) || track.trimEnd - track.trimStart < 0.00999 ||
        typeof track.levels !== "string" || track.levels.length !== voiceMouthSampleCount(track.trimStart, track.trimEnd) * 2 ||
        !/^[a-f\d]+$/.test(track.levels) || !countBytes(track.levels.length) ||
        !time(track.start) || !time(track.end) || track.end <= track.start ||
        !numberIn(track.delay, -0.5, 0.5) || typeof track.preset !== "string" || !Object.hasOwn(TALKING_PRESETS, track.preset) ||
        !numberIn(track.sensitivity, 0.25, 2.5) || !numberIn(track.minimum, 0, 1) ||
        !numberIn(track.maximum, track.minimum as number, 1) ||
        (track.expression !== "keep" && !EMOTIONS.includes(track.expression as Emotion)) ||
        typeof track.replaceManual !== "boolean" || !Array.isArray(track.corrections) || track.corrections.length > MAX_MOUTH_CORRECTIONS)
      return false;
    for (const cue of track.corrections) {
      if (!record(cue) || !time(cue.start) || !time(cue.end) ||
          cue.end <= cue.start || !numberIn(cue.opening, 0, 1)) return false;
    }
    ids.add(track.clipId);
  }
  return true;
}
