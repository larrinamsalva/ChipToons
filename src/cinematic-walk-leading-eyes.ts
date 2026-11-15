import type { SceneElement } from "./model";
import { elementAt } from "./timeline";
import { cinematicWalkAnticipationAt } from "./cinematic-walk-anticipation";

/** Let the eyes lead a CREATOR-authored horizontal walk a fraction of a
 * second before the body translates. Only valid for an actual held-to-walk
 * path; does not invent a walk, voice, eye keyframe or camera cue.
 *
 * The face owns the final priority: this low-priority glance must never
 * override an active story prop, actual dialogue or a paired camera shot.
 */
export function cinematicWalkLeadingEyesAt(
  element: SceneElement,
  time: number,
  duration: number,
): { x: number; focus: number } | undefined {
  if (!element.animation?.keyframes?.length || !Number.isFinite(time))
    return;
  const approach = cinematicWalkAnticipationAt(
    time, duration,
    t => elementAt(element, t, duration, true),
  );
  const focus = Math.min(1, Math.abs(approach.torsoTilt));
  if (focus < 0.035) return;
  // The torso prepares in the opposite direction, while pupils glance
  // into the intended step. Respect horizontal mirroring of the puppet.
  const direction = -Math.sign(approach.torsoTilt) *
    (element.flip ? -1 : 1);
  return { x: direction, focus };
}
