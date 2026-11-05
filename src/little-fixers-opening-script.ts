import type { Emotion } from "./model";

export const LITTLE_FIXERS_EPISODE_TITLE = "Little Fixers Club — Episode 1: Fix It, Don't Toss It!";
export const LITTLE_FIXERS_OPENING_ACTION = "Open Episode 1 animated opening";

type Line = readonly [at: number, text: string, expression?: Emotion];
type SceneBeat = {
  id: string;
  title: string;
  seconds: number;
  action: string;
  lines: readonly Line[];
};

export const LITTLE_FIXERS_OPENING = [
  {
    id: "wobble", title: "Something wobbles in the workshop", seconds: 15,
    action: "The host looks at the chair. Its back rocks, and she stops and reacts.",
    lines: [
      [0.6, "Let's take a look at this chair.", "calm"],
      [4.5, "Oh! Did you see it wobble?", "surprised"],
      [8.1, "I think something is loose. Let's look together.", "worried"],
    ],
  },
  {
    id: "aside", title: "Set the chair aside", seconds: 15,
    action: "The host points to a clear spot. The chair is moved aside and stays still.",
    lines: [
      [0.6, "Let's set it aside so no one sits on it.", "calm"],
      [5.3, "Look with your eyes. What do you notice where the wood meets?", "happy"],
    ],
  },
  {
    id: "joint", title: "Look closely at the joint", seconds: 15,
    action: "A close-up circles the place where the back meets the seat, then returns to the host.",
    lines: [
      [0.6, "See where the back of the chair meets the seat?", "calm"],
      [5.05, "That spot is called a joint. This one is loose.", "calm"],
      [10.2, "A grown-up can check whether it can be fixed safely.", "happy"],
    ],
  },
  {
    id: "ask", title: "Wait for a trusted grown-up", seconds: 15,
    action: "The host shakes her head, then nods toward the reminder beside the chair.",
    lines: [
      [0.6, "Don't sit on a wobbly chair. Ask a trusted grown-up.", "calm"],
      [5.5, "If it's safe to repair, we can give it another try.", "happy"],
      [10.5, "Fix it, don't toss it!", "excited"],
    ],
  },
  {
    id: "title", title: "Fix It, Don't Toss It!", seconds: 8,
    action: "The episode title appears to a short original melody.",
    lines: [],
  },
  {
    id: "welcome", title: "Welcome to Little Fixers Club", seconds: 17,
    action: "The host greets the viewers. Three teaching cards appear in time with the lesson.",
    lines: [
      [0.6, "Welcome to the Little Fixers Club!", "excited"],
      [4.8, "When something wobbles, we look, stop, and ask. Say it with me. Look. Stop. Ask.", "happy"],
    ],
  },
  {
    id: "choose", title: "Pick the safe choice", seconds: 18,
    action: "Viewers get a quiet moment to choose. The host reveals the safe answer.",
    lines: [
      [0.65, "Would you sit on the wobbly chair or ask a grown-up?", "calm"],
      [10.3, "Ask a grown-up. Leave the chair alone until it's checked.", "happy"],
    ],
  },
  {
    id: "bench", title: "Get ready at the workbench", seconds: 16,
    action: "The host turns toward the bench and previews the next step.",
    lines: [
      [0.6, "Fixing starts with a plan and a grown-up who can help.", "happy"],
      [6.1, "Next, we'll get the work area ready. Meet me at the bench!", "excited"],
    ],
  },
] as const satisfies readonly SceneBeat[];
