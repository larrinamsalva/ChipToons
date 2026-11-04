import { BACKGROUNDS, clone } from "./model";
import type { Asset, Project, Scene, SceneElement } from "./model";
import { SCENERY_DEPTHS, record } from "./art-model";
import type { SceneryDepth } from "./art-model";

export interface LocationLayout {
  description: string;
  background: Scene["background"];
  camera: Scene["camera"];
  gentleDepth: boolean;
  atmosphere?: "drift" | "sway" | "twinkle" | "parallax";
  elements: SceneElement[];
}

export const DEPTH_LABELS: Record<SceneryDepth, string> = {
  behind: "Behind characters",
  alongside: "Alongside characters",
  front: "In front of characters",
};
const isCharacter = (element: SceneElement) => !!element.characterId ||
  element.kind === undefined || element.kind === "character";
export const isScenery = (element: SceneElement) => !isCharacter(element) &&
  (!!element.backdrop || !!element.sceneryDepth);

export function sceneryDepthAt(elements: SceneElement[], index: number): SceneryDepth {
  const cast = elements.flatMap((element, position) => isCharacter(element) ? [position] : []);
  if (!cast.length) return elements[index]?.sceneryDepth ?? "alongside";
  if (index < cast[0]) return "behind";
  if (index > cast.at(-1)!) return cast.length === 1 && elements[index]?.sceneryDepth === "alongside" ? "alongside" : "front";
  return "alongside";
}

function insertScenery(elements: SceneElement[], additions: SceneElement[], depth: SceneryDepth) {
  const cast = elements.flatMap((element, index) => isCharacter(element) ? [index] : []);
  const backdropEnd = elements.reduce((end, element, index) => element.backdrop ? index + 1 : end, 0);
  let position = elements.length;
  if (depth === "behind") {
    position = cast[0] ?? backdropEnd;
  } else if (depth === "alongside") {
    const foreground = elements.findIndex((element, index) =>
      index > (cast.at(-1) ?? -1) && element.sceneryDepth === "front");
    position = cast.length > 1 ? cast.at(-1)! : foreground < 0 ? elements.length : foreground;
  }
  elements.splice(position, 0, ...additions);
}

export function setSceneryDepth(elements: SceneElement[], id: string, depth?: SceneryDepth) {
  const source = elements.find(element => element.id === id);
  if (!source || isCharacter(source) || source.backdrop) return elements;
  const updated = { ...source, sceneryDepth: depth };
  if (!depth) return elements.map(element => element.id === id ? updated : element);
  const result = elements.filter(element => element.id !== id);
  insertScenery(result, [updated], depth);
  return result;
}

export function applyScenery(scene: Scene, layout: LocationLayout, copies: SceneElement[]): Scene {
  const elements = [...copies.filter(element => element.backdrop), ...scene.elements.filter(element => !isScenery(element))];
  for (const depth of SCENERY_DEPTHS)
    insertScenery(elements, copies.filter(element => !element.backdrop && element.sceneryDepth === depth), depth);
  return {
    ...scene, elements, background: layout.background, gentleDepth: layout.gentleDepth,
    backgroundAnimation: scene.backgroundAnimation?.keyframes.length ? scene.backgroundAnimation :
      layout.atmosphere ? { style: layout.atmosphere, enabled: true, keyframes: [] } : undefined,
    cameraAnimation: scene.cameraAnimation?.followId &&
      !elements.some(element => element.id === scene.cameraAnimation?.followId)
      ? { ...scene.cameraAnimation, followId: undefined } : scene.cameraAnimation,
  };
}

// Keep editable geometry, artwork and ordering. Exclude episode animation and media.
export function captureLocation(project: Project, scene: Scene): { location: LocationLayout; assets: Asset[] } {
  const elements = scene.elements.flatMap((element, index) => {
    if (!isScenery(element)) return [];
    const { id, kind, x, y, scale, rotation, flip, flipY, opacity, width, height, crop,
      name, assetId, prop, backdrop } = element;
    return [{
      id, kind, x, y, scale, rotation, flip, flipY, opacity, width, height, crop, name, assetId, prop, backdrop,
      characterId: "", emotion: "calm" as const, motion: "still" as const,
      sceneryDepth: backdrop ? "behind" as const : sceneryDepthAt(scene.elements, index),
    }];
  });
  const used = new Set(elements.map(element => element.assetId));
  return clone({
    location: { description: "", background: scene.background, camera: scene.camera, gentleDepth: !!scene.gentleDepth,
      atmosphere: scene.backgroundAnimation?.enabled ? scene.backgroundAnimation.style : undefined, elements },
    assets: project.assets.filter(asset => used.has(asset.id)),
  });
}

const layoutFields = ["description", "background", "camera", "gentleDepth", "atmosphere", "elements"];
const elementFields = ["id", "kind", "x", "y", "scale", "rotation", "flip", "flipY", "opacity", "width",
  "height", "crop", "name", "assetId", "prop", "backdrop", "characterId", "emotion", "motion", "sceneryDepth"];

export function validLocation(value: unknown): value is LocationLayout {
  return record(value) && Object.keys(value).every(key => layoutFields.includes(key)) &&
    typeof value.description === "string" && value.description.length <= 500 &&
    BACKGROUNDS.includes(value.background as Scene["background"]) &&
    (value.camera === "wide" || value.camera === "close") &&
    typeof value.gentleDepth === "boolean" &&
    (value.atmosphere === undefined || ["drift", "sway", "twinkle", "parallax"].includes(String(value.atmosphere))) &&
    Array.isArray(value.elements) && value.elements.length <= 20 &&
    value.elements.every(element => record(element) && Object.keys(element).every(key => elementFields.includes(key)) &&
      (element.kind === "prop" || element.kind === "art") && element.characterId === "" &&
      element.motion === "still" && SCENERY_DEPTHS.includes(element.sceneryDepth as SceneryDepth));
}

export function sceneryOffset(scene: Scene, element: SceneElement, camera: { x: number; y: number }, calm: boolean) {
  if (calm || !scene.gentleDepth || !scene.cameraAnimation || !element.sceneryDepth || element.backdrop)
    return { x: 0, y: 0 };
  const factor = element.sceneryDepth === "behind" ? 0.2 : element.sceneryDepth === "front" ? -0.12 : 0;
  return { x: Math.max(-28, Math.min(28, (camera.x - 400) * factor)),
    y: Math.max(-16, Math.min(16, (camera.y - 225) * factor)) };
}
