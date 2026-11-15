import type { Project } from "./model";
import { cameraReviewTimecode } from "./episode-camera-punch-list";
import { cameraVoiceSourceStatus } from "./episode-camera-voice-source";
import { sceneAssignedVoiceCoverage } from "./episode-voice-coverage";
import { episodeVoiceOriginalSummary } from "./episode-voice-original-summary";
import { sceneStart } from "./timeline";

const oneLine = (value: string) => value.replace(/\s+/gu, " ").trim();

/** Complete read-only, device-specific source-index report. No audio is decoded,
 * recorded, uploaded or approved. Clips crossing scenes are listed only once.
 */
export function episodeVoiceOriginalReport(
  project: Project,
  missing: ReadonlySet<string>,
  checked: boolean,
  checkFailed: boolean,
): string {
  const summary = episodeVoiceOriginalSummary(project, missing, checked, checkFailed);
  const lines = [
    "CHIPTOONS — WHOLE-EPISODE VOICE ORIGINALS CHECKLIST",
    `Cartoon: ${oneLine(project.title)}`,
    `Scenes: ${project.scenes.length}`,
    `UNIQUE VOICE CLIPS — ${summary.total}`,
    `Indexed original sources: ${summary.indexed} | Missing: ${summary.missing} | Unverified: ${summary.unverified}`,
    "",
    "Source availability is a snapshot of this browser/device, not a portable integrity certificate.",
    "Indexed does not mean decoded, audible speech, accurate words or approved performance.",
    "Unassigned voice time does not prove silence or indicate a failed export.",
    checkFailed
      ? "Local original-file check failed; external originals cannot be verified on this device."
      : checked
        ? "Local original-file check completed on this device."
        : "Local original-file check is pending; file-backed sources cannot be verified yet.",
    "Each assigned clip appears once, even when it continues across scene boundaries.",
    "Times identify the first visible interval of each recording inside this episode.",
    "",
  ];
  const seen = new Set<string>();
  for (let sceneIndex = 0; sceneIndex < project.scenes.length; sceneIndex++) {
    const start = sceneStart(project, sceneIndex);
    for (const span of sceneAssignedVoiceCoverage(project, sceneIndex).spans) {
      if (seen.has(span.clipId)) continue;
      seen.add(span.clipId);
      const source = cameraVoiceSourceStatus(
        project, span.clipId, missing, checked, checkFailed,
      );
      const clip = project.audioClips.find(c => c.id === span.clipId);
      const asset = project.audioAssets.find(a => a.id === clip?.assetId);
      const classification = source.soundReady
        ? "INDEXED"
        : asset?.file && (!checked || checkFailed) ? "UNVERIFIED" : "MISSING";
      lines.push(
        `[ ] ${classification} | Scene ${sceneIndex + 1} · ${span.category.toUpperCase()} | first visible scene interval ${cameraReviewTimecode(span.start)}–${cameraReviewTimecode(span.end)} | episode ${cameraReviewTimecode(start + span.start)}–${cameraReviewTimecode(start + span.end)}`,
        `    Recording ID: ${oneLine(span.clipId)}`,
        `    SOURCE — ${oneLine(source.text)}`,
      );
    }
  }
  if (!seen.size) lines.push("No assigned, unmuted dialogue or narration clips intersect this episode.");
  lines.push(
    "", "This checklist is read-only and reflects this device at download time.",
    "Restore missing originals using a complete backup and download a fresh report.",
    "Listen to each recording and inspect the actual movie before publishing.", "",
  );
  return lines.join("\n");
}
