import type { Project, Scene, SceneElement } from "./model";
import { neutralJoint } from "./puppet-model";
import type { ElementFrame } from "./timeline";
import { voiceMouthAt } from "./voice-mouth";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Focus on the OTHER original character when their approved recorded
 * voice is audible, or when the creator explicitly directs a silent
 * reaction close-up. This is read-only sampled-time acting: never invent
 * speech, rewrite voices, store keyframes or change the camera.
 */
export interface ConversationListening {
  speakerId: string;
  dx: number;
  dy: number;
  /** Gently fades through small gaps between real spoken syllables. */
  focus: number;
  /** Very small 2D head tilt toward the other performer. */
  headTilt: number;
  /** Only nonzero for an explicitly authored silent reaction shot. */
  reaction?: number;
}

export function cinematicConversationListeningAt(
  project: Project,
  scene: Scene,
  listener: SceneElement,
  frames: ReadonlyMap<string, ElementFrame>,
  localTime: number,
  calm: boolean,
): ConversationListening | undefined {
  if (calm || project.visualStyle !== "storybook-cinematic" ||
      !Number.isFinite(localTime) || localTime < 0 ||
      localTime > scene.duration || !listener.characterId ||
      listener.assetId) return;
  const listenerFrame = frames.get(listener.id);
  if (!listenerFrame || listenerFrame.opacity < .1 ||
      listenerFrame.gesture !== "none" ||
      (listenerFrame.voiceOpening ?? 0) > .06) return;
  // Do not draw the eye away from a real pickup, release, pointing action or
  // handoff. Authored head poses also take priority even between keyframes.
  if (scene.interactions?.some(action => action.actorId === listener.id ||
      action.transfer?.actorId === listener.id)) return;
  const rig = project.characters.find(c => c.id === listener.characterId)?.puppet;
  const head = rig?.parts.find(p => p.role === "head");
  if (!rig?.face || !head || head.assetId ||
      rig.parts.some(p => p.role === "eyes" && p.assetId)) return;
  if (listener.animation?.keyframes.some(key => {
    const joint = key.joints?.[head.id];
    return joint && (Math.abs(joint.angle) > 2 ||
      Math.abs(joint.x) > 1.5 || Math.abs(joint.y) > 1.5);
  })) return;

  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  if (sceneIndex < 0) return;
  const start = project.scenes.slice(0, sceneIndex)
    .reduce((total, item) => total + item.duration, 0);
  const candidates = scene.elements.flatMap(speaker => {
    if (!speaker.characterId || speaker.id === listener.id ||
        speaker.characterId === listener.characterId ||
        !speaker.voiceMouth?.length) return [];
    const speakingFrame = frames.get(speaker.id);
    if (!speakingFrame || speakingFrame.opacity < .1 ||
        speakingFrame.voiceOpening === undefined) return [];
    const dx = speakingFrame.x - listenerFrame.x;
    const dy = speakingFrame.y - listenerFrame.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance < 20 || distance > 370) return [];

    // Use the SAME already-approved source/trim/mute/manual rules as the
    // mouth. Averaging five nearby samples avoids snap-to-viewer on the
    // short silences between real syllables and smooths each handoff of focus.
    const authoredManual = speakingFrame.authoredMouth !== "auto";
    const opening = (offset: number) => voiceMouthAt(
      project, scene, speaker,
      start + clamp(localTime + offset, 0, scene.duration),
      authoredManual,
    )?.opening ?? 0;
    const signal = (.14 * opening(-.24) + .22 * opening(-.12) +
      .28 * speakingFrame.voiceOpening + .22 * opening(.12) +
      .14 * opening(.24));
    const focus = smooth((signal - .045) / .28);
    if (focus < .035) return [];
    return [{ speakerId: speaker.id, dx, dy, distance, focus, signal }];
  });
  const best = candidates.sort((a, b) => b.signal - a.signal ||
    a.distance - b.distance || a.speakerId.localeCompare(b.speakerId))[0];
  if (!best) {
    // A camera "reaction" is an explicit creator decision to watch the
    // OTHER performer even after their last recorded syllable has ended.
    // Otherwise the old periodic gaze scan can send Jo back to the viewer
    // in the middle of a silent reaction close-up. No new voice is assumed.
    const shot = scene.cameraShots?.find(item =>
      item.style === "reaction" && item.targets.includes(listener.id) &&
      localTime >= item.start && localTime < item.end);
    if (!shot) return;
    const partner = scene.elements.flatMap(other => {
      if (!other.characterId || other.id === listener.id ||
          other.characterId === listener.characterId) return [];
      const otherFrame = frames.get(other.id);
      if (!otherFrame || otherFrame.opacity < .1) return [];
      const dx = otherFrame.x - listenerFrame.x;
      const dy = otherFrame.y - listenerFrame.y;
      const distance = Math.hypot(dx, dy);
      if (!Number.isFinite(distance) || distance < 20 || distance > 370)
        return [];
      return [{ id: other.id, dx, dy, distance }];
    }).sort((a, b) => a.distance - b.distance ||
      a.id.localeCompare(b.id))[0];
    if (!partner) return;
    // Ease in as the existing real camera moves, then soften the gaze
    // before the shot ends. Sampling is seekable and shared with WebM.
    const focus = .88 * smooth((localTime - shot.start) / .42) *
      smooth((shot.end - localTime) / .58);
    if (focus < .035) return;
    return {
      speakerId: partner.id, dx: partner.dx, dy: partner.dy, focus,
      headTilt: clamp(partner.dx / 130, -1, 1) * 1.35 * focus,
      reaction: focus,
    };
  }

  return {
    speakerId: best.speakerId,
    dx: best.dx,
    dy: best.dy,
    focus: best.focus,
    headTilt: clamp(best.dx / 130, -1, 1) * 1.35 * best.focus,
  };
}

/** Apply the listener's head cue to the SAME Stage/export frame.
 * The creator's authored frame and the voice/media data remain untouched. */
export function cinematicConversationHeadAt(
  project: Project,
  scene: Scene,
  listener: SceneElement,
  frame: ElementFrame,
  frames: ReadonlyMap<string, ElementFrame>,
  localTime: number,
  calm: boolean,
): ElementFrame {
  const cue = cinematicConversationListeningAt(
    project, scene, listener, frames, localTime, calm,
  );
  if (!cue || Math.abs(cue.headTilt) < .0001) return frame;
  const head = project.characters.find(c => c.id === listener.characterId)
    ?.puppet?.parts.find(p => p.role === "head");
  if (!head) return frame;
  const current = frame.joints?.[head.id] ?? neutralJoint;
  return {
    ...frame,
    joints: {
      ...frame.joints,
      [head.id]: { ...current, angle: current.angle + cue.headTilt },
    },
  };
}
