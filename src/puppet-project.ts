import { freshCharacter, newLibraryItem, placeLibraryItem } from "./library";
import type { LibraryItem } from "./library";
import { validateProject } from "./model";
import type { Project } from "./model";
import { starterProject } from "./planner";
import { presetAnimation } from "./presets";
import { sunnyRig, validJoints } from "./puppet-model";

export const SUNNY_NAME = "Sunny the Kindness Hero";
export function sunnyLibraryItem(): LibraryItem {
  return {
    ...newLibraryItem(SUNNY_NAME, "character"),
    character: {
      ...freshCharacter(SUNNY_NAME),
      shirt: "#ca5b36",
      skin: "#e9ab85",
      hair: "#49323b",
      puppet: sunnyRig(),
    },
  };
}
export function sunnyCartoon(): Project {
  const source = starterProject("kindness");
  const item = sunnyLibraryItem();
  source.title = "Sunny the Kindness Hero says hello";
  source.scenes = source.scenes.slice(0, 2);
  const steps = ["walk", "wave"] as const;
  const project = steps.reduce(
    (p, _, i) => placeLibraryItem(p, i, item),
    source,
  );
  return validateProject({
    ...project,
    scenes: project.scenes.map((scene, index) => {
      const puppet = {
        ...scene.elements.at(-1)!,
        x: 170,
        y: 355,
        motion: "still" as const,
      };
      const friend = {
        ...scene.elements[0],
        x: 640,
        animation: undefined,
        y: 355,
        motion: "still" as const,
      };
      if (index === 1) puppet.x = 470;
      const animation = presetAnimation(
        puppet,
        5,
        steps[index],
        0,
        3,
        item.character!.puppet,
      );
      animation.keyframes = animation.keyframes.map((key) => ({
        ...key,
        ...(index === 0 ? { x: puppet.x + (key.x - puppet.x) * 0.55 } : {}),
        ...(index === 1
          ? { emotion: "happy" as const, heart: "helping" as const }
          : {}),
      }));
      return {
        ...scene,
        title: index ? "A warm hello" : "Walk over kindly",
        duration: 5,
        camera: "wide",
        cameraAnimation: undefined,
        backgroundAnimation: undefined,
        narration: index
          ? "Sunny waves. A little hello can help someone feel welcome."
          : "Sunny notices a friend and walks over to say hello.",
        dialogue: index ? "Sunny: Would you like to play?" : "",
        action: index
          ? "Wave and show a glowing heart"
          : "Walk toward a friend",
        elements: [friend, { ...puppet, animation }],
      };
    }),
  });
}

export function updateScenePuppet(
  source: Project,
  sceneIndex: number,
  elementId: string,
  item: LibraryItem,
): Project {
  const old = source.scenes[sceneIndex]?.elements.find(
    (e) => e.id === elementId,
  );
  const rig = item.character?.puppet;
  if (!old || !rig || old.sourceLibraryId !== item.id)
    throw new Error(
      "Choose a scene puppet that came from this library character.",
    );
  const parts = new Set(rig.parts.map((p) => p.id));
  if (
    old.animation?.keyframes.some(
      (key) => key.joints && !validJoints(key.joints, parts),
    )
  )
    throw new Error(
      "The new rig removes an animated joint. Add it as a new character to keep this animation intact.",
    );
  const seriesCastId = source.characters.find(character => character.id === old.characterId)?.seriesCastId;
  const project = placeLibraryItem(source, sceneIndex, item, seriesCastId);
  const scene = project.scenes[sceneIndex];
  const placed = scene.elements.at(-1)!;
  scene.elements = scene.elements
    .slice(0, -1)
    .map((e) =>
      e.id === elementId
        ? {
            ...e,
            characterId: placed.characterId,
            voiceMouth: e.voiceMouth?.map(track => ({ ...track, speakerId: placed.characterId })),
            assetId: placed.assetId,
            name: placed.name,
          }
        : e,
    );
  return validateProject(project);
}
