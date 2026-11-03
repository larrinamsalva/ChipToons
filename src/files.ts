import { episodePackage } from "./episode-package";
import { MAX_ASSET_BYTES, MAX_PROJECT_BYTES, parseBackup, uid } from "./model";
import type { Asset, Project } from "./model";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export const safeFilename = (title: string) =>
  title
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "chiptoons-story";
export function exportProject(project: Project) {
  if (project.audioAssets.some((a) => a.file)) {
    const progress = (detail: { phase: string; fraction: number }) =>
      window.dispatchEvent(
        new CustomEvent("chiptoons-backup-progress", { detail }),
      );
    void episodePackage(project, { onProgress: progress })
      .then((blob) => {
        downloadBlob(blob, `${safeFilename(project.title)}.ctepisode`);
        progress({ phase: "Complete episode backup ready. Check your browser downloads.", fraction: 1 });
      })
      .catch((e) =>
        window.dispatchEvent(
          new CustomEvent("chiptoons-backup-error", {
            detail:
              e instanceof Error
                ? e.message
                : "Backup failed. Your project is unchanged.",
          }),
        ),
      );
    return;
  }
  downloadBlob(
    new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
    `${safeFilename(project.title)}.chiptoons.json`,
  );
}
export async function readProject(file: File): Promise<Project> {
  if (file.size > MAX_PROJECT_BYTES)
    throw new Error("Choose a project backup smaller than 64 MB.");
  return parseBackup(await file.text());
}
export async function readImage(file: File): Promise<Asset> {
  const types = ["image/png", "image/jpeg", "image/webp"] as const;
  if (!types.some((t) => t === file.type))
    throw new Error(
      "Choose a PNG, JPEG, or WebP image. SVG import is not available in this version.",
    );
  if (!file.size || file.size > MAX_ASSET_BYTES)
    throw new Error("Choose an image smaller than 4 MB.");
  const buffer = new Uint8Array(await file.arrayBuffer());
  const matches =
    file.type === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => buffer[i] === b)
      : file.type === "image/jpeg"
        ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
        : String.fromCharCode(...buffer.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...buffer.slice(8, 12)) === "WEBP";
  if (!matches)
    throw new Error(
      "This file does not contain the image type it claims to be.",
    );
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("This image could not be read."));
    reader.readAsDataURL(file);
  });
  const dimensions = await new Promise<{
    sourceWidth: number;
    sourceHeight: number;
  }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth * image.naturalHeight > 24_000_000)
        reject(
          new Error(
            "This image is too large to edit comfortably. Choose an image under 24 megapixels.",
          ),
        );
      else
        resolve({
          sourceWidth: image.naturalWidth,
          sourceHeight: image.naturalHeight,
        });
    };
    image.onerror = () => reject(new Error("This image could not be opened."));
    image.src = dataUrl;
  });
  return {
    id: uid(),
    name: file.name.slice(0, 160),
    type: "image",
    mime: file.type as Asset["mime"],
    dataUrl,
    ...dimensions,
  };
}
const escapeXml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
function wrap(text: string, width: number) {
  const words = text
    .split(/\s+/)
    .flatMap((word) => word.match(new RegExp(`.{1,${width}}`, "g")) ?? []);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length + word.length > width && line) {
      lines.push(line);
      line = word;
    } else line += `${line ? " " : ""}${word}`;
  }
  if (line) lines.push(line);
  return lines;
}
export function storyboardSvg(project: Project): string {
  const width = 1000;
  let nextY = 100;
  const rows = project.scenes
    .map((s, i) => {
      const stage = document.querySelector(`[data-scene-thumbnail="${i}"] svg`);
      const visual = stage ? new XMLSerializer().serializeToString(stage) : "";
      const lines = wrap(s.narration, 61);
      const dialogue = wrap(s.dialogue, 61);
      const titles = wrap(`${i + 1}. ${s.title}`, 75);
      const header = 30 + titles.length * 24;
      const rowHeight = Math.max(
        280 + titles.length * 24,
        header + 70 + (lines.length + dialogue.length) * 20,
      );
      const y = nextY;
      nextY += rowHeight + 20;
      return `<g transform="translate(30 ${y})"><rect width="940" height="${rowHeight}" rx="16" fill="#fff" stroke="#d7d7d7"/><svg x="15" y="${header}" width="365" height="210" viewBox="0 0 800 450">${visual.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg><g font-family="Arial,sans-serif" fill="#242b42">${titles.map((l, j) => `<text x="20" y="${30 + j * 24}" font-weight="700" font-size="20">${escapeXml(l)}</text>`).join("")}<text x="400" y="${header + 5}" font-size="14">${s.duration}s · ${escapeXml(s.background)} · ${escapeXml(s.camera)} camera</text>${lines.map((l, j) => `<text x="400" y="${header + 35 + j * 20}" font-size="15">${escapeXml(l)}</text>`).join("")}${dialogue.map((l, j) => `<text x="400" y="${header + 57 + lines.length * 20 + j * 20}" font-size="14">${escapeXml(l)}</text>`).join("")}</g></g>`;
    })
    .join("");
  const height = nextY + 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fffaf1"/><text x="30" y="45" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#242b42">${escapeXml(project.title)}</text><text x="30" y="74" font-family="Arial,sans-serif" font-size="15" fill="#555">ChipToons Studio · ${project.scenes.length} scenes · Original storyboard</text>${rows}</svg>`;
}
