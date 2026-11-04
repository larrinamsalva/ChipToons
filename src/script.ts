import { reconcileParticipation } from "./participation-model";
import { reconcileLearningSteps } from "./transform-motion";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { uid } from "./model";
import type { Project, Scene } from "./model";
import { captionsFromText, newAudioClip } from "./production";
import { MAX_CAPTIONS } from "./media-model";
import type { AudioAsset, AudioClip } from "./media-model";
import { DEFAULT_SCRIPT, MAX_LINE_TAKES, spokenFields } from "./script-model";
import type { SceneScript, ScriptLine } from "./script-model";

export const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;

export function blankLine(kind: ScriptLine["kind"], text = ""): ScriptLine {
  return { id: uid(), kind, text, delivery: "", takes: [] };
}

export function scriptFor(scene: Scene): SceneScript {
  return scene.script ?? {
    acting: "", emotion: "",
    lines: (["narration", "dialogue"] as const).flatMap(kind =>
      scene[kind] ? [blankLine(kind, scene[kind])] : []),
  };
}

export function withScript(scene: Scene, script: SceneScript): Scene {
  const next = { ...scene, script, ...spokenFields(script.lines) };
  if (next.learningSteps) next.learningSteps = reconcileLearningSteps(next, scene);
  return reconcileParticipation(next);
}

export function findScriptLine(project: Project, id: string) {
  for (const [index, scene] of project.scenes.entries()) {
    const line = scene.script?.lines.find(line => line.id === id);
    if (line) return { index, scene, line };
  }
}

export function editScriptLine(project: Project, sceneId: string, line: ScriptLine) {
  return {
    ...project,
    scenes: project.scenes.map(scene => scene.id === sceneId && scene.script
      ? withScript(scene, { ...scene.script, lines: scene.script.lines.map(current => current.id === line.id ? line : current) })
      : scene),
  };
}

export function scriptTiming(project: Project, scene: Scene) {
  const options = project.scriptOptions ?? DEFAULT_SCRIPT;
  const lines = scene.script?.lines ?? [scene.narration, scene.dialogue].map(text => ({ text, pause: undefined }));
  let words = 0, speech = 0, pauses = 0;
  const starts = lines.map(line => {
    const start = speech + pauses;
    const count = wordCount(line.text);
    words += count;
    speech += count * 60 / options.pace;
    if (count) pauses += line.pause ?? options.pause;
    return start;
  });
  return { starts, words, speech, pauses, total: speech + pauses };
}

function signature(line: ScriptLine) {
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify([line.kind, line.speakerId ?? "", line.text, line.delivery]))));
}

export function selectedTake(project: Project, line: ScriptLine) {
  const clip = project.audioClips.find(clip => clip.id === line.clipId);
  const take = line.takes.find(take => take.assetId === clip?.assetId);
  return { clip, take };
}

export function recordingNeedsRoom(project: Project, clip: AudioClip) {
  const scene = project.scenes.find(item => item.id === clip.sceneId);
  return !!scene && !clip.loop && clip.start + clip.duration >= scene.duration - 0.001 &&
    clip.duration + 0.02 < clip.trimEnd - clip.trimStart;
}

export function lineStatus(project: Project, line: ScriptLine, missing: Set<string> = new Set()) {
  const { clip, take } = selectedTake(project, line);
  if (!clip || !take) return line.takes.length ? "Needs review" : "Not recorded";
  if (missing.has(clip.assetId) || take.words !== signature(line) || clip.muted || clip.volume === 0 || recordingNeedsRoom(project, clip)) return "Needs review";
  return take.approved ? "Approved" : "Recording assigned";
}

export function setLineApproval(project: Project, lineId: string, approved: boolean) {
  const found = findScriptLine(project, lineId);
  if (!found) throw new Error("Choose a script line first.");
  const { line, scene } = found;
  const { clip } = selectedTake(project, line);
  if (!clip) throw new Error("Save and choose a recording before approving.");
  if (approved && recordingNeedsRoom(project, clip))
    throw new Error("Adjust the trim or allow more scene time before approving this recording.");
  return editScriptLine(project, scene.id, { ...line,
    takes: line.takes.map(take => take.assetId === clip.assetId
      ? { ...take, approved, ...(approved ? { words: signature(line) } : {}) } : take),
  });
}

// A preferred take is a normal audio clip. Alternate originals are never added
// to the mixer and remain protected by the project's existing source references.
export function chooseScriptTake(project: Project, lineId: string, asset: AudioAsset, isNew = false) {
  const found = findScriptLine(project, lineId);
  if (!found || !found.line.text.trim()) throw new Error("Add words to this script line before saving a recording.");
  const { index, line, scene } = found;
  const old = selectedTake(project, line).clip;
  const existing = line.takes.find(take => take.assetId === asset.id);
  if (!existing && (!isNew || line.takes.length >= MAX_LINE_TAKES))
    throw new Error("This line already has 12 takes. Keep its originals and use a new line for further recording.");
  if (old?.assetId === asset.id && !isNew) return project;
  const estimate = scriptTiming(project, scene).starts[scene.script!.lines.indexOf(line)];
  const start = old?.start ?? Math.min(estimate, Math.max(0, scene.duration - asset.duration));
  const clip = newAudioClip(project, asset, line.kind, index, start);
  clip.characterId = line.speakerId;
  if (old) {
    clip.id = old.id;
    clip.name = asset.name.slice(0, 100);
    clip.volume = old.volume;
    clip.muted = old.muted;
  }
  const next = editScriptLine(project, scene.id, {
    ...line, clipId: clip.id,
    takes: existing ? line.takes : [...line.takes, { assetId: asset.id, words: signature(line) }],
  });
  return { ...next,
    audioAssets: project.audioAssets.some(source => source.id === asset.id) ? project.audioAssets : [...project.audioAssets, asset],
    audioClips: old ? project.audioClips.map(item => item.id === old.id ? clip : item) : [...project.audioClips, clip],
  };
}

// Generic timeline edits can explicitly remove or move a line's preferred clip.
// Leave its takes available, and leave the timeline edit and original untouched.
export function reconcileScriptClips(project: Project): Project {
  const clips = new Map(project.audioClips.map(clip => [clip.id, clip]));
  let changed = false;
  const scenes = project.scenes.map(scene => {
    if (!scene.script) return scene;
    const lines = scene.script.lines.map(line => {
      if (!line.clipId) return line;
      const clip = clips.get(line.clipId);
      if (clip && clip.sceneId === scene.id && clip.category === line.kind &&
          clip.characterId === line.speakerId && line.takes.some(take => take.assetId === clip.assetId)) return line;
      changed = true;
      return { ...line, clipId: undefined };
    });
    return { ...scene, script: { ...scene.script, lines } };
  });
  return changed ? { ...project, scenes } : project;
}

export function duplicateScript(copy: Scene, oldClips: AudioClip[], newClips: AudioClip[]) {
  if (!copy.script) return copy;
  const clips = new Map(oldClips.map((clip, index) => [clip.id, newClips[index]?.id]));
  const ids = new Map(copy.script.lines.map(line => [line.id, uid()]));
  let updated = copy.learningSteps ? { ...copy, learningSteps: copy.learningSteps.map(step =>
    ({ ...step, lineId: step.lineId ? ids.get(step.lineId) : undefined })) } : copy;
  if (copy.participation) updated = { ...updated, participation: copy.participation.map(moment => ({
    ...moment, questionLineId: moment.questionLineId ? ids.get(moment.questionLineId) : undefined,
    answerLineId: moment.answerLineId ? ids.get(moment.answerLineId) : undefined,
  })) };
  return withScript(updated, { ...copy.script, lines: copy.script.lines.map(line =>
    ({ ...line, id: ids.get(line.id)!, clipId: line.clipId ? clips.get(line.clipId) : undefined })) });
}

export function scriptCaptions(project: Project, scene: Scene) {
  const lines = scene.script?.lines ?? [];
  const timing = scriptTiming(project, scene);
  const existing = project.captions.filter(caption => caption.sceneId === scene.id);
  const drafts = lines.flatMap((line, index) => {
    if (!line.text.trim()) return [];
    const clip = selectedTake(project, line).clip;
    const start = clip?.start ?? timing.starts[index];
    const duration = Math.min(scene.duration - start,
      clip?.duration ?? Math.max(1, wordCount(line.text) * 60 / (project.scriptOptions ?? DEFAULT_SCRIPT).pace));
    if (duration < 0.05) return [];
    return captionsFromText({ ...scene, duration, narration: line.text, dialogue: "" })
      .map(caption => ({ ...caption, start: start + caption.start, end: Math.min(scene.duration, start + caption.end) }));
  });
  const accepted = [...existing];
  for (const draft of drafts) {
    if (project.captions.length + accepted.length - existing.length >= MAX_CAPTIONS) break;
    if (!accepted.some(caption => draft.start < caption.end - 0.0001 && draft.end > caption.start + 0.0001))
      accepted.push(draft);
  }
  return [...project.captions, ...accepted.slice(existing.length)];
}

export function scriptText(project: Project) {
  const title = project.scriptOptions?.seriesTitle;
  return [
    ...(title ? [title] : []), project.title, project.lesson, "",
    ...project.scenes.flatMap((scene, i) => [
      `${i + 1}. ${scene.title} · ${scene.chapter ?? "Scene"} · ${scene.duration}s`,
      scene.action, scene.script?.acting, scene.script?.emotion,
      ...(scene.script ? scene.script.lines.map((line, index) => {
        const speaker = line.kind === "narration" ? "Narrator" :
          project.characters.find(character => character.id === line.speakerId)?.name ?? "Unassigned speaker";
        return `${index + 1}. ${speaker}${line.delivery ? ` (${line.delivery})` : ""}: ${line.text}`;
      }) : [`Narrator: ${scene.narration}`, scene.dialogue]),
      scene.question ? `Learning question: ${scene.question}` : "", "",
    ]),
  ].filter(line => line !== undefined).join("\n");
}
