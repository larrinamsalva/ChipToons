import { validateShotBeats } from "./studio-shot-beats";
import type { ShotBeat } from "./studio-shot-beats";
import type { ReelPlan } from "./studio-story-reel";

/**
 * A deliberately conservative, non-automatic *rough* planning guide,
 * based on 120 spoken English words/minute (2 words/sec).
 * Real child-friendly delivery, emphasis and pauses will vary.
 */
export const GUIDE_SPOKEN_WORDS_PER_SECOND = 2;

export interface NarrationTiming {
  words: number;
  estimatedSeconds: number;
  shotSeconds: number;
  estimatedOverrun: boolean;
}

export function narrationTiming(text: string, shotSeconds: number): NarrationTiming {
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  const estimatedSeconds = words / GUIDE_SPOKEN_WORDS_PER_SECOND;
  return {
    words,
    estimatedSeconds,
    shotSeconds,
    estimatedOverrun: words > 0 && estimatedSeconds > shotSeconds,
  };
}

const seconds = (value: number) => value.toFixed(2);
const line = (value: string) => value.replace(/\s+/gu, " ").trim();

/**
 * Pure, downloadable recording worksheet. A cue sheet is NOT an audio
 * recording, synthetic narration, subtitle file or exported video.
 * It uses the same ordered plan that creates the new project's real scenes.
 */
export function formatVoiceCueSheet(plan: ReelPlan, beats: readonly ShotBeat[]): string {
  if (!plan.shots.length || !Number.isFinite(plan.duration) ||
      !Number.isFinite(plan.fps) || plan.duration <= 0)
    throw new Error("Choose valid storyboard shots before exporting a voice cue sheet.");
  const notes = validateShotBeats(plan.shots, beats);
  const body: string[] = [
    "ChipToons — Storyboard Voice Cue Sheet",
    "LOCAL SCRIPT ONLY — written narration, not a voice recording.",
    `Shots: ${plan.shots.length} | Total storyboard: ${seconds(plan.duration)}s | PNG rate: ${plan.fps} fps`,
    "Approximate narration pacing: 120 spoken words/minute. Rehearse and adjust manually.",
    "",
  ];
  plan.shots.forEach((shot, index) => {
    const note = notes.get(shot.prefix.toLowerCase())!;
    const pace = narrationTiming(note.narration, shot.duration);
    body.push(
      `SHOT ${index + 1} — ${line(note.title) || shot.prefix}`,
      `Time: ${seconds(shot.start)}s to ${seconds(shot.start + shot.duration)}s (${seconds(shot.duration)}s)`,
      `Source PNG shot: ${shot.prefix}`,
      `Frames: ${shot.files.length} | Final-frame hold: +${shot.holdSeconds}s`,
      `Action / lesson: ${line(note.action) || "(none written)"}`,
      `Written narration: ${line(note.narration) || "(none written)"}`,
      `Narration estimate: ${pace.words} word(s), about ${seconds(pace.estimatedSeconds)}s at 120 wpm`,
      pace.estimatedOverrun
        ? "TIMING NOTE: Narration may be too long for this shot. Shorten the script or edit the scene later."
        : "Timing note: Estimated words fit the shot, but actual delivery may differ.",
      "",
    );
  });
  body.push("End of cue sheet. To add spoken audio, record it separately in ChipToons.");
  return body.join("\n") + "\n";
}
