import type { Scene, SceneElement } from "./model";
import { uid } from "./model";
import type { ElementKeyframe } from "./animation-model";
import type { PuppetRig } from "./puppet-model";
import { puppetTransforms } from "./puppet-model";
import { presetAnimation } from "./presets";
import { canSeatWorkshopRig, isSeatFurniture } from "./workshop-seating-stage";

/**
 * Extend an untouched #155 chair/bench seated animation with a hold and
 * fully articulated stand. Unlike replacing the track, this retains every
 * already-authored sitting key and makes both actions editable on Stage.
 */
export function standWorkshopFromFurniture(
  scene: Scene,
  characterElementId: string,
  furnitureElementId: string,
  rig: PuppetRig,
): Scene {
  const actor = scene.elements.find(element => element.id === characterElementId);
  const seat = scene.elements.find(element => element.id === furnitureElementId);
  if (!actor || (actor.kind !== undefined && actor.kind !== "character"))
    throw new Error("Choose a character in this scene.");
  if (!seat || !isSeatFurniture(seat))
    throw new Error("Choose the chair or bench this character is sitting on.");
  if (!canSeatWorkshopRig(rig))
    throw new Error("Only complete original workshop characters can stand from their seats.");
  if (scene.duration < 6)
    throw new Error("A sit-and-stand scene needs at least six seconds.");
  if (actor.motion !== "still" || actor.rotation !== 0 || actor.flipY ||
      seat.motion !== "still" || seat.animation?.keyframes.length ||
      seat.rotation !== 0 || seat.flip || seat.flipY)
    throw new Error("Keep both the seated character and furniture still and upright.");
  if (scene.interactions?.some(link =>
    link.actorId === actor.id || link.transfer?.actorId === actor.id))
    throw new Error("A timed interaction uses this character; keep that action unchanged.");

  const existing = actor.animation?.keyframes;
  // Refuse arbitrary author edits and avoid creating conflicting timing.
  // The expected track has the SAME actual 13 sitting keyframes as #155;
  // their random IDs are ignored but everything visible must still match.
  const expected = presetAnimation(actor, scene.duration, "sit", 0, 3, rig).keyframes;
  const withoutId = (key: ElementKeyframe) =>
    Object.fromEntries(Object.entries(key).filter(([field]) => field !== "id"));
  if (!existing || existing.length !== 13 ||
      JSON.stringify(existing.map(withoutId)) !== JSON.stringify(expected.map(withoutId)))
    throw new Error(
      "This sitting animation has been edited or is not the original seat action. " +
      "Use a new scene instead of replacing your existing keyframes.",
    );

  // The selected seat must still be at the exact same 2.5D contact point
  // as the saved seated pose. Never silently align to the wrong/moved prop.
  const finalSit = existing[existing.length - 1];
  const world = puppetTransforms(rig, finalSit.joints ?? {});
  const hips = ["leftLeg", "rightLeg"].map(role => {
    const index = rig.parts.findIndex(part => part.role === role);
    return world[index];
  });
  const hipX = actor.x + (actor.flip ? -1 : 1) *
    ((hips[0].x + hips[1].x) / 2) * actor.scale;
  const hipY = finalSit.y + ((hips[0].y + hips[1].y) / 2) * actor.scale;
  const expectedSeatY = seat.y + (seat.prop === "bench" ? -43 : -44) * seat.scale -
    8 * actor.scale;
  if (Math.abs(hipX - seat.x) > 0.1 || Math.abs(hipY - expectedSeatY) > 0.1)
    throw new Error("The seat or character moved. Restore the original seat alignment first.");

  // The last three seconds stand up; the remaining time is a genuine
  // held seated pose, not a reset to standing or an offscreen preview.
  const standStart = scene.duration - 3;
  const standing = presetAnimation(actor, scene.duration, "stand", standStart, 3, rig);
  const hold: ElementKeyframe[] = standStart > 3
    ? [{ ...finalSit, id: uid(), time: standStart, easing: "linear" }]
    : [];
  const rise = standing.keyframes.filter(key => key.time > standStart);
  const animated: SceneElement = {
    ...actor,
    animation: {
      ...actor.animation!,
      keyframes: [...existing, ...hold, ...rise],
    },
  };
  return {
    ...scene,
    elements: scene.elements.map(element =>
      element.id === actor.id ? animated : element,
    ),
  };
}
