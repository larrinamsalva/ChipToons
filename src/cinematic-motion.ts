import type { Project, Scene, SceneElement } from "./model";
import { neutralJoint } from "./puppet-model";
import { cinematicEmotionReactionAt } from "./cinematic-emotion-reaction";
import { cinematicFreeArmReactionAt } from "./cinematic-free-arm-reaction";
import type { ElementFrame } from "./timeline";

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * Non-destructive, deterministic secondary acting polish for original puppets.
 *
 * Only the project's explicit Cinematic Storybook option enables this pass.
 * Its result is a normal ElementFrame: the SAME frame feeds Stage, camera
 * targeting and interaction/hand anchors, so held props stay attached and
 * recorded lip-sync is not recalculated or replaced.
 *
 * No wall-clock randomness, DOM animation, added keyframes or saved edits.
 */
export function cinematicMotionAt(
  project: Pick<Project, "visualStyle" | "characters">,
  element: SceneElement,
  frame: ElementFrame,
  localTime: number,
  sceneDuration: number,
  calm: boolean,
  sample: (time: number) => ElementFrame,
  scene?: Pick<Scene, "interactions">,
): ElementFrame {
  if (project.visualStyle !== "storybook-cinematic" || calm || !element.characterId)
    return frame;
  const character = project.characters.find(c => c.id === element.characterId);
  const rig = character?.puppet;
  if (!rig) return frame;

  // Intentional, quiet listening/attention motion at rest. The unique but
  // deterministic phase prevents two characters from nodding in lockstep.
  const seed = ([...element.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 29) / 29;
  const restHead = 0.55 * Math.sin(localTime * 2.25 + seed * Math.PI * 2);
  let travel = 0, forward = 0;

  // Sample the AUTHOR'S movement curve rather than replacing it. This also
  // respects a paused position/held pose at the ends of any walking interval.
  const dt = 0.12;
  const before = Math.max(0, localTime - dt);
  const after = Math.min(sceneDuration, localTime + dt);
  if (after - before > 0.0001) {
    const b = sample(before);
    const a = sample(after);
    const vx = (a.x - b.x) / (after - before);
    const vy = (a.y - b.y) / (after - before);
    // Small storybook steps are often only 8-15 stage pixels/s. Give those
    // deliberate walks visible (but restrained) weight transfer too.
    travel = clamp((Math.hypot(vx, vy) - 1.5) / 16, 0, 1);
    forward = clamp(vx / 65, -1, 1);
  }

  // Opposite torso/head counter-action, with very small body bob, makes a
  // walk read as weight transfer while preserving the user's real keyframes.
  const stride = localTime * 8.1 + seed * Math.PI * 2;
  const roll = travel * (1.05 * Math.sin(stride) + 0.95 * forward);
  const bounce = travel * 1.75 * Math.abs(Math.sin(stride));
  const headFollow = restHead + travel * (-1.45 * Math.sin(stride) - 1.15 * forward);
  const head = rig.parts.find(p => p.role === "head");
  // Optional subtle response to the AUTHOR'S actual emotion change.
  // Leave motion paths, keys, mouth shapes and all timed voice data alone.
  const reaction = cinematicEmotionReactionAt(element,localTime);

  const freeArms = cinematicFreeArmReactionAt(scene, element, rig, frame, localTime);
  const joints = head || freeArms ? {
    ...frame.joints,
    ...freeArms,
    ...(head ? { [head.id]: {
      ...(frame.joints?.[head.id] ?? neutralJoint),
      angle: (frame.joints?.[head.id]?.angle ?? 0) +
        headFollow + (reaction?.headTilt ?? 0),
    } } : {}),
  } : frame.joints;

  return {
    ...frame,
    y: frame.y - bounce,
    rotation: frame.rotation + roll + (reaction?.torsoTilt ?? 0),
    scale: frame.scale * (1 + travel * 0.0028 * Math.cos(stride * 2)),
    joints,
  };
}
