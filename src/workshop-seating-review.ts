import type { Scene } from "./model";

export interface WorkshopReviewMoment {
  id: "seated" | "wave" | "rise" | "standing" | "settled";
  label: string;
  seconds: number;
}

/**
 * Read-only shortcuts into the *saved* Stage timeline, never a fabricated
 * preview. The joints and the keyframe's actual time are the evidence a
 * moment exists. The editor routes clicks through its normal safe seek.
 */
export function workshopSeatingReviewMoments(
  scene: Scene,
  characterElementId: string,
): WorkshopReviewMoment[] {
  const actor = scene.elements.find(element => element.id === characterElementId);
  const keys = actor?.animation?.keyframes;
  if (!actor || !keys?.length) return [];

  const at = (time: number) =>
    keys.find(key => Math.abs(key.time - time) < 0.001);
  const seated = at(3);
  if (!seated || seated.pose !== "sitting" ||
      !seated.joints?.leftShin || !seated.joints?.rightShin)
    return [];

  const moments: WorkshopReviewMoment[] = [
    { id: "seated", label: "Review sitting", seconds: 3 },
  ];

  const waving = at(4.5);
  if (waving?.pose === "sitting" &&
      (waving.joints?.rightArm?.angle ?? 0) < -70)
    moments.push({ id: "wave", label: "Review wave", seconds: 4.5 });

  const final = keys.at(-1)!;
  const standTime = scene.duration - 1.5;
  const rising = at(standTime);
  const standsAtEnd = Math.abs(final.time - scene.duration) < 0.001 &&
    final.pose === "standing";
  if (standsAtEnd &&
      rising?.joints?.leftShin && rising?.joints?.rightShin &&
      rising.joints.leftShin.angle > 25 &&
      rising.joints.rightShin.angle > 25) {
    moments.push({ id: "rise", label: "Review rising", seconds: standTime });
    moments.push({
      id: "standing", label: "Review standing", seconds: scene.duration,
    });
  } else if (waving && final.pose === "sitting" &&
      final.time >= 6) {
    // A seated greeting may finish at six seconds inside a longer scene.
    moments.push({
      id: "settled", label: "Review settled pose", seconds: 6,
    });
  }

  return moments;
}
