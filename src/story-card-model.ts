import { numberIn, record, validDisplayText } from "./art-model";

export const STORY_CARD_DEMO = "Kind Hearts Crew — A Little Room for a Friend: Complete TV-Style Episode";
export const STORY_CARD_STUDIO = "Finish My Cartoon’s Story";
export const STORY_CARD_KINDS = {
  opening: "Opening Title", episode: "Episode Title", chapter: "Chapter Card",
  recap: "What We Learned Recap", thanks: "Thank-You Ending", credits: "Creator Credits",
} as const;
export const STORY_CARD_MOTIONS = {
  fade: "Soft Fade", slide: "Friendly Slide", heart: "Heart Glow",
  book: "Storybook Reveal", still: "Simple Still Card",
} as const;
export const STORY_CARD_FONTS = { rounded: "Friendly sans-serif", book: "Storybook serif", mono: "Typewriter" } as const;
export const CREDIT_ROLES = ["Created by", "Written by", "Artwork", "Animation", "Voices", "Music",
  "Sound effects", "Special thanks", "Original source acknowledgments"] as const;
export const CARD_SOUNDS = { melody: "Kindness melody", transition: "Gentle transition", reassure: "Reassuring chimes" } as const;

export type StoryCardKind = keyof typeof STORY_CARD_KINDS;
export type StoryCardStyle = {
  motion: keyof typeof STORY_CARD_MOTIONS;
  font: keyof typeof STORY_CARD_FONTS;
  size: number;
  ink: string;
  paper: string;
  align: "left" | "center" | "right";
  border: boolean;
};
export type StoryCredit = { role: string; name: string; license: string; url: string };
export type RecapPoint = { text: string; source?: { sceneId: string; stepId: string } };
export type StoryCard = {
  kind: StoryCardKind;
  title: string;
  eyebrow: string;
  subtitle: string;
  style: StoryCardStyle;
  points: RecapPoint[];
  credits: StoryCredit[];
  scroll: boolean;
};
export type SeriesPresentation = {
  style: StoryCardStyle;
  artId: string;
  sound: "" | keyof typeof CARD_SOUNDS;
  ending: "thanks" | "credits" | "scroll";
  roles: string[];
};
export const MAX_STORY_CREDITS = 8;
export const storyCardStyle = (): StoryCardStyle => ({
  motion: "fade", font: "rounded", size: 43, ink: "#39243a", paper: "#fff1d8", align: "center", border: true,
});
export const seriesPresentation = (): SeriesPresentation => ({
  style: storyCardStyle(), artId: "", sound: "", ending: "thanks", roles: [],
});
const fields = (value: object, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const choice = (options: object, value: unknown) => typeof value === "string" && Object.hasOwn(options, value);
const color = (value: unknown) => typeof value === "string" && /^#[a-f\d]{6}$/i.test(value);
const shortId = (value: unknown) => validDisplayText(value, 100) && !!value.trim();
export function validStoryCardStyle(value: unknown): value is StoryCardStyle {
  return record(value) && fields(value, ["motion", "font", "size", "ink", "paper", "align", "border"]) &&
    choice(STORY_CARD_MOTIONS, value.motion) && choice(STORY_CARD_FONTS, value.font) &&
    numberIn(value.size, 28, 54) && Number.isInteger(value.size) &&
    color(value.ink) && color(value.paper) && (value.align === "left" || value.align === "center" || value.align === "right") &&
    typeof value.border === "boolean";
}
export function validPresentation(value: unknown): value is SeriesPresentation {
  return record(value) && fields(value, ["style", "artId", "sound", "ending", "roles"]) &&
    validStoryCardStyle(value.style) && validDisplayText(value.artId, 100) &&
    (value.sound === "" || choice(CARD_SOUNDS, value.sound)) &&
    (value.ending === "thanks" || value.ending === "credits" || value.ending === "scroll") &&
    Array.isArray(value.roles) && value.roles.length <= MAX_STORY_CREDITS &&
    value.roles.every(role => validDisplayText(role, 45) && !!role.trim());
}
export function minimumCreditTime(card: Pick<StoryCard, "credits" | "scroll">) {
  return card.scroll ? Math.min(55, 5 + card.credits.reduce((seconds, row) =>
    seconds + Math.max(3, [row.role, row.name, row.license, row.url].filter(Boolean).join(" ").trim().split(/\s+/u).length / 1.8), 0)) : 2;
}
export function storyCardIssue(value: unknown, duration: number) {
  if (value === undefined) return;
  if (!record(value) || !fields(value, ["kind", "title", "eyebrow", "subtitle", "style", "points", "credits", "scroll"]) ||
      !choice(STORY_CARD_KINDS, value.kind) || !validDisplayText(value.title, 140) || !value.title.trim() ||
      !validDisplayText(value.eyebrow, 90) || !validDisplayText(value.subtitle, 165) ||
      !validStoryCardStyle(value.style) || typeof value.scroll !== "boolean" ||
      !Array.isArray(value.points) || value.points.length > (value.kind === "recap" ? 3 : 0) ||
      !Array.isArray(value.credits) || value.credits.length > (value.kind === "credits" ? MAX_STORY_CREDITS : 0) ||
      (value.scroll && value.kind !== "credits")) return "Check the title, style, and card details.";
  for (const point of value.points) {
    if (!record(point) || !fields(point, ["text", "source"]) || !validDisplayText(point.text, 140) || !point.text.trim() ||
        (point.source !== undefined && (!record(point.source) || !fields(point.source, ["sceneId", "stepId"]) ||
          !shortId(point.source.sceneId) || !shortId(point.source.stepId)))) return "Use up to three short learning points.";
  }
  for (const credit of value.credits) {
    if (!record(credit) || !fields(credit, ["role", "name", "license", "url"]) ||
        !validDisplayText(credit.role, 45) || !validDisplayText(credit.name, 105) || !credit.name.trim() ||
        !validDisplayText(credit.license, 80) || !validDisplayText(credit.url, 125) ||
        (credit.url.trim() && !/^https?:\/\/[^\s/]+[^\s]*$/iu.test(credit.url))) return "Enter a name or source for each credit and use an http or https link.";
  }
  const minimum = minimumCreditTime(value as unknown as StoryCard);
  if (duration + 0.001 < minimum) return `Allow at least ${Math.ceil(minimum)} seconds for these credits.`;
}
