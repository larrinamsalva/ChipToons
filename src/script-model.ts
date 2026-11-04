import { numberIn, record } from "./art-model";
import type { Scene } from "./model";

export const VOICE_FIELDS = {
  description: "Voice description",
  delivery: "Delivery style",
  pace: "Speaking pace",
  personality: "Personality",
  pronunciation: "Pronunciation notes",
  performer: "Human voice performer (optional)",
} as const;
export type VoiceNotes = Partial<Record<keyof typeof VOICE_FIELDS, string>>;

export interface ScriptTake {
  assetId: string;
  words: string;
  approved?: boolean;
}
export interface ScriptLine {
  id: string;
  kind: "narration" | "dialogue";
  speakerId?: string;
  text: string;
  delivery: string;
  pause?: number;
  takes: ScriptTake[];
  clipId?: string;
}
export interface SceneScript {
  lines: ScriptLine[];
  acting: string;
  emotion: string;
}
export interface ScriptOptions {
  pace: number;
  pause: number;
  seriesTitle?: string;
  helloHeart?: true;
}
export const DEFAULT_SCRIPT: ScriptOptions = { pace: 120, pause: 1 };
export const MAX_SCRIPT_LINES = 80;
export const MAX_LINE_TAKES = 12;

const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;

export function validVoiceNotes(value: unknown): value is VoiceNotes {
  return record(value) && Object.entries(value).every(([key, entry]) =>
    Object.hasOwn(VOICE_FIELDS, key) && text(entry, 300));
}

export function validScriptOptions(value: unknown) {
  return record(value) && numberIn(value.pace, 60, 240) && numberIn(value.pause, 0, 20) &&
    (value.seriesTitle === undefined || text(value.seriesTitle, 160)) &&
    (value.helloHeart === undefined || value.helloHeart === true);
}

export function spokenFields(lines: ScriptLine[]) {
  return {
    narration: lines.filter(line => line.kind === "narration").map(line => line.text).join("\n"),
    dialogue: lines.filter(line => line.kind === "dialogue").map(line => line.text).join("\n"),
  };
}

// Called after ordinary production validation, so existing audio invariants still apply.
export function validateScripts(project: Record<string, unknown>, unique: (id: unknown) => void, characterIds: Set<string>) {
  if (project.scriptOptions !== undefined && !validScriptOptions(project.scriptOptions)) return false;
  const sources = new Set((project.audioAssets as { id: string }[]).map(asset => asset.id));
  const clips = new Map((project.audioClips as {
    id: string; sceneId?: string; category: string; assetId: string; characterId?: string;
  }[]).map(clip => [clip.id, clip]));
  const linked = new Set<string>();
  for (const scene of project.scenes as Scene[]) {
    const script = scene.script;
    if (script === undefined) continue;
    if (!record(script) || !text(script.acting, 1500) || !text(script.emotion, 1000) ||
        !Array.isArray(script.lines) || script.lines.length > MAX_SCRIPT_LINES) return false;
    for (const line of script.lines) {
      if (!record(line) || (line.kind !== "narration" && line.kind !== "dialogue") ||
          (line.speakerId !== undefined && (line.kind !== "dialogue" || !characterIds.has(line.speakerId))) ||
          !text(line.text, 6000) || !text(line.delivery, 400) ||
          (line.pause !== undefined && !numberIn(line.pause, 0, 20)) ||
          !Array.isArray(line.takes) || line.takes.length > MAX_LINE_TAKES) return false;
      unique(line.id);
      const takeIds = new Set<string>();
      for (const take of line.takes) {
        if (!record(take) || typeof take.assetId !== "string" || !sources.has(take.assetId) ||
            takeIds.has(take.assetId) || typeof take.words !== "string" || !/^[a-f\d]{64}$/.test(take.words) ||
            (take.approved !== undefined && typeof take.approved !== "boolean")) return false;
        takeIds.add(take.assetId);
      }
      if (line.clipId !== undefined) {
        const clip = clips.get(line.clipId);
        if (!clip || linked.has(line.clipId) || !takeIds.has(clip.assetId) ||
            clip.sceneId !== scene.id || clip.category !== line.kind || clip.characterId !== line.speakerId) return false;
        linked.add(line.clipId);
      }
    }
    const speech = spokenFields(script.lines);
    if (scene.narration !== speech.narration || scene.dialogue !== speech.dialogue) return false;
  }
  return true;
}
