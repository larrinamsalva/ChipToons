import type { Project, Scene, SceneElement } from "./model";
import type { ElementFrame } from "./timeline";
import { mouthTrackIsCurrent } from "./voice-mouth";
import { clipStart } from "./production";

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

/** A gaze-only cue for an already recorded, script-linked CLOSE-UP.
 * The saved camera explicitly singles out the speaker, who can glance
 * toward the other real performer rather than scanning unrelated props.
 * Never changes the head rig, original mouth, audio, shot or keys. */
export interface SpeakingEyeline {
  partnerId: string;
  dx: number;
  dy: number;
  focus: number;
}

export function cinematicSpeakingEyelineAt(
  project: Project,
  scene: Scene,
  speaker: SceneElement,
  frames: ReadonlyMap<string, ElementFrame>,
  time: number,
  calm: boolean,
): SpeakingEyeline | undefined {
  if (calm || project.visualStyle !== "storybook-cinematic" ||
      project.mixer.muted || project.mixer.voice <= 0 ||
      project.mixer.master <= 0 || !Number.isFinite(time) ||
      time < 0 || time > scene.duration || !speaker.characterId ||
      speaker.assetId) return;

  // Require an authored line-linked close-up and an existing, unchanged
  // voice-to-mouth link at precisely this original recording's start.
  const shot = scene.cameraShots?.find(item => item.style === "close" &&
    item.targets.length === 1 && item.targets[0] === speaker.id &&
    !!item.lineId && time >= item.start && time < item.end);
  if (!shot || !speaker.voiceMouth?.length ||
      !scene.script?.lines.some(line => line.id === shot.lineId &&
        line.speakerId === speaker.characterId)) return;

  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  if (sceneIndex < 0) return;
  const start = project.scenes.slice(0, sceneIndex)
    .reduce((sum, item) => sum + item.duration, 0);
  if (!speaker.voiceMouth.some(track =>
    mouthTrackIsCurrent(project, scene, speaker, track) &&
    project.audioClips.some(clip => clip.id === track.clipId &&
      !clip.muted && clip.volume > 0 &&
      Math.abs(clipStart(project, clip) - start - shot.start) < .03))) return;

  const frame = frames.get(speaker.id);
  if (!frame || frame.opacity < .1 || frame.gesture !== "none") return;
  // A pickup/point/handoff stays in charge of where the performer looks.
  if (scene.interactions?.some(action => action.actorId === speaker.id ||
      action.transfer?.actorId === speaker.id)) return;
  const rig = project.characters.find(item =>
    item.id === speaker.characterId)?.puppet;
  if (!rig?.face || !rig.parts.some(part => part.role === "head" &&
      !part.assetId) || rig.parts.some(part => part.role === "eyes" &&
      part.assetId)) return;

  const partner = scene.elements.flatMap(other => {
    if (!other.characterId || other.id === speaker.id ||
        other.characterId === speaker.characterId) return [];
    const otherFrame = frames.get(other.id);
    if (!otherFrame || otherFrame.opacity < .1) return [];
    const dx = otherFrame.x - frame.x, dy = otherFrame.y - frame.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance < 20 || distance > 370)
      return [];
    return [{ id: other.id, dx, dy, distance }];
  }).sort((a,b) => a.distance - b.distance || a.id.localeCompare(b.id))[0];
  if (!partner) return;

  // Soft holds bridge short recorded-syllable gaps without inventing voice.
  // The cue exists only for this authored, recorded shot.
  const focus = .82 * ease((time - shot.start) / .38) *
    ease((shot.end - time) / .52);
  if (focus < .035) return;
  return { partnerId: partner.id, dx: partner.dx, dy: partner.dy, focus };
}
