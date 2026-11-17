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
    .map(frame => {
      // Ease the waving arm back into the *seated* resting angles during
      // the final second. The generic wave preset ends at standing-neutral
      // (zero) arm joints, which otherwise creates an abrupt mismatch
      // with the original relaxed seated pose at second six.
      const settle = Math.max(0, Math.min(1, frame.time - 5));
      const eased = settle * settle * (3 - 2 * settle);
      const joints = { ...finalSit.joints, ...frame.joints };
      for (const part of rig.parts) {
        if (!/(Arm|Forearm|Hand)$/.test(part.role)) continue;
        const resting = finalSit.joints?.[part.id];
        if (!resting) continue;
        const wavingAngle = frame.joints?.[part.id]?.angle ?? 0;
        joints[part.id] = {
          ...resting,
          angle: wavingAngle * (1 - eased) + resting.angle * eased,
        };
      }
      return {
        ...finalSit,
        id: uid(),
        time: frame.time,
        easing: "linear" as const,
        pose: "sitting" as const,
        gesture: "none" as const,
        // Keep the original pelvis, legs, head and boots untouched.
        joints,
      };
    });

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
