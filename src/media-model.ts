import { record, numberIn } from "./art-model";

export const AUDIO_MIMES = [
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
] as const;
export type AudioMime = (typeof AUDIO_MIMES)[number];
export const CATEGORIES = [
  "narration",
  "dialogue",
  "music",
  "effects",
] as const;
export type AudioCategory = (typeof CATEGORIES)[number];
export interface AudioAsset {
  id: string;
  name: string;
  mime: AudioMime;
  dataUrl: string;
  duration: number;
  channels: number;
  sampleRate: number;
}
export interface AudioClip {
  id: string;
  assetId: string;
  name: string;
  category: AudioCategory;
  sceneId?: string;
  characterId?: string;
  start: number;
  trimStart: number;
  trimEnd: number;
  duration: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
}
export interface Caption {
  id: string;
  sceneId: string;
  start: number;
  end: number;
  text: string;
}
export interface Mixer {
  duckMusic?: boolean;
  master: number;
  voice: number;
  music: number;
  effects: number;
  muted: boolean;
}
export interface CaptionStyle {
  fontSize: number;
  position: "top" | "bottom";
  color: "#ffffff" | "#ffe6a1";
}
export interface Production {
  audioAssets: AudioAsset[];
  audioClips: AudioClip[];
  captions: Caption[];
  mixer: Mixer;
  captionStyle: CaptionStyle;
}
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 120;
export const MAX_TOTAL_AUDIO_SECONDS = 300;
export const MAX_AUDIO_ASSETS = 24;
export const MAX_AUDIO_CLIPS = 240;
export const MAX_CAPTIONS = 1000;
export const emptyProduction = (): Production => ({
  audioAssets: [],
  audioClips: [],
  captions: [],
  mixer: { master: 1, voice: 1, music: 0.55, effects: 0.7, muted: false },
  captionStyle: { fontSize: 22, position: "bottom", color: "#ffffff" },
});
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
export function audioSignature(bytes: Uint8Array, mime: string) {
  const head = (a: number, b: number) =>
    String.fromCharCode(...bytes.slice(a, b));
  if (mime === "audio/wav")
    return head(0, 4) === "RIFF" && head(8, 12) === "WAVE";
  if (mime === "audio/ogg") return head(0, 4) === "OggS";
  if (mime === "audio/webm")
    return [0x1a, 0x45, 0xdf, 0xa3].every((n, i) => bytes[i] === n);
  return (
    mime === "audio/mpeg" &&
    (head(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0))
  );
}
export function audioDataValid(asset: AudioAsset) {
  if (
    typeof asset.dataUrl !== "string" ||
    asset.dataUrl.length > MAX_AUDIO_BYTES * 1.38 ||
    !asset.dataUrl.startsWith(`data:${asset.mime};base64,`) ||
    !/^data:audio\/(wav|mpeg|ogg|webm);base64,[A-Za-z0-9+/]+=*$/.test(
      asset.dataUrl,
    )
  )
    return false;
  try {
    const comma = asset.dataUrl.indexOf(",");
    const payload = asset.dataUrl.slice(comma + 1),
      padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    if (
      payload.length % 4 ||
      (payload.length * 3) / 4 - padding > MAX_AUDIO_BYTES ||
      payload.endsWith("===")
    )
      return false;
    return audioSignature(
      Uint8Array.from(atob(asset.dataUrl.slice(comma + 1, comma + 65)), (c) =>
        c.charCodeAt(0),
      ),
      asset.mime,
    );
  } catch {
    return false;
  }
}
// This validates the entire production graph before state is imported or saved.
export function validProduction(
  p: Record<string, unknown>,
  unique: (id: unknown) => void,
  characters: Set<string>,
  scenes: Map<string, { duration: number; start: number }>,
) {
  if (
    !Array.isArray(p.audioAssets) ||
    p.audioAssets.length > MAX_AUDIO_ASSETS ||
    !Array.isArray(p.audioClips) ||
    p.audioClips.length > MAX_AUDIO_CLIPS ||
    !Array.isArray(p.captions) ||
    p.captions.length > MAX_CAPTIONS ||
    !record(p.mixer) ||
    !record(p.captionStyle)
  )
    return false;
  const mixer = p.mixer;
  if (
    ![mixer.master, mixer.voice, mixer.music, mixer.effects].every((n) =>
      numberIn(n, 0, 1),
    ) ||
    typeof mixer.muted !== "boolean" ||
    (mixer.duckMusic !== undefined && typeof mixer.duckMusic !== "boolean") ||
    !numberIn(p.captionStyle.fontSize, 18, 32) ||
    !["top", "bottom"].includes(String(p.captionStyle.position)) ||
    !["#ffffff", "#ffe6a1"].includes(String(p.captionStyle.color))
  )
    return false;
  const assets = new Map<string, AudioAsset>();
  let seconds = 0;
  for (const a of p.audioAssets) {
    if (
      !record(a) ||
      !text(a.name, 160) ||
      !AUDIO_MIMES.includes(a.mime as AudioMime) ||
      !numberIn(a.duration, 0.02, MAX_AUDIO_SECONDS) ||
      !numberIn(a.sampleRate, 8000, 96000) ||
      !numberIn(a.channels, 1, 2) ||
      !Number.isInteger(a.channels) ||
      !audioDataValid(a as unknown as AudioAsset)
    )
      return false;
    unique(a.id);
    assets.set(a.id as string, a as unknown as AudioAsset);
    seconds += a.duration;
  }
  if (seconds > MAX_TOTAL_AUDIO_SECONDS + 0.001) return false;
  const total = [...scenes.values()].reduce((n, s) => n + s.duration, 0),
    overlaps: { time: number; delta: number }[] = [];
  for (const c of p.audioClips) {
    if (
      !record(c) ||
      !text(c.name, 100) ||
      !CATEGORIES.includes(c.category as AudioCategory) ||
      !assets.has(c.assetId as string) ||
      (c.sceneId !== undefined && !scenes.has(c.sceneId as string)) ||
      (c.characterId !== undefined &&
        (!characters.has(c.characterId as string) || c.category !== "dialogue"))
    )
      return false;
    const a = assets.get(c.assetId as string)!,
      scene =
        c.sceneId === undefined ? undefined : scenes.get(c.sceneId as string),
      limit = scene?.duration ?? total;
    if (
      !numberIn(c.start, 0, limit - 0.01) ||
      !numberIn(c.trimStart, 0, a.duration - 0.01) ||
      !numberIn(c.trimEnd, c.trimStart + 0.01, a.duration + 0.001) ||
      !numberIn(c.duration, 0.01, limit - c.start + 0.00001) ||
      !numberIn(c.volume, 0, 1) ||
      typeof c.muted !== "boolean" ||
      typeof c.loop !== "boolean" ||
      (!c.loop && c.duration > c.trimEnd - c.trimStart + 0.001) ||
      !numberIn(c.fadeIn, 0, c.duration) ||
      !numberIn(c.fadeOut, 0, c.duration)
    )
      return false;
    unique(c.id);
    const start = c.start + (scene?.start ?? 0);
    overlaps.push(
      { time: start, delta: 1 },
      { time: start + c.duration, delta: -1 },
    );
  }
  let active = 0;
  for (const item of overlaps.sort(
    (a, b) => a.time - b.time || a.delta - b.delta,
  )) {
    active += item.delta;
    if (active > 24) return false;
  }
  for (const c of p.captions) {
    if (
      !record(c) ||
      !scenes.has(c.sceneId as string) ||
      !text(c.text, 280) ||
      !numberIn(c.start, 0, scenes.get(c.sceneId as string)!.duration - 0.01) ||
      !numberIn(
        c.end,
        (c.start as number) + 0.01,
        scenes.get(c.sceneId as string)!.duration,
      )
    )
      return false;
    unique(c.id);
  }
  return true;
}
