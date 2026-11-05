import { readAudio } from "./audio-files";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { LITTLE_FIXERS_OPENING } from "./little-fixers-opening-script";
import { validateProject } from "./model";
import type { Emotion, Project } from "./model";
import { applyWorkshopTake } from "./picture-demo";
import { blankLine, scriptCaptions, withScript } from "./script";

export const SCOUT_VOICED_TITLE =
  "Little Fixers Club — Scout Walks and Talks (34-second voiced cartoon)";

const voiceFiles = import.meta.glob<string>(
  "./samples/little-fixers-opening/*.mp3",
  { query: "?inline", import: "default" },
);

// These three original, approved lines were recorded for the same series.
// Reusing the existing takes is not AI text-to-speech, a fabricated recording,
// or new actor approval. The exact wording must match the embedded audio.
const lines = [
  {
    file: "welcome-1", at: 0.8, emotion: "excited" as const,
    text: LITTLE_FIXERS_OPENING[5].lines[0][1],
  },
  {
    file: "welcome-2", at: 6.4, emotion: "happy" as const,
    text: LITTLE_FIXERS_OPENING[5].lines[1][1],
  },
  {
    file: "bench-1", at: 20.4, emotion: "calm" as const,
    text: LITTLE_FIXERS_OPENING[7].lines[0][1],
  },
] satisfies Array<{ file: string; at: number; text: string; emotion: Emotion }>;

/**
 * Full-body vector Scout walks with alternating limbs while saying the
 * same original Little Fixers lines voiced in PR #25. Approved recordings,
 * real waveform-driven mouth openings and readable captions are preserved.
 * This creates a NEW standalone project; the silent #30 pilot remains intact.
 */
export async function littleFixersScoutVoiced(): Promise<Project> {
  let project = littleFixersFullBodyPilot();
  const scene = project.scenes[0];
  const scoutId = project.characters[0].id;
  project = {
    ...project,
    title: SCOUT_VOICED_TITLE,
    templateId: "little-fixers-scout-voiced",
    lesson: "Watch, notice and ask a trusted grown-up before touching unsafe tools.",
    idea: "A full-body original cartoon character walks, speaks, looks, points, and teaches safe workshop choices.",
    scriptOptions: { pace: 140, pause: 0.8, seriesTitle: "Little Fixers Club" },
    scenes: [withScript({
      ...scene,
      title: "Scout says hello and shows the safe workshop",
      action: "Scout takes an actual alternating-leg walk to the bench, greets the audience, talks with synchronized lips, pauses, and points to the adult-controlled toolbox.",
    }, {
      acting: "Friendly and energetic; camera follows Scout walking, then turns toward the safe work area.",
      emotion: "Welcoming and curious",
      lines: lines.map(line => ({
        ...blankLine("dialogue", line.text),
        speakerId: scoutId,
      })),
    })],
  };

  const context = new AudioContext({ sampleRate: 24000 });
  try {
    for (const [index, line] of lines.entries()) {
      const key = `./samples/little-fixers-opening/${line.file}.mp3`;
      const loader = voiceFiles[key];
      if (!loader) throw new Error(`Missing original Little Fixers approved take: ${key}`);
      const url = await loader();
      const blob = await (await fetch(url)).blob();
      const asset = await readAudio(new File([blob], `Scout voice · ${line.file}.mp3`, {
        type: "audio/mpeg",
      }));
      const currentLine = project.scenes[0].script!.lines[index];
      const result = await applyWorkshopTake(project, 0, currentLine, asset, context, line.at, line.emotion);
      project = result.project;
    }
    project.captions = scriptCaptions(project, project.scenes[0]);
  } finally {
    await context.close();
  }
  return validateProject(project);
}
