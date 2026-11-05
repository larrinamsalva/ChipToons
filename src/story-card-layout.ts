import type { Project, Scene } from "./model";
import type { StoryCard } from "./story-card-model";
import { focusContrast, sceneCaptionBand } from "./focus-motion";

type CardLine = { text: string; size: number; height: number; strong?: boolean };
export const STORY_FONTS = {
  rounded: "sans-serif",
  book: "serif",
  mono: "monospace",
};
function weight(char: string) {
  return /[ilI.,'’ !]/u.test(char) ? 0.32 : (/[MW@]/u.test(char) || char.codePointAt(0)! > 127) ? 1.04 : 0.75;
}
function wrap(text: string, size: number, width: number): string[] {
  const capacity = width / size;
  const words = text.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "", length = 0;
  for (const word of words) {
    const wordWidth = [...word].reduce((sum, char) => sum + weight(char), 0);
    if (length + wordWidth + 0.75 > capacity && current) {
      lines.push(current); current = ""; length = 0;
    }
    if (current) { current += " "; length += 0.75; }
    for (const char of word) {
      const next = weight(char);
      if (length + next > capacity && current) {
        lines.push(current); current = ""; length = 0;
      }
      current += char; length += next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
function cardLines(card: StoryCard, width: number, size: number) {
  const lines: CardLine[] = [];
  const add = (text: string, size: number, strong = false, gap = 0) => {
    const batch = wrap(text, size, width).map(text => ({ text, size, strong, height: Math.ceil(size * 1.24) }));
    if (batch.length) batch[batch.length - 1].height += gap;
    lines.push(...batch);
  };
  add(card.eyebrow, 20, true, 6);
  add(card.title, size, true, 7);
  add(card.subtitle, 22, false, 5);
  card.points.forEach((point, i) => add(`${i + 1}. ${point.text}`, 22, false, 5));
  card.credits.forEach(credit => {
    add(credit.role ? `${credit.role} · ${credit.name}` : credit.name, 21, true);
    add([credit.license, credit.url].filter(Boolean).join(" · "), 18, false, 4);
  });
  return lines;
}

export function storyCardLayout(project: Pick<Project, "captions" | "captionStyle">, scene: Scene, card: StoryCard) {
  const band = sceneCaptionBand(project, scene);
  const top = band && project.captionStyle.position === "top" ? band.y + band.height + 12 : 26;
  const bottom = band && project.captionStyle.position === "bottom" ? band.y - 12 : 424;
  const x = 65, width = 670;
  const compact = !card.scroll && scene.elements.some(element => !!element.characterId) &&
    (card.kind === "opening" || card.kind === "thanks");
  const height = bottom - top;
  let lines = cardLines(card, width - 64, card.style.size);
  let length = lines.reduce((sum, line) => sum + line.height, 0);
  if (!card.scroll && length > height - 48 && card.style.size > 28) {
    lines = cardLines(card, width - 64, 28);
    length = lines.reduce((sum, line) => sum + line.height, 0);
  }
  const panelHeight = card.scroll ? height : Math.min(height, Math.max(112, length + 47));
  const y = compact ? top + 5 : top + (height - panelHeight) / 2;
  const contentHeight = panelHeight - 36;
  const clipped = !card.scroll && length > contentHeight;
  const positioned = [];
  let offset = 0;
  for (const line of lines) {
    positioned.push({ ...line, offset });
    offset += line.height;
  }
  return { x, width, y, height: panelHeight, length, lines: positioned, clipped, contentHeight,
    contrast: focusContrast(card.style.ink, card.style.paper) };
}

export function storyCardFrame(card: StoryCard, seconds: number, duration: number, calm: boolean,
  length: number, viewport: number) {
  const entry = Math.max(0, Math.min(1, seconds / Math.min(0.85, duration / 4)));
  const ease = 1 - (1 - entry) ** 3;
  const progress = Math.max(0, Math.min(1, (seconds - 0.7) / Math.max(0.1, duration - 1.4)));
  const lead = Math.max(0, Math.min(66, viewport - length));
  const spill = Math.max(lead, length - viewport);
  return {
    opacity: calm || card.style.motion === "still" ? 1 : 0.45 + ease * 0.55,
    slide: !calm && card.style.motion === "slide" ? 24 * (1 - ease) : 0,
    reveal: !calm && card.style.motion === "book" ? 0.72 + 0.28 * ease : 1,
    glow: card.style.motion === "heart" ? calm ? 0.55 : 0.52 + 0.2 * Math.sin(seconds * 1.8) : 0,
    lead: card.scroll ? lead : 0,
    scroll: card.scroll ? (calm ? (lead ? lead / 2 : Math.min(spill, Math.floor(progress * (Math.ceil(spill / viewport) + 1)) * viewport)) : progress * spill) : 0,
  };
}
