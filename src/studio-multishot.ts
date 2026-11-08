import type { Asset, Project, SceneElement } from "./model";
import { makeScene, uid, validateProject } from "./model";
import { readImage } from "./files";
import { numberedPngFrames, projectFromFrameAssets } from "./studio-frame-sequence";
import { FRAME_SEQUENCE_RATES, MAX_FRAME_SEQUENCE_BYTES } from "./frame-sequence-model";
import type { FrameSequenceRate } from "./frame-sequence-model";

export const MAX_STORYBOARD_SHOTS = 3;
export const MAX_STORYBOARD_ASSETS = 40;

export interface NumberedShot {
  prefix: string;
  files: File[];
}

/**
 * Accept independent numbered shots, not mixed-up frames. Native file picker
 * selection order has no bearing on chronological scene order: shot prefixes
 * are sorted with numeric-aware order and each series must be contiguous.
 */
export function groupNumberedShots(files: readonly File[]): NumberedShot[] {
  if (files.length < 4 || files.length > MAX_STORYBOARD_ASSETS)
    throw new Error("Select 4–40 PNG files arranged into 2–3 complete numbered shots.");
  const sum = files.reduce((bytes, file) => bytes + file.size, 0);
  if (sum > MAX_FRAME_SEQUENCE_BYTES)
    throw new Error("All shots together must be 24 MB or smaller.");

  const groups = new Map<string, File[]>();
  for (const file of files) {
    const parts = /^(.*?)(\d{1,6})\.png$/i.exec(file.name);
    if (!parts || !parts[1] || file.type !== "image/png")
      throw new Error("Name each shot consistently, such as shot01_frame_0001.png.");
    const prefix = parts[1].toLowerCase();
    const current = groups.get(prefix) ?? [];
    current.push(file);
    groups.set(prefix, current);
  }
  if (groups.size < 2 || groups.size > MAX_STORYBOARD_SHOTS)
    throw new Error("Use 2–3 distinct shot prefixes, each with at least two numbered PNGs.");

  return [...groups].sort(([left], [right]) =>
    left.localeCompare(right, undefined, { numeric: true })).map(([prefix, group]) => ({
    prefix,
    files: numberedPngFrames(group),
  }));
}

export interface ImportedShotAssets {
  prefix: string;
  assets: Asset[];
}

/**
 * Create a brand-new standard ChipToons cartoon with a scene per shot.
 * Built on the already-validated PR #57 single-shot path; original images,
 * export timing, scene frame sampler and local backup all remain unchanged.
 */
export function projectFromFrameAssetShots(
  shots: readonly ImportedShotAssets[],
  fps: FrameSequenceRate,
): Project {
  if (shots.length < 2 || shots.length > MAX_STORYBOARD_SHOTS ||
      !FRAME_SEQUENCE_RATES.includes(fps))
    throw new Error("Choose 2–3 numbered shots and a supported frame rate.");
  const allAssets = shots.flatMap(shot => shot.assets);
  if (allAssets.length > MAX_STORYBOARD_ASSETS ||
      allAssets.length < shots.length * 2)
    throw new Error("Use no more than 40 total PNG frames, with at least two in each shot.");
  if (shots.some(shot => !shot.prefix.trim() ||
      shot.assets.length < 2 || shot.assets.length > 24))
    throw new Error("Every shot needs a distinct name and 2–24 frames.");
  if (new Set(shots.map(shot => shot.prefix.toLowerCase())).size !== shots.length)
    throw new Error("Every shot needs a distinct filename prefix.");

  const first = shots[0];
  const project = projectFromFrameAssets(first.assets, fps, first.prefix);
  const firstElement = project.scenes[0].elements[0];
  const newScenes = shots.map((shot, index) => {
    const scene = index === 0 ? project.scenes[0] : makeScene(project.characters, index);
    scene.title = `Shot ${index + 1} · ${shot.prefix.slice(0, 80)}`;
    scene.duration = Math.max(2, Math.ceil(shot.assets.length / fps));
    scene.narration = "";
    scene.dialogue = "";
    scene.action = "Render the original numbered PNG animation in the correct shot order.";
    scene.props = "";
    scene.background = "classroom";
    scene.camera = "wide";
    scene.transition = "cut";
    scene.elements = [{
      ...firstElement,
      id: index === 0 ? firstElement.id : uid(),
      assetId: shot.assets[0].id,
      frameSequence: { fps, assetIds: shot.assets.map(asset => asset.id) },
      name: `Rendered shot ${index + 1}`,
    } satisfies SceneElement];
    return scene;
  });

  project.assets = allAssets;
  project.scenes = newScenes;
  project.title = `${first.prefix.replace(/[_ -]+$/, "").slice(0, 65)} · ${shots.length}-shot cartoon`;
  project.templateId = "frame-sequence-storyboard";
  project.idea = "Combine independent rendered 2D animation shots into one editable cartoon.";
  project.outline = {
    beginning: "The first shot introduces the original artwork.",
    conflict: "The story continues in its next rendered shot.",
    response: "The numbered frames play in chronological shot order.",
    ending: "The final shot settles into its last original frame.",
  };
  // A single portable project including every original PNG. Invalid source
  // graphs, duplicate IDs and project-size violations all fail closed.
  return validateProject(project);
}

export async function importMultiShotPngs(files: readonly File[], fps: number): Promise<Project> {
  if (!FRAME_SEQUENCE_RATES.some(rate => rate === fps))
    throw new Error("Choose a supported playback rate (2, 4, 8 or 12 fps).");
  const shots = groupNumberedShots(files);
  const imported: ImportedShotAssets[] = [];
  for (const shot of shots) {
    const assets: Asset[] = [];
    for (const file of shot.files) {
      const asset = await readImage(file);
      if (!asset.sourceWidth || !asset.sourceHeight ||
          asset.sourceWidth > 1280 || asset.sourceHeight > 720)
        throw new Error("Use PNG frames up to 1280 × 720 pixels.");
      if (assets.length && (assets[0].sourceWidth !== asset.sourceWidth ||
          assets[0].sourceHeight !== asset.sourceHeight))
        throw new Error(`Shot ${shot.prefix} has mismatched PNG dimensions.`);
      assets.push(asset);
    }
    imported.push({ prefix: shot.prefix, assets });
  }
  return projectFromFrameAssetShots(imported, fps as FrameSequenceRate);
}
