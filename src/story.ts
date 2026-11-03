import { makeScene, validateProject, totalDuration } from "./model";
import type { Project, Scene, Asset, SceneElement } from "./model";
import { CHAPTERS } from "./story-model";
import type { ChapterId, CreationSource } from "./story-model";
import {
  resolvedCharacter,
  imageLibraryItem,
  placeLibraryItem,
} from "./library";

export function chapterOf(
  scene: Scene,
  index: number,
  count: number,
): ChapterId {
  return (
    scene.chapter ??
    CHAPTERS[Math.min(5, Math.floor((index * 6) / Math.max(1, count)))].id
  );
}
export function chapterSummary(project: Project) {
  return CHAPTERS.map((chapter) => ({
    ...chapter,
    scenes: project.scenes.flatMap((scene, index) =>
      chapterOf(scene, index, project.scenes.length) === chapter.id
        ? [{ scene, index }]
        : [],
    ),
  }));
}
export type ArtworkRole = "character" | "prop" | "background";
export function artworkStory(
  project: Project,
  asset: Asset,
  name: string,
  source: CreationSource,
  role: ArtworkRole = "character",
): Project {
  const item = imageLibraryItem(
    asset,
    name.trim().slice(0, 80) || "My artwork",
    role,
  );
  let p = { ...project, creationSource: source };
  if (role === "character") {
    const character = {
      ...project.characters[0],
      name: item.name,
      assetId: asset.id,
    };
    p = {
      ...p,
      assets: [...project.assets, asset],
      characters: [character, ...project.characters.slice(1)],
      scenes: project.scenes.map((scene) => ({
        ...scene,
        elements: scene.elements.map((e) =>
          e.characterId === character.id
            ? {
                ...e,
                kind: "character" as const,
                motion: "still" as const,
                animation: undefined,
              }
            : e,
        ),
      })),
    };
  } else {
    for (let i = 0; i < p.scenes.length; i++)
      p = { ...placeLibraryItem(p, i, item), creationSource: source };
  }
  return validateProject(p);
}
export function chapterDrafts(
  project: Project,
  chapter: ChapterId,
  count: number,
  duration: number,
): Scene[] {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 12 ||
    !Number.isFinite(duration) ||
    duration < 2 ||
    duration > 120
  )
    throw new Error("Choose 1–12 scenes lasting 2–120 seconds.");
  const phase = CHAPTERS.find((c) => c.id === chapter)!;
  const [a, b = a] = project.characters;
  const notes =
    chapter === "opening" || chapter === "introduction"
      ? project.outline.beginning
      : chapter === "challenge"
        ? project.outline.conflict
        : chapter === "closing"
          ? project.outline.ending
          : project.outline.response;
  const questions = [
    "What do you notice?",
    "How might our friend feel?",
    "What kind thing could we say?",
    "Which safe idea could we try?",
    "How did working together help?",
    "What could you try with a trusted grown-up?",
  ];
  return Array.from({ length: count }, (_, i) => ({
    ...makeScene(project.characters, project.scenes.length + i),
    chapter,
    duration,
    title: `${phase.label} · ${["Notice", "Wonder", "Listen", "Try", "Practice", "Reflect"][i % 6]} ${i + 1}`,
    narration: `${notes.slice(0, 4000)} ${["Pause to notice one small detail in this part of the story.", "Name a feeling and leave room to answer.", "Listen to each character’s idea before choosing.", "Try one safe step and describe what happens.", "Take turns practicing the helpful step.", "Look back at what changed and what to try next."][i % 6]}`,
    dialogue: `${a.name}: "${i % 2 ? "Let’s take one small step together." : "I am listening. What would help?"}"\n${b.name}: "We can take our time and try."`,
    action: phase.prompt,
    question: questions[(CHAPTERS.indexOf(phase) + i) % questions.length],
    background: project.scenes.at(-1)?.background ?? "meadow",
  }));
}
export function insertDrafts(project: Project, drafts: Scene[], after: number) {
  if (!drafts.length || project.scenes.length + drafts.length > 120)
    throw new Error(
      "A project can hold up to 120 scenes. Try a smaller batch.",
    );
  if (!Number.isInteger(after) || after < -1 || after >= project.scenes.length)
    throw new Error("Choose where to add these scenes.");
  // All inserted IDs are new; references and media on existing scenes are untouched.
  const scenes = [
    ...project.scenes.slice(0, after + 1),
    ...drafts,
    ...project.scenes.slice(after + 1),
  ];
  return validateProject({ ...project, scenes });
}
export function applyCharacterAppearance(
  project: Project,
  source: SceneElement,
  sceneIds: Set<string>,
) {
  const character = resolvedCharacter(project, source);
  if (!character) throw new Error("Choose a character first.");
  return validateProject({
    ...project,
    scenes: project.scenes.map((s) =>
      !sceneIds.has(s.id)
        ? s
        : {
            ...s,
            elements: s.elements.map((e) =>
              e.characterId === source.characterId &&
              (e.kind ?? "character") === "character"
                ? {
                    ...e,
                    name: source.name ?? character.name,
                    appearance: {
                      shirt: character.shirt,
                      skin: character.skin,
                      hair: character.hair,
                      accessory: character.accessory,
                    },
                    assetId: source.assetId ?? character.assetId,
                    crop: source.crop ? { ...source.crop } : undefined,
                  }
                : e,
            ),
          },
    ),
  });
}
export function planningProgress(project: Project) {
  const seconds = totalDuration(project),
    target = project.plannedMinutes * 60;
  return {
    seconds,
    target,
    remaining: Math.max(0, target - seconds),
    percent: Math.min(100, (seconds / target) * 100),
  };
}
