import type { Project } from "./model";
import { cameraVoiceSourceStatus } from "./episode-camera-voice-source";
import { sceneAssignedVoiceCoverage } from "./episode-voice-coverage";

export interface VoiceOriginalIssue {
  clipId: string;
  sceneIndex: number;
  category: "narration" | "dialogue";
  status: "missing" | "unverified";
  detail: string;
}
export interface EpisodeVoiceOriginalSummary {
  /** Unique, active voice clips occurring inside at least one scene. */
  total: number;
  /** The original source is indexed on this device, NOT decoded or approved. */
  indexed: number;
  missing: number;
  unverified: number;
  /** First five issues in episode order, deduplicated for cross-scene clips. */
  issues: VoiceOriginalIssue[];
}

/** A read-only episode-level source-index inventory. A voice clip that
 * continues into the next scene is counted once. This does NOT inspect
 * speech, decode original media or determine if the cartoon is finished.
 */
export function episodeVoiceOriginalSummary(
  project: Project,
  missing: ReadonlySet<string>,
  checked: boolean,
  checkFailed: boolean,
): EpisodeVoiceOriginalSummary {
  const unique = new Set<string>();
  let indexed = 0, unavailable = 0, unverified = 0;
  const issues: VoiceOriginalIssue[] = [];
  for (let sceneIndex = 0; sceneIndex < project.scenes.length; sceneIndex++) {
    for (const span of sceneAssignedVoiceCoverage(project, sceneIndex).spans) {
      if (unique.has(span.clipId)) continue;
      unique.add(span.clipId);
      const source = cameraVoiceSourceStatus(project, span.clipId, missing, checked, checkFailed);
      if (source.soundReady) {
        indexed++;
        continue;
      }
      const clip = project.audioClips.find(c => c.id === span.clipId);
      const asset = project.audioAssets.find(a => a.id === clip?.assetId);
      // An external original with an incomplete or failed local-index
      // inspection is unverified, never incorrectly classified missing.
      const status: VoiceOriginalIssue["status"] =
        asset?.file && (!checked || checkFailed) ? "unverified" : "missing";
      if (status === "unverified") unverified++;
      else unavailable++;
      if (issues.length < 5) issues.push({
        clipId: span.clipId, sceneIndex, category: span.category,
        status, detail: source.text,
      });
    }
  }
  return { total: unique.size, indexed, missing: unavailable, unverified, issues };
}
