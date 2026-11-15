import type { SceneElement } from "./model";
import { elementAt } from "./timeline";
import { cinematicStopSettleAt } from "./cinematic-stop-settle";

/** Gentle eyes-forward arrival when an existing authored horizontal walk
 * actually slows. Uses #132's deterministic stop window rather than
 * inventing new camera, movement, speech or animation keyframes.
 *
 * The facial engine treats this as LOW priority: actual story gestures,
 * recorded conversations and authored paired shots still win.
 */
export function cinematicWalkArrivalEyesAt(
  element: SceneElement,
  time: number,
  duration: number,
): { x: number; focus: number } | undefined {
  if (!element.animation?.keyframes?.length ||
      !Number.isFinite(time) || !Number.isFinite(duration))
    return;
  const settle = cinematicStopSettleAt(
    time, duration,
    t => elementAt(element, t, duration, true),
  );
  // Shared #132 stop reaction already rejects idle, vertical-only and
  // constant-speed motion. Keep this eye response quieter than #134's
  // anticipation glance and remove it as soon as the body settles.
  const focus = Math.min(0.65, Math.abs(settle.torsoTilt) * 0.54);
  if (focus < 0.035) return;
  const direction = Math.sign(settle.torsoTilt) *
    (element.flip ? -1 : 1);
  return { x: direction, focus };
}
