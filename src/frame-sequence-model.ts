import type { Asset, SceneElement } from "./model";

export const FRAME_SEQUENCE_RATES = [2, 4, 8, 12] as const;
export type FrameSequenceRate = (typeof FRAME_SEQUENCE_RATES)[number];
export const MAX_FRAME_SEQUENCE_FILES = 24;
export const MAX_FRAME_SEQUENCE_BYTES = 24 * 1024 * 1024;

/** Optional sequence metadata for a standard editable art element. */
export interface FrameSequence {
  fps: FrameSequenceRate;
  assetIds: string[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validates the entire sequence graph during project/backup validation. */
export function validFrameSequence(
  value: unknown,
  element: Pick<SceneElement, "kind" | "assetId">,
  assets: ReadonlyMap<string, Asset>,
  duration: number,
): value is FrameSequence {
  if (!record(value) || Object.keys(value).some(key => key !== "fps" && key !== "assetIds") ||
      !FRAME_SEQUENCE_RATES.some(rate => rate === value.fps) ||
      !Array.isArray(value.assetIds) ||
      value.assetIds.length < 2 || value.assetIds.length > MAX_FRAME_SEQUENCE_FILES ||
      element.kind !== "art" || !element.assetId ||
      value.assetIds[0] !== element.assetId ||
      value.assetIds.length / (value.fps as number) > duration + 1e-7) return false;

  let size = 0;
  const ids = new Set<string>();
  let width: number | undefined, height: number | undefined;
  for (const id of value.assetIds) {
    if (typeof id !== "string" || ids.has(id)) return false;
    const asset = assets.get(id);
    if (!asset || asset.mime !== "image/png" ||
        !asset.sourceWidth || !asset.sourceHeight) return false;
    if (width === undefined) { width = asset.sourceWidth; height = asset.sourceHeight; }
    if (width !== asset.sourceWidth || height !== asset.sourceHeight ||
        width > 1280 || height! > 720) return false;
    size += Math.ceil(asset.dataUrl.length * 3 / 4);
    if (size > MAX_FRAME_SEQUENCE_BYTES + MAX_FRAME_SEQUENCE_FILES * 64) return false;
    ids.add(id);
  }
  return true;
}

/** One deterministic frame for every preview, seek, screenshot and export. */
export function frameSequenceAssetIdAt(
  element: Pick<SceneElement, "assetId" | "frameSequence">,
  localTime: number,
): string | undefined {
  const sequence = element.frameSequence;
  if (!sequence?.assetIds.length || !Number.isFinite(localTime)) return element.assetId;
  const index = Math.min(sequence.assetIds.length - 1,
    Math.max(0, Math.floor(Math.max(0, localTime) * sequence.fps + 1e-9)));
  return sequence.assetIds[index];
}
