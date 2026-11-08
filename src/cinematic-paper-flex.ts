import type { Project, Scene, SceneElement } from "./model";
import type { InteractionFrame } from "./interaction-motion";

const smooth = (start: number, end: number, value: number) => {
  if (end <= start) return Number(value >= end);
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

/**
 * A tiny vector-page flex follows an ACTUAL held storybook/checklist.
 * The envelope is based only on the authored interaction and sampled held
 * state, so preview, scrubbing and genuine video exports stay deterministic.
 * No saved keyframes, prop anchors or object transforms are modified.
 */
export function cinematicPaperFlexAt(
  project: Pick<Project, "visualStyle">,
  scene: Pick<Scene, "interactions">,
  element: SceneElement,
  frame: InteractionFrame,
  time: number,
  calm: boolean,
): number {
  if (calm || project.visualStyle !== "storybook-cinematic" ||
      element.kind !== "prop" || element.prop !== "book" ||
      element.assetId || !frame.heldBy || frame.opacity < 0.1 ||
      !Number.isFinite(time)) return 0;
  const action = scene.interactions?.find(item =>
    item.kind !== "point" && item.objectId === element.id &&
    time >= item.attach && time < (item.release?.time ?? item.finish) &&
    (frame.heldBy === item.actorId ||
      frame.heldBy === item.transfer?.actorId));
  if (!action) return 0;

  const end = action.release?.time ?? action.finish;
  const lift = smooth(action.attach, action.attach + 0.32, time);
  const settle = 1 - smooth(Math.max(action.attach, end - 0.3), end, time);

  // A small extra bend as the receiving fingers take the page.
  const transfer = action.transfer?.time;
  const receiving = transfer === undefined ? 0 :
    smooth(transfer - 0.32, transfer, time) *
    (1 - smooth(transfer, transfer + 0.32, time));
  return Math.min(1, Math.max(0, (0.46 + receiving * 0.24) * lift * settle));
}
