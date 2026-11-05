import { validPresentation } from "./story-card-model";
import type { SeriesPresentation } from "./story-card-model";
import { BACKGROUNDS, uid } from "./model";
import { validVoiceNotes } from "./script-model";
import type { VoiceNotes } from "./script-model";
import type { Project } from "./model";
import { START_BRIEF } from "./assistant";
import type { StoryBrief } from "./assistant";
import { EMOTIONS, HEARTS } from "./animation-model";
import { POSES } from "./art-model";
import type { LibraryItem } from "./library";
import { remapPuppetAssets } from "./puppet-model";
import { actionsFor, actionsForPuppet } from "./presets";

export const EPISODE_STATUSES = [
  "Idea", "Planned", "Storyboard", "Animating", "Recording", "Ready for Review", "Completed",
] as const;
export const BIBLE_FIELDS = {
  concept: "Series concept and values",
  primary: "Primary characters",
  supporting: "Supporting characters",
  relationships: "Character relationships",
  locations: "Recurring locations",
  style: "Visual style",
  goals: "Educational goals",
  rules: "Storytelling rules",
  notes: "Continuity notes",
} as const;

export interface CastMember {
  id: string;
  name: string;
  role: string;
  libraryId: string;
  appearance: string;
  strengths: string;
  expressions: string;
  relationships: string;
  voice?: VoiceNotes;
  heart: (typeof HEARTS)[number];
}
export interface EpisodePlan {
  id: string;
  title: string;
  lesson: string;
  main: string[];
  supporting: string[];
  setting: string;
  description: string;
  question: string;
  minutes: number;
  status: (typeof EPISODE_STATUSES)[number];
  projectId?: string;
  locationId?: string;
}
export interface SeriesPlan {
  id: string;
  name: string;
  description: string;
  age: string;
  themes: string;
  target: number;
  archived: boolean;
  presentation?: SeriesPresentation;
  bible: Record<keyof typeof BIBLE_FIELDS, string>;
  cast: CastMember[];
  episodes: EpisodePlan[];
}
export const MAX_EPISODES = 100;
export const MAX_CAST = 40;
export const MAX_SERIES_FILE = 6 * 1024 * 1024;

export function newCast(item?: LibraryItem): CastMember {
  return { id: uid(), name: item?.name ?? "", libraryId: item?.id ?? "",
    role: "", appearance: "", strengths: "", expressions: "", relationships: "", heart: "off" };
}

export function newEpisode(number: number): EpisodePlan {
  return { id: uid(), title: `Episode ${number}`, lesson: "", main: [], supporting: [],
    setting: "", description: "", question: "", minutes: 5, status: "Idea" };
}

export function newSeries(): SeriesPlan {
  return {
    id: uid(), name: "My new series", description: "", age: "4–7", themes: "",
    target: 6, archived: false,
    bible: { concept: "", primary: "", supporting: "", relationships: "", locations: "",
      style: "", goals: "", rules: "", notes: "" },
    cast: [], episodes: [],
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown, max = 6000): value is string =>
  typeof value === "string" && value.length <= max;
const id = (value: unknown): value is string => str(value, 100) && !!value.trim();
const number = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;

export function validateSeries(value: unknown): SeriesPlan {
  const invalid = () => { throw new Error("This series plan is invalid or exceeds the supported size."); };
  if (!record(value) || !id(value.id) || !str(value.name, 160) || !value.name.trim() ||
      !str(value.description) || !str(value.age, 60) || !str(value.themes, 1000) ||
      !number(value.target, MAX_EPISODES) || typeof value.archived !== "boolean" ||
      (value.presentation !== undefined && !validPresentation(value.presentation)) ||
      !record(value.bible) || !Array.isArray(value.cast) || value.cast.length > MAX_CAST ||
      !Array.isArray(value.episodes) || value.episodes.length > MAX_EPISODES) return invalid();
  const rawBible = value.bible;
  const bible = Object.fromEntries(Object.keys(BIBLE_FIELDS).map(key => {
    const entry = rawBible[key];
    if (!str(entry, 1500)) return invalid();
    return [key, entry];
  })) as SeriesPlan["bible"];
  const castIds = new Set<string>();
  const cast = value.cast.map((entry: unknown): CastMember => {
    if (!record(entry)) return invalid();
    const { id: key, name, libraryId, role, appearance, strengths, expressions, relationships, heart, voice } = entry;
    if (!id(key) || castIds.has(key) || !str(name, 80) || !name.trim() ||
        !str(libraryId, 100) || !str(role, 160) || !str(appearance, 1500) ||
        !str(strengths, 1500) || !str(expressions, 1500) || !str(relationships, 1500) ||
        (voice !== undefined && !validVoiceNotes(voice)) ||
        !HEARTS.includes(heart as CastMember["heart"])) return invalid();
    castIds.add(key);
    return { id: key, name, libraryId, role, appearance, strengths, expressions, relationships,
      heart: heart as CastMember["heart"], ...(voice ? { voice } : {}) };
  });
  const episodeIds = new Set<string>();
  const projects = new Set<string>();
  const episodes = value.episodes.map((entry: unknown): EpisodePlan => {
    if (!record(entry)) return invalid();
    const { id: key, title, lesson, main, supporting, setting, description, question, minutes, status, projectId, locationId } = entry;
    if (!id(key) || episodeIds.has(key) || !str(title, 160) || !title.trim() ||
        !str(lesson, 500) || !str(setting, 500) || !str(description, 6000) ||
        !str(question, 500) || !number(minutes, 30) ||
        !EPISODE_STATUSES.includes(status as EpisodePlan["status"]) ||
        !Array.isArray(main) || !Array.isArray(supporting) ||
        main.length + supporting.length > MAX_CAST ||
        (locationId !== undefined && !id(locationId)) ||
        (projectId !== undefined && (!id(projectId) || projects.has(projectId)))) return invalid();
    const assigned = [...main, ...supporting];
    if (new Set(assigned).size !== assigned.length || assigned.some(key => !castIds.has(key))) return invalid();
    episodeIds.add(key);
    if (projectId) projects.add(projectId);
    return { id: key, title, lesson, main, supporting, setting, description, question, minutes,
      status: status as EpisodePlan["status"], ...(projectId ? { projectId } : {}), ...(locationId ? { locationId } : {}) };
  });
  return { id: value.id, name: value.name, description: value.description, age: value.age,
    themes: value.themes, target: value.target, archived: value.archived, bible, cast, episodes,
    ...(value.presentation ? { presentation: structuredClone(value.presentation) } : {}) };
}

export function seriesBackup(series: SeriesPlan) {
  return new Blob([JSON.stringify({ format: "chiptoons-series-plan", version: 1,
    series: validateSeries(series) })], { type: "application/json" });
}

export async function readSeriesBackup(file: Blob) {
  if (file.size > MAX_SERIES_FILE) throw new Error("This series-plan backup is too large.");
  let value: unknown;
  try { value = JSON.parse(await file.text()); } catch {
    throw new Error("Choose a readable ChipToons series-plan backup.");
  }
  if (!record(value) || value.format !== "chiptoons-series-plan" || value.version !== 1)
    throw new Error("Choose a supported ChipToons series-plan backup.");
  const source = validateSeries(value.series);
  return {
    ...source, id: uid(), archived: false,
    episodes: source.episodes.map(episode => ({ ...episode, id: uid(), projectId: undefined })),
  };
}

export function episodeBrief(plan: EpisodePlan, number: number): StoryBrief {
  const words = plan.setting.toLowerCase().split(/[^a-z]+/);
  const background = BACKGROUNDS.find(value => words.includes(value)) ?? START_BRIEF.background;
  return { ...START_BRIEF, title: plan.title, idea: plan.description, setting: plan.setting,
    background, lesson: plan.lesson, minutes: plan.minutes, growing: true, episode: Math.min(number, 30) };
}

export function castOptions(item: LibraryItem) {
  const rig = item.character?.puppet;
  const shape = !!item.character && !item.character.assetId && (!rig || rig.face);
  return {
    expressions: shape ? EMOTIONS.join(", ") : "Uses its saved appearance",
    poses: rig ? rig.poses.map(pose => pose.name).join(", ") : shape ? POSES.join(", ") : "",
    actions: (rig ? actionsForPuppet(rig) : actionsFor(shape)).map(([, label]) => label).join(", "),
  };
}

// Asset IDs are remapped per project. Compare the artwork behind those IDs.
function appearance(item: LibraryItem, character = item.character) {
  if (!character) return "";
  const { shirt, hair, skin, accessory, puppet, assetId } = character;
  const relevant = new Set([assetId, ...(puppet?.parts.map(part => part.assetId) ?? [])]);
  const assets = new Map(item.assets.filter(asset => relevant.has(asset.id)).map(asset =>
    [asset.id, JSON.stringify([asset.dataUrl, asset.drawing])]));
  return JSON.stringify([shirt, hair, skin, accessory, assets.get(assetId ?? ""),
    puppet && remapPuppetAssets(puppet, assets)]);
}

export function continuityWarnings(series: SeriesPlan, episode: EpisodePlan,
  project: Project | undefined, library: LibraryItem[]) {
  const warnings: string[] = [];
  const planned = [...episode.main, ...episode.supporting];
  if (episode.locationId && !library.some(item => item.kind === "location" && item.id === episode.locationId))
    warnings.push("The reusable location is unavailable. Choose a location again before creating a new draft.");
  if (!episode.lesson.trim()) warnings.push("Add the lesson you want this episode to teach.");
  if (episode.projectId && !project) warnings.push("The linked cartoon is unavailable. Restore its episode backup and link it again.");
  const elements = project?.scenes.flatMap(scene => scene.elements) ?? [];
  const used = new Set(elements.map(element => element.characterId));
  const characters = project?.characters.filter(character => used.has(character.id)) ?? [];
  for (const member of series.cast.filter(member => planned.includes(member.id))) {
    const source = library.find(item => item.kind === "character" && item.id === member.libraryId);
    if (member.libraryId && !source) warnings.push(`${member.name}: the library source is unavailable.`);
    if (!project) continue;
    const matches = characters.filter(character => character.seriesCastId === member.id);
    if (!matches.length) {
      warnings.push(`${member.name}: this cartoon has no confirmed instance of the planned cast member.`);
    } else if (matches.length > 1) {
      warnings.push(`${member.name}: review the multiple character definitions with this cast identity.`);
    }
    if (source) {
      const expected = appearance(source);
      const ids = new Set(matches.map(character => character.id));
      const instances = elements.filter(element => ids.has(element.characterId));
      const changed = matches.some(character => appearance({ ...source, assets: project.assets }, character) !== expected)
        || instances.some(element => Object.entries(element.appearance ?? {}).some(
          ([key, value]) => source.character?.[key as "shirt" | "skin" | "hair" | "accessory"] !== value));
      if (changed) warnings.push(`${member.name}: this cartoon’s appearance differs from the current library source. Review before updating.`);
      if (instances.some(element => element.sourceLibraryId && element.sourceLibraryId !== source.id))
        warnings.push(`${member.name}: a scene points to different library artwork for this identity.`);
    }
  }
  if (project && characters.some(character => character.seriesCastId && !planned.includes(character.seriesCastId)))
    warnings.push("This cartoon uses recurring cast members outside the episode plan.");
  return warnings;
}
