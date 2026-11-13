import type { Project, Scene, SceneElement } from "./model";
import type { ElementFrame } from "./timeline";
import { clipStart } from "./production";
import { mouthTrackIsCurrent, voiceMouthAt } from "./voice-mouth";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};

/** Gentle voice-phrased whole-body breathing for an actual recorded,
 * line-linked cinematic close-up. The animator's authored shoulders,
 * elbows, hand poses, root motion and head keys are retained.
 * Only a tiny rendered-frame lift, scale and roll is sampled.
 */
export function cinematicVoiceBodyAt(
  project: Project,
  scene: Scene,
  element: SceneElement,
  frame: ElementFrame,
  time: number,
  sceneStart: number,
  calm: boolean,
): ElementFrame {
  if (calm || project.visualStyle !== "storybook-cinematic" ||
      !Number.isFinite(time) || time < 0 || time >= scene.duration ||
      !element.characterId || element.assetId || !element.voiceMouth?.length ||
      frame.gesture !== "none" || frame.authoredMouth !== "auto" ||
      !Number.isFinite(frame.voiceOpening) ||
      (frame.voiceOpening ?? 0) <= .035) return frame;
  const performer = project.characters.find(c => c.id === element.characterId);
  const torso = performer?.puppet?.parts.find(p => p.role === "torso");
  if (performer?.assetId || !torso || torso.assetId) return frame;

  // An animator-held object or acted gesture outranks automatic breathing,
  // even when a particular prop is momentarily off screen.
  if (scene.interactions?.some(action =>
    action.actorId === element.id || action.transfer?.actorId === element.id))
    return frame;

  const shot = scene.cameraShots?.find(item =>
    item.style === "close" && item.targets.length === 1 &&
    item.targets[0] === element.id && !!item.lineId &&
    time >= item.start && time < item.end);
  if (!shot || !scene.script?.lines.some(line =>
      line.id === shot.lineId && line.speakerId === element.characterId))
    return frame;

  // Guard against stale lip-sync, retimed or muted clips. The same genuine
  // source/trim rules as the visible mouth must still be valid.
  if (!element.voiceMouth.some(track =>
    mouthTrackIsCurrent(project, scene, element, track) &&
    project.audioClips.some(clip => clip.id === track.clipId &&
      clip.category === "dialogue" && !clip.muted && clip.volume > 0 &&
      Math.abs(clipStart(project, clip) - sceneStart - shot.start) < .03)))
    return frame;
  const opening = (offset: number) => voiceMouthAt(
    project, scene, element,
    sceneStart + Math.max(0, Math.min(scene.duration, time + offset)),
    false,
  )?.opening ?? 0;
  const strength = .25 * opening(-.12) +
    .5 * frame.voiceOpening! + .25 * opening(.12);
  const phrase = ease((strength - .06) / .56) *
    ease((time - shot.start) / .32) *
    ease((shot.end - time) / .42);
  if (phrase < .025) return frame;

  const seed = [...element.id].reduce((total, c) =>
    total + c.charCodeAt(0), 0) % 19;
  // Bounded, gently staggered phrase energy. Deliberate walking/arm
  // animation remains fully authored; no saved keyframe is touched.
  const roll = .68 * phrase * Math.sin(time * 2.7 + seed * .22);
  return {
    ...frame,
    y: frame.y - .58 * phrase,
    scale: frame.scale * (1 + .006 * phrase),
    rotation: frame.rotation + roll,
  };
}
