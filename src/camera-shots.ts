import type { CameraValues } from "./animation-model";
import { numberIn, record, validDisplayText } from "./art-model";
import { focusWindow } from "./focus-model";
import type { Scene } from "./model";
import { soundCueTime } from "./sound-cues";
import type { SoundAnchor } from "./sound-cues";

export const SHOT_TITLE = "Direct My Cartoon Camera";
export const MAX_CAMERA_SHOTS = 24;
export const SHOT_STYLES = {
  wide: { label: "Wide Shot", zoom: 1 },
  medium: { label: "Medium Shot", zoom: 1.6 },
  close: { label: "Close-Up", zoom: 2.5 },
  detail: { label: "Detail Shot", zoom: 2.85 },
  pair: { label: "Two-Character Shot", zoom: 1.6 },
  reaction: { label: "Reaction Shot", zoom: 2.25 },
  follow: { label: "Follow Shot", zoom: 1.65 },
  move: { label: "Gentle Camera Move", zoom: 1.45 },
} as const;
export type ShotStyle = keyof typeof SHOT_STYLES;
export type ShotAnchor = SoundAnchor | { kind: "focus"; id: string };
export type CameraShot = {
  id: string;
  style: ShotStyle;
  start: number;
  end: number;
  move: number;
  frame: CameraValues;
  /** Optional starting camera; absent in all existing shots. */
  fromFrame?: CameraValues;
  targets: string[];
  follow: boolean;
  offset: { x: number; y: number };
  placement: "left" | "center" | "right";
  note: string;
  cue?: { anchor: ShotAnchor; reviewedAt: number };
  lineId?: string;
  overlays?: true;
  missingTarget?: true;
  missingLink?: true;
};

const epsilon = 1e-8;
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;
const keys = (v: object, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key));

export function shotCueTime(scene: Scene, anchor: ShotAnchor) {
  if (anchor.kind !== "focus") return soundCueTime(scene, anchor);
  const graphic = scene.focusGraphics?.find(item => item.id === anchor.id);
  return graphic ? focusWindow(scene, graphic).start : undefined;
}

export function shotAt(scene: Scene, time: number) {
  return scene.cameraShots?.find(shot => time >= shot.start && time < shot.end);
}

export function shotNeedsReview(scene: Scene, shot: CameraShot) {
  const at = shot.cue && shotCueTime(scene, shot.cue.anchor);
  return !!(shot.missingTarget || shot.missingLink || (shot.cue && (at === undefined || Math.abs(at - shot.cue.reviewedAt) > 0.005)));
}

export function hasCameraTrack(scene: Scene) {
  return !!(scene.cameraAnimation?.followId || scene.cameraAnimation?.keyframes.length);
}

export function shotIssue(value: unknown, scene: Scene, unique: (id: string) => void = () => {}) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > MAX_CAMERA_SHOTS) return "Use up to 24 camera shots in a scene.";
  const ids = new Set<string>();
  const intervals: { start: number; end: number }[] = [];
  for (const item of value) {
    if (!record(item) || !keys(item, ["id", "style", "start", "end", "move", "frame", "targets", "follow",
      "offset", "placement", "note", "cue", "lineId", "overlays", "missingTarget", "missingLink", "fromFrame"]) ||
      !id(item.id) || ids.has(item.id) || typeof item.style !== "string" || !Object.hasOwn(SHOT_STYLES, item.style) ||
      !numberIn(item.start, 0, scene.duration) || !numberIn(item.end, item.start, scene.duration) || item.end - item.start <= epsilon ||
      !numberIn(item.move, 0, item.end - item.start + epsilon) ||
      !record(item.frame) || !keys(item.frame, ["x", "y", "zoom"]) ||
      !numberIn(item.frame.x, 0, 800) || !numberIn(item.frame.y, 0, 450) || !numberIn(item.frame.zoom, 1, 3) ||
      (item.fromFrame !== undefined && (
        !record(item.fromFrame) || !keys(item.fromFrame, ["x", "y", "zoom"]) ||
        !numberIn(item.fromFrame.x, 0, 800) || !numberIn(item.fromFrame.y, 0, 450) ||
        !numberIn(item.fromFrame.zoom, 1, 3) || item.start !== 0 ||
        item.move <= 0 || item.style !== "move" ||
        (Array.isArray(item.targets) && item.targets.length !== 0) || item.follow !== false
      )) ||
      !record(item.offset) || !keys(item.offset, ["x", "y"]) ||
      !numberIn(item.offset.x, -300, 300) || !numberIn(item.offset.y, -300, 300) ||
      !Array.isArray(item.targets) || item.targets.length > 2 ||
      new Set(item.targets).size !== item.targets.length || !item.targets.every(target => id(target) && scene.elements.some(element => element.id === target)) ||
      typeof item.follow !== "boolean" || (item.follow && !item.targets.length) ||
      !["left", "center", "right"].includes(item.placement as string) || !validDisplayText(item.note, 160) ||
      [item.overlays, item.missingTarget, item.missingLink].some(flag => flag !== undefined && flag !== true))
      return "Check the shot’s framing, subjects, and time range.";
    if (item.lineId !== undefined && (!id(item.lineId) || !Array.isArray(scene.script?.lines) ||
      !scene.script.lines.some(line => record(line) && line.id === item.lineId))) return "Choose an existing script line in this scene.";
    if (item.cue !== undefined) {
      const cue = item.cue;
      if (!record(cue) || !keys(cue, ["anchor", "reviewedAt"]) || !numberIn(cue.reviewedAt, 0, scene.duration) ||
        !record(cue.anchor) || !id(cue.anchor.id) ||
        !keys(cue.anchor, cue.anchor.kind === "action" || cue.anchor.kind === "participation" ? ["kind", "id", "moment"] : ["kind", "id"]) ||
        !Number.isFinite(shotCueTime(scene, cue.anchor as ShotAnchor))) return "Choose an existing teaching or animation event in this scene.";
    }
    intervals.push({ start: item.start, end: item.end });
    ids.add(item.id);
    unique(item.id);
  }
  intervals.sort((a, b) => a.start - b.start);
  if (intervals.some((item, i) => i > 0 && item.start < intervals[i - 1].end))
    return "Camera shots cannot overlap. Move a shot or shorten it to make room.";
}

export function reconcileShotReferences(scene: Scene) {
  if (!scene.cameraShots?.length) return scene;
  let changed = false;
  const cameraShots = scene.cameraShots.map(shot => {
    const missingTarget = shot.targets.some(id => !scene.elements.some(item => item.id === id));
    const lostCue = shot.cue && shotCueTime(scene, shot.cue.anchor) === undefined;
    const lostLine = shot.lineId && !scene.script?.lines.some(line => line.id === shot.lineId);
    if (!missingTarget && !lostCue && !lostLine) return shot;
    changed = true;
    return { ...shot, ...(missingTarget ? { targets: [], follow: false, missingTarget: true as const } : {}),
      ...(lostCue ? { cue: undefined, missingLink: true as const } : {}),
      ...(lostLine ? { lineId: undefined, missingLink: true as const } : {}) };
  });
  return changed ? { ...scene, cameraShots } : scene;
}
