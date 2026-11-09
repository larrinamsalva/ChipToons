import type { Project } from "./model";
import { framefieldCaptionVoiceReview } from "./framefield-caption-voice-review";

/**
 * Create a plain-text, human recording/review worksheet from the exact saved
 * cartoon. No made-up voices, speaker guesses, waveform analysis, edits or
 * synthetic timing. The line is a snapshot of assigned audio clip coverage.
 */
export function framefieldRecordingPunchList(project: Project): string {
  if (project.templateId !== "frame-sequence-storyboard")
    throw new Error("This recording checklist is for imported PNG storyboards.");
  const board = framefieldCaptionVoiceReview(project);
  const normal = (value: string) => value.replace(/\s+/gu, " ").trim();
  const sec = (value: number) => `${value.toFixed(2)}s`;
  const lines: string[] = [
    "CHIPTOONS — RECORDING & CAPTION REVIEW CHECKLIST",
    `Cartoon: ${normal(project.title)}`,
    "LOCAL WRITTEN CHECKLIST — not a voice recording, narration approval or automatic alignment.",
    "",
    `Scenes: ${board.scenes.length} | Scenes with assigned voice intervals: ${board.scenesWithAssignedVoice}`,
    `Captions: ${board.captions} | Captions without overlapping assigned voice: ${board.captionsWithoutOverlappingVoice}`,
    "",
  ];
  let absoluteStart = 0;
  for (const scene of board.scenes) {
    const authored = project.scenes[scene.sceneIndex];
    lines.push(
      `SCENE ${scene.sceneIndex + 1} — ${normal(scene.title)}`,
      `Episode time: ${sec(absoluteStart)} to ${sec(absoluteStart + scene.duration)}`,
      `Voice intervals assigned: ${scene.voiceClips} | Timed captions: ${scene.captions}`,
      `Written narration: ${normal(authored.narration) || "(none)"}`,
      `Written dialogue: ${normal(authored.dialogue) || "(none)"}`,
    );
    if (scene.missingVoice)
      lines.push("TO DO: Record or assign actual narration/dialogue, or choose a silent text scene.");
    if (scene.missingCaptions)
      lines.push("TO DO: Add and review scene captions if these words should appear in the video.");
    if (!scene.missingVoice && !scene.missingCaptions && !scene.unmatchedCues)
      lines.push("TO DO: Listen, approve the actual spoken performance and verify timing.");
    for (const cue of scene.cues)
      lines.push(
        `  CAPTION ${sec(absoluteStart + cue.start)}–${sec(absoluteStart + cue.end)}: ${normal(cue.text)}`,
        cue.overlapsVoice
          ? "  REVIEW: An assigned voice clip overlaps. Listen to confirm the words and exact timing."
          : "  REVIEW: No assigned voice clip overlaps. Record speech or confirm intentional silent text.",
      );
    lines.push("");
    absoluteStart += scene.duration;
  }
  lines.push(
    "All timing is drawn from this cartoon's existing scene, caption and assigned clip data.",
    "A clip overlapping text does not prove a recording exists at its source, contains matching speech or has been approved.",
    "Keep your portable project backup, review voice and caption edits, and watch the finished film before publishing.",
    "",
  );
  return lines.join("\n");
}
