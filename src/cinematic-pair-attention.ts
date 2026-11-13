import type { Project, Scene, SceneElement } from "./model";
import type { ElementFrame } from "./timeline";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};

/** Read-only paired-shot gaze. The original animator's camera explicitly
 * places two performers together, so their generated pupils can briefly
 * attend to each other rather than repeatedly scan the room.
 *
 * No voice, head joint, saved pose, camera record or timeline edit.
 */
export interface PairAttention {
  partnerId: string;
  dx: number;
  dy: number;
  focus: number;
}

export function cinematicPairAttentionAt(
  project: Project,
  scene: Scene,
  element: SceneElement,
  frames: ReadonlyMap<string, ElementFrame>,
  time: number,
  calm: boolean,
): PairAttention | undefined {
  if (calm || project.visualStyle !== "storybook-cinematic" ||
      !Number.isFinite(time) || time < 0 || time >= scene.duration ||
      !element.characterId || element.assetId) return;

  // Only an actual TWO-PERFORMER "pair" shot opts in; no guesswork based
  // on proximity, auto camera cuts or unrelated characters in the scene.
  const shot = scene.cameraShots?.find(item =>
    item.style === "pair" && item.targets.length === 2 &&
    item.targets.includes(element.id) &&
    time >= item.start && time < item.end);
  if (!shot) return;
  const otherId = shot.targets.find(id => id !== element.id);
  const partner = scene.elements.find(item =>
    item.id === otherId && !!item.characterId &&
    item.characterId !== element.characterId && !item.assetId);
  if (!partner) return;

  const selfFrame = frames.get(element.id), partnerFrame = frames.get(partner.id);
  if (!selfFrame || !partnerFrame || selfFrame.opacity < .1 ||
      partnerFrame.opacity < .1 || selfFrame.gesture !== "none") return;

  // Hands, props and an animator's chosen gesture should remain primary.
  if (scene.interactions?.some(action =>
    (action.actorId === element.id || action.transfer?.actorId === element.id) &&
    time >= action.start && time <= action.finish)) return;

  const rig = project.characters.find(c => c.id === element.characterId)?.puppet;
  if (!rig?.face || !rig.parts.some(p => p.role === "head" && !p.assetId) ||
      rig.parts.some(p => p.role === "eyes" && p.assetId)) return;

  const dx = partnerFrame.x - selfFrame.x;
  const dy = partnerFrame.y - selfFrame.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 20 || distance > 370) return;

  // In longer shared shots, the first authored performer catches the
  // other's attention, then the second follows 160ms later and holds it
  // just a little longer. This avoids a synchronized puppet stare without
  // changing saved poses, shot durations or any audio. Very short
  // establishing shots keep the existing symmetric easing.
  const canStagger = shot.end - shot.start >= 1.5;
  const first = canStagger && shot.targets[0] === element.id;
  const second = canStagger && shot.targets[1] === element.id;
  const enterDelay = second ? .16 : 0;
  const exitDuration = first ? .52 : second ? .32 : .42;
  // Sampling depends only on saved shot order and scene time, so seeking,
  // editor Stage and genuine WebM exports receive the same gaze.
  const focus = .76 * ease((time - shot.start - enterDelay) / .35) *
    ease((shot.end - time) / exitDuration);
  if (focus < .035) return;
  return { partnerId: partner.id, dx, dy, focus };
}
