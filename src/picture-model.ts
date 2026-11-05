import { record, validCrop } from "./art-model";
import type { Crop } from "./art-model";

export interface PicturePanel {
  name: string;
  crop: Crop;
  rotation: number;
}

export function picturePanelValid(value: unknown): value is PicturePanel {
  return record(value) && Object.keys(value).every(key => ["name", "crop", "rotation"].includes(key)) &&
    typeof value.name === "string" && !!value.name.trim() && value.name.length <= 80 &&
    validCrop(value.crop) && typeof value.rotation === "number" && Number.isFinite(value.rotation) &&
    Math.abs(value.rotation) <= 180;
}
