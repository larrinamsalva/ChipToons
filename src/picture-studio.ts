import { FULL_CROP, validCrop } from "./art-model";
import type { Crop } from "./art-model";
import { readImage } from "./files";
import { freshCharacter, newLibraryItem } from "./library";
import { makeScene, uid, validateProject } from "./model";
import type { Asset, Project, Scene } from "./model";
import { starterProject } from "./planner";
import type { PicturePanel } from "./picture-model";
import type { PartRole, PuppetPart } from "./puppet-model";
import { clamp, cleanSceneReferences } from "./timeline";

export interface Panel extends PicturePanel {
  visible: boolean;
}
export interface Point { x: number; y: number }
export interface Mask { points: Point[]; subtract: boolean }
export interface Cutout {
  asset: Asset;
  center: Point;
  width: number;
  height: number;
}
export interface PreparedPart { role: PartRole; cutout: Cutout }

export const MAX_MASKS = 24;
export const MAX_POINTS = 100;
export const defaultPanel: Panel = { name: "My picture panel", crop: FULL_CROP, rotation: 0, visible: false };

export function cropBetween(a: Point, b: Point): Crop {
  const left = Math.min(a.x, b.x, 0.95), top = Math.min(a.y, b.y, 0.95);
  return {
    left, top,
    width: Math.max(0.05, Math.max(a.x, b.x) - left),
    height: Math.max(0.05, Math.max(a.y, b.y) - top),
  };
}

export function editCrop(crop: Crop, field: keyof Crop, value: number): Crop {
  if (!Number.isFinite(value)) return crop;
  if (field === "left") return { ...crop, left: clamp(value, 0, 1 - crop.width) };
  if (field === "top") return { ...crop, top: clamp(value, 0, 1 - crop.height) };
  if (field === "width") return { ...crop, width: clamp(value, 0.05, 1 - crop.left) };
  return { ...crop, height: clamp(value, 0.05, 1 - crop.top) };
}

const panel = (name: string, left: number, top: number, width: number, height: number): Panel =>
  ({ name, crop: { left, top, width, height }, rotation: 0, visible: false });

export const fixersPanels: Panel[] = [
  panel("Workshop and presenter", 0.02, 0.01, 0.37, 0.77),
  panel("Workshop safety", 0.60, 0.01, 0.17, 0.29),
  panel("Chair repair", 0.78, 0.01, 0.21, 0.20),
  panel("Fan inspection", 0.77, 0.22, 0.22, 0.17),
  panel("Birdhouse challenge", 0.77, 0.40, 0.22, 0.17),
  panel("Team celebration", 0.77, 0.58, 0.22, 0.20),
];

const fixersPlan = [
  ["Cold Open", 60, 0, "Notice the wobbling chair. Set it aside until an adult checks it."],
  ["Welcome", 60, 0, "Introduce the Little Fixers Club and its repair-and-reuse lesson."],
  ["Safety First", 60, 1, "Clear the workspace and ask a grown-up before using tools."],
  ["Tools & Materials", 60, 1, "Identify tools and safety glasses with an adult."],
  ["Find the Problem", 120, 2, "Observe the loose chair joint while a grown-up holds the chair steady."],
  ["Fix the Chair · Inspect", 120, 2, "Let a grown-up decide whether the chair can be repaired safely."],
  ["Fix the Chair · Repair", 120, 2, "Watch the grown-up repair the joint using the right tools."],
  ["Fix the Chair · Check", 60, 2, "Wait for the grown-up to check the repair before anyone sits."],
  ["Bonus Fix: Fan", 120, 3, "A grown-up unplugs and checks the fan. Children observe from a safe distance."],
  ["Reuse & Upcycle", 120, 4, "Sort reusable wood. An adult handles cutting and sharp tools."],
  ["Team Challenge", 120, 4, "Take turns planning a birdhouse and choosing safe materials."],
  ["Test & Celebrate", 120, 5, "Review what the team repaired, reused, and built together."],
  ["Wrap-Up", 60, 5, "Recall one safe step and one way to reuse something."],
] as const;

export async function loadFixersPoster() {
  const response = await fetch(`${import.meta.env.BASE_URL}examples/little-fixers.png`);
  if (!response.ok) throw new Error("The Little Fixers Club picture could not be opened.");
  return readImage(new File([await response.blob()], "little-fixers.png", { type: "image/png" }));
}

export function sourcePanel(project: Project, index: number): Panel {
  const scene = project.scenes[index];
  const element = scene?.elements.find(item => item.backdrop && item.assetId === project.pictureSourceId);
  return { ...defaultPanel, ...scene?.picturePanel, visible: !!element };
}

export function applyPanel(scene: Scene, source: Asset, value: Panel): Scene {
  if (!validCrop(value.crop)) throw new Error("Choose a panel inside the picture.");
  const old = scene.elements.find(item => item.backdrop && item.assetId === source.id);
  const panel = { name: value.name.trim().slice(0, 80) || defaultPanel.name, crop: value.crop, rotation: value.rotation };
  if (!value.visible) return old
    ? cleanSceneReferences({ ...scene, picturePanel: panel, elements: scene.elements.filter(item => item !== old) }, scene)
    : { ...scene, picturePanel: panel };
  const cropWidth = (source.sourceWidth ?? 800) * value.crop.width;
  const cropHeight = (source.sourceHeight ?? 450) * value.crop.height;
  const scale = Math.min(800 / cropWidth, 450 / cropHeight);
  const width = Math.max(10, cropWidth * scale), height = Math.max(10, cropHeight * scale);
  const entry = {
    id: old?.id ?? uid(), kind: "art" as const, characterId: "", assetId: source.id, backdrop: true,
    name: panel.name, crop: panel.crop,
    x: 400, y: (450 + height) / 2, width, height, scale: 1,
    rotation: clamp(value.rotation, -180, 180), flip: false,
    emotion: "calm" as const, motion: "still" as const, opacity: 1,
  };
  if (!old && scene.elements.length === 20) throw new Error("Remove an object before adding a picture panel to this scene.");
  return { ...scene, picturePanel: panel,
    elements: old ? scene.elements.map(item => item === old ? { ...item, ...entry } : item) : [entry, ...scene.elements] };
}

export function newPictureProject(source: Asset, selection: Panel, fixers: boolean): Project {
  const base = starterProject();
  const scenes = fixers ? fixersPlan.map(([name, duration, suggestion, action], index) => applyPanel({
    ...makeScene([]), title: name, duration, background: "classroom", narration: "", dialogue: "", action,
  }, source, index === 0 ? selection : fixersPanels[suggestion])) : [applyPanel({
    ...makeScene([]), title: selection.name.trim() || "My first scene", duration: 10,
    background: "classroom", narration: "", dialogue: "", action: "Plan what will happen in this scene.",
  }, source, selection)];
  return validateProject({
    ...base, title: fixers ? "Little Fixers Club — Fix It, Don’t Toss It!" : "My Picture Cartoon",
    creationSource: "image", pictureSourceId: source.id, assets: [source],
    ...(fixers ? { templateId: "little-fixers-picture" } : {}),
    characters: [freshCharacter("Story host")], plannedMinutes: fixers ? 20 : 1, scenes,
    idea: fixers ? "Little Fixers learn to work safely and give everyday things a second chance." : "Turn an original picture into an editable cartoon.",
    lesson: fixers ? "Be safe. Repair, reuse, and rebuild together." : "",
    setting: fixers ? "Little Fixers workshop" : "",
    outline: { beginning: "", conflict: "", response: "", ending: "" },
  });
}

export async function pictureImage(source: Asset) {
  const image = new Image();
  image.src = source.dataUrl;
  await image.decode();
  return image;
}

export async function pictureCutout(image: HTMLImageElement, masks: Mask[], name: string): Promise<Cutout> {
  const added = masks.filter(mask => !mask.subtract).flatMap(mask => mask.points);
  if (!added.length) throw new Error("Add an outline around visible artwork first.");
  if (masks.length > MAX_MASKS || masks.some(mask => mask.points.length < 3 || mask.points.length > MAX_POINTS ||
    mask.points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)))
    throw new Error("Use at least three points per outline and stay inside the picture.");
  const iw = image.naturalWidth, ih = image.naturalHeight;
  const left = Math.floor(Math.min(...added.map(point => point.x * iw)));
  const top = Math.floor(Math.min(...added.map(point => point.y * ih)));
  const width = Math.ceil(Math.max(...added.map(point => point.x * iw))) - left;
  const height = Math.ceil(Math.max(...added.map(point => point.y * ih))) - top;
  if (width < 2 || height < 2) throw new Error("Outline a larger area of the picture.");
  const scale = Math.min(1, 768 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not prepare a cutout.");
  ctx.scale(scale, scale);
  ctx.translate(-left, -top);
  for (const mask of masks) {
    ctx.save();
    ctx.beginPath();
    for (const [index, point] of mask.points.entries()) {
      if (index === 0) ctx.moveTo(point.x * iw, point.y * ih);
      else ctx.lineTo(point.x * iw, point.y * ih);
    }
    ctx.closePath();
    ctx.clip("evenodd");
    if (mask.subtract) ctx.clearRect(left, top, width + 1, height + 1);
    else ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!pixels.some((alpha, index) => index % 4 === 3 && alpha > 0))
    throw new Error("This selection is fully transparent. Restore an area or choose other artwork.");
  return {
    asset: { id: uid(), name, mime: "image/png", type: "image", dataUrl: canvas.toDataURL(),
      sourceWidth: canvas.width, sourceHeight: canvas.height },
    center: { x: left + width / 2, y: top + height / 2 }, width, height,
  };
}

export function picturePuppet(name: string, prepared: PreparedPart[]) {
  const body = prepared.find(item => item.role === "torso") ?? prepared[0];
  if (!body) throw new Error("Prepare at least one part first.");
  const scale = 120 / Math.max(body.cutout.width, body.cutout.height,
    ...prepared.map(item => Math.max(item.cutout.width, item.cutout.height)));
  const origin = body.cutout.center;
  const parts: PuppetPart[] = prepared.map(({ role, cutout }) => {
    const face = role === "eyes" || role === "mouth";
    const parent = role === body.role ? undefined : (face ? prepared.find(item => item.role === "head") : undefined) ?? body;
    const center = parent?.cutout.center ?? origin;
    const width = Math.max(8, cutout.width * scale), height = Math.max(8, cutout.height * scale);
    return { id: role, role, assetId: cutout.asset.id, parentId: parent?.role,
      x: clamp((cutout.center.x - center.x) * scale, -320, 320),
      y: clamp((cutout.center.y - center.y) * scale - (parent ? 0 : 100), -320, 320),
      width, height, pivotX: 0, pivotY: 0 };
  });
  const title = name.trim().slice(0, 80) || "Picture puppet";
  return {
    ...newLibraryItem(title, "character"),
    character: { ...freshCharacter(title), puppet: {
      version: 1 as const, description: "Raster pieces traced from an original picture.", face: false, parts, poses: [],
    } },
    assets: prepared.map(item => item.cutout.asset),
  };
}
