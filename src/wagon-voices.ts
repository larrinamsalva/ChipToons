import notice from "./samples/wagon/notice.mp3?inline";
import shine from "./samples/wagon/shine.mp3?inline";
import help from "./samples/wagon/help.mp3?inline";
import adult from "./samples/wagon/adult.mp3?inline";
import roll from "./samples/wagon/roll.mp3?inline";
import lesson from "./samples/wagon/lesson.mp3?inline";
import { readAudio } from "./audio-files";
import { validateProject } from "./model";
import type { Project } from "./model";
import { chooseScriptTake, setLineApproval } from "./script";
import { WAGON_LINES } from "./transform-examples";

export async function withWagonVoices(project: Project, answerDelay = 0) {
  const recordings = { notice, shine, help, adult, roll, lesson };
  const audio = await Promise.all(WAGON_LINES.map(async ([name]) => {
    const blob = await (await fetch(recordings[name])).blob();
    return readAudio(new File([blob], `Wobbly Wagon · original synthetic ${name}.mp3`, { type: "audio/mpeg" }));
  }));
  let updated = project;
  for (const [index, [, sceneIndex, authoredStart, text]] of WAGON_LINES.entries()) {
    const start = !sceneIndex && index >= 2 ? authoredStart + answerDelay : authoredStart;
    const line = updated.scenes[sceneIndex].script!.lines.find(item => item.text === text)!;
    updated = chooseScriptTake(updated, line.id, audio[index], true);
    const chosen = updated.scenes[sceneIndex].script!.lines.find(item => item.id === line.id)!;
    updated = { ...updated, audioClips: updated.audioClips.map(clip => clip.id === chosen.clipId ? {
      ...clip, start, duration: Math.min(audio[index].duration, updated.scenes[sceneIndex].duration - start),
    } : clip) };
    updated = setLineApproval(updated, line.id, true);
  }
  return validateProject(updated);
}
