import type { Project } from "./model";
import { cameraCoverageReview } from "./camera-coverage-review";
import { episodeCameraSummary } from "./episode-camera-review";

/** Timecode with hundredth-second precision, including long episodes.
 * Convert once to integer centiseconds so rounding cannot emit 60.00s. */
export function cameraReviewTimecode(seconds: number): string {
  const centis = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(centis / 360000);
  const minutes = Math.floor(centis % 360000 / 6000);
  const whole = Math.floor(centis % 6000 / 100);
  const fractional = centis % 100;
  return [hours, minutes, whole].map(value => String(value).padStart(2, "0")).join(":") +
    "." + String(fractional).padStart(2, "0");
}

const tidy = (text: string) => text.replace(/\s+/gu, " ").trim();

/** Downloadable, data-only worksheet from the EXACT saved camera scene
 * and assigned voice clip metadata. No new recordings, auto-generated
 * camera edits, export promises or remote sources are included.
 *
 * This report is optional: default-camera intervals are valid, and
 * a clip assignment is not proof the spoken performance is approved.
 */
export function episodeCameraPunchList(project: Project): string {
  const report = episodeCameraSummary(project);
  const lines: string[] = [
    "CHIPTOONS — WHOLE-EPISODE CAMERA REVIEW CHECKLIST",
    `Cartoon: ${tidy(project.title)}`,
    `Scenes: ${report.scenes.length} | Custom camera: ${report.percent}% (${report.customSeconds.toFixed(2)}s of ${report.seconds.toFixed(2)}s)`,
    "For manual visual review only. The default camera is a valid, intentional fallback.",
    "Voice markers come from assigned, unmuted dialogue/narration clip timing; they do not verify recorded words or audio files.",
    "",
  ];
  let episodeStart = 0;
  for (const row of report.scenes) {
    const scene = project.scenes[row.sceneIndex];
    const coverage = cameraCoverageReview(project, scene);
    lines.push(
      `SCENE ${row.sceneIndex + 1} — ${tidy(scene.title)}`,
      `Episode time: ${cameraReviewTimecode(episodeStart)} to ${cameraReviewTimecode(episodeStart + row.seconds)}`,
      `Custom shots: ${row.shotCount} | Camera coverage: ${row.customSeconds.toFixed(2)}s/${row.seconds.toFixed(2)}s | Default-camera intervals: ${row.gapCount}`,
    );
    if (coverage.gaps.length === 0) {
      lines.push("  No default-camera intervals. Review the existing custom shots.");
    } else {
      for (const gap of coverage.gaps) {
        lines.push(
          `  [ ] DEFAULT CAMERA scene ${cameraReviewTimecode(gap.start)}–${cameraReviewTimecode(gap.end)} | episode ${cameraReviewTimecode(episodeStart + gap.start)}–${cameraReviewTimecode(episodeStart + gap.end)}`,
        );
      }
    }
    if (coverage.voices.length === 0)
      lines.push("  No assigned audible dialogue/narration clip starts in this scene.");
    for (const voice of coverage.voices) {
      const view = voice.shotId ? "custom camera shot" : "default camera";
      lines.push(
        `  [ ] ${voice.category.toUpperCase()} START scene ${cameraReviewTimecode(voice.start)} | episode ${cameraReviewTimecode(episodeStart + voice.start)} | ${view}`,
      );
    }
    lines.push("");
    episodeStart += row.seconds;
  }
  lines.push(
    "Checklist reflects the project at download time; revising shots or voice clips requires a new download.",
    "Review actual camera framing, movement, captions and sound before publishing.",
    "No project data is changed by this download.",
    "",
  );
  return lines.join("\n");
}
