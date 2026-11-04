import { captionBand } from "./captions";
import { stagePoint } from "./interaction-motion";
import type { Point } from "./interaction-model";
import type { Project, Scene, SceneElement } from "./model";
import type { FocusGraphic } from "./focus-model";
import { focusWindow } from "./focus-model";
import { sceneryOffset } from "./world-model";

type Transform = { x: number; y: number; rotation: number; scale: number };
type Camera = { x: number; y: number; zoom: number };
type Band = NonNullable<ReturnType<typeof captionBand>>;
export type Rectangle = { x: number; y: number; width: number; height: number };
export const clampFocus = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export function projectFocusPoint(scene: Scene, element: SceneElement, frame: Transform, camera: Camera, local: Point, calm = false) {
  const point = stagePoint(element, frame, local);
  const depth = sceneryOffset(scene, element, camera, calm);
  return {
    x: 400 + (point.x + depth.x - camera.x) * camera.zoom,
    y: 225 + (point.y + depth.y - camera.y) * camera.zoom,
  };
}

export function focusAnchor(scene: Scene, graphic: FocusGraphic, frames: ReadonlyMap<string, Transform>, camera: Camera, calm = false) {
  const { target } = graphic;
  if (target.kind !== "object") return { x: target.x, y: target.y };
  const element = scene.elements.find(item => item.id === target.id);
  const frame = frames.get(target.id);
  return element && frame ? projectFocusPoint(scene, element, frame, camera, { x: target.dx, y: target.dy }, calm) :
    { x: target.x, y: target.y };
}

export function focusTiming(scene: Scene, graphic: FocusGraphic, time: number, calm = false) {
  const { start, end } = focusWindow(scene, graphic);
  if (time < start || time >= end) return;
  if (calm) return { opacity: 1, progress: 1 };
  const elapsed = time - start;
  const fadeScale = Math.min(1, (end - start) / (graphic.fadeIn + graphic.fadeOut || 1));
  const opacity = Math.min(1, graphic.fadeIn ? elapsed / (graphic.fadeIn * fadeScale) : 1,
    graphic.fadeOut ? (end - time) / (graphic.fadeOut * fadeScale) : 1);
  const progress = graphic.reveal ? Math.min(1, elapsed / Math.min(0.45, (end - start) / 2)) : 1;
  return { opacity, progress };
}

export function sceneCaptionBand(project: Pick<Project, "captions" | "captionStyle">, scene: Scene) {
  // Reserve enough room for the scene's authored captions, independent of playback visibility.
  const texts = project.captions.filter(caption => caption.sceneId === scene.id).map(caption => caption.text);
  return captionBand(texts, project.captionStyle);
}

export function intersects(a: Rectangle, b: Rectangle) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function textLines(value: string, limit: number) {
  const words = value.trim().split(/\s+/u).filter(Boolean).flatMap(word => {
    const characters = [...word];
    return Array.from({ length: Math.ceil(characters.length / limit) },
      (_, index) => characters.slice(index * limit, (index + 1) * limit).join(""));
  });
  const result: string[] = [];
  for (const word of words) {
    const previous = result.at(-1);
    if (previous && [...previous, ...word].length + 1 <= limit) result[result.length - 1] = `${previous} ${word}`;
    else result.push(word);
  }
  return result.length > 3 ? [...result.slice(0, 2), `${[...result[2]].slice(0, limit - 1).join("")}…`] : result;
}

export function focusLayout(graphic: FocusGraphic, point: Point, band?: Band) {
  const radius = graphic.size / 2;
  const edge = 12;
  const top = band && band.y < 225 ? band.y + band.height + 8 : edge;
  const bottom = band && band.y >= 225 ? band.y - 8 : 450 - edge;
  const side = point.x < 400 ? 1 : -1;
  const hasText = !!graphic.text.trim();
  const maxWidth = graphic.kind === "card" ? clampFocus(graphic.size * 3.6, 170, 320) : clampFocus(graphic.size * 3.3, 155, 266);
  const font = graphic.textSize;
  const lines = hasText ? textLines(graphic.text, Math.floor((maxWidth - 26) / (font * 0.66))) : [];
  const textWidth = Math.min(maxWidth, Math.max(58, ...lines.map(line => [...line].length * font * 0.68 + 26)));
  const textHeight = lines.length * (font + 4) + 18;
  const hasBox = lines.length > 0;
  const offset = graphic.kind === "number" ? radius + 9 : graphic.kind === "circle" || graphic.kind === "spotlight"
    ? radius + 12 : graphic.kind === "arrow" ? 25 : 16;
  const isTextGraphic = graphic.kind === "label" || graphic.kind === "card";
  const desiredX = graphic.target.kind === "object" || !isTextGraphic
    ? point.x + side * (offset + textWidth / 2) : point.x;
  const desiredY = graphic.target.kind === "object" || !isTextGraphic ? point.y - 22 : point.y;
  const preferred = { x: desiredX - textWidth / 2, y: desiredY - textHeight / 2, width: textWidth, height: textHeight };
  const box = hasBox ? { ...preferred,
    x: clampFocus(preferred.x, edge, 800 - edge - textWidth),
    y: clampFocus(preferred.y, top, bottom - textHeight),
  } : undefined;
  const marker = graphic.kind === "number" ? {
    x: clampFocus(point.x, edge + radius, 800 - edge - radius),
    y: clampFocus(point.y, top + radius, bottom - radius),
  } : point;
  const tail = {
    x: clampFocus(point.x + side * graphic.size * 0.85, edge, 800 - edge),
    y: clampFocus(point.y - graphic.size * 0.71, top, bottom),
  };
  const theta = Math.atan2(point.y - tail.y, point.x - tail.x);
  const arrow = [
    `M${tail.x} ${tail.y}L${point.x} ${point.y}`,
    ...[-0.55, 0.55].map(offset =>
      `M${point.x - 13 * Math.cos(theta + offset)} ${point.y - 13 * Math.sin(theta + offset)}L${point.x} ${point.y}`),
  ].join(" ");
  const targetBounds = { x: point.x - radius, y: point.y - radius, width: 2 * radius, height: 2 * radius };
  return { lines, box, marker, radius, arrow,
    captionOverlap: !!band && ((hasBox && intersects(preferred, band)) ||
      (!isTextGraphic && intersects(targetBounds, band))),
  };
}

export function focusContrast(ink: string, paper: string) {
  function luminance(color: string) {
    const bytes = [1, 3, 5].map(start => Number.parseInt(color.slice(start, start + 2), 16) / 255)
      .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return bytes[0] * 0.2126 + bytes[1] * 0.7152 + bytes[2] * 0.0722;
  }
  const a = luminance(ink), b = luminance(paper);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
