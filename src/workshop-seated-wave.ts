import type { Scene, SceneElement } from "./model";
import { uid } from "./model";
import type { ElementKeyframe } from "./animation-model";
import type { PuppetRig } from "./puppet-model";
import { presetAnimation } from "./presets";
import { validatePristineWorkshopSeating } from "./workshop-seat-stand";

/**
 * Append a real right-arm greeting on top of PR #155's original seated pose.
 *
 * This is an opt-in alternative to standing up; the same untouched chair/
 * bench track is validated before any frame is added. Original sitting
 * keys, leg chains, seat location and actor's source rig are preserved.
 */
export function waveWorkshopWhileSeated(
  scene: Scene,
  characterElementId: string,
  furnitureElementId: string,
  rig: PuppetRig,
): Scene {
  if (scene.duration < 6)
    throw new Error("A seated hello needs at least six seconds.");
  const { actor, existing, finalSit } = validatePristineWorkshopSeating(
    scene, characterElementId, furnitureElementId, rig,
  );

  // Reuse actual shared elbow/wrist/shoulder wave samples rather than
  // inventing an unrelated visual-only CSS gesture.
  const wave = presetAnimation(actor, scene.duration, "wave", 3, 3, rig);
  const waved: ElementKeyframe[] = wave.keyframes
    .filter(frame => frame.time > 3)
    .map(frame => ({
      ...finalSit,
      id: uid(),
      time: frame.time,
      easing: "linear",
      pose: "sitting",
      gesture: "none",
      // Keep seated hip, torso, shin and boot joints unchanged while the
      // animated right shoulder, elbow and wrist wave. The opposite hand
      // can remain resting at the character's side.
      joints: { ...finalSit.joints, ...frame.joints },
    }));

  if (waved.length !== 12)
    throw new Error("The seated hello could not generate its joint frames.");
  const animated: SceneElement = {
    ...actor,
    animation: {
      ...actor.animation!,
      keyframes: [...existing, ...waved],
    },
  };
  return {
    ...scene,
    elements: scene.elements.map(element =>
      element.id === actor.id ? animated : element,
    ),
  };
}
