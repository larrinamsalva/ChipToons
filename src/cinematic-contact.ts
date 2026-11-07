import type { Project, Scene } from "./model";
import type { InteractionFrame } from "./interaction-motion";

export interface CinematicContact {
  actionId: string;
  objectId: string;
  ownerId: string;
  /** Center of the real held prop, before optional scenic depth offset. */
  x: number;
  y: number;
  rotation: number;
  scale: number;
  side: "left" | "right";
  curl: number;
  skin: string;
}

/**
 * Foreground fingertips on REAL held objects only.
 *
 * The object and the puppet hand already share the same attachment position
 * in the interaction engine. This produces a tiny, noninteractive overlay
 * *after* painting the prop, making the fingers appear in front of its edge.
 *
 * It is purely derived from the sampled frames: no state, no saved keys,
 * no changes to prop attachment or physical hand placement.
 */
export function cinematicContactsAt(
  project: Pick<Project, "visualStyle" | "characters">,
  scene: Pick<Scene, "elements" | "interactions">,
  frames: ReadonlyMap<string, InteractionFrame>,
  time: number,
  calm: boolean,
): CinematicContact[] {
  if (project.visualStyle !== "storybook-cinematic" || calm ||
      !Number.isFinite(time) || !scene.interactions?.length) return [];

  const elements = new Set(scene.elements.map(element => element.id));
  const results: CinematicContact[] = [];
  const seen = new Set<string>();

  for (const action of scene.interactions) {
    if (action.kind === "point" || seen.has(action.objectId) ||
        time < action.attach || time >= (action.release?.time ?? action.finish)) continue;
    const held = frames.get(action.objectId);
    const ownerId = held?.heldBy;
    if (!held || !ownerId || !elements.has(action.objectId) || !elements.has(ownerId)) continue;
    const receiver = action.transfer;
    const grip = ownerId === action.actorId ? action.grip
      : receiver && ownerId === receiver.actorId ? receiver.grip : undefined;
    const side = grip?.hand;
    if (side !== "left" && side !== "right") continue;

    const owner = scene.elements.find(element => element.id === ownerId);
    const character = project.characters.find(item => item.id === owner?.characterId);
    const frame = frames.get(ownerId);
    const rig = character?.puppet;
    if (!owner || owner.assetId || character?.assetId || !frame || !rig) continue;

    const arm = rig.parts.find(part => part.role === `${side}Arm`);
    const forearm = rig.parts.find(part =>
      part.role === `${side}Forearm` && part.parentId === arm?.id);
    const hand = rig.parts.find(part =>
      part.role === `${side}Hand` && part.parentId === forearm?.id);
    const curl = frame.gripCurl?.[side] ?? 0;
    if (!arm || !forearm || !hand || arm.assetId || forearm.assetId ||
        hand.assetId || !Number.isFinite(curl) || curl < 0.15 ||
        !Number.isFinite(held.x) || !Number.isFinite(held.y) ||
        !Number.isFinite(held.rotation) || !Number.isFinite(frame.scale)) continue;

    // Foreground marks are scaled to the real owner's puppet hand rather
    // than the tiny book artwork; they should never dominate a large prop.
    results.push({
      actionId: action.id, objectId: action.objectId, ownerId,
      x: held.x, y: held.y, rotation: held.rotation,
      scale: Math.min(1.5, Math.max(0.75, Math.abs(frame.scale))),
      side, curl: Math.min(1, Math.max(0, curl)),
      skin: character!.skin,
    });
    seen.add(action.objectId);
  }
  return results;
}
