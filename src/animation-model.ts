import { validJoints } from "./puppet-model";
import type { JointSnapshot } from "./puppet-model";
import { numberIn, record, POSES } from "./art-model";
import type { Pose } from "./art-model";
import type { Emotion } from "./model";

export const EASINGS = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "bounce",
] as const;
export type Easing = (typeof EASINGS)[number];
export const EMOTIONS: Emotion[] = [
  "happy",
  "sad",
  "calm",
  "surprised",
  "excited",
  "worried",
];
export const MOUTHS = ["auto", "closed", "open", "smile", "talking"] as const;
export type Mouth = (typeof MOUTHS)[number];
export const HEARTS = [
  "off",
  "warm",
  "helping",
  "sad",
  "calm",
  "together",
] as const;
export type Heart = (typeof HEARTS)[number];
export const GESTURES = ["none", "wave", "nod", "shake", "walk"] as const;
export type Gesture = (typeof GESTURES)[number];
export interface TimedKey {
  id: string;
  time: number;
  easing: Easing;
}
export interface ElementValues {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  emotion: Emotion;
  pose: Pose;
  mouth: Mouth;
  heart: Heart;
  heartStrength: number;
  gesture: Gesture;
  openness: number;
}
export interface ElementKeyframe extends TimedKey, ElementValues {
  joints?: JointSnapshot;
}
export interface ElementAnimation {
  keyframes: ElementKeyframe[];
  blink: boolean;
  idle: "none" | "breathe" | "float";
}
export interface CameraValues {
  x: number;
  y: number;
  zoom: number;
}
export interface CameraKeyframe extends TimedKey, CameraValues {}
export interface CameraAnimation {
  keyframes: CameraKeyframe[];
  followId?: string;
}
export interface BackgroundValues {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}
export interface BackgroundKeyframe extends TimedKey, BackgroundValues {}
export interface BackgroundAnimation {
  enabled: boolean;
  style: "drift" | "sway" | "twinkle" | "parallax";
  keyframes: BackgroundKeyframe[];
}
export type AnyKeyframe = ElementKeyframe | CameraKeyframe | BackgroundKeyframe;
export const MAX_TRACK_KEYS = 120;
export const MAX_PROJECT_KEYS = 12000;
const inList = (v: unknown, list: readonly string[]) =>
  typeof v === "string" && list.includes(v);
function keysValid(
  value: unknown,
  duration: number,
  check: (key: Record<string, unknown>) => boolean,
  unique: (id: unknown) => void,
): value is AnyKeyframe[] {
  if (!Array.isArray(value) || value.length > MAX_TRACK_KEYS) return false;
  let previous = -1;
  for (const k of value) {
    if (
      !record(k) ||
      !numberIn(k.time, 0, duration) ||
      k.time <= previous ||
      !inList(k.easing, EASINGS) ||
      !check(k)
    )
      return false;
    unique(k.id);
    previous = k.time;
  }
  return true;
}
export function validElementAnimation(
  v: unknown,
  duration: number,
  unique: (id: unknown) => void,
  puppetParts?: ReadonlySet<string>,
): v is ElementAnimation {
  return (
    record(v) &&
    typeof v.blink === "boolean" &&
    inList(v.idle, ["none", "breathe", "float"]) &&
    keysValid(
      v.keyframes,
      duration,
      (k) =>
        numberIn(k.x, -800, 1600) &&
        numberIn(k.y, -450, 900) &&
        numberIn(k.scale, 0.05, 4) &&
        numberIn(k.rotation, -1440, 1440) &&
        numberIn(k.opacity, 0, 1) &&
        inList(k.emotion, EMOTIONS) &&
        inList(k.pose, POSES) &&
        inList(k.mouth, MOUTHS) &&
        inList(k.heart, HEARTS) &&
        numberIn(k.heartStrength, 0, 1) &&
        inList(k.gesture, GESTURES) &&
        numberIn(k.openness, 0, 1) &&
        (k.joints === undefined || (!!puppetParts && validJoints(k.joints, puppetParts))),
      unique,
    )
  );
}
export function validCameraAnimation(
  v: unknown,
  duration: number,
  elementIds: Set<string>,
  unique: (id: unknown) => void,
): v is CameraAnimation {
  return (
    record(v) &&
    (v.followId === undefined ||
      (typeof v.followId === "string" && elementIds.has(v.followId))) &&
    keysValid(
      v.keyframes,
      duration,
      (k) =>
        numberIn(k.x, -800, 1600) &&
        numberIn(k.y, -450, 900) &&
        numberIn(k.zoom, 0.5, 3),
      unique,
    )
  );
}
export function validBackgroundAnimation(
  v: unknown,
  duration: number,
  unique: (id: unknown) => void,
): v is BackgroundAnimation {
  return (
    record(v) &&
    typeof v.enabled === "boolean" &&
    inList(v.style, ["drift", "sway", "twinkle", "parallax"]) &&
    keysValid(
      v.keyframes,
      duration,
      (k) =>
        numberIn(k.x, -200, 200) &&
        numberIn(k.y, -120, 120) &&
        numberIn(k.scale, 1, 1.5) &&
        numberIn(k.opacity, 0, 1),
      unique,
    )
  );
}
