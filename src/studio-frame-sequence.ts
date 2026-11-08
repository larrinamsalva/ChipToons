import type { Asset, Project, SceneElement } from "./model";
import { FRAME_SEQUENCE_RATES, MAX_FRAME_SEQUENCE_FILES, MAX_FRAME_SEQUENCE_BYTES } from "./frame-sequence-model";
import type { FrameSequenceRate } from "./frame-sequence-model";
import { MAX_ASSET_BYTES, makeScene, uid, validateProject } from "./model";
import { readImage } from "./files";
import { starterProject } from "./planner";
import { emptyProduction } from "./media-model";

export function numberedPngFrames(files: readonly File[]): File[] {
  if (files.length < 2 || files.length > MAX_FRAME_SEQUENCE_FILES)
    throw new Error("Choose 2–24 numbered PNG frames from a single export.");
  const parsed = files.map(file => {
    const name = /^(.*?)(\d{1,6})\.png$/i.exec(file.name);
    if (!name || !name[1] || file.type !== "image/png")
      throw new Error("Use numbered PNG filenames such as frame_0001.png, frame_0002.png.");
    if (!file.size || file.size > MAX_ASSET_BYTES)
      throw new Error(`The file ${file.name} must be nonempty and no larger than 4 MB.`);
    return { file, prefix: name[1].toLowerCase(), digits: name[2].length, index: Number(name[2]) };
  });
  const total = parsed.reduce((sum, item) => sum + item.file.size, 0);
  if (total > MAX_FRAME_SEQUENCE_BYTES)
    throw new Error("The complete PNG sequence must be 24 MB or smaller. Export shorter parts.");
  const { prefix, digits } = parsed[0];
  if (parsed.some(item => item.prefix !== prefix || item.digits !== digits))
    throw new Error("Use one frame filename prefix and the same number of digits for every frame.");
  parsed.sort((a, b) => a.index - b.index);
  if (parsed[0].index !== 0 && parsed[0].index !== 1)
    throw new Error("The numbered sequence must start at frame 0000 or 0001.");
  if (parsed.some((item, i) => item.index !== parsed[0].index + i))
    throw new Error("The PNG sequence has a missing or duplicate frame. Select a complete consecutive set.");
  return parsed.map(item => item.file);
}

export function projectFromFrameAssets(assets: Asset[], fps: FrameSequenceRate, filename: string): Project {
  if (!FRAME_SEQUENCE_RATES.includes(fps) || assets.length < 2 ||
      assets.length > MAX_FRAME_SEQUENCE_FILES)
    throw new Error("Choose 2–24 PNG frames and a supported playback speed.");
  const title = filename.replace(/[_ -]+$/, "").trim().slice(0, 75) || "Framefield";
  const p = starterProject("safety");
  Object.assign(p, emptyProduction());
  const scene = makeScene(p.characters);
  scene.title = "Imported numbered PNG animation";
  scene.narration = "";
  scene.dialogue = "";
  scene.action = "Original ordered PNG frames, displayed in sync with the scene clock.";
  scene.duration = Math.max(2, Math.ceil(assets.length / fps));
  scene.background = "classroom";
  scene.camera = "wide";
  scene.transition = "cut";
  const element: SceneElement = {
    id: uid(), characterId: "", kind: "art", assetId: assets[0].id,
    frameSequence: { fps, assetIds: assets.map(asset => asset.id) },
    name: "Imported Framefield frames",
    x: 400, y: 450, scale: 1, rotation: 0, flip: false,
    width: 800, height: 450, emotion: "calm", motion: "still",
  };
  scene.elements = [element];
  p.title = `${title} · PNG animation`;
  p.templateId = "frame-sequence-import";
  p.creationSource = "image";
  p.idea = "Animate a complete, user-selected numbered PNG frame sequence.";
  p.lesson = "Creative storytelling with original artwork.";
  p.setting = "Original locally imported animation frames.";
  p.artStyle = "Original 2D rendered PNG frames from a separate creator tool.";
  p.plannedMinutes = 1;
  p.outline = {
    beginning: "The original frames begin.",
    conflict: "The short imported shot continues.",
    response: "Every numbered image appears in sequence.",
    ending: "The final original image holds until the scene ends.",
  };
  p.assets = assets;
  p.scenes = [scene];
  return validateProject(p);
}

export async function importNumberedPngSequence(files: readonly File[], fps: number): Promise<Project> {
  if (!FRAME_SEQUENCE_RATES.some(rate => rate === fps))
    throw new Error("Choose a supported frame rate (2, 4, 8, or 12 fps).");
  const ordered = numberedPngFrames(files);
  const assets: Asset[] = [];
  for (const file of ordered) {
    const asset = await readImage(file); // signature and decoded dimensions
    if (!asset.sourceWidth || !asset.sourceHeight ||
        asset.sourceWidth > 1280 || asset.sourceHeight > 720)
      throw new Error("Use matching PNG frames up to 1280 × 720 pixels.");
    if (assets.length && (assets[0].sourceWidth !== asset.sourceWidth ||
        assets[0].sourceHeight !== asset.sourceHeight))
      throw new Error("Every PNG frame must have exactly the same width and height.");
    assets.push(asset);
  }
  const stem = ordered[0].name.replace(/\d{1,6}\.png$/i, "");
  return projectFromFrameAssets(assets, fps as FrameSequenceRate, stem);
}
