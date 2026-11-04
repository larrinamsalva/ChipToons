import audio from "./samples/hello-heart-narrator.mp3?inline";
import { readAudio } from "./audio-files";
import type { Project } from "./model";
import { blankLine, chooseScriptTake, scriptFor, withScript } from "./script";

export async function addHelloHeartSample(project: Project) {
  if (!project.scriptOptions?.helloHeart) throw new Error("This episode has no starter voice to add.");
  const scene = project.scenes[0];
  const script = scriptFor(scene);
  const words = "At the park, one kind hello helps a new friend feel welcome.";
  const narration = { ...blankLine("narration", words), delivery: "Warmly, with a friendly pause." };
  const cast = project.characters.filter(character => scene.elements.some(element => element.characterId === character.id));
  const lead = cast[0], friend = cast[1];
  const hello = { ...blankLine("dialogue", "Hello! Would you like to sit with us?"),
    speakerId: lead?.id, delivery: "Give a gentle wave." };
  const answer = { ...blankLine("dialogue", "Yes, please. Thank you for making room."),
    speakerId: friend?.id, delivery: "Smile when you answer." };
  const blob = await (await fetch(audio)).blob();
  const source = await readAudio(new File([blob], "A Hello Heart · original sample narrator.mp3", { type: "audio/mpeg" }),
    undefined, project.mediaVersion === 1, project.audioAssets);
  const next: Project = {
    ...project, scriptOptions: { ...project.scriptOptions, helloHeart: undefined },
    scenes: [withScript({
      ...scene, question: scene.question || "How does a friendly hello feel?",
    }, { ...script,
      acting: script.acting || "Wave a friendly hello, then listen quietly.",
      emotion: script.emotion || "Start curious and end with a small smile.",
      lines: [narration, hello, answer, ...script.lines],
    }), ...project.scenes.slice(1)],
  };
  return chooseScriptTake(next, narration.id, source, true);
}
