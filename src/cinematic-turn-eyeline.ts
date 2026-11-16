import type { SceneElement } from "./model";
import { elementAt } from "./timeline";
import { cinematicTurnAnticipationAt } from "./cinematic-turn-anticipation";

/** A gentle pupil cue in the NEW direction of a genuine authored turnaround.
 * Reuse the same deterministic reversal sampling as the shared head/torso
 * motion. The existing face composer decides priority over the cue.
 * This never edits saved keyframes, voice tracks or puppet eye assets.
 */
export function cinematicTurnEyelineAt(
  element: SceneElement,
  time: number,
  duration: number,
): { x: number; focus: number } | undefined {
  if (!element.animation?.keyframes?.length ||
      !Number.isFinite(time) || !Number.isFinite(duration))
    return;

  const turn = cinematicTurnAnticipationAt(
    time, duration,
    t => elementAt(element, t, duration, true),
  );
  const focus = Math.min(0.7, Math.abs(turn.headTilt) * 0.48);
  if (focus < 0.035) return;

  // The head tilts toward upcoming travel. Pupils follow the next step;
  // mirror horizontal gaze for intentionally flipped vector puppets.
  return {
    x: Math.sign(turn.headTilt) * (element.flip ? -1 : 1),
    focus,
  };
}
