import { storyCardLayout } from "./story-card-layout";
import { soundNotes } from "./sound-director";
import type { Project } from "./model";
import { clipStart, categoryBus } from "./production";
import { totalDuration } from "./model";
import { planSegments } from "./segments";
import { mouthTrackIsCurrent, supportsVoiceMouth } from "./voice-mouth";
import { sceneStart } from "./timeline";
export interface ReadinessIssue {
  id: string;
  title: string;
  detail: string;
  blocking: boolean;
  sceneIndex?: number;
  action: "scene" | "voices" | "captions" | "backup" | "browser";
}
export function productionReadiness(
  project: Project,
  limit: number,
  supported: boolean,
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [],
    total = totalDuration(project),
    assets = new Set(project.assets.map((a) => a.id));
  if (!supported)
    issues.push({
      id: "browser",
      title: "This browser cannot encode this movie",
      detail:
        "Keep a portable backup and SRT, then try a browser with WebM, canvas capture and Web Audio support.",
      blocking: true,
      action: "browser",
    });
  for (const [i, scene] of project.scenes.entries()) {
    const start = sceneStart(project, i),
      end = start + scene.duration;
    if (scene.elements.some(element => element.voiceMouth?.some(track =>
      !supportsVoiceMouth(project.characters.find(character => character.id === element.characterId), element) ||
      !mouthTrackIsCurrent(project, scene, element, track))))
      issues.push({
        id: `mouth:${scene.id}`, title: `Scene ${i + 1} has mouth timing to review`,
        detail: "Open Make My Character Talk to review a changed clip or character. Earlier cues stay saved.",
        sceneIndex: i, blocking: false, action: "scene",
      });
    if (
      !scene.storyCard &&
      !scene.elements.length &&
      !scene.narration.trim() &&
      !scene.dialogue.trim()
    )
      issues.push({
        id: `empty:${scene.id}`,
        title: `Scene ${i + 1} is empty`,
        detail:
          "Add artwork or words, or deliberately keep this quiet background moment.",
        sceneIndex: i,
        blocking: false,
        action: "scene",
      });
    if (scene.storyCard) {
      const layout = storyCardLayout(project, scene, scene.storyCard);
      if (layout.clipped || layout.contrast < 4.5) issues.push({
        id: `story-card:${scene.id}`,
        title: `Scene ${i + 1} has a story card to review`,
        detail: "Open Finish My Cartoon’s Story. Shorten text or use scrolling credits if the caption area crowds the card, and choose colors with enough contrast.",
        sceneIndex: i, blocking: false, action: "scene",
      });
    }
    if (
      scene.elements.some((e) => {
        const id =
          e.assetId ??
          project.characters.find((c) => c.id === e.characterId)?.assetId;
        return id && !assets.has(id);
      })
    )
      issues.push({
        id: `art:${scene.id}`,
        title: `Scene ${i + 1} has missing artwork`,
        detail:
          "Restore a complete backup or replace the missing source in the art library.",
        sceneIndex: i,
        blocking: true,
        action: "scene",
      });
    if (
      scene.narration.trim() &&
      !project.audioClips.some(
        (c) =>
          ["narration", "dialogue"].includes(c.category) &&
          !c.muted &&
          c.volume > 0 &&
          project.mixer.voice > 0 &&
          clipStart(project, c) < end &&
          clipStart(project, c) + c.duration > start,
      )
    )
      issues.push({
        id: `voice:${scene.id}`,
        title: `Scene ${i + 1} has words without a recorded voice`,
        detail:
          "Record or assign narration, or keep this scene as text and music. Browser voice previews are not exported.",
        sceneIndex: i,
        blocking: false,
        action: "voices",
      });
    if (
      project.captions.some(
        (c) =>
          c.sceneId === scene.id &&
          (c.start < 0 || c.end > scene.duration || c.end <= c.start),
      )
    )
      issues.push({
        id: `caption:${scene.id}`,
        title: `Review captions in scene ${i + 1}`,
        detail:
          "Keep caption times inside this scene. Restore an intact backup if the data is damaged.",
        sceneIndex: i,
        blocking: true,
        action: "captions",
      });
  }
  for (const c of project.audioClips) {
    const s = c.sceneId
      ? project.scenes.find((s) => s.id === c.sceneId)
      : undefined;
    if (
      !project.audioAssets.some((a) => a.id === c.assetId) ||
      (c.sceneId && !s) ||
      c.start < 0 ||
      c.start + c.duration > (s?.duration ?? total) + 1e-5
    )
      issues.push({
        id: `clip:${c.id}`,
        title: `Review audio: ${c.name}`,
        detail:
          "Choose an available source and keep the clip within its scene or episode timing.",
        blocking: true,
        action: "voices",
      });
  }
  for (const i of planSegments(project, limit).oversized)
    issues.push({
      id: `limit:${project.scenes[i].id}`,
      title: `Scene ${i + 1} is longer than ${limit} seconds`,
      detail:
        "Shorten this scene in Scene details, or use a larger-screen export limit. Whole scenes are never silently cut.",
      blocking: true,
      sceneIndex: i,
      action: "scene",
    });
  if (
    !project.audioClips.some(
      (c) =>
        !c.muted && c.volume > 0 && project.mixer[categoryBus(c.category)] > 0,
    ) ||
    project.mixer.muted ||
    !project.mixer.master
  )
    issues.push({
      id: "mix",
      title: "The current mix is silent",
      detail:
        "Check voice/music/effects levels or deliberately export a silent cartoon.",
      blocking: false,
      action: "voices",
    });
  return [...issues, ...soundNotes(project).map(note => ({ ...note, blocking: false, action: "voices" as const }))];
}
