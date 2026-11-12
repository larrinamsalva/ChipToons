import type { Project, Scene, SceneElement } from "./model";
import { neutralJoint } from "./puppet-model";
import type { ElementFrame } from "./timeline";
import { voiceMouthAt } from "./voice-mouth";

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/**
 * An original vector character can show a tiny *speaking* head response
 * to the existing, approved recorded-voice mouth envelope.
 *
 * No speech recognition, new audio processing or added keyframes: the stored
 * source/trim/mute/manual precedence checks already happened in voiceMouthAt.
 * Only the same Stage frame gets a bounded, time-deterministic visual offset.
 */
export function cinematicVoiceHeadAt(
  project: Project,
  scene: Scene,
  element: SceneElement,
  frame: ElementFrame,
  localTime: number,
  sceneStart: number,
  calm: boolean,
): ElementFrame {
  if (calm || project.visualStyle !== "storybook-cinematic" ||
      !Number.isFinite(localTime) || localTime < 0 ||
      !element.characterId || element.assetId || !element.voiceMouth?.length ||
      frame.gesture !== "none" || !Number.isFinite(frame.voiceOpening) ||
      (frame.voiceOpening ?? 0) <= .04) return frame;

  // Never compete with existing handoffs, prop attention, or manually
  // performed head gestures anywhere in the authored scene.
  if (scene.interactions?.some(action =>
    action.actorId === element.id || action.transfer?.actorId === element.id)) return frame;

  const character = project.characters.find(c => c.id === element.characterId);
  const head = character?.puppet?.parts.find(p => p.role === "head");
  if (!head || head.assetId || !character?.puppet?.face) return frame;
  if (element.animation?.keyframes.some(key => {
    const pose = key.joints?.[head.id];
    return pose && (Math.abs(pose.angle) > 2 ||
      Math.abs(pose.x) > 1.5 || Math.abs(pose.y) > 1.5);
  })) return frame;

  const manual = frame.authoredMouth !== "auto";
  const neighboring = (offset: number) =>
    voiceMouthAt(project, scene, element,
      sceneStart + clamp(localTime + offset, 0, scene.duration), manual)?.opening ?? 0;

  // Average adjacent approved mouth samples rather than twitching on each
  // 25Hz envelope sample. Silence/muted/clipped sources contribute zero.
  const strength = clamp(
    (neighboring(-.09) + 2 * frame.voiceOpening! + neighboring(.09)) / 4,
    0, 1,
  );
  const weight = clamp((strength - .04) / .65, 0, 1);
  if (weight <= 0) return frame;

  const seed = [...element.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 37;
  const delta = clamp(
    weight * (.24 + .74 * Math.sin(localTime * 3.8 + seed * .19)),
    -1.05, 1.05,
  );
  if (Math.abs(delta) < .001) return frame;
  const previous = frame.joints?.[head.id] ?? neutralJoint;
  return {
    ...frame,
    joints: {
      ...frame.joints,
      [head.id]: { ...previous, angle: previous.angle + delta },
    },
  };
}
