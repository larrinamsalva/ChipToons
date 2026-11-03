import type { PuppetRig } from "./puppet-model";
import { EMOTIONS, HEARTS } from "./animation-model";
import type { CameraAnimation, Heart } from "./animation-model";
import { POSES } from "./art-model";
import type { Pose, PropName } from "./art-model";
import { placeLibraryItem } from "./library";
import type { LibraryItem } from "./library";
import { BACKGROUNDS, makeScene, uid, validateProject } from "./model";
import type {
  Background,
  Emotion,
  Project,
  Scene,
  SceneElement,
} from "./model";
import { DEFAULT_IDEA, planStory } from "./planner";
import { actionsFor, actionsForPuppet, presetAnimation } from "./presets";
import type { Action } from "./presets";
import { CHAPTERS } from "./story-model";
import { clamp, elementAt, roundTime } from "./timeline";

export const PATTERNS = {
  kindness: [
    "Kindness and empathy",
    "notice how someone feels",
    "find out what would help",
    "ask what would feel helpful",
    "What could you say to someone who looks sad?",
  ],
  friendship: [
    "Friendship and inclusion",
    "make room for a friend",
    "figure out how everyone can join",
    "offer a choice about how to join",
    "How could you invite someone to play?",
  ],
  solving: [
    "Problem-solving",
    "work out a small problem",
    "decide which idea to try first",
    "compare two simple ideas",
    "What clue helped the friends choose?",
  ],
  responsibility: [
    "Responsibility",
    "take care of an important job",
    "remember what to do first",
    "make a short list and do one job at a time",
    "What small job could you take care of today?",
  ],
  cooperation: [
    "Cooperation",
    "do something together",
    "agree on how to share the work",
    "give everyone a turn or a job",
    "Which part could you do with a friend?",
  ],
  safety: [
    "Safe choices",
    "make a safe choice",
    "know when to stop and ask",
    "pause and check with a trusted adult",
    "Which trusted grown-up could you ask for help?",
  ],
  caring: [
    "Caring for others",
    "show someone they matter",
    "find a kind way to offer support",
    "listen first, then offer a small kind action",
    "How can you help while giving someone a choice?",
  ],
} as const;
export type Pattern = keyof typeof PATTERNS;
export const SHOTS = {
  none: "No camera suggestion",
  wide: "Wide establishing shot",
  pair: "Two-character conversation",
  feeling: "Close-up of a feeling",
  follow: "Follow a walking character",
  reveal: "Gentle zoom toward a moment",
  celebrate: "Celebration shot",
} as const;
export type Shot = keyof typeof SHOTS;

export interface StoryBrief {
  title: string;
  idea: string;
  setting: string;
  lesson: string;
  pattern: Pattern;
  goal: string;
  challenge: string;
  choice: string;
  outcome: string;
  background: Background;
  count: number;
  minutes: number;
  growing: boolean;
  episode: number;
  hearts: boolean;
  style: "gentle" | "expressive";
}
export const START_BRIEF: StoryBrief = {
  title: "",
  idea: "",
  setting: "",
  lesson: "",
  pattern: "kindness",
  goal: "",
  challenge: "",
  choice: "",
  outcome: "",
  background: "playground",
  count: 6,
  minutes: 1,
  growing: false,
  episode: 1,
  hearts: true,
  style: "gentle",
};
export const PLAYGROUND_BRIEF: StoryBrief = {
  ...START_BRIEF,
  title: "The Playground of Kind Hearts",
  pattern: "friendship",
  idea: "At the playground, two little superheroes notice a child feeling left out. One walks over and asks how the child feels. The other suggests a friendly game. The child begins to smile, their hearts glow, and the friends celebrate.",
  setting: "a sunny playground",
  lesson: "An invitation can help someone feel they belong.",
  goal: "Invite a child who is feeling left out to join a game",
  challenge:
    "The child feels left out, is unsure how to join, and wants someone to listen",
  choice:
    "Ask how the child feels, then offer a friendly game they can choose to join",
  outcome: "The child smiles and everyone celebrates playing together",
};
export interface CastChoice {
  name: string;
  library?: LibraryItem;
}
export interface Direction {
  sceneId: string;
  actorId: string;
  action: Action | "none";
  emotion: Emotion | "keep";
  pose: Pose | "keep";
  heart: Heart;
  shot: Shot;
  start: number;
  seconds: number;
  enabled: boolean;
}
const ASK =
  "What does your main character want to do? Add one small goal to help plan the story.";
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : s + ".");
export function suggestPattern(idea: string): Pattern {
  if (
    /\b(trusted adult|stranger|password|private information|unsafe|lost in)\b/i.test(
      idea,
    )
  )
    return "safety";
  if (/\b(chores?|tidy|clean up|responsib\w*|feed the pet)\b/i.test(idea))
    return "responsibility";
  if (
    /\b(left out|friendship|new friend|join the game|include\w*)\b/i.test(idea)
  )
    return "friendship";
  if (/\b(teamwork|cooperat\w*|work together|share the work)\b/i.test(idea))
    return "cooperation";
  if (/\b(puzzle|solve\w*|figure out|broken|build a bridge)\b/i.test(idea))
    return "solving";
  if (/\b(take care|look after|care for|comfort\w*)\b/i.test(idea))
    return "caring";
  return "kindness";
}
const hasWords = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length >= 5;

export function suggestScript(brief: StoryBrief, names: string[]) {
  if (
    !Object.hasOwn(PATTERNS, brief.pattern) ||
    !BACKGROUNDS.includes(brief.background) ||
    !Number.isInteger(brief.count) ||
    brief.count < 6 ||
    brief.count > 12 ||
    !Number.isInteger(brief.minutes) ||
    brief.minutes < 1 ||
    brief.minutes > 30 ||
    !Number.isInteger(brief.episode) ||
    brief.episode < 1 ||
    brief.episode > 30
  )
    throw new Error(
      "Choose a valid story pattern, scene count, and episode goal.",
    );
  const idea = brief.idea.trim();
  if (!idea || idea.length > 6000)
    throw new Error("Enter an idea of up to 6,000 characters.");
  if (!brief.setting.trim() || !brief.lesson.trim())
    throw new Error("Add a setting and a lesson for your story.");
  if (!hasWords(idea) && !brief.goal.trim()) throw new Error(ASK);
  const [, patternGoal, patternChallenge, patternChoice, question] =
    PATTERNS[brief.pattern];
  const lead = names[0],
    partner = names[1],
    friend = names.length > 1 ? names.at(-1) : undefined;
  const lines = idea.split(/(?<=[.!?])\s+|\n+/).map((line) => line.trim());
  const cue = (pattern: RegExp) =>
    lines.find((line) => line.length <= 500 && pattern.test(line)) ?? "";
  const goal =
    brief.goal.trim() ||
    cue(/\b(wants? to|hopes? to|tries? to|plans? to|needs? to)\b/i);
  const challenge =
    brief.challenge.trim() ||
    cue(
      /\b(but|left out|can’t|cannot|could not|gets stuck|is unsure|has trouble)\b/i,
    );
  const choice =
    brief.choice.trim() ||
    cue(/\b(decides? to|chooses? to|offers? to|asks? for help|suggests? a)\b/i);
  const outcome =
    brief.outcome.trim() ||
    cue(/\b(in the end|finally|starts? to smile|celebrat\w*|it works)\b/i);
  const dialogue = (first: string, second?: string, speaker = partner) =>
    lead +
    ': "' +
    first +
    '"' +
    (speaker && second ? "\n" + speaker + ': "' + second + '"' : "");
  const beats = [
    {
      title: "Meet the characters",
      narration:
        `Our story begins in ${brief.setting.trim()}. ${sentence(idea)}`.slice(
          0,
          6000,
        ),
      dialogue: dialogue("Let’s see what happens today."),
      question: "Who is in the story?",
    },
    {
      title: "Choose a goal",
      narration: goal
        ? sentence(goal)
        : `One possible goal for ${lead} is to ${patternGoal}.`,
      dialogue: dialogue("What are we trying to do?", "Let’s work it out."),
      question: "What does the main character want to do?",
    },
    {
      title: "Notice the challenge",
      narration: challenge
        ? sentence(challenge)
        : `A small challenge to explore is how to ${patternChallenge}.`,
      dialogue: dialogue(
        "How do you feel about this?",
        "I’d like a moment to think.",
        friend,
      ),
      question: "How might the character be feeling?",
    },
    {
      title: "Make a helpful choice",
      narration: choice
        ? sentence(choice)
        : `One helpful step could be to ${patternChoice}.`,
      dialogue: dialogue(
        brief.pattern === "safety"
          ? "Let’s pause and ask a trusted grown-up."
          : "Can I help?",
        "We can choose what feels right.",
      ),
      question: "What is one helpful choice?",
    },
    {
      title: "See what happens",
      narration: outcome
        ? sentence(outcome)
        : `After trying their choice, the characters can stop and notice what changed. ${sentence(brief.lesson.trim())}`,
      dialogue: dialogue(
        "What changed when we tried that?",
        "I’m glad we took a moment to check.",
      ),
      question:
        brief.growing && brief.episode >= 10
          ? "What did the characters notice first? What changed later, and what clues helped them tell?"
          : "What changed after their choice?",
    },
    {
      title: "Share the lesson",
      narration: sentence(brief.lesson.trim()),
      dialogue: dialogue("What could you try next time?"),
      question:
        brief.growing && brief.episode >= 4
          ? "What might happen if the characters tried another choice? How could they decide which one helps?"
          : question,
    },
  ];
  const extras = [
    [
      "Take a quiet moment",
      "Give the characters time to think before they choose.",
      "What do you notice while they pause?",
    ],
    [
      "Hear another idea",
      "Invite a different suggestion before anyone decides.",
      "How could they listen to another idea?",
    ],
    [
      "Compare the choices",
      "Consider what might happen with either choice.",
      "Which idea might help the most?",
    ],
    [
      "Check everyone agrees",
      "Leave room for someone to ask a question or say no.",
      "How can you tell if everyone is ready?",
    ],
    [
      "Try one small step",
      "Start with one step the characters can handle.",
      "What could they try first?",
    ],
    [
      "Notice what helped",
      "Look for something useful to remember next time.",
      "Which part helped most?",
    ],
  ] as const;
  return [
    ...beats.slice(0, 3).map((beat, chapter) => ({ ...beat, chapter })),
    ...extras.slice(0, brief.count - 6).map(([title, narration, question]) => ({
      title,
      narration,
      question,
      dialogue: dialogue("Let’s take it one step at a time."),
      chapter: 3,
    })),
    ...beats.slice(3).map((beat, i) => ({ ...beat, chapter: i + 3 })),
  ];
}

export function shapeActor(project: Project, element: SceneElement) {
  const rig = puppetFor(project, element);
  if (rig) return rig.face || rig.parts.some(p => !p.assetId && (p.role === "eyes" || p.role === "mouth"));
  return (
    !!element.characterId &&
    !element.assetId &&
    project.characters.some((c) => c.id === element.characterId && !c.assetId)
  );
}

export function puppetFor(project: Project, element?: SceneElement) {
  return project.characters.find(c => c.id === element?.characterId)?.puppet;
}

export function gentleActions(shape: boolean, rig?: PuppetRig) {
  return (rig ? actionsForPuppet(rig) : actionsFor(shape)).filter(([id]) =>
    [
      "walk",
      "walk-in-place",
      "celebrate",
      "jump",
      "wave",
      "nod",
      "float",
      "dance",
      "point",
      "sit",
      "stand",
    ].includes(id),
  );
}

export function openActors(scene: Scene, existing: boolean) {
  return scene.elements.filter(
    (e) =>
      !!e.characterId && (!existing || (!e.animation && e.motion === "still")),
  );
}

const hasWalkCue = (text: string) =>
  !/\b(?:never|does not|do not|doesn.t|don.t|won.t) walk\w*\b/i.test(text) &&
  /\b(walks?|approach(?:es)?|heads? over)\b/i.test(text);

export function suggestDirection(
  project: Project,
  scene: Scene,
  existing = false,
  hearts = true,
  expressive = false,
): Direction {
  const text = [
    scene.title,
    scene.action,
    scene.narration,
    scene.dialogue,
  ].join(" ");
  const actors = openActors(scene, existing);
  const sad = /\b(sad|lonely|left out|left behind|upset|worried)\b/i.test(text);
  const walk = hasWalkCue(text);
  const help = /\b(helpful|help|offer|invite|invitation|ask)\b/i.test(text);
  const celebration = /\b(celebrat\w*|cheer\w*|smiles?)\b/i.test(text);
  const reveal = /\b(reveal\w*|discover\w*|finds|uncover\w*)\b/i.test(text);
  const actor =
    scene.chapter === "challenge" && sad ? actors.at(-1) : actors[0];
  const shape = !!actor && shapeActor(project, actor);
  const rig = puppetFor(project, actor);
  const proposed = !actor
    ? "none"
    : walk
      ? "walk"
      : rig && /\bwave(?:s|d| hello)?\b/i.test(text)
        ? "wave"
      : celebration
        ? rig ? "celebrate" : expressive
          ? "jump"
          : "dance"
        : help && (shape || rig) && !sad
          ? "wave"
          : "none";
  const action = proposed === "none" || gentleActions(shape, rig).some(([id]) => id === proposed) ? proposed : "none";
  const shot =
    existing && (scene.cameraAnimation || scene.camera !== "wide")
      ? "none"
      : walk && actor
        ? "follow"
        : sad && actor
          ? "feeling"
          : celebration
            ? "celebrate"
            : reveal
              ? "reveal"
              : help && actors.length > 1
                ? "pair"
                : existing
                  ? "none"
                  : "wide";
  return {
    sceneId: scene.id,
    actorId: actor?.id ?? "",
    action,
    shot,
    emotion: !shape
      ? "keep"
      : rig && /\bsurpris\w*\b/i.test(text)
        ? "surprised"
      : sad
        ? "sad"
        : celebration
          ? "happy"
          : help
            ? "calm"
            : "keep",
    pose: "keep",
    heart:
      !shape || !hearts
        ? "off"
        : sad
          ? "sad"
          : celebration
            ? "together"
            : help
              ? "helping"
              : "off",
    start: 0,
    seconds: Math.min(3, scene.duration),
    enabled: !existing,
  };
}

function cameraTrack(
  scene: Scene,
  shot: Exclude<Shot, "none">,
  actor: SceneElement | undefined,
): CameraAnimation {
  const first = scene.elements.find((e) => e.characterId);
  const second = scene.elements.find(
    (e) => e.characterId && e.id !== first?.id,
  );
  const x = actor?.x ?? first?.x ?? 400;
  const [targetX, targetY, zoom] =
    shot === "feeling"
      ? [x, (actor?.y ?? 340) - 110, 1.35]
      : shot === "pair"
        ? [first && second ? (first.x + second.x) / 2 : 400, 225, 1.12]
        : shot === "reveal"
          ? [x, 225, 1.25]
          : shot === "celebrate"
            ? [400, 225, 1.08]
            : [400, 225, 1];
  const key = (time: number, x: number, y: number, zoom: number) => ({
    id: uid(),
    time,
    x: clamp(x, -800, 1600),
    y: clamp(y, -450, 900),
    zoom,
    easing: "ease-in-out" as const,
  });
  if (shot === "follow" && actor) {
    const followKey = (time: number, zoom: number) => {
      const frame = elementAt(actor, time, scene.duration);
      return key(
        time,
        400 - (frame.x - 400) * 0.85,
        225 - (frame.y - 345) * 0.85,
        zoom,
      );
    };
    return {
      followId: actor.id,
      keyframes: [followKey(0, 1.12), followKey(scene.duration, 1.2)],
    };
  }
  const marginX = 400 / zoom;
  const marginY = 225 / zoom;
  return {
    keyframes: [
      key(0, 400, 225, 1),
      key(
        Math.min(4, scene.duration),
        clamp(targetX, marginX, 800 - marginX),
        clamp(targetY, marginY, 450 - marginY),
        zoom,
      ),
    ],
  };
}

export function directScene(
  project: Project,
  scene: Scene,
  direction: Direction,
  existing: boolean,
): Scene {
  if (!direction.enabled) return scene;
  const actor = openActors(scene, existing).find(
    (e) => e.id === direction.actorId,
  );
  if (
    scene.id !== direction.sceneId ||
    (direction.actorId && !actor) ||
    !Object.hasOwn(SHOTS, direction.shot) ||
    !Number.isFinite(direction.start) ||
    direction.start < 0 ||
    direction.start > scene.duration - 0.1 ||
    !Number.isFinite(direction.seconds) ||
    direction.seconds < 0.1 ||
    direction.seconds > scene.duration ||
    !(direction.emotion === "keep" || EMOTIONS.includes(direction.emotion)) ||
    !(direction.pose === "keep" || POSES.includes(direction.pose)) ||
    !HEARTS.includes(direction.heart)
  )
    throw new Error(
      "Review the suggested scene, character and timing before applying.",
    );
  const shape = !!actor && shapeActor(project, actor);
  if (
    (direction.action !== "none" &&
      (!actor ||
        !gentleActions(shape, puppetFor(project, actor)).some(([id]) => id === direction.action))) ||
    (!shape &&
      (direction.emotion !== "keep" ||
        direction.pose !== "keep" ||
        direction.heart !== "off"))
  )
    throw new Error("Choose an action supported by this character.");
  if (
    existing &&
    direction.shot !== "none" &&
    (scene.camera !== "wide" || scene.cameraAnimation)
  )
    throw new Error("This scene already has a camera choice. It was kept.");
  const stage = scene.elements.filter((e) => e.characterId);
  const other = stage.find((e) => e.id !== actor?.id);
  const elements = scene.elements.map((e) => {
    if (
      e !== actor ||
      (direction.action === "none" &&
        direction.emotion === "keep" &&
        direction.pose === "keep" &&
        direction.heart === "off")
    )
      return e;
    const next = { ...e, motion: "still" as const };
    const action = direction.action === "none" ? "nod" : direction.action;
    const animation = presetAnimation(
      next,
      scene.duration,
      action,
      direction.start,
      direction.seconds,
      direction.action === "none" ? undefined : puppetFor(project, actor),
    );
    const destination = clamp(
      other
        ? other.x + (e.x < other.x ? -105 : 105)
        : e.x + (e.x < 400 ? 150 : -150),
      110,
      690,
    );
    const end = Math.min(scene.duration, direction.start + direction.seconds);
    next.animation = {
      ...animation,
      blink: shape,
      idle: "none",
      keyframes: animation.keyframes.map((key) => {
        const active = key.time >= roundTime(direction.start);
        return {
          ...key,
          time: Math.min(key.time, scene.duration),
          ...(direction.action === "walk"
            ? {
                x:
                  e.x +
                  (destination - e.x) *
                    clamp(
                      (key.time - direction.start) / (end - direction.start),
                      0,
                      1,
                    ),
              }
            : {}),
          ...(direction.action === "jump"
            ? { y: e.y + (key.y - e.y) * 0.45 }
            : {}),
          ...(direction.action === "none" ? { gesture: "none" as const } : {}),
          ...(active && direction.pose !== "keep"
            ? { pose: direction.pose }
            : {}),
          ...(active && direction.emotion !== "keep"
            ? { emotion: direction.emotion }
            : {}),
          ...(active && direction.heart !== "off"
            ? { heart: direction.heart }
            : {}),
        };
      }),
    };
    return next;
  });
  return {
    ...scene,
    elements,
    ...(direction.shot === "none"
      ? {}
      : {
          cameraAnimation: cameraTrack(
            scene,
            direction.shot,
            elements.find((e) => e.id === actor?.id),
          ),
        }),
  };
}

export function applyDirections(
  project: Project,
  directions: Direction[],
  existing = false,
): Project {
  if (project.scenes.some((scene) => !scene.title.trim()))
    throw new Error(
      "Give every suggested scene a title before creating the draft.",
    );
  const byScene = new Map(directions.map((d) => [d.sceneId, d]));
  if (
    byScene.size !== directions.length ||
    directions.some((d) => !project.scenes.some((s) => s.id === d.sceneId))
  )
    throw new Error(
      "The storyboard changed. Open the assistant again to review the current scenes.",
    );
  return validateProject({
    ...project,
    scenes: project.scenes.map((scene) => {
      const direction = byScene.get(scene.id);
      return direction
        ? directScene(project, scene, direction, existing)
        : scene;
    }),
  });
}

export function createAssistantDraft(
  brief: StoryBrief,
  cast: CastChoice[],
  prop?: PropName,
) {
  if (
    !cast.length ||
    cast.length > 3 ||
    cast.some((c) => !c.name.trim() || c.name.length > 80)
  )
    throw new Error("Name one to three characters before planning.");
  const names = cast.map((c) => c.name.trim());
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length)
    throw new Error("Give each character a different name.");
  const script = suggestScript(brief, names);
  let project = planStory({
    ...DEFAULT_IDEA,
    ...brief,
    names: names.map((name) => name.replaceAll(",", " ")).join(","),
    plannedMinutes: brief.minutes,
  });
  const originals = project.characters;
  const outline = {
    beginning: script[0].narration,
    conflict: script[2].narration,
    response: script.at(-3)!.narration,
    ending: script.at(-1)!.narration,
  };
  project = {
    ...project,
    outline,
    scenes: [{ ...makeScene([]), elements: [] }],
  };
  const templates = cast.map(({ library }, i) => {
    if (library) {
      if (library.kind !== "character")
        throw new Error("Choose a saved character from the art library.");
      project = placeLibraryItem(project, 0, { ...library, name: names[i] });
      return project.scenes[0].elements.at(-1)!;
    }
    return { ...makeScene([originals[i]]).elements[0] };
  });
  const characterIds = new Set(templates.map((e) => e.characterId));
  project.characters = project.characters
    .filter((c) => characterIds.has(c.id))
    .map((c) => ({
      ...c,
      name: names[templates.findIndex((e) => e.characterId === c.id)],
    }));
  const positioned = templates.map((e, i) => ({
    ...e,
    name: undefined,
    x: 400 + (i - (templates.length - 1) / 2) * 175,
    y: 340,
    motion: "still" as const,
  }));
  const scenes: Scene[] = script.map(({ chapter, ...beat }, i) => ({
    ...makeScene([]),
    ...beat,
    chapter: CHAPTERS[chapter].id,
    background: brief.background,
    action: [
      "Introduce the place",
      "Show the goal",
      "Pause for a feeling",
      "Offer help",
      "Try the choice and celebrate progress",
      "Share the lesson",
    ][chapter],
    duration: [8, 8, 10, 10, 10, 10][chapter],
    elements: [
      ...positioned.map((e) => ({ ...e, id: uid() })),
      ...(prop && i === 0
        ? [
            {
              id: uid(),
              characterId: "",
              kind: "prop" as const,
              prop,
              x: 680,
              y: 365,
              scale: 0.8,
              rotation: 0,
              flip: false,
              emotion: "calm" as const,
              motion: "still" as const,
            },
          ]
        : []),
    ],
  }));
  project = validateProject({ ...project, scenes });
  const directions = scenes.map((scene, i) => {
    // The opening quotes the original idea. Use the whole idea as a cue for
    // the action beat, not as a reason to animate every scene the same way.
    const cues =
      i === 0
        ? { ...scene, narration: "" }
        : scene.chapter === "exploration" && i === scenes.length - 3
          ? {
              ...scene,
              action: `${scene.action} ${hasWalkCue(brief.idea) ? "Walk over" : ""} ${/\b(reveal\w*|discover\w*)\b/i.test(brief.idea) ? "Reveal" : ""}`,
            }
          : scene;
    return suggestDirection(
      project,
      cues,
      false,
      brief.hearts,
      brief.style === "expressive",
    );
  });
  return { project, positioned, directions };
}
