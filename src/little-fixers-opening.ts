import { readAudio } from "./audio-files";
import { newFocusGraphic } from "./focus-studio";
import { placeLibraryItem } from "./library";
import { LITTLE_FIXERS_EPISODE_TITLE, LITTLE_FIXERS_OPENING } from "./little-fixers-opening-script";
import { makeScene, uid, validateProject } from "./model";
import type { Asset, Project, Scene, SceneElement } from "./model";
import { newParticipation } from "./participation-studio";
import { applyWorkshopTake, littleFixersWorkshopArt, workshopHostKeys } from "./picture-demo";
import { defaultPanel, newPictureProject } from "./picture-studio";
import { newAudioClip } from "./production";
import { blankLine, scriptCaptions, withScript } from "./script";
import { builtInSound } from "./sounds";
import { makeStoryCardScene, newStoryCard } from "./story-card-studio";
import { elementBase } from "./timeline";
import { starterLocations } from "./world-starters";

const voices = import.meta.glob<string>("./samples/little-fixers-opening/*.mp3", { query: "?inline", import: "default" });
type BeatId = (typeof LITTLE_FIXERS_OPENING)[number]["id"];
type HostKeys = Parameters<typeof workshopHostKeys>[1];
const hostBeats: Record<Exclude<BeatId, "title">, HostKeys> = {
  wobble: [[0, 0, -12], [2.2, 6, 14], [3.25, 10, 22], [4.25, -13, 5, "surprised"],
    [5.6, -9, 1], [8.6, 9, 21, "worried"], [11.1, 6, 14], [14.4, 0, -4]],
  aside: [[0, 2, -7], [2.1, 6, 26], [4.5, 2, 11], [6.4, 11, 23], [8.7, -5, 7],
    [11.7, 10, 19], [14.5, 0, -8]],
  joint: [[0, 3, 2], [1.8, 9, 25], [4, 12, 17], [8.8, 6, 22], [11, -8, -5],
    [13.8, 5, 9]],
  ask: [[0, 0, 1], [1.1, -10, 14], [1.9, 10, 13], [2.6, -7, 3],
    [6.1, 8, 17], [7, -5, 8], [10.8, 0, 27, "excited"], [13.7, 3, -6]],
  welcome: [[0, -4, -12], [1.3, 5, 30, "excited"], [2.5, -4, 10], [5.5, 6, 20],
    [7.2, 12, 31], [9.4, 5, 6], [11.3, -4, 18], [13.7, 7, 26], [16.5, 0, -6]],
  choose: [[0, 0, -8], [2.4, 8, 22], [4.5, 2, -5], [7.5, -6, -10],
    [10.4, 9, 25], [12.2, -6, 14], [15.8, 6, 8], [17.5, 0, -7]],
  bench: [[0, 3, -10], [2, -8, 8], [3.9, 5, 12], [7.2, -14, -22], [9.7, -9, -12],
    [12.5, 5, 27, "excited"], [14.2, -4, 12], [15.7, 0, -6]],
};

function teachingLabel(scene: Scene, at: number, length: number, text: string, y: number) {
  return { ...newFocusGraphic(scene, at), kind: "label" as const, text, length,
    target: { kind: "screen" as const, x: 604, y } };
}

export async function littleFixersOpening(source: Asset): Promise<Project> {
  const { puppet, chair } = await littleFixersWorkshopArt(source);
  const workshop = starterLocations().find(item => item.id === "starter-location-workshop")!;
  const original = newPictureProject(source, defaultPanel, false);
  const seed = placeLibraryItem(placeLibraryItem(placeLibraryItem(original, 0, {
    ...workshop,
    location: { ...workshop.location!, elements: workshop.location!.elements
      .filter(element => element.prop === "shelf" || element.prop === "table" || element.prop === "toolbox") },
  }), 0, puppet), 0, chair);
  const host = seed.scenes[0].elements.find(element => element.characterId)!;
  const prop = seed.scenes[0].elements.find(element => element.assetId)!;
  const scenery = seed.scenes[0].elements.filter(element => element !== host && element !== prop);
  let project: Project = {
    ...seed, title: LITTLE_FIXERS_EPISODE_TITLE, plannedMinutes: 2, targetAge: "4–7",
    setting: "Little Fixers workshop",
    idea: "The Little Fixers host spots a wobbly chair, looks at the loose joint, and teaches the club to look, stop, and ask a grown-up.",
    lesson: "Leave a wobbly chair unused until a trusted grown-up checks whether it can be repaired safely.",
    scriptOptions: { pace: 140, pause: 0.8, seriesTitle: "Little Fixers Club" },
    outline: {
      beginning: "A chair wobbles in the workshop.",
      conflict: "The joint is loose and the chair should not be used.",
      response: "Look, stop, and ask a trusted grown-up.",
      ending: "Welcome the club and preview getting the work area ready.",
    },
    characters: seed.characters.filter(character => character.id === host.characterId),
  };
  const card = newStoryCard(project, "episode", {
    series: "Little Fixers Club", title: "Fix It, Don't Toss It!", number: 1, defaults: undefined,
  });
  project.scenes = LITTLE_FIXERS_OPENING.map((beat, index) => {
    if (beat.id === "title") return {
      ...makeStoryCardScene(project, card, {
        duration: beat.seconds, after: index - 1, chapter: "introduction", background: "classroom", cast: false, sound: "",
      }),
      action: beat.action, transition: "cut",
    };
    const actor: SceneElement = { ...host, id: uid(),
      x: beat.id === "choose" ? 240 : beat.id === "bench" ? 335 : 282,
      y: 422, scale: beat.id === "choose" ? 1.48 : 1.72 };
    const seat: SceneElement = { ...prop, id: uid(), x: beat.id === "wobble" || beat.id === "joint" ? 530 : 648, y: 376 };
    actor.animation = workshopHostKeys(actor, hostBeats[beat.id]);
    const lines = beat.lines.map(([, text]) => ({ ...blankLine("dialogue", text), speakerId: actor.characterId }));
    const scene = withScript({
      ...makeScene([], index), title: beat.title, duration: beat.seconds, action: beat.action,
      background: "classroom", transition: "cut", chapter: index < 4 ? "opening" : "introduction",
      elements: [...scenery.map(element => ({ ...element, id: uid() })), actor, seat],
    }, { acting: "Warm workshop host. Leave time to notice and answer.", emotion: "Curious and reassuring", lines });
    if (beat.id === "wobble") {
      const wobble = [[0, 0], [3.05, 0], [3.38, -13], [3.72, 10], [4.04, -8], [4.4, 4], [4.72, 0]];
      seat.animation = { idle: "none", blink: false, keyframes: wobble.map(([time, rotation]) => ({
        ...elementBase(seat), id: uid(), time, rotation, easing: "linear",
      })) };
    }
    if (beat.id === "aside") scene.focusGraphics = [teachingLabel(scene, 2.8, 9, "Set aside", 105)];
    if (beat.id === "joint") {
      scene.cameraShots = [{
        id: uid(), style: "detail", start: 2.4, end: 9.9, frame: { x: 530, y: 327, zoom: 2.05 },
        move: 0, targets: [], follow: false, offset: { x: 0, y: 0 }, placement: "center",
        note: "Frame the loose joint where the back meets the seat.",
      }];
      scene.focusGraphics = [{
        ...newFocusGraphic(scene, 4.9, { objectId: seat.id }), size: 57, length: 4.6,
        target: { kind: "object", id: seat.id, x: seat.x, y: seat.y, dx: 26, dy: -35 },
      }];
    }
    if (beat.id === "ask") scene.focusGraphics = [
      teachingLabel(scene, 2.7, 6.8, "Wait for a grown-up", 105),
      teachingLabel(scene, 10.45, 4.35, "Fix it, don't toss it!", 105),
    ];
    if (beat.id === "welcome") scene.focusGraphics = [
      teachingLabel(scene, 6.65, 8, "1. Look", 58),
      teachingLabel(scene, 7.35, 7.3, "2. Stop", 119),
      teachingLabel(scene, 8.05, 6.6, "3. Ask", 180),
    ];
    if (beat.id === "choose") scene.participation = [{
      ...newParticipation(scene, 0.65), kind: "choose", askFor: 5, thinkFor: 4.65, revealFor: 6.6,
      question: "What should we do with the wobbly chair?",
      choices: [{ text: "Sit on the chair", icon: "dot" }, { text: "Ask a grown-up", icon: "star" }],
      answer: 1, feedback: "Ask a grown-up to check the chair before anyone uses it.",
      speakerId: actor.characterId, questionLineId: lines[0].id, answerLineId: lines[1].id,
    }];
    if (beat.id === "bench") {
      scene.cameraShots = [{
        id: uid(), style: "medium", start: 6.15, end: 11.2, frame: { x: 278, y: 243, zoom: 1.3 },
        move: 1, targets: [], follow: false, offset: { x: 0, y: 0 }, placement: "center",
        note: "Bring the workbench into view for the next step.",
      }];
      scene.focusGraphics = [teachingLabel(scene, 11.25, 4.5, "Next: Safety first", 105)];
    }
    return scene;
  });

  const room = builtInSound("workshop"), wood = builtInSound("place");
  const melody = builtInSound("melody"), success = builtInSound("success");
  project.audioAssets = [room, wood, melody, success];
  project.audioClips = [
    { ...newAudioClip(project, room, "effects", 0), volume: 0.30 },
    { ...newAudioClip(project, wood, "effects", 0, 3.28), volume: 0.68 },
    { ...newAudioClip(project, melody, "music", 4), sceneId: project.scenes[4].id, volume: 0.28, fadeOut: 0.5 },
    { ...newAudioClip(project, success, "effects", 6, 14.7), volume: 0.36 },
  ];
  const context = new AudioContext({ sampleRate: 24000 });
  try {
    for (const [index, beat] of LITTLE_FIXERS_OPENING.entries()) {
      const scene = project.scenes[index];
      for (const [lineIndex, [at, , expression]] of beat.lines.entries()) {
        const url = await voices[`./samples/little-fixers-opening/${beat.id}-${lineIndex + 1}.mp3`]();
        const data = await (await fetch(url)).blob();
        const asset = await readAudio(new File([data], `Little Fixers · ${beat.title} · line ${lineIndex + 1}.mp3`,
          { type: "audio/mpeg" }));
        const take = await applyWorkshopTake(project, index, scene.script!.lines[lineIndex], asset, context, at, expression);
        project = take.project;
      }
      project.captions = scriptCaptions(project, project.scenes[index]);
    }
  } finally {
    await context.close();
  }
  return validateProject(project);
}
