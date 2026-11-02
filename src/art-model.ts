export type Pose = "standing" | "sitting" | "waving" | "walking" | "pointing";
export const POSES: Pose[] = [
  "standing",
  "sitting",
  "waving",
  "walking",
  "pointing",
];
export const PROPS = [
  "chair",
  "table",
  "book",
  "flower",
  "tree",
  "toy",
  "door",
  "sign",
] as const;
export type PropName = (typeof PROPS)[number];
export interface Crop {
  left: number;
  top: number;
  width: number;
  height: number;
}
export const FULL_CROP: Crop = { left: 0, top: 0, width: 1, height: 1 };
export interface DrawObject {
  id: string;
  kind: "stroke" | "rectangle" | "circle" | "ellipse" | "line" | "star";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  stroke: string;
  fill: string;
  lineWidth: number;
  eraser: boolean;
  points: { x: number; y: number }[];
}
export interface DrawingDocument {
  version: 1;
  width: 600;
  height: 400;
  objects: DrawObject[];
}
export const blankDrawing = (): DrawingDocument => ({
  version: 1,
  width: 600,
  height: 400,
  objects: [],
});
export const colorValid = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
export const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export const numberIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
export function validCrop(v: unknown): v is Crop {
  return (
    record(v) &&
    numberIn(v.left, 0, 0.95) &&
    numberIn(v.top, 0, 0.95) &&
    numberIn(v.width, 0.05, 1) &&
    numberIn(v.height, 0.05, 1) &&
    v.left + v.width <= 1.000001 &&
    v.top + v.height <= 1.000001
  );
}
export function validDrawing(value: unknown): value is DrawingDocument {
  if (
    !record(value) ||
    value.version !== 1 ||
    value.width !== 600 ||
    value.height !== 400 ||
    !Array.isArray(value.objects) ||
    value.objects.length > 500
  )
    return false;
  const ids = new Set();
  let points = 0;
  for (const o of value.objects) {
    if (
      !record(o) ||
      typeof o.id !== "string" ||
      !o.id ||
      o.id.length > 100 ||
      ids.has(o.id) ||
      !["stroke", "rectangle", "circle", "ellipse", "line", "star"].includes(
        String(o.kind),
      ) ||
      !numberIn(o.x, -600, 1200) ||
      !numberIn(o.y, -400, 800) ||
      !numberIn(o.width, 1, 1200) ||
      !numberIn(o.height, 1, 800) ||
      !numberIn(o.rotation, -180, 180) ||
      !colorValid(o.stroke) ||
      !(colorValid(o.fill) || o.fill === "transparent") ||
      !numberIn(o.lineWidth, 1, 60) ||
      typeof o.eraser !== "boolean" ||
      !Array.isArray(o.points) ||
      o.points.length > 10000 ||
      !o.points.every(
        (p) => record(p) && numberIn(p.x, 0, 1) && numberIn(p.y, 0, 1),
      )
    )
      return false;
    if (o.kind === "stroke" && !o.points.length) return false;
    points += o.points.length;
    if (points > 50000) return false;
    ids.add(o.id);
  }
  return true;
}

export function rasterSignature(dataUrl: string, mime: string): boolean {
  try {
    const bytes = Array.from(
      atob(dataUrl.slice(dataUrl.indexOf(",") + 1, dataUrl.indexOf(",") + 65)),
      (c) => c.charCodeAt(0),
    );
    return mime === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
      : mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  } catch {
    return false;
  }
}
