import { SHOT_STYLES, shotCueTime } from "./camera-shots";
import type { CameraShot, ShotAnchor, ShotStyle } from "./camera-shots";
import { FOCUS_TYPES } from "./focus-model";
import { projectFocusPoint } from "./focus-motion";
import { uid } from "./model";
import type { Project, Scene } from "./model";
import { scriptTiming, selectedTake } from "./script";
import { soundMoments } from "./sound-director";
import { soundAnchorKey } from "./sound-cues";
import { roundTime, sceneFramesAt, stageCameraAt } from "./timeline";

export const shotAnchorKey = (anchor: ShotAnchor) => anchor.kind === "focus" ? JSON.stringify(["focus", anchor.id]) : soundAnchorKey(anchor);

export function shotCueChoices(project: Project, scene: Scene) {
  return [
    ...soundMoments(project, scene).map(item => ({
      ...item, label: project.audioClips.some(clip => clip.sceneId === scene.id && clip.soundCue &&
        soundAnchorKey(clip.soundCue.anchor) === soundAnchorKey(item.anchor)) ? `${item.label} · sound cue` : item.label,
    })),
    ...(scene.focusGraphics ?? []).map(graphic => ({
      anchor: { kind: "focus" as const, id: graphic.id }, at: shotCueTime(scene, { kind: "focus", id: graphic.id })!,
      label: `Teaching graphic · ${graphic.text || FOCUS_TYPES[graphic.kind]}`,
    })),
  ].sort((a, b) => a.at - b.at);
}

export function shotGap(scene: Scene, requested: number) {
  const shots = [...(scene.cameraShots ?? [])].sort((a, b) => a.start - b.start);
  const gaps = shots.map((shot, i) => [shots[i - 1]?.end ?? 0, shot.start]);
  gaps.push([shots.at(-1)?.end ?? 0, scene.duration]);
  const gap = gaps.find(([from, to]) => to - Math.max(from, requested) >= 0.15) ??
    gaps.find(([from, to]) => to - from >= 0.15);
  if (!gap) return { start: Math.max(0, scene.duration - 0.25), end: scene.duration };
  const start = requested >= gap[1] || gap[1] - requested < 0.15 ? gap[0] : Math.max(gap[0], requested);
  return { start, end: Math.min(gap[1], roundTime(start + 2)) };
}

export function newCameraShot(project: Project, scene: Scene, at: number, lineId?: string): CameraShot {
  const lines = scene.script?.lines ?? [];
  const line = lines.find(item => item.id === lineId);
  const actor = line?.speakerId && scene.elements.find(item => item.characterId === line.speakerId);
  const timing = line ? selectedTake(project, line).clip?.start ?? scriptTiming(project, scene).starts[lines.indexOf(line)] : undefined;
  const style = actor ? "close" : "wide";
  return {
    id: uid(), style, ...shotGap(scene, roundTime(timing ?? at)), move: 0, frame: { x: 400, y: 225, zoom: SHOT_STYLES[style].zoom },
    targets: actor ? [actor.id] : [], offset: { x: 0, y: actor ? -145 : 0 }, follow: false,
    placement: "center", note: "", lineId: line?.id,
  } satisfies CameraShot;
}

export function shotPreset(scene: Scene, shot: CameraShot, style: ShotStyle): Partial<CameraShot> {
  const cast = scene.elements.filter(element => element.characterId);
  const selected = scene.elements.find(element => element.id === shot.targets[0]);
  const prop = scene.elements.find(element => !element.characterId && !element.backdrop);
  const target = style === "detail" ? (selected && !selected.characterId ? selected : prop) :
    (selected ?? cast[0] ?? prop);
  const pair = target?.characterId ? [target, ...cast.filter(item => item.id !== target.id)].slice(0, 2) : cast.slice(0, 2);
  const targets = style === "wide" ? [] : style === "pair" ? pair.map(item => item.id) : target ? [target.id] : [];
  const offset = targets.length && (style === "pair" || target?.characterId)
    ? (style === "close" || style === "reaction" ? -145 : -95) : targets.length ? -24 : 0;
  return { style, targets, frame: { ...shot.frame, zoom: SHOT_STYLES[style].zoom },
    offset: { x: 0, y: offset }, follow: style === "follow" && !!targets.length,
    move: style === "move" ? Math.min(1.4, shot.end - shot.start) : 0 };
}

export function subjectsOutside(project: Project, scene: Scene, shot: CameraShot) {
  return [shot.start + Math.min(0.01, (shot.end - shot.start) / 4), (shot.start + shot.end) / 2,
    shot.end - Math.min(0.01, (shot.end - shot.start) / 4)].some(at => {
    const frames = sceneFramesAt(project, scene, at);
    const camera = stageCameraAt(project, scene, at, false, frames);
    return shot.targets.some(id => {
      const element = scene.elements.find(item => item.id === id), frame = frames.get(id);
      if (!element || !frame || frame.opacity < 0.15) return true;
      const p = projectFocusPoint(scene, element, frame, camera, shot.offset);
      return p.x < 24 || p.x > 776 || p.y < 24 || p.y > 426;
    });
  });
}
