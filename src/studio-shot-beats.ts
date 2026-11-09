/** Small, optional, local written notes for each original numbered-PNG shot. */
export const SHOT_BEAT_TITLE_LIMIT = 80;
export const SHOT_BEAT_ACTION_LIMIT = 240;
export const SHOT_BEAT_NARRATION_LIMIT = 300;

export interface ShotBeat {
  /** Exact selected numbered-shot prefix; never a remote file path. */
  prefix: string;
  /** Optional human-readable scene title. */
  title: string;
  /** Optional description of the visible action for the editor. */
  action: string;
  /** Optional written narration, NOT recorded or synthetic audio. */
  narration: string;
}
export const emptyShotBeat = (prefix: string): ShotBeat => ({
  prefix, title: "", action: "", narration: "",
});

// Check character codes rather than a control-character regex, preserving
// the exact original validation while satisfying ESLint's no-control-regex.
const validText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.length <= limit &&
  !Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) ||
      code === 127;
  });

/**
 * Fail closed for malformed, stale or extra notes before image decoding.
 * A complete set of notes is allowed only when its keys match the current
 * selected shot set exactly. Default/no notes preserves PR #58 behaviour.
 */
export function validateShotBeats<T extends { prefix: string }>(
  shots: readonly T[],
  beats?: readonly ShotBeat[],
): ReadonlyMap<string, ShotBeat> {
  if (!beats) return new Map();
  if (!Array.isArray(beats) || beats.length !== shots.length)
    throw new Error("Story beats no longer match the selected shots. Reselect your PNGs.");
  const expected = new Set(shots.map(shot => shot.prefix.toLowerCase()));
  if (expected.size !== shots.length) throw new Error("Shot names must be unique.");
  const verified = new Map<string, ShotBeat>();
  for (const beat of beats) {
    if (!beat || typeof beat !== "object" || Array.isArray(beat) ||
        Object.keys(beat).some(key => !["prefix", "title", "action", "narration"].includes(key)) ||
        typeof beat.prefix !== "string" ||
        !expected.has(beat.prefix.toLowerCase()) || verified.has(beat.prefix.toLowerCase()) ||
        !validText(beat.title, SHOT_BEAT_TITLE_LIMIT) ||
        !validText(beat.action, SHOT_BEAT_ACTION_LIMIT) ||
        !validText(beat.narration, SHOT_BEAT_NARRATION_LIMIT))
      throw new Error("Invalid story beat: check selected shots and note length.");
    verified.set(beat.prefix.toLowerCase(), beat);
  }
  return verified;
}
