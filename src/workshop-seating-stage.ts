import type { Scene, SceneElement } from "./model";
import { uid } from "./model";
import type { PuppetRig } from "./puppet-model";
import { puppetTransforms } from "./puppet-model";
import { presetAnimation } from "./presets";

/**
 * The author explicitly chooses an existing chair or bench.
 * Its illustrated seat top is in the local PropArt/SceneryArt coordinate
 * space, not a physics collider. Do not guess offsets for raster seats.
 */
const SEAT_TOP: Readonly<Record<"chair" | "bench", number>> = {
  chair: -44,
  bench: -43,
};
const REQUIRED = [
  "torso", "head", "leftArm", "rightArm",
  "leftForearm", "rightForearm", "leftHand", "rightHand",
  "leftLeg", "rightLeg", "leftShin", "rightShin",
  "leftFoot", "rightFoot",
] as const;

export function isSeatFurniture(element: SceneElement): boolean {
  return element.kind === "prop" && (element.prop === "chair" || element.prop === "bench");
}

export function canSeatWorkshopRig(rig?: PuppetRig): rig is PuppetRig {
  return !!rig && rig.costume === "workshop" &&
    REQUIRED.every(role => rig.parts.some(part => part.role === role && !part.assetId));
}

/**
 * Prepare an *actual* seated Stage timeline aligned to the top of a real
 * scene furniture prop. It is deliberately explicit and refuses to replace
 * authored keyframes or interaction timing.
 *
 * 2.5D guide only: no collider, inverse kinematics, or character pathfinding.
 * The artist can adjust alignment through regular timeline editing/Undo.
 */
export function seatWorkshopAtFurniture(
  scene: Scene,
  characterElementId: string,
  furnitureElementId: string,
  rig: PuppetRig,
): Scene {
  const actor = scene.elements.find(e => e.id === characterElementId);
  const furniture = scene.elements.find(e => e.id === furnitureElementId);
  if (!actor || (actor.kind !== undefined && actor.kind !== "character"))
    throw new Error("Choose a character in this scene.");
  if (!furniture || !isSeatFurniture(furniture))
    throw new Error("Choose an existing chair or bench in this scene.");
  if (!canSeatWorkshopRig(rig))
    throw new Error("Only complete original workshop puppets can use seat alignment.");
  if (scene.duration < 3)
    throw new Error("Make this scene at least three seconds long to animate sitting.");
  if (actor.animation?.keyframes.length || actor.motion !== "still")
    throw new Error("This character already has movement. Use an unanimated scene so your work is not overwritten.");
  if (scene.interactions?.some(link =>
    link.actorId === actor.id || link.transfer?.actorId === actor.id))
    throw new Error("This character is part of a timed interaction. Use a separate scene to keep the handoff safe.");
  if (furniture.animation?.keyframes.length || furniture.motion !== "still")
    throw new Error("Choose a stationary chair or bench for this seat alignment.");
  if (actor.rotation !== 0 || actor.flipY || furniture.rotation !== 0 ||
      furniture.flipY || furniture.flip)
    throw new Error("Use upright, unrotated seat furniture and an upright character.");
  if (!Number.isFinite(actor.scale) || !Number.isFinite(furniture.scale) ||
      actor.scale <= 0 || furniture.scale <= 0)
    throw new Error("The character and seat need valid positive sizes.");

  // Sample the SAME real seated rig as Stage and media export. The average
  // of the upper-leg anchors is a stable pelvis proxy for new workshop rigs.
  const preview = presetAnimation(actor, scene.duration, "sit", 0, 3, rig);
  const final = preview.keyframes.find(key => key.time === 3);
  if (!final?.joints) throw new Error("The seated action could not be sampled.");
  const world = puppetTransforms(rig, final.joints);
  const hips = ["leftLeg", "rightLeg"].map(role => {
    const index = rig.parts.findIndex(part => part.role === role);
    return world[index];
  });
  const hipX = (hips[0].x + hips[1].x) / 2;
  const hipY = (hips[0].y + hips[1].y) / 2;
  // Allow the pelvis to rest a little above the illustrated seat top.
  // Sitting ends at base.y + 20 in the shared action from PR #154.
  const x = furniture.x - (actor.flip ? -1 : 1) * hipX * actor.scale;
  const y = furniture.y +
    SEAT_TOP[furniture.prop as "chair" | "bench"] * furniture.scale -
    8 * actor.scale - hipY * actor.scale - 20;
  if (![x, y].every(Number.isFinite) || x < 30 || x > 770 || y < 65 || y > 440)
    throw new Error("This seat is too close to the stage edge. Move it inward and try again.");

  const positioned: SceneElement = {
    ...actor, x, y, motion: "still", pose: "standing",
  };
  const animated: SceneElement = {
    ...positioned,
    animation: presetAnimation(positioned, scene.duration, "sit", 0, 3, rig),
  };
  return {
    ...scene,
    elements: scene.elements.map(e =>
      e.id === actor.id ? animated
        : e.id === furniture.id ? { ...e, sceneryDepth: "behind" }
        : e,
    ),
  };
}

export function addWorkshopChair(scene: Scene, actor: SceneElement): {
  scene: Scene;
  chairId: string;
} {
  if (scene.elements.length >= 20)
    throw new Error("This scene already has 20 objects. Remove one before adding a chair.");
  const chairId = uid();
  const chair: SceneElement = {
    id: chairId,
    name: "Workshop chair",
    characterId: "",
    kind: "prop",
    prop: "chair",
    x: actor.x,
    y: Math.min(430, actor.y + 15),
    scale: 1,
    rotation: 0,
    flip: false,
    emotion: "calm",
    motion: "still",
    sceneryDepth: "behind",
  };
  return { scene: { ...scene, elements: [...scene.elements, chair] }, chairId };
}
