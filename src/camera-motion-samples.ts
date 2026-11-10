import type { CameraShot } from "./camera-shots";

export type CameraMotionSample = {
  id: "beginning" | "middle" | "end";
  label: "Beginning" | "Middle" | "End";
  time: number;
};

/** Sample inside the approved half-open shot window.
 * Pure deterministic seconds ensure previews share the real Stage sampling
 * contract and never accidentally show the following shot at the boundary. */
export function cameraMotionSamples(
  shot: Pick<CameraShot, "start" | "end">,
): CameraMotionSample[] {
  const duration = shot.end - shot.start;
  if (!Number.isFinite(shot.start) || !Number.isFinite(shot.end) ||
      duration <= 0) return [];
  return [
    { id: "beginning", label: "Beginning", time: shot.start },
    { id: "middle", label: "Middle", time: shot.start + duration / 2 },
    { id: "end", label: "End", time: shot.end - Math.min(0.005, duration / 10) },
  ];
}
