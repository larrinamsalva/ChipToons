import type { SceneElement } from "./model";

/** Smooth, deterministic open → shut → open curves on the existing
 * Cinematic Storybook blink clocks. No authored keys, audio, timers or state.
 *
 * Classic mode never uses these values. The opt-out in ElementAnimation
 * disables BOTH automated blink clocks.
 */
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const pulse = (phase: number, begin: number, closed: number,
  reopen: number, end: number) =>
  smooth((phase - begin) / (closed - begin)) *
  (1 - smooth((phase - reopen) / (end - reopen)));

export function cinematicEyelidClosureAt(
  element: Pick<SceneElement, "id" | "animation">,
  time: number,
): number {
  if (!Number.isFinite(time) || time < 0 ||
      element.animation?.blink === false) return 0;

  const sum = [...element.id].reduce((n, char) => n + char.charCodeAt(0), 0);
  // Previously this periodic secondary cinematic blink was a hard
  // 1.98–2.095s shut-eye. Keep its tempo and smooth its boundary.
  const cinematicPhase = (time + (sum % 37) * 0.041) % 5.4;
  const cinematic = pulse(cinematicPhase, 1.89, 1.99, 2.07, 2.17);

  // The original 4.3s baseline blink of ElementFrame used a hard Boolean.
  // Its phase is derived from the same existing element ID formula.
  // End exactly at 4.3 to avoid a discontinuity when the cycle wraps.
  const originalPhase = (time + (sum % 17) / 10) % 4.3;
  const original = pulse(originalPhase, 4.06, 4.18, 4.22, 4.299);
  return Math.max(cinematic, original);
}
