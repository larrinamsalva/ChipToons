import type { Project } from "./model";

export interface CameraVoiceSourceStatus {
  /** Audio may be attempted after the creator explicitly presses Play.
   * This is NOT an integrity, decoding, speech or approval guarantee. */
  soundReady: boolean;
  text: string;
}

/** Report just what the saved clip metadata and the local original-index
 * check establish. Never invent recordings or imply a file has been
 * decoded or its spoken words verified.
 */
export function cameraVoiceSourceStatus(
  project: Pick<Project, "audioAssets" | "audioClips">,
  clipId: string,
  missing: ReadonlySet<string>,
  checked: boolean,
  checkFailed: boolean,
): CameraVoiceSourceStatus {
  const clip = project.audioClips.find(item => item.id === clipId);
  if (!clip) return {
    soundReady: false,
    text: "Voice clip assignment is no longer in this project.",
  };
  const source = project.audioAssets.find(asset => asset.id === clip.assetId);
  if (!source) return {
    soundReady: false,
    text: "Assigned audio source is missing from this project.",
  };
  if (!source.file) return source.dataUrl
    ? {
      soundReady: true,
      text: `Embedded audio source: ${source.name}. Listen to verify its contents.`,
    }
    : {
      soundReady: false,
      text: `Embedded audio data missing: ${source.name}. Restore the project backup before listening.`,
    };
  if (checkFailed) return {
    soundReady: false,
    text: `Local audio source not verified: ${source.name}. Retry the original-file check or restore a complete backup.`,
  };
  if (!checked) return {
    soundReady: false,
    text: `Checking local audio source: ${source.name}. Audio playback is not ready yet.`,
  };
  if (missing.has(source.id)) return {
    soundReady: false,
    text: `Original audio missing on this device: ${source.name}. Restore a complete episode backup before listening.`,
  };
  return {
    soundReady: true,
    text: `Local audio entry found: ${source.name}. Listen to verify the original plays and matches the words.`,
  };
}
