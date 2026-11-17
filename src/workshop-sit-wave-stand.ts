import type { ElementKeyframe } from "./animation-model";
import type { Scene, SceneElement } from "./model";
import { uid } from "./model";
import type { PuppetRig } from "./puppet-model";
import { presetAnimation } from "./presets";
import { validatePristineWorkshopSeating } from "./workshop-seat-stand";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";

/**
 * Extend PR #158's existing chair/bench animation:
 * stand -> sit (0-3s) -> wave (3-6s) -> seated hold -> stand (last 3s).
 *
 * Only the unmodified original 25-frame seated greeting is accepted.
 * We intentionally do not rewrite any of its source keyframes or the
 * furniture: users can still edit everything manually afterwards.
 */
export function standAfterSeatedGreeting(
  scene: Scene,
  characterElementId: string,
  furnitureElementId: string,
  rig: PuppetRig,
): Scene {
  if (scene.duration < 9)
    throw new Error("Sitting, waving, and standing needs at least nine seconds.");
  const actor = scene.elements.find(item => item.id === characterElementId);
  const existing = actor?.animation?.keyframes;
  if (!actor || !existing || existing.length !== 25 ||
      existing.at(-1)?.time !== 6 || existing.at(-1)?.pose !== "sitting")
    throw new Error("First use Wave Hello While Seated on an original chair or bench sit.");

  // Validate against the real #155 sit and #158 greeting actions. Comparing
  // everything except generated key IDs prevents silently discarding a
  // customized arm, face, stage position, or earlier scene work.
  const pristine: Scene = {
    ...scene,
    elements: scene.elements.map(item =>
      item.id === actor.id ? {
        ...item,
        animation: { ...actor.animation!, keyframes: existing.slice(0, 13) },
      } : item,
    ),
  };
  validatePristineWorkshopSeating(pristine, characterElementId, furnitureElementId, rig);
  const reference = waveWorkshopWhileSeated(
    pristine, characterElementId, furnitureElementId, rig,
  ).elements.find(item => item.id === actor.id)!.animation!.keyframes;
  const stripId = (key: ElementKeyframe) =>
    Object.fromEntries(Object.entries(key).filter(([field]) => field !== "id"));
  // Earlier #158 saves used the same authentic wave joint samples, but
  // ended with standing-neutral arm angles. Recognize those exact original
  // creator-owned keys too; improved seated settling must not make existing
  // saved cartoons ineligible to stand up. A user-edited wave remains unsafe.
  const sitFinish = existing[12];
  const historicWaves = presetAnimation(actor, scene.duration, "wave", 3, 3, rig)
    .keyframes.filter(frame => frame.time > 3)
    .map(frame => ({
      ...sitFinish,
      id: frame.id,
      time: frame.time,
      easing: "linear" as const,
      pose: "sitting" as const,
      gesture: "none" as const,
      joints: { ...sitFinish.joints, ...frame.joints },
    }));
  const historic = [...existing.slice(0, 13), ...historicWaves];
  const signature = JSON.stringify(existing.map(stripId));
  if (signature !== JSON.stringify(reference.map(stripId)) &&
      signature !== JSON.stringify(historic.map(stripId)))
    throw new Error(
      "This seated wave was edited. Keep your customized keyframes and use a new scene for the automatic stand-up.",
    );

  // The last wave sample returns to the original seated posture at 6s.
  // At 9s standing begins immediately; longer scenes hold the same actual
  // seated pose until the last three seconds (not a sudden pose reset).
  const standStart = scene.duration - 3;
  const lastGreeting = existing.at(-1)!;
  const hold: ElementKeyframe[] = standStart > 6
    ? [{ ...lastGreeting, time: standStart, id: uid(), easing: "linear" }]
    : [];
  const standing = presetAnimation(actor, scene.duration, "stand", standStart, 3, rig);
  const rise = standing.keyframes.filter(key => key.time > standStart);
  if (rise.length !== 12)
    throw new Error("The full-body stand-up frames could not be generated.");
  const animated: SceneElement = {
    ...actor,
    animation: {
      ...actor.animation!,
      keyframes: [...existing, ...hold, ...rise],
    },
  };
  return {
    ...scene,
    elements: scene.elements.map(item => item.id === actor.id ? animated : item),
  };
}
