import {
  colorValid,
  validCrop,
  validDrawing,
  POSES,
  PROPS,
  numberIn,
  rasterSignature,
} from "./art-model";
import type { Crop, DrawingDocument, Pose, PropName } from "./art-model";
export const SCHEMA_VERSION = 2 as const;
export const BACKGROUNDS = [
  "meadow",
  "playground",
  "classroom",
  "moonlight",
  "house",
  "bedroom",
  "forest",
  "garden",
  "beach",
  "town",
  "magical",
] as const;
export type Background = (typeof BACKGROUNDS)[number];
export type Emotion =
  "happy" | "sad" | "surprised" | "calm" | "excited" | "worried";
export type Motion =
  | "still"
  | "enter-left"
  | "enter-right"
  | "walk"
  | "bounce"
  | "spin"
  | "grow"
  | "fade";
export type Mood =
  "gentle" | "funny" | "adventurous" | "magical" | "educational";
export interface Character {
  id: string;
  name: string;
  shirt: string;
  skin: string;
  hair: string;
  accessory: "none" | "bow" | "cap";
  assetId?: string;
}
export interface Asset {
  id: string;
  name: string;
  type: "image";
  mime: "image/png" | "image/jpeg" | "image/webp";
  dataUrl: string;
  drawing?: DrawingDocument;
}
export interface SceneElement {
  id: string;
  characterId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flip: boolean;
  emotion: Emotion;
  motion: Motion;
  kind?: "character" | "prop" | "art";
  assetId?: string;
  prop?: PropName;
  pose?: Pose;
  opacity?: number;
  flipY?: boolean;
  width?: number;
  height?: number;
  crop?: Crop;
  name?: string;
  appearance?: Partial<
    Pick<Character, "shirt" | "skin" | "hair" | "accessory">
  >;
  sourceLibraryId?: string;
  backdrop?: boolean;
}
export interface Scene {
  id: string;
  title: string;
  narration: string;
  dialogue: string;
  duration: number;
  background: Background;
  camera: "wide" | "close";
  transition: "cut" | "fade";
  action: string;
  props: string;
  audioRefs: string[];
  elements: SceneElement[];
}
export interface Outline {
  beginning: string;
  conflict: string;
  response: string;
  ending: string;
}
export interface Project {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  title: string;
  idea: string;
  lesson: string;
  setting: string;
  mood: Mood;
  artStyle: string;
  targetAge: string;
  plannedMinutes: number;
  outline: Outline;
  characters: Character[];
  scenes: Scene[];
  assets: Asset[];
  status: "draft" | "ready";
  createdAt: string;
  updatedAt: string;
}
export interface IdeaInput {
  idea: string;
  title: string;
  names: string;
  setting: string;
  lesson: string;
  mood: Mood;
  artStyle: string;
  targetAge: string;
  plannedMinutes: number;
}
export interface StoryProvider {
  readonly name: string;
  plan(input: IdeaInput): Promise<Project>;
}
export function uid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues also works on local HTTP previews, outside a secure context.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const clone = <T>(value: T): T => structuredClone(value);
export const totalDuration = (project: Project) =>
  project.scenes.reduce((sum, s) => sum + s.duration, 0);
export function durationLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}
export function makeScene(characters: Character[], index = 0): Scene {
  return {
    id: uid(),
    title: `A new moment ${index + 1}`,
    narration: "What happens in this part of the story?",
    dialogue: "",
    duration: 8,
    background: "meadow",
    camera: "wide",
    transition: "fade",
    action: "The characters take a moment together.",
    props: "",
    audioRefs: [],
    elements: characters.slice(0, 2).map((c, i) => ({
      id: uid(),
      characterId: c.id,
      x: 310 + i * 230,
      y: 340,
      scale: 1,
      rotation: 0,
      flip: false,
      emotion: "happy",
      motion: i ? "enter-right" : "still",
    })),
  };
}
export const MAX_PROJECT_BYTES = 32 * 1024 * 1024;
export const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
function validString(v: unknown, max = 6000): v is string {
  return typeof v === "string" && v.length <= max;
}
function bounded(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}
function oneOf<T extends string>(v: unknown, choices: readonly T[]): v is T {
  return typeof v === "string" && choices.includes(v as T);
}
const validColor = (v: unknown) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const fail = (): never => {
  throw new Error(
    "This backup has invalid or unsupported project data. Your current work is unchanged.",
  );
};

// Validate the whole graph before either importing or rendering untrusted data.
export function validateProject(value: unknown): Project {
  if (!isRecord(value)) return fail();
  if (value.schemaVersion === 1) return validateProject(migrateV1(value));
  const p = value;
  if (
    p.schemaVersion !== SCHEMA_VERSION ||
    !validString(p.id, 100) ||
    !p.id ||
    !validString(p.title, 160) ||
    !p.title.trim() ||
    !validString(p.idea) ||
    !validString(p.lesson, 500) ||
    !validString(p.setting, 300) ||
    !oneOf(p.mood, [
      "gentle",
      "funny",
      "adventurous",
      "magical",
      "educational",
    ]) ||
    !validString(p.artStyle, 100) ||
    !validString(p.targetAge, 50) ||
    !bounded(p.plannedMinutes, 1, 30) ||
    !oneOf(p.status, ["draft", "ready"]) ||
    !validString(p.createdAt, 40) ||
    !validString(p.updatedAt, 40) ||
    !Number.isFinite(Date.parse(p.createdAt)) ||
    !Number.isFinite(Date.parse(p.updatedAt)) ||
    !isRecord(p.outline) ||
    !["beginning", "conflict", "response", "ending"].every((k) =>
      validString((p.outline as Record<string, unknown>)[k]),
    ) ||
    !Array.isArray(p.characters) ||
    p.characters.length < 1 ||
    p.characters.length > 20 ||
    !Array.isArray(p.scenes) ||
    p.scenes.length < 1 ||
    p.scenes.length > 120 ||
    !Array.isArray(p.assets) ||
    p.assets.length > 40
  )
    return fail();
  const ids = new Set<string>();
  function unique(id: unknown) {
    if (!validString(id, 100) || !id || ids.has(id)) fail();
    ids.add(id as string);
  }
  const assetIds = new Set<string>();
  for (const asset of p.assets) {
    if (
      !isRecord(asset) ||
      !validString(asset.name, 160) ||
      asset.type !== "image" ||
      !oneOf(asset.mime, ["image/png", "image/jpeg", "image/webp"]) ||
      typeof asset.dataUrl !== "string" ||
      asset.dataUrl.length > MAX_ASSET_BYTES * 1.38 ||
      !asset.dataUrl.startsWith(`data:${asset.mime};base64,`) ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(
        asset.dataUrl,
      ) ||
      (asset.drawing !== undefined && !validDrawing(asset.drawing)) ||
      !rasterSignature(asset.dataUrl, asset.mime)
    )
      return fail();
    unique(asset.id);
    assetIds.add(asset.id as string);
  }
  const characterIds = new Set<string>();
  for (const c of p.characters) {
    if (
      !isRecord(c) ||
      !validString(c.name, 80) ||
      !c.name.trim() ||
      ![c.shirt, c.hair, c.skin].every(validColor) ||
      !oneOf(c.accessory, ["none", "bow", "cap"]) ||
      (c.assetId !== undefined && !assetIds.has(c.assetId as string))
    )
      return fail();
    unique(c.id);
    characterIds.add(c.id as string);
  }
  for (const s of p.scenes) {
    if (
      !isRecord(s) ||
      !validString(s.title, 160) ||
      !s.title.trim() ||
      !validString(s.narration) ||
      !validString(s.dialogue) ||
      !bounded(s.duration, 2, 120) ||
      !oneOf(s.background, BACKGROUNDS) ||
      !oneOf(s.camera, ["wide", "close"]) ||
      !oneOf(s.transition, ["cut", "fade"]) ||
      !validString(s.action) ||
      !validString(s.props, 500) ||
      !Array.isArray(s.audioRefs) ||
      s.audioRefs.length > 20 ||
      !s.audioRefs.every((a) => validString(a, 100)) ||
      !Array.isArray(s.elements) ||
      s.elements.length > 20
    )
      return fail();
    unique(s.id);
    for (const e of s.elements) {
      if (
        !isRecord(e) ||
        !oneOf(e.kind ?? "character", ["character", "prop", "art"]) ||
        ((e.kind === undefined || e.kind === "character") &&
          !characterIds.has(e.characterId as string)) ||
        (e.kind === "prop" && !oneOf(e.prop, PROPS)) ||
        (e.kind === "art" && !assetIds.has(e.assetId as string)) ||
        (e.assetId !== undefined && !assetIds.has(e.assetId as string)) ||
        (e.pose !== undefined && !oneOf(e.pose, POSES)) ||
        (e.opacity !== undefined && !numberIn(e.opacity, 0, 1)) ||
        (e.flipY !== undefined && typeof e.flipY !== "boolean") ||
        (e.width !== undefined && !numberIn(e.width, 10, 1600)) ||
        (e.height !== undefined && !numberIn(e.height, 10, 900)) ||
        (e.crop !== undefined && !validCrop(e.crop)) ||
        (e.name !== undefined && !validString(e.name, 80)) ||
        (e.sourceLibraryId !== undefined &&
          !validString(e.sourceLibraryId, 100)) ||
        (e.backdrop !== undefined && typeof e.backdrop !== "boolean") ||
        (e.appearance !== undefined &&
          (!isRecord(e.appearance) ||
            !Object.entries(e.appearance).every(([k, v]) =>
              k === "accessory"
                ? oneOf(v, ["none", "bow", "cap"])
                : ["shirt", "skin", "hair"].includes(k) && colorValid(v),
            ))) ||
        !bounded(e.x, 0, 800) ||
        !bounded(e.y, 50, 450) ||
        !bounded(e.scale, 0.3, 2) ||
        !bounded(e.rotation, -180, 180) ||
        typeof e.flip !== "boolean" ||
        !oneOf(e.emotion, [
          "happy",
          "sad",
          "surprised",
          "calm",
          "excited",
          "worried",
        ]) ||
        !oneOf(e.motion, [
          "still",
          "enter-left",
          "enter-right",
          "walk",
          "bounce",
          "spin",
          "grow",
          "fade",
        ])
      )
        return fail();
      unique(e.id);
    }
  }
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
    MAX_PROJECT_BYTES
  )
    throw new Error(
      "This project exceeds the 32 MB portable project limit. Remove unused images or use smaller originals.",
    );
  // Keep validated data detached from the caller. Rendering uses text nodes and raster images.
  return JSON.parse(JSON.stringify(value)) as Project;
}
export function parseBackup(text: string): Project {
  if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_BYTES)
    throw new Error("This backup is too large. The limit is 32 MB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid project JSON.");
  }
  return validateProject(value);
}
// Lazy, non-destructive migration: originals stay untouched until the next successful save.
export function migrateV1(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const copy = clone(value);
  copy.schemaVersion = 2;
  if (Array.isArray(copy.scenes))
    for (const scene of copy.scenes) {
      if (isRecord(scene) && Array.isArray(scene.elements))
        scene.elements = scene.elements.map((e) =>
          isRecord(e)
            ? {
                ...e,
                kind: "character",
                pose: "standing",
                opacity: 1,
                flipY: false,
              }
            : e,
        );
    }
  return copy;
}
export function duplicateProject(source: Project): Project {
  const copy = clone(source);
  copy.id = uid();
  copy.title = `${source.title.slice(0, 150)} (copy)`;
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  return copy;
}
