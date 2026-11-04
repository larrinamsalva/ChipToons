import { numberIn, record, validDisplayText } from "./art-model";
import type { Scene } from "./model";

export const PARTICIPATION_TITLE = "Let the Kids Join In";
export const MAX_PARTICIPATION_MOMENTS = 8;
export const ACTIVITIES = {
  notice: "Look and Notice", predict: "What Happens Next?", choose: "Choose a Helpful Idea",
  try: "Let's Try Together", feel: "How Would You Feel?",
} as const;
export type Activity = keyof typeof ACTIVITIES;
export const CHOICE_ICONS = { dot: "●", heart: "♥", star: "★", plus: "+" } as const;
export type Choice = { text: string; icon?: keyof typeof CHOICE_ICONS; explanation?: string };
export type Participation = {
  id: string;
  kind: Activity;
  question: string;
  feedback: string;
  choices: Choice[];
  answer?: number;
  at: number;
  askFor: number;
  thinkFor: number;
  revealFor: number;
  speakerId?: string;
  questionLineId?: string;
  answerLineId?: string;
  stepId?: string;
  focusId?: string;
  review?: boolean;
};

export function participationWindow(moment: Participation) {
  const think = moment.at + moment.askFor;
  const reveal = think + moment.thinkFor;
  return { start: moment.at, think, reveal, end: reveal + moment.revealFor };
}

export function participationAt(scene: Scene, time: number) {
  for (const moment of scene.participation ?? []) {
    const { start, think, reveal, end } = participationWindow(moment);
    if (time >= start && time < end)
      return { moment, phase: time < think ? "ask" as const : time < reveal ? "think" as const : "reveal" as const };
  }
}

export const allowsChoices = (kind: Activity) => kind !== "feel" && kind !== "try";
const fields = ["id", "kind", "question", "feedback", "choices", "answer", "at", "askFor", "thinkFor", "revealFor",
  "speakerId", "questionLineId", "answerLineId", "stepId", "focusId", "review"];
const identifier = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 100;
const phrase = (value: unknown, max: number): value is string => validDisplayText(value, max) && !!value.trim();
const epsilon = 1e-7;

export function participationIssue(value: unknown, scene: Scene, unique: (id: string) => void = () => {}) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > MAX_PARTICIPATION_MOMENTS) return "Use up to eight participation moments in a scene.";
  const lines = Array.isArray(scene.script?.lines) ? scene.script.lines.filter(record) : [];
  const ids = new Set<string>(), usedGraphics = new Set<string>();
  const windows: ReturnType<typeof participationWindow>[] = [];
  for (const item of value) {
    if (!record(item) || Object.keys(item).some(key => !fields.includes(key)) ||
      !identifier(item.id) || ids.has(item.id) || typeof item.kind !== "string" || !Object.hasOwn(ACTIVITIES, item.kind) ||
      !phrase(item.question, 84) || !phrase(item.feedback, 110) ||
      !numberIn(item.at, 0, scene.duration) || !numberIn(item.askFor, 0.5, 12) ||
      !numberIn(item.thinkFor, 3, 10) || !numberIn(item.revealFor, 1, 15) ||
      (item.review !== undefined && typeof item.review !== "boolean"))
      return "Add a short question and explanation, and give children 3–10 seconds to think.";
    const kind = item.kind as Activity;
    if (!Array.isArray(item.choices) || item.choices.length > 3 || item.choices.length === 1 ||
      (kind === "choose" && item.choices.length < 2) || (!allowsChoices(kind) && item.choices.length > 0) ||
      item.choices.some(choice => !record(choice) || Object.keys(choice).some(key => !["text", "icon", "explanation"].includes(key)) ||
        !phrase(choice.text, 24) || (choice.icon !== undefined &&
          (typeof choice.icon !== "string" || !Object.hasOwn(CHOICE_ICONS, choice.icon))) ||
        (choice.explanation !== undefined && !validDisplayText(choice.explanation, 54))) ||
      new Set(item.choices.map(choice => choice.text.trim().toLowerCase())).size !== item.choices.length ||
      (item.choices.length ? !numberIn(item.answer, 0, item.choices.length - 1) || !Number.isInteger(item.answer) : item.answer !== undefined))
      return "Use two or three short choices and choose which one the story will explain.";
    if (item.speakerId !== undefined && (!identifier(item.speakerId) || !scene.elements.some(element => element.characterId === item.speakerId)))
      return "Choose a character in this scene or use the narrator.";
    const question = lines.find(line => line.id === item.questionLineId);
    if (item.questionLineId !== undefined && (!identifier(item.questionLineId) || !question || question.speakerId !== item.speakerId))
      return "Choose a question line that belongs to this speaker.";
    if (item.answerLineId !== undefined && (!identifier(item.answerLineId) || item.answerLineId === item.questionLineId ||
      !lines.some(line => line.id === item.answerLineId))) return "Choose a separate explanation line from this scene.";
    if (item.stepId !== undefined && (!identifier(item.stepId) || !scene.learningSteps?.some(step => step.id === item.stepId)))
      return "Choose a learning step from this scene.";
    if (item.focusId !== undefined) {
      if (!identifier(item.focusId) || usedGraphics.has(item.focusId) ||
        !Array.isArray(scene.focusGraphics) || !scene.focusGraphics.some(graphic => record(graphic) && graphic.id === item.focusId))
        return "Choose a teaching graphic that is available in this scene.";
      usedGraphics.add(item.focusId);
    }
    const window = participationWindow(item as unknown as Participation);
    if (window.end > scene.duration + epsilon)
      return "This scene is too short for the question, thinking time, and reveal. Use a longer or dedicated scene.";
    windows.push(window);
    ids.add(item.id);
    unique(item.id);
  }
  windows.sort((a, b) => a.start - b.start);
  if (windows.some((window, index) => index > 0 && window.start < windows[index - 1].end - epsilon))
    return "Give each participation moment its own time without overlapping another.";
}

export function reconcileParticipation(scene: Scene): Scene {
  if (!scene.participation?.length) return scene;
  let changed = false;
  const participation = scene.participation.map(moment => {
    const speakerId = scene.elements.some(item => item.characterId === moment.speakerId) ? moment.speakerId : undefined;
    const questionLineId = scene.script?.lines.some(line => line.id === moment.questionLineId && line.speakerId === speakerId)
      ? moment.questionLineId : undefined;
    const answerLineId = scene.script?.lines.some(line => line.id === moment.answerLineId) ? moment.answerLineId : undefined;
    const stepId = scene.learningSteps?.some(item => item.id === moment.stepId) ? moment.stepId : undefined;
    const focusId = scene.focusGraphics?.some(item => item.id === moment.focusId) ? moment.focusId : undefined;
    if (speakerId === moment.speakerId && questionLineId === moment.questionLineId && answerLineId === moment.answerLineId &&
      stepId === moment.stepId && focusId === moment.focusId) return moment;
    changed = true;
    return { ...moment, speakerId, questionLineId, answerLineId, stepId, focusId, review: true };
  });
  return changed ? { ...scene, participation } : scene;
}

export const PARTICIPATION_EXAMPLES = {
  wagon: "The Wobbly Wagon Mystery", seed: "Which One Helps the Plant?",
  tidy: "Kind Words, Happy Hearts", bridge: "The Paper Bridge Challenge",
} as const;
