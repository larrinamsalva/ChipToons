import { CHAPTERS } from "./story-model";
import { addDemoProduction } from "./demo-production";
import { emptyProduction } from "./media-model";
import { animateInclusion } from "./demo-animation";
import { makeScene, uid } from "./model";
import type { Character, IdeaInput, Project, StoryProvider } from "./model";

export const STARTERS = [
  {
    id: "kindness",
    category: "Kindness & empathy",
    title: "A little room for a friend",
    description: "One small invitation. One very big smile.",
    idea: "A child notices someone feeling left out of a game and invites them to join.",
    lesson: "A kind invitation can help someone feel included.",
    background: "meadow",
    color: "peach",
    icon: "heart",
  },
  {
    id: "friendship",
    category: "Friendship",
    title: "The friendship picnic",
    description: "Different favorites make the best picnic.",
    idea: "Two friends plan a picnic and learn to enjoy their different favorite things.",
    lesson: "Friends can like different things and still belong together.",
    background: "playground",
    color: "mint",
    icon: "sun",
  },
  {
    id: "helping",
    category: "Helping others",
    title: "The wobbly little wagon",
    description: "Helping hands make a lighter load.",
    idea: "A friend has a wagon full of books that is hard to pull, so the children offer to help.",
    lesson: "Ask what help someone needs, then work together.",
    background: "meadow",
    color: "lavender",
    icon: "sparkles",
  },
  {
    id: "feelings",
    category: "Understanding feelings",
    title: "A cloud in my heart",
    description: "Every feeling deserves a little kindness.",
    idea: "A child feels upset when a paper kite tears, and a friend listens and helps repair it.",
    lesson: "Naming our feelings and listening can help.",
    background: "meadow",
    color: "sky",
    icon: "cloud",
  },
  {
    id: "choices",
    category: "Responsible choices",
    title: "The paintbrush promise",
    description: "A tiny tidy-up makes tomorrow brighter.",
    idea: "Children finish painting and choose to put away their art supplies together.",
    lesson: "Looking after shared things helps everyone.",
    background: "classroom",
    color: "yellow",
    icon: "pencil",
  },
  {
    id: "safety",
    category: "Everyday safety",
    title: "Stop, look, ask",
    description: "A trusted grown-up is always a good idea.",
    idea: "A ball rolls beyond the playground gate, and the children stop and ask a trusted grown-up for help.",
    lesson: "Pause and ask a trusted grown-up when you are unsure.",
    background: "playground",
    color: "mint",
    icon: "shield",
  },
  {
    id: "problem",
    category: "Problem-solving",
    title: "The bridge of bright ideas",
    description: "Try, learn, and try something new.",
    idea: "Two friends build a pretend bridge from blocks and try a wider base when it wobbles.",
    lesson: "We can learn from a try that does not work yet.",
    background: "classroom",
    color: "sky",
    icon: "bulb",
  },
  {
    id: "teamwork",
    category: "Sharing & teamwork",
    title: "Our big little garden",
    description: "Everyone has something wonderful to add.",
    idea: "Children share tools and take turns watering their little community garden.",
    lesson: "Taking turns gives everyone a chance to help.",
    background: "meadow",
    color: "peach",
    icon: "flower",
  },
  {
    id: "differences",
    category: "Respecting differences",
    title: "Every color in our parade",
    description: "Different ways to join make a brighter parade.",
    idea: "Friends design a pretend parade where everyone can join in their own comfortable way.",
    lesson: "Ask what makes someone comfortable and respect their answer.",
    background: "playground",
    color: "lavender",
    icon: "heart",
  },
  {
    id: "privacy",
    category: "Personal information safety",
    title: "The puzzling prize message",
    description: "Pause, keep details private, ask a trusted adult.",
    idea: "A pretend tablet message asks for a home address to win a toy. The friends pause, do not reply, and show a trusted grown-up.",
    lesson:
      "Keep personal details private. Stop and ask a trusted grown-up about an unexpected request.",
    background: "classroom",
    color: "sky",
    icon: "shield",
  },
  {
    id: "nature",
    category: "Caring for nature",
    title: "A tiny home for the ladybird",
    description: "Little helpers care for a living world.",
    idea: "Children notice a ladybird in the garden and ask a trusted grown-up how to care for its habitat without disturbing it.",
    lesson: "Watch gently, leave living things safe, and care for their home.",
    background: "garden",
    color: "mint",
    icon: "flower",
  },
  {
    id: "chores",
    category: "Chores & responsibility",
    title: "The sock basket adventure",
    description: "Small shared jobs make a cozy home.",
    idea: "Two friends turn sorting clean socks into a cheerful matching game and put their own things away.",
    lesson:
      "Small helpful jobs and asking for help are ways to care for our home.",
    background: "house",
    color: "yellow",
    icon: "sun",
  },
] as const;

export const DEFAULT_IDEA: IdeaInput = {
  idea: "",
  title: "",
  names: "Pip, Sunny",
  setting: "a sunny neighborhood park",
  lesson: "Kindness helps everyone feel they belong.",
  mood: "gentle",
  artStyle: "Storybook shapes",
  targetAge: "4–7",
  plannedMinutes: 1,
};
const sentence = (text: string) =>
  /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;

export function planStory(input: IdeaInput): Project {
  const idea = input.idea.trim();
  if (!idea || idea.length > 6000)
    throw new Error("Add a story idea of up to 6,000 characters.");
  const names = input.names
    .split(",")
    .map((n) => n.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 4);
  const characters: Character[] = (names.length ? names : ["Pip", "Sunny"]).map(
    (name, i) => ({
      id: uid(),
      name,
      shirt: ["#f3b749", "#8e86d4", "#77bfa4", "#ef9079"][i],
      skin: ["#bf805c", "#edb89b", "#a76b4a", "#e9ac87"][i],
      hair: ["#44332d", "#5b3c32", "#302a29", "#79502e"][i],
      accessory: i === 0 ? "cap" : i === 1 ? "bow" : "none",
    }),
  );
  const a = characters[0].name;
  const b = characters[1]?.name ?? "a new friend";
  const lesson =
    input.lesson.trim() || "A little kindness can make a big difference.";
  const setting = input.setting.trim() || "a sunny neighborhood park";
  const outline = {
    beginning: `Meet ${characters.map((c) => c.name).join(" and ")} in ${setting}. ${sentence(idea)}`,
    conflict: `${a} notices that something is not going as hoped. Everyone pauses to name how they feel.`,
    response: `The friends listen, ask what would help, and choose one small, kind action together.`,
    ending: `They try their idea, celebrate their effort, and remember: ${sentence(lesson)}`,
  };
  const scenes = [
    {
      title: "A little spark",
      narration: `Our story begins in ${setting}. ${sentence(idea)}`,
      dialogue: `${a}: "I wonder what we can do today!"`,
      action: "Introduce the place and the characters.",
    },
    {
      title: "Notice a feeling",
      narration: `${a} looks around and notices that things are not going as hoped. It is time to slow down and listen.`,
      dialogue: `${a}: "How are you feeling?"\n${b}: "I could use a little help."`,
      action: "Pause and show a thoughtful expression.",
    },
    {
      title: "Listen with kindness",
      narration:
        "Every feeling matters. The friends take a calm breath and give each other time to talk.",
      dialogue: `${a}: "I am listening. What would help?"\n${b}: "Thank you for asking."`,
      action: "The characters face each other and listen.",
    },
    {
      title: "A bright little idea",
      narration: `Together, the friends think of one helpful step. ${sentence(lesson)}`,
      dialogue: `${a}: "We can try together!"\n${b}: "I have an idea too!"`,
      action: "Show surprise and a gentle excited bounce.",
    },
    {
      title: "Give it a go",
      narration:
        "They take turns and try their idea. A little patience and a little teamwork make a difference.",
      dialogue: `${a}: "Your turn!"\n${b}: "Our ideas work well together."`,
      action: "The characters move together and celebrate their effort.",
    },
    {
      title: "A brighter together",
      narration: `They smile at what they learned. ${sentence(lesson)} What kind thing could you try today?`,
      dialogue: `${a}: "I am glad we helped."\n${b}: "Me too!"`,
      action: "End with a happy pose and a question for the audience.",
    },
  ].map((content, i) => {
    const scene = makeScene(characters, i);
    return {
      ...scene,
      ...content,
      chapter: CHAPTERS[i].id,
      question: [
        "What do you notice?",
        "How might our friend feel?",
        "What could we ask kindly?",
        "Which safe idea could we try?",
        "How did taking turns help?",
        "What small kind thing could you try today?",
      ][i],
      background: /class|room|school/i.test(setting)
        ? ("classroom" as const)
        : ("meadow" as const),
      duration: [10, 10, 10, 8, 10, 12][i],
      elements: scene.elements.map((el, j) => ({
        ...el,
        emotion:
          i === 1 && j === 1
            ? ("sad" as const)
            : i === 3
              ? ("surprised" as const)
              : i === 2
                ? ("calm" as const)
                : ("happy" as const),
        motion:
          i === 0 && j === 1
            ? ("enter-right" as const)
            : i >= 3
              ? ("bounce" as const)
              : ("still" as const),
      })),
    };
  });
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    ...emptyProduction(),
    id: uid(),
    creationSource: "thought",
    title: input.title.trim().slice(0, 160) || "My little big story",
    idea,
    lesson,
    setting,
    mood: input.mood,
    artStyle: input.artStyle,
    targetAge: input.targetAge,
    plannedMinutes: input.plannedMinutes,
    outline,
    characters,
    scenes,
    assets: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

// A replaceable contract, deliberately labeled as local templates in the UI.
export const localStoryProvider: StoryProvider = {
  name: "Local story templates",
  plan: async (input) => planStory(input),
};

export function starterProject(id = "kindness"): Project {
  const starter = STARTERS.find((t) => t.id === id) ?? STARTERS[0];
  const p = planStory({
    ...DEFAULT_IDEA,
    title: starter.title,
    idea: starter.idea,
    lesson: starter.lesson,
  });
  p.templateId = starter.id;
  p.scenes.forEach((s) => {
    s.background = starter.background;
  });
  if (id !== "kindness") {
    p.scenes[1].narration = `${starter.idea} ${starter.lesson}`;
    p.scenes[2].dialogue =
      'Pip: "Let’s pause and listen."\nSunny: "We can ask a trusted grown-up if we are unsure."';
    p.scenes[4].narration = `The friends practice one small step together. ${starter.lesson} They leave time for everyone to answer and try.`;
    p.scenes[5].question =
      `What could you try with a trusted grown-up? ${starter.lesson}`.slice(
        0,
        500,
      );
  }
  if (id === "kindness") {
    const content = [
      [
        "A sunny kind of day",
        "In the little neighborhood park, Pip and Sunny are making up a new game. There is room for a little more fun.",
        'Pip: "Let’s make a rainbow with our steps!"',
        "The friends arrive in a cheerful meadow.",
      ],
      [
        "One quiet cloud",
        "Sunny stands a little way away. Pip notices a quiet face and stops to listen.",
        'Pip: "Hi, Sunny. Would you like to play?"\nSunny: "I don’t know the game yet."',
        "Pip notices Sunny’s sad expression.",
      ],
      [
        "A little room for a friend",
        "Pip makes space and explains the game one small step at a time. Nobody needs to know everything to join in.",
        'Pip: "I can show you. We can go slowly."\nSunny: "I’d like that."',
        "Pip gives Sunny time to learn.",
      ],
      [
        "Two bright ideas",
        "Sunny has an idea: a silly hop at the end! Pip listens. Now their game has something from both of them.",
        'Sunny: "Can we add a tiny bunny hop?"\nPip: "A bunny hop! I love it!"',
        "The friends brighten up and try a gentle hop.",
      ],
      [
        "Hop, giggle, repeat",
        "Step, step, hop! They wobble, giggle, and try again. Playing together feels even better than getting it perfect.",
        'Pip: "My hop turned into a wobble!"\nSunny: "Mine too! Let’s try together."',
        "The friends bounce and laugh together.",
      ],
      [
        "Kindness makes space",
        "A little invitation made a big difference. There is room for everyone to bring their own bright idea. Who could you invite to play?",
        'Sunny: "Thank you for making room for me."\nPip: "Our game is better with you."',
        "End with warm smiles and a question for the audience.",
      ],
    ];
    p.scenes.forEach((s, i) => {
      [s.title, s.narration, s.dialogue, s.action] = content[i];
    });
  }
  if (id === "kindness") {
    animateInclusion(p);
    addDemoProduction(p);
  }
  return p;
}
