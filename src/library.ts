import { puppetAssetIds, remapPuppetAssets } from "./puppet-model";
import { emptyProduction } from "./media-model";
import { clone, makeScene, uid, validateProject, BACKGROUNDS } from "./model";
import type {
  Asset,
  Background,
  Character,
  Emotion,
  Project,
  SceneElement,
} from "./model";
import { POSES, PROPS, record } from "./art-model";
import type { Pose, PropName } from "./art-model";
import { db } from "./storage";

export type LibraryKind = "character" | "background" | "prop" | "drawing";
export type ImageSettings = Partial<
  Pick<
    SceneElement,
    "crop" | "opacity" | "rotation" | "flip" | "flipY" | "width" | "height"
  >
>;
export interface LibraryItem {
  version: 1;
  id: string;
  name: string;
  kind: LibraryKind;
  group: string;
  tags: string[];
  character?: Character;
  assets: Asset[];
  assetId?: string;
  background?: Background;
  prop?: PropName;
  transform: ImageSettings;
  pose: Pose;
  emotion: Emotion;
  updatedAt: string;
}
export const freshCharacter = (name = "My character"): Character => ({
  id: uid(),
  name,
  shirt: "#8e86d4",
  skin: "#bf805c",
  hair: "#44332d",
  accessory: "none",
});
export function newLibraryItem(
  name = "My character",
  kind: LibraryKind = "character",
): LibraryItem {
  return {
    version: 1,
    id: uid(),
    name,
    kind,
    group: "My collection",
    tags: [],
    assets: [],
    character: kind === "character" ? freshCharacter(name) : undefined,
    transform: {},
    pose: "standing",
    emotion: "happy",
    updatedAt: new Date().toISOString(),
  };
}
export function imageLibraryItem(
  asset: Asset,
  name: string,
  kind: LibraryKind,
): LibraryItem {
  const item = newLibraryItem(name, kind);
  item.assets = [clone(asset)];
  item.assetId = asset.id;
  if (kind === "background") item.transform = { width: 800, height: 450 };
  if (item.character) item.character.assetId = asset.id;
  return item;
}
export const elementName = (project: Project, e: SceneElement) =>
  e.name ||
  project.characters.find((c) => c.id === e.characterId)?.name ||
  (e.prop ? e.prop[0].toUpperCase() + e.prop.slice(1) : "Artwork");
export function resolvedCharacter(
  project: Project,
  e?: SceneElement,
): Character | undefined {
  const c = project.characters.find((c) => c.id === e?.characterId);
  return c && e ? { ...c, ...e.appearance, name: e.name || c.name } : undefined;
}
export function starterLibrary(): LibraryItem[] {
  const characters = ["Pip", "Sunny"].map((name, i) => ({
    ...newLibraryItem(name),
    id: `starter-character-${i}`,
    group: "Original starters",
    character: {
      ...freshCharacter(name),
      shirt: i ? "#8e86d4" : "#f3b749",
      accessory: i ? ("bow" as const) : ("cap" as const),
    },
  }));
  return [
    ...characters,
    ...BACKGROUNDS.map((background) => ({
      ...newLibraryItem(
        (
          {
            meadow: "Park",
            town: "Town street",
            moonlight: "Moonlit park",
            magical: "Magical world",
          } as Record<string, string>
        )[background] || background[0].toUpperCase() + background.slice(1),
        "background",
      ),
      id: `starter-background-${background}`,
      background,
      group: "Original starters",
    })),
    ...PROPS.map((prop) => ({
      ...newLibraryItem(prop[0].toUpperCase() + prop.slice(1), "prop"),
      id: `starter-prop-${prop}`,
      prop,
      group: "Original starters",
    })),
  ];
}
export function validateLibraryItem(value: unknown): LibraryItem {
  const bad = () => {
    throw new Error(
      "This saved artwork is invalid or unsupported. Existing projects are unchanged.",
    );
  };
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 100 ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 80 ||
    !["character", "background", "prop", "drawing"].includes(
      String(value.kind),
    ) ||
    typeof value.group !== "string" ||
    value.group.length > 80 ||
    !Array.isArray(value.tags) ||
    value.tags.length > 15 ||
    !value.tags.every((t) => typeof t === "string" && t.length <= 40) ||
    !Array.isArray(value.assets) ||
    value.assets.length > (record(value.character) && value.character.puppet ? 20 : 4) ||
    !record(value.transform) ||
    !Object.keys(value.transform).every((k) =>
      [
        "crop",
        "opacity",
        "rotation",
        "flip",
        "flipY",
        "width",
        "height",
      ].includes(k),
    ) ||
    !POSES.includes(value.pose as Pose) ||
    !["happy", "sad", "calm", "surprised", "excited", "worried"].includes(
      String(value.emotion),
    ) ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    return bad();
  const item = value as unknown as LibraryItem;
  if (item.kind === "character" && !item.character) return bad();
  if (item.assetId && !item.assets.some((a) => a.id === item.assetId))
    return bad();
  if (
    item.kind === "drawing" &&
    (!item.assetId || !item.assets.find((a) => a.id === item.assetId)?.drawing)
  )
    return bad();
  if (
    item.kind === "background" &&
    !item.assetId &&
    !BACKGROUNDS.includes(item.background!)
  )
    return bad();
  if (item.kind === "prop" && !item.assetId && !PROPS.includes(item.prop!))
    return bad();
  const character = item.character ?? freshCharacter("Validation character");
  const scene = makeScene([character]);
  scene.elements[0] = {
    ...scene.elements[0],
    ...item.transform,
    pose: item.pose,
    emotion: item.emotion,
  };
  validateProject({
    schemaVersion: 4,
    ...emptyProduction(),
    id: "library-validation",
    title: "Library artwork",
    idea: "",
    lesson: "",
    setting: "",
    mood: "gentle",
    artStyle: "Shapes",
    targetAge: "4–7",
    plannedMinutes: 1,
    outline: { beginning: "", conflict: "", response: "", ending: "" },
    characters: [character],
    scenes: [scene],
    assets: item.assets,
    status: "draft",
    createdAt: item.updatedAt,
    updatedAt: item.updatedAt,
  });
  if (JSON.stringify(item).length > 10 * 1024 * 1024) return bad();
  return clone(item);
}
export function placeLibraryItem(
  source: Project,
  sceneIndex: number,
  sourceItem: LibraryItem,
): Project {
  const item = validateLibraryItem(sourceItem);
  const p = clone(source);
  const scene = p.scenes[sceneIndex];
  if (!scene) throw new Error("Choose a scene first.");
  if (item.kind === "background" && !item.assetId) {
    scene.background = item.background!;
    return validateProject(p);
  }
  if (scene.elements.length >= 20)
    throw new Error(
      "This scene has 20 objects. Remove an object before adding another.",
    );
  const assetMap = new Map<string, string>();
  for (const asset of item.assets) {
    let match = p.assets.find(
      (a) =>
        a.dataUrl === asset.dataUrl &&
        JSON.stringify(a.drawing) === JSON.stringify(asset.drawing),
    );
    if (!match) {
      match = { ...clone(asset), id: uid() };
      p.assets.push(match);
    }
    assetMap.set(asset.id, match.id);
  }
  let characterId = "";
  if (item.character) {
    const c = {
      ...clone(item.character),
      name: item.name,
      ...(item.character.puppet ? { puppet: remapPuppetAssets(item.character.puppet, assetMap) } : {}),
      assetId: item.character.assetId
        ? assetMap.get(item.character.assetId)
        : undefined,
    };
    const same = p.characters.find(
      (a) =>
        a.name === c.name &&
        a.shirt === c.shirt &&
        a.skin === c.skin &&
        a.hair === c.hair &&
        a.accessory === c.accessory &&
        a.assetId === c.assetId && JSON.stringify(a.puppet) === JSON.stringify(c.puppet),
    );
    if (same) characterId = same.id;
    else {
      c.id = uid();
      p.characters.push(c);
      characterId = c.id;
    }
  }
  const background = item.kind === "background";
  const element: SceneElement = {
    id: uid(),
    characterId,
    kind: item.character
      ? "character"
      : item.prop && !item.assetId
        ? "prop"
        : "art",
    prop: item.prop,
    assetId: item.assetId ? assetMap.get(item.assetId) : undefined,
    sourceLibraryId: item.id,
    name: item.name,
    x: 400,
    y: background ? 450 : 340,
    scale: 1,
    rotation: 0,
    flip: false,
    opacity: 1,
    motion: "still",
    emotion: item.emotion,
    pose: item.pose,
    backdrop: background,
    ...(background ? { width: 800, height: 450 } : {}),
    ...item.transform,
  };
  if (background) scene.elements.unshift(element);
  else scene.elements.push(element);
  return validateProject(p);
}
export function libraryItemFromElement(
  p: Project,
  e: SceneElement,
): LibraryItem {
  const c = resolvedCharacter(p, e);
  const kind: LibraryKind = e.backdrop
    ? "background"
    : c
      ? "character"
      : e.prop
        ? "prop"
        : "drawing";
  const item = newLibraryItem(elementName(p, e), kind);
  item.character = c ? clone(c) : undefined;
  item.prop = e.prop;
  const aid = e.assetId ?? c?.assetId;
  const needed = new Set([aid, ...(c?.puppet ? puppetAssetIds(c.puppet) : [])]);
  item.assets = p.assets.filter(a => needed.has(a.id)).map(clone);
  item.assetId = aid;
  if (!c && !e.prop && !item.assets[0]?.drawing && !e.backdrop)
    item.kind = "prop";
  item.transform = {
    crop: e.crop,
    opacity: e.opacity,
    rotation: e.rotation,
    flip: e.flip,
    flipY: e.flipY,
    width: e.width,
    height: e.height,
  };
  item.pose = e.pose ?? "standing";
  item.emotion = e.emotion;
  return validateLibraryItem(item);
}
export async function listLibrary(): Promise<LibraryItem[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("library", "readonly");
    const req = tx.objectStore("library").getAll();
    tx.oncomplete = () => {
      try {
        resolve(
          req.result
            .map(validateLibraryItem)
            .sort((a: LibraryItem, b: LibraryItem) =>
              b.updatedAt.localeCompare(a.updatedAt),
            ),
        );
      } catch (e) {
        reject(e);
      }
    };
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
export async function saveLibraryItem(
  item: LibraryItem,
  create = false,
): Promise<void> {
  const validated = validateLibraryItem(item);
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("library", "readwrite");
    const store = tx.objectStore("library");
    const request = create ? store.add(validated) : store.put(validated);
    request.onerror = () =>
      reject(
        request.error ?? tx.error ?? new Error("Artwork could not be saved."),
      );
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function removeLibraryItem(id: string): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("library", "readwrite");
    tx.objectStore("library").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function readPalette(): Promise<string[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("settings", "readonly");
    const req = tx.objectStore("settings").get("palette");
    tx.oncomplete = () =>
      resolve(
        Array.isArray(req.result)
          ? req.result
              .filter(
                (c: unknown) =>
                  typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
              )
              .slice(0, 16)
          : [],
      );
    tx.onerror = () => reject(tx.error);
  });
}
export async function savePalette(colors: string[]): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("settings", "readwrite");
    tx.objectStore("settings").put(colors.slice(0, 16), "palette");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
