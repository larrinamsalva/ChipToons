import type { Project, Scene, SceneElement } from "./model";
import type { ElementFrame } from "./timeline";

export interface CinematicFace {
  /** Small pupil offsets in the existing authored face coordinate system. */
  x: number;
  y: number;
  /** Subtle extra eyebrow lift in SVG units. */
  brow: number;
  /** A short anticipatory blink as attention changes. */
  blink: boolean;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * A quiet, deterministic attention pass for generated vector puppet faces.
 * Characters glance toward nearby collaborators or workshop props, then back
 * to the viewer. It never edits the scene, voice tracks or authored joints.
 *
 * Asset-backed eyes are excluded: a painted/raster gaze cannot be repositioned
 * as independent pupils without corrupting the artist's intended expression.
 */
export function cinematicFaceAt(
  project: Pick<Project, "visualStyle" | "characters">,
  scene: Pick<Scene, "elements" | "interactions">,
  element: SceneElement,
  frame: ElementFrame,
  frames: ReadonlyMap<string, ElementFrame>,
  localTime: number,
  calm: boolean,
): CinematicFace | undefined {
  if (project.visualStyle !== "storybook-cinematic" || calm ||
      !element.characterId || !Number.isFinite(localTime)) return;
  const character = project.characters.find(c => c.id === element.characterId);
  const rig = character?.puppet;
  if (!rig?.face || !rig.parts.some(part => part.role === "head") ||
      rig.parts.some(part => part.role === "eyes" && part.assetId)) return;

  // A performed pickup, point, handoff or put-down temporarily draws the
  // performer's attention to the ACTUAL moving story object, rather than the
  // other actor's body. Look at the prop through the moving handoff frame so
  // pupil direction follows the same deterministic Stage/export positions.
  const action = scene.interactions?.find(item => {
    const isGiver = item.actorId === element.id;
    const isReceiver = item.transfer?.actorId === element.id;
    const from = isReceiver
      ? Math.max(item.attach, item.transfer!.time - 0.55) : item.start;
    const until = isReceiver ? (item.release?.time ?? item.finish)
      : (item.transfer?.time ?? item.release?.time ?? item.finish);
    return (isGiver || isReceiver) && localTime >= from && localTime <= until;
  });
  const active = action && (() => {
    const object = frames.get(action.objectId);
    if (!object || object.opacity < 0.1) return undefined;
    const dx = object.x - frame.x, dy = object.y - frame.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 10 || distance > 370) return undefined;
    const from = action.transfer?.actorId === element.id
      ? Math.max(action.attach, action.transfer!.time - 0.55) : action.start;
    const until = action.transfer?.actorId === element.id
      ? (action.release?.time ?? action.finish)
      : (action.transfer?.time ?? action.release?.time ?? action.finish);
    const focus = smooth((localTime - from) / 0.32) *
      (1 - smooth((localTime - (until - 0.3)) / 0.3));
    return { dx, dy, focus };
  })();

  // Outside a performed action, prefer another performer over props. With no
  // companion, allow a nearby workshop object to be the point of attention.
  const available = scene.elements.flatMap(other => {
    if (other.id === element.id || other.backdrop || other.id === "") return [];
    const otherFrame = frames.get(other.id);
    if (!otherFrame || otherFrame.opacity < 0.1) return [];
    const dx = otherFrame.x - frame.x, dy = otherFrame.y - frame.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 10 || distance > 370) return [];
    return [{ other, dx, dy, distance }];
  });
  const friends = available.filter(item => item.other.characterId);
  const target = (friends.length ? friends : available)
    .sort((left, right) => left.distance - right.distance ||
      left.other.id.localeCompare(right.other.id))[0];

  // All timing is based on saved scene time and saved IDs. Seeking to an exact
  // frame (or exporting it twice) yields exactly the same facial performance.
  const seed = [...element.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 37;
  const phase = (Math.max(0, localTime) + seed * 0.041) % 5.4;
  const attention = smooth((phase - 1.7) / 0.4) *
    (1 - smooth((phase - 4.3) / 0.4));
  const direction = active ?? target;
  const targetX = direction ? clamp(direction.dx / 130, -1, 1) : 0;
  const targetY = direction ? clamp(direction.dy / 150, -1, 1) : 0;
  const focus = active ? active.focus : target ? attention : 0;

  const x = clamp(2.35 * targetX * focus +
    0.23 * Math.sin(localTime * 1.12 + seed * 0.3) * (1 - focus), -2.6, 2.6);
  const y = clamp(1.35 * targetY * focus +
    0.12 * Math.sin(localTime * 0.86 + seed * 0.4) * (1 - focus), -1.6, 1.6);
  const brow = clamp(
    (frame.emotion === "surprised" ? 1.55 :
      frame.emotion === "worried" ? 0.95 :
      frame.emotion === "excited" ? 0.75 : 0.2) +
      (frame.voiceOpening ?? 0) * 0.32 +
      0.25 * Math.sin(localTime * 1.1 + seed * 0.19),
    0, 1.9,
  );
  const allowsBlink = element.animation?.blink ?? true;
  const blink = frame.blink || (allowsBlink && phase >= 1.98 && phase < 2.095);
  return { x, y, brow, blink };
}
