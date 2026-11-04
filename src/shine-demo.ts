import recording from "./samples/shine-says-hello.mp3?inline";
import { createAssistantDraft } from "./assistant";
import { readAudio } from "./audio-files";
import { validateProject } from "./model";
import { presetAnimation } from "./presets";
import { blankLine, chooseScriptTake, setLineApproval, withScript } from "./script";
import { episodeBrief } from "./series";
import { kindHeartsCrew } from "./series-starter";

export async function shineTalkDemo() {
  const { plan, artwork } = kindHeartsCrew();
  const index = plan.cast.findIndex(member => member.name === "Shine");
  const cast = plan.cast[index];
  const lineText = "Hello, neighbor! I am Shine. Would you like to sit with us?";
  const title = "A Hello Heart — Shine Says Hello";
  const { project } = createAssistantDraft({
    ...episodeBrief(plan.episodes[0], 1),
    title,
  }, [{ name: cast.name, seriesCastId: cast.id, library: artwork[index] }]);
  const scene = { ...project.scenes[0], title: "Shine welcomes a neighbor", transition: "cut" as const,
    narration: "", action: "Shine gives a friendly wave, pauses, then invites a neighbor to sit.",
    question: "What could you say to help someone feel welcome?", duration: 8 };
  const actor = { ...scene.elements[0], x: 400, y: 338, scale: 1.5 };
  const character = project.characters[0];
  const wave = presetAnimation(actor, scene.duration, "wave", 0.25, 3, character.puppet);
  actor.animation = { ...wave, keyframes: wave.keyframes.map(key => ({
    ...key, mouth: "auto", heart: "warm", heartStrength: 0.75,
  })) };
  const line = { ...blankLine("dialogue", lineText), speakerId: actor.characterId,
    delivery: "A gentle wave and a quiet pause after saying your name." };
  const original = await (await fetch(recording)).blob();
  const audio = await readAudio(new File([original], "Shine’s original greeting.mp3", { type: "audio/mpeg" }));
  const linked = chooseScriptTake({
    ...project, scenes: [withScript({ ...scene, elements: [actor] },
      { lines: [line], acting: scene.action, emotion: "A friendly welcome" })],
    scriptOptions: { pace: 120, pause: 1, seriesTitle: plan.name },
  }, line.id, audio, true);
  linked.audioClips[0].start = 0.3;
  return validateProject(setLineApproval(linked, line.id, true));
}
