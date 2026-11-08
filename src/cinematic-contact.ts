import type { Project, Scene } from "./model";
import type { Grip } from "./interaction-model";
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
  /** Render-only contact visibility, faded at pickup, transfer and release. */
  opacity: number;
  phase: "holding" | "receiving";
  skin: string;
}

const smooth = (from: number, until: number, time: number) => {
  if (until <= from) return Number(time >= until);
  const t = Math.min(1, Math.max(0, (time - from) / (until - from)));
  return t * t * (3 - 2 * t);
};

/**
 * Foreground fingertips on REAL held objects only.
 *
 * During a handoff, both hands may briefly touch the same prop: Scout's
 * finger contact eases away as Helper Jo's receiving fingers ease in.
 * Nothing changes the real interaction's heldBy owner or hand positions.
 * Generated from saved scene time and the exact Stage/export frame.
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

  function addContact(
    actionId: string,
    objectId: string,
    ownerId: string,
    grip: Grip,
    held: InteractionFrame,
    weight: number,
    phase: "holding" | "receiving",
  ) {
    if (!elements.has(ownerId) || !Number.isFinite(weight) || weight <= 0) return;
    const side = grip.hand;
    if (side !== "left" && side !== "right") return;
    const owner = scene.elements.find(element => element.id === ownerId);
    const character = project.characters.find(item => item.id === owner?.characterId);
    const frame = frames.get(ownerId);
    const rig = character?.puppet;
    if (!owner || owner.assetId || character?.assetId || !frame || !rig) return;

    const arm = rig.parts.find(part => part.role === `${side}Arm`);
    const forearm = rig.parts.find(part =>
      part.role === `${side}Forearm` && part.parentId === arm?.id);
    const hand = rig.parts.find(part =>
      part.role === `${side}Hand` && part.parentId === forearm?.id);
    const curl = frame.gripCurl?.[side] ?? 0;
    const opacity = Math.min(1, Math.max(0, curl * weight));
    if (!arm || !forearm || !hand || arm.assetId || forearm.assetId ||
        hand.assetId || !Number.isFinite(curl) || opacity < 0.04 ||
        !Number.isFinite(held.x) || !Number.isFinite(held.y) ||
        !Number.isFinite(held.rotation) || !Number.isFinite(frame.scale)) return;

    results.push({
      actionId, objectId, ownerId,
      x: held.x, y: held.y, rotation: held.rotation,
      scale: Math.min(1.5, Math.max(0.75, Math.abs(frame.scale))),
      side, curl: Math.min(1, Math.max(0, curl)), opacity, phase,
      skin: character!.skin,
    });
  }

  for (const action of scene.interactions) {
    if (action.kind === "point" || seen.has(action.objectId) ||
        time < action.attach || time >= (action.release?.time ?? action.finish)) continue;
    const held = frames.get(action.objectId);
    const ownerId = held?.heldBy;
    if (!held || !ownerId || !elements.has(action.objectId) || !elements.has(ownerId)) continue;
    const transfer = action.transfer;
    const grip = ownerId === action.actorId ? action.grip
      : transfer && ownerId === transfer.actorId ? transfer.grip : undefined;
    if (!grip) continue;

    const pickup = smooth(action.attach, action.attach + 0.18, time);
    const release = action.release
      ? 1 - smooth(action.release.time - 0.22, action.release.time, time) : 1;
    const handoff = transfer && ownerId === action.actorId
      ? 1 - smooth(transfer.time - 0.24, transfer.time, time) : 1;
    addContact(action.id, action.objectId, ownerId, grip, held,
      pickup * release * handoff, "holding");

    // A real two-hand overlap BEFORE the saved transfer time. This is a
    // visual-only receiving touch; heldBy changes at the exact authored time
    // in sampleInteractions, with no second ownership or second prop.
    if (action.kind === "give" && transfer && ownerId === action.actorId &&
        time >= transfer.time - 0.32 && time < transfer.time) {
      const anticipation = smooth(transfer.time - 0.32, transfer.time, time);
      addContact(action.id, action.objectId, transfer.actorId,
        transfer.grip, held, anticipation, "receiving");
    }
    seen.add(action.objectId);
  }
  return results;
}
