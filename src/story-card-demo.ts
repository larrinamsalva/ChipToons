import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { presetAnimation } from "./presets";
import { kindHeartsCrew } from "./series-starter";
import { starterProject } from "./planner";
import { blankLine, chooseScriptTake, scriptCaptions, setLineApproval, withScript } from "./script";
import { makeScene, totalDuration, uid, validateProject } from "./model";
import type { Project, Scene } from "./model";
import { defaultCardOptions, newStoryCard, reviewStoryCard } from "./story-card-studio";
import type { CardOptions } from "./story-card-studio";
import { STORY_CARD_DEMO } from "./story-card-model";
import type { StoryCard, StoryCardKind } from "./story-card-model";

const noticeText = "Shine sees a friend standing alone. Shine waves and asks, would you like to join us?";
const recapText = "We can make room, explain the game, and give our new friend time to answer.";
const palette = {
  opening: "#ffe6af", episode: "#e7e6fa", chapter: "#d4efdf",
  recap: "#fce4ed", thanks: "#e2f1f7", credits: "#f6e9d6",
} as const;

export function storyCardDemo() {
  const crew = kindHeartsCrew();
  const cast = [crew.artwork[2], crew.artwork[5]];
  const characters = cast.map((item, index) => ({
    ...item.character!, seriesCastId: crew.plan.cast[index ? 5 : 2].id,
  }));
  const beat = (title: string, duration: number, chapter: Scene["chapter"], action: string): Scene => {
    const scene = makeScene(characters);
    return { ...scene, title, duration, chapter, background: "playground", action, narration: "", dialogue: "", transition: "cut",
      elements: scene.elements.map((element, i) => ({ ...element, x: i ? 557 : 245, motion: "still",
        animation: presetAnimation({ ...element, x: i ? 557 : 245, motion: "still" }, duration,
          i ? "nod" : "wave", 0.7, 2.6, characters[i].puppet) })) };
  };
  const hello = withScript(beat("Notice a friend", 9, "introduction", "Shine waves gently to a quiet friend."),
    { acting: "Give the friend time to answer.", emotion: "Curious and kind", lines: [blankLine("narration", noticeText)] });
  const invitation = beat("Make a little room", 10, "resolution", "Helping Hands listens and makes space in the game.");
  const learning = { id: uid(), text: "Give a new friend time to answer.", at: 1 };
  invitation.learningSteps = [learning];
  invitation.participation = [{ id: uid(), kind: "choose", at: 0.65, askFor: 1.7, thinkFor: 3, revealFor: 3.25,
    question: "What could we say to a friend who wants to join?", feedback: "Say, “Would you like to play with us?” Then give them time to answer.",
    choices: [{ text: "Would you like to play?", icon: "heart" }, { text: "Hurry up!", icon: "star" }], answer: 0, stepId: learning.id }];
  const finish = beat("Play together", 7, "closing", "The friends make space and play together.");
  const original = starterProject();
  let project: Project = { ...original, title: STORY_CARD_DEMO, characters, scenes: [hello, invitation, finish],
    scriptOptions: { seriesTitle: "The Kind Hearts Crew", pace: 110, pause: 0.5 } };
  function insert(kind: StoryCardKind, duration: number, card: Partial<StoryCard>, options: Partial<CardOptions> = {}) {
    const first = newStoryCard(project, kind, { series: "The Kind Hearts Crew", title: "A Little Room for a Friend", number: 1, defaults: undefined });
    const draft: StoryCard = { ...first, ...card, style: { ...first.style, paper: palette[kind], ...card.style } };
    const next = reviewStoryCard(project, draft, { ...defaultCardOptions(project, kind, 0), background: "playground", duration, ...options });
    project = next.project;
    return project.scenes[next.index];
  }
  const opening = insert("opening", 5, { subtitle: "Small acts of kindness make room." }, { cast: true, sound: "melody" });
  opening.storyCard!.style = { ...opening.storyCard!.style, motion: "heart", size: 38 };
  opening.cameraShots = [{ id: uid(), style: "move", start: 1.1, end: 5, move: 2.1,
    frame: { x: 400, y: 242, zoom: 1.14 }, targets: [], follow: false, offset: { x: 0, y: 0 },
    placement: "center", note: "Move gently toward the playground as the crew welcomes viewers." }];
  insert("episode", 4, { subtitle: "Kindness makes room for everyone." }, { sound: "transition" });
  insert("chapter", 4, { title: "Time to help", subtitle: "Let’s find a friendly way to invite someone in." },
    { after: project.scenes.findIndex(scene => scene.id === hello.id), chapter: "resolution" });
  const recap = insert("recap", 8, { points: [
    { text: "Notice when someone is on their own." }, { text: "Make space and explain the game." },
    { text: learning.text, source: { sceneId: invitation.id, stepId: learning.id } },
  ] });
  project.scenes = project.scenes.map(scene => scene.id === recap.id ? withScript(scene, {
    acting: "Read slowly and leave time to remember.", emotion: "Warm", lines: [blankLine("narration", recapText)],
  }) : scene);
  const goodbye = insert("thanks", 5, { subtitle: "Try one kind invitation today." }, { cast: true, sound: "reassure" });
  goodbye.storyCard!.style = { ...goodbye.storyCard!.style, motion: "heart", size: 38 };
  insert("credits", 17, { title: "Made with kindness", credits: [
    { role: "Story and artwork", name: "ChipToons Studio demonstration", license: "", url: "" },
    { role: "Music and sounds", name: "Original ChipToons sounds", license: "", url: "" },
    { role: "Narration", name: "Original words read with offline synthetic speech", license: "", url: "" },
  ], scroll: true });
  const bed = builtInSound("garden");
  project.audioAssets.push(bed);
  project.audioClips.push({ ...newAudioClip(project, bed, "music", 0), loop: true,
    duration: totalDuration(project), volume: 0.17, fadeIn: 0.4, fadeOut: 0.65 });
  project.mixer.duckMusic = true;
  return validateProject(project);
}

export async function voicedStoryCardDemo() {
  const [{ default: notice }, { default: recap }, { readAudio }] = await Promise.all([
    import("./samples/story-cards/notice.mp3?inline"), import("./samples/story-cards/recap.mp3?inline"), import("./audio-files"),
  ]);
  const sounds = await Promise.all([notice, recap].map(async (url, i) => readAudio(new File(
    [await (await fetch(url)).blob()], i ? "Kind Hearts Crew · recap narration.mp3" : "Kind Hearts Crew · opening story narration.mp3", { type: "audio/mpeg" },
  ))));
  let project = storyCardDemo();
  const lines = project.scenes.flatMap(scene => scene.script?.lines ?? []);
  for (const [index, line] of lines.entries()) {
    project = chooseScriptTake(project, line.id, sounds[index], true);
    project = setLineApproval(project, line.id, true);
  }
  for (const scene of project.scenes) if (scene.script) project = { ...project, captions: scriptCaptions(project, scene) };
  return validateProject(project);
}
