import type { Project } from "./model";
import { cameraCoverageReview } from "./camera-coverage-review";
import { episodeCameraSummary } from "./episode-camera-review";
import { cameraVoiceSourceStatus } from "./episode-camera-voice-source";
import { sceneAssignedVoiceCoverage } from "./episode-voice-coverage";

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
/** Optional snapshot of the original-file index in the current browser.
 * This is not a guarantee that an audio file is decodable or that the
 * performance matches the script, and it is not a portable health report.
 */
export interface CameraWorksheetSourceCheck {
  missing: ReadonlySet<string>;
  checked: boolean;
  checkFailed: boolean;
}

export function episodeCameraPunchList(
  project: Project,
  sourceCheck?: CameraWorksheetSourceCheck,
): string {
  const report = episodeCameraSummary(project);
  const lines: string[] = [
    "CHIPTOONS — WHOLE-EPISODE CAMERA REVIEW CHECKLIST",
    `Cartoon: ${tidy(project.title)}`,
    `Scenes: ${report.scenes.length} | Custom camera: ${report.percent}% (${report.customSeconds.toFixed(2)}s of ${report.seconds.toFixed(2)}s)`,
    "For manual visual review only. The default camera is a valid, intentional fallback.",
    "Voice markers come from assigned, unmuted dialogue/narration clip timing; they do not verify recorded words or audio files.",
    "",
  ];
  if (sourceCheck) lines.push(
    "Audio-source notes reflect only the file index of the device used for this download.",
    "An entry marked available has not necessarily been decoded or heard. Review the actual recording before publishing.",
    "Restoring an episode or changing browsers/devices may change availability. Download a fresh checklist after changes.",
    "",
  );
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
      if (sourceCheck) {
        const status = cameraVoiceSourceStatus(
          project, voice.clipId, sourceCheck.missing,
          sourceCheck.checked, sourceCheck.checkFailed,
        );
        lines.push(`      AUDIO SOURCE — ${tidy(status.text)}`);
      }
    }
    // The download invoked from Finish My Cartoon passes sourceCheck.
    // Mirror #123's full duration coverage while keeping the existing
    // data-only worksheet API unchanged for older callers.
    if (sourceCheck) {
      const voiceCoverage = sceneAssignedVoiceCoverage(project, row.sceneIndex);
      lines.push(
        `  ASSIGNED VOICE COVERAGE — ${voiceCoverage.assignedSeconds.toFixed(2)}s / ${voiceCoverage.totalSeconds.toFixed(2)}s from clip timing`,
        "  No assigned voice does not prove silence; assigned clips do not prove audible or approved speech.",
      );
      if (!voiceCoverage.spans.length) {
        lines.push("    No dialogue/narration clips assigned during this scene.");
      }
      for (const span of voiceCoverage.spans) {
        lines.push(
          `    [ ] ASSIGNED ${span.category.toUpperCase()} scene ${cameraReviewTimecode(span.start)}–${cameraReviewTimecode(span.end)} | episode ${cameraReviewTimecode(episodeStart + span.start)}–${cameraReviewTimecode(episodeStart + span.end)}`,
        );
      }
      for (const gap of voiceCoverage.gaps) {
        lines.push(
          `    [ ] NO ASSIGNED VOICE scene ${cameraReviewTimecode(gap.start)}–${cameraReviewTimecode(gap.end)} | episode ${cameraReviewTimecode(episodeStart + gap.start)}–${cameraReviewTimecode(episodeStart + gap.end)}`,
        );
      }
      if (!voiceCoverage.gaps.length) {
        lines.push("    Voice clip timing covers the scene; listen to verify the content.");
      }
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
