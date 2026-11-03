import type { CaptionStyle } from "./media-model";
export function captionLines(text: string, fontSize: number) {
  const count = Math.floor(720 / (fontSize * 0.61)),
    words = text
      .split(/\s+/)
      .flatMap((w) => w.match(new RegExp(`.{1,${count}}`, "gu")) ?? []),
    lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length + word.length + 1 > count && line) {
      lines.push(line);
      line = "";
    }
    line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines.length > 4
    ? [...lines.slice(0, 3), `${lines[3].slice(0, -1)}…`]
    : lines;
}
export function captionLayout(text: string, style: CaptionStyle) {
  const lines = captionLines(text, style.fontSize),
    height = lines.length * (style.fontSize + 6) + 20,
    y = style.position === "top" ? 16 : 434 - height;
  return { lines, height, y };
}
export function paintCaptions(
  context: CanvasRenderingContext2D,
  text: string,
  style: CaptionStyle,
) {
  if (!text) return;
  const { lines, height, y } = captionLayout(text, style);
  context.save();
  context.fillStyle = "rgba(18,25,37,.94)";
  context.fillRect(28, y, 744, height);
  context.fillStyle = style.color;
  context.font = `${style.fontSize}px monospace`;
  context.textAlign = "center";
  context.textBaseline = "top";
  lines.forEach((line, i) =>
    context.fillText(line, 400, y + 10 + i * (style.fontSize + 6)),
  );
  context.restore();
}
