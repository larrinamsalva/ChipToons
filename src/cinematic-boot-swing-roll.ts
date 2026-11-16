/** A tiny heel-to-toe rotation during the SWING portion of an already
 * authored and supported walking cycle.
 *
 * The boot stays level through the stance interval (0..0.58). Swing
 * begins/ends with zero pitch to avoid a pop at takeoff or touchdown.
 * Deterministic scene time only: no animation clock, extra steps, source
 * movement or stored keyframes.
 */
export function cinematicBootSwingRollAt(
  gaitProgress: number,
  horizontalDirection: number,
): number {
  if (!Number.isFinite(gaitProgress) ||
      !Number.isFinite(horizontalDirection) ||
      Math.abs(horizontalDirection) < 0.001 ||
      gaitProgress <= 0.58 || gaitProgress >= 1)
    return 0;
  const swing = (gaitProgress - 0.58) / 0.42;
  const direction = Math.sign(horizontalDirection);
  // At mid-swing the toe lifts by only 5 degrees. Stance is unaffected.
  return direction * 5 * Math.sin(Math.PI * swing);
}
