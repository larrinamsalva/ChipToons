import { placeLibraryItem } from "./library";
import type { LibraryItem } from "./library";
import { makeScene, totalDuration, validateProject } from "./model";
import type { Background, Project, Scene } from "./model";
import { presetAnimation } from "./presets";
import { newAudioClip, reconcileProduction } from "./production";
import { reconcileSoundClips } from "./sound-cues";
import { builtInSound, SOUNDS } from "./sounds";
import { insertDrafts } from "./story";
import { CHAPTERS } from "./story-model";
import type { ChapterId } from "./story-model";
import { CARD_SOUNDS, STORY_CARD_KINDS, storyCardIssue, storyCardStyle } from "./story-card-model";
import type { SeriesPresentation, StoryCard, StoryCardKind } from "./story-card-model";
import { retimeScene, sceneStart } from "./timeline";
import type { SeriesPlan } from "./series";

export type CardSound = "" | keyof typeof CARD_SOUNDS;
export type CardOptions = {
  duration: number;
  after: number;
  chapter: ChapterId;
  background: Background;
  cast: boolean;
  sound: CardSound;
  artwork?: LibraryItem;
};

export function episodePresentation(project: Project, series: SeriesPlan[]) {
  for (const plan of series) {
    const index = plan.episodes.findIndex(episode => episode.projectId === project.id);
    if (index >= 0) return { series: plan.name, title: plan.episodes[index].title, number: index + 1, defaults: plan.presentation };
  }
  return { series: project.scriptOptions?.seriesTitle ?? "", title: project.title, number: 0, defaults: undefined };
}

export function newStoryCard(project: Project, kind: StoryCardKind, metadata = episodePresentation(project, [])): StoryCard {
  const title = {
    opening: metadata.series || project.title,
    episode: metadata.title,
    chapter: CHAPTERS[0].label,
    recap: "Let’s remember what we learned",
    thanks: "Thank you for watching!",
    credits: "Made with kindness",
  }[kind].slice(0, 140);
  return { kind, title, eyebrow: kind === "episode" ? [metadata.series, metadata.number ? `Episode ${metadata.number}` : ""]
    .filter(Boolean).join(" · ").slice(0, 90) : "", subtitle: "", style: storyCardStyle(), points: [], credits: [], scroll: false };
}
export function defaultCardOptions(project: Project, kind: StoryCardKind, selected: number): CardOptions {
  const after = kind === "opening" ? -1 : kind === "episode"
    ? project.scenes.reduce((last, scene, index) => scene.storyCard?.kind === "opening" ? index : last, -1)
    : kind === "chapter" ? selected : project.scenes.length - 1;
  return { duration: kind === "credits" || kind === "recap" ? 12 : 6, after,
    chapter: kind === "chapter" ? project.scenes[selected].chapter ?? "exploration" :
      kind === "opening" || kind === "episode" ? "opening" : "closing",
    background: project.scenes[selected].background, cast: false, sound: "" };
}

export function applyPresentation(card: StoryCard, defaults: SeriesPresentation) {
  return { ...card, style: { ...defaults.style }, scroll: card.kind === "credits" && defaults.ending === "scroll" };
}

export function makeStoryCardScene(project: Project, card: StoryCard, options: CardOptions): Scene {
  const base = makeScene(options.cast ? project.characters : []);
  const elements = base.elements.map((element, i) => {
    const cast = project.characters.find(item => item.id === element.characterId);
    const pose = { ...element, x: i ? 565 : 235, y: 419, scale: 0.84, motion: "still" as const };
    const animation = presetAnimation(pose, options.duration, "wave", 0.55, Math.min(2.4, options.duration - 0.55), cast?.puppet);
    if (card.kind === "thanks" || card.style.motion === "heart")
      animation.keyframes = animation.keyframes.map(key => ({ ...key, heart: "helping", heartStrength: 0.68 }));
    return { ...pose, animation };
  });
  return { ...base, elements, storyCard: card, chapter: options.chapter, background: options.background,
    title: `${STORY_CARD_KINDS[card.kind]} · ${card.title}`.slice(0, 160),
    narration: "", dialogue: "", action: "", duration: options.duration };
}

function shiftEpisodeAudio(project: Project, scenes: Scene[], boundary: number, change: number) {
  if (!change) return reconcileProduction(project, scenes);
  const timing = reconcileProduction(project, scenes);
  const audioClips = timing.audioClips.map(clip => {
    const source = project.audioClips.find(original => original.id === clip.id)!;
    if (clip.sceneId || clip.ambience || clip.soundCue) return clip;
    if (source.start >= boundary - 1e-8) return { ...source, start: source.start + change };
    if (source.start + source.duration <= boundary + 1e-8) return source;
    if (source.category !== "music" || !source.loop)
      throw new Error("A sound or voice spans this spot. Choose another position or assign that clip to a scene in Voices & Sound.");
    const duration = source.duration + change;
    return { ...source, duration, fadeIn: Math.min(source.fadeIn, duration), fadeOut: Math.min(source.fadeOut, duration) };
  });
  return { ...timing, audioClips: reconcileSoundClips(audioClips, scenes) };
}

function addCardSound(project: Project, index: number, sound: CardSound) {
  if (!sound) return project;
  const fresh = builtInSound(sound);
  const asset = project.audioAssets.find(item => item.name === fresh.name && item.dataUrl === fresh.dataUrl) ?? fresh;
  const music = SOUNDS.some(item => item[0] === sound && item[2] === "music");
  const scene = project.scenes[index];
  const duration = Math.min(scene.duration, asset.duration);
  const clip = { ...newAudioClip(project, asset, music ? "music" : "effects", index), sceneId: scene.id,
    duration, volume: music ? 0.31 : 0.33, fadeIn: Math.min(duration / 4, 0.2), fadeOut: Math.min(duration / 3, 0.4) };
  return { ...project, audioAssets: project.audioAssets.includes(asset) ? project.audioAssets : [...project.audioAssets, asset],
    audioClips: [...project.audioClips, clip] };
}

export function reviewStoryCard(project: Project, card: StoryCard, options: CardOptions, sceneId?: string) {
  const issue = storyCardIssue(card, options.duration);
  if (issue) throw new Error(issue);
  if (!Number.isFinite(options.duration) || options.duration < 2 || options.duration > 120)
    throw new Error("Choose a duration between 2 and 120 seconds.");
  let next: Project, index: number;
  if (sceneId) {
    index = project.scenes.findIndex(scene => scene.id === sceneId);
    const source = project.scenes[index];
    if (!source?.storyCard) throw new Error("The saved card could not be found.");
    const boundary = sceneStart(project, index) + source.duration;
    const change = options.duration - source.duration;
    if (change < 0 && project.audioClips.some(clip => clip.sceneId === sceneId && clip.start + clip.duration > options.duration + 1e-8))
      throw new Error("Give this card enough time for its saved audio, or adjust the clip in Voices & Sound first.");
    const scene = { ...(change ? retimeScene(source, options.duration) : source), chapter: options.chapter, storyCard: card,
      title: `${STORY_CARD_KINDS[card.kind]} · ${card.title}`.slice(0, 160), background: options.background };
    const scenes = project.scenes.map(item => item.id === sceneId ? scene : item);
    const media = shiftEpisodeAudio(project, scenes, boundary, change);
    next = { ...project, scenes, ...media };
  } else {
    index = options.after + 1;
    const scene = makeStoryCardScene(project, card, options);
    const boundary = index === project.scenes.length ? totalDuration(project) : sceneStart(project, index);
    // Use the same stable storyboard insertion and validation as chapter batches.
    const scenes = [...project.scenes.slice(0, index), scene, ...project.scenes.slice(index)];
    const media = shiftEpisodeAudio(project, scenes, boundary, scene.duration);
    next = insertDrafts({ ...project, ...media }, [scene], options.after);
  }
  if (options.artwork) next = placeLibraryItem(next, index, options.artwork);
  next = addCardSound(next, index, options.sound);
  return { project: validateProject(next), index };
}
