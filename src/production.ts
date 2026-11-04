import { clone, totalDuration, uid } from "./model";
import type { Project, Scene } from "./model";
import type {
  AudioAsset,
  AudioCategory,
  AudioClip,
  Caption,
} from "./media-model";
import { frameAt, sceneStart, clamp } from "./timeline";

export function clipStart(project: Project, clip: AudioClip) {
  const i = clip.sceneId
    ? project.scenes.findIndex((s) => s.id === clip.sceneId)
    : -1;
  return clip.start + (i < 0 ? 0 : sceneStart(project, i));
}
export function clipOffset(clip: AudioClip, elapsed: number) {
  const span = clip.trimEnd - clip.trimStart;
  return clip.trimStart + (clip.loop ? elapsed % span : elapsed);
}
export function clipGain(clip: AudioClip, elapsed: number) {
  if (clip.muted || elapsed < 0 || elapsed >= clip.duration) return 0;
  return (
    clip.volume *
    Math.max(
      0,
      Math.min(
        1,
        clip.fadeIn ? elapsed / clip.fadeIn : 1,
        clip.fadeOut ? (clip.duration - elapsed) / clip.fadeOut : 1,
      ),
    )
  );
}
export function categoryBus(category: AudioCategory) {
  return category === "narration" || category === "dialogue"
    ? "voice"
    : category;
}
export function duckingWindows(project: Project) {
  if (!project.mixer.duckMusic || !project.mixer.voice) return [];
  const windows = project.audioClips
    .filter(
      (c) => categoryBus(c.category) === "voice" && !c.muted && c.volume > 0,
    )
    .map((c) => ({
      start: clipStart(project, c),
      end: clipStart(project, c) + c.duration,
    }))
    .sort((a, b) => a.start - b.start);
  const merged: typeof windows = [];
  for (const w of windows) {
    const last = merged.at(-1);
    if (last && w.start <= last.end + 0.4) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  return merged;
}
export function duckingAt(
  windows: { start: number; end: number }[],
  time: number,
) {
  let gain = 1;
  for (const w of windows)
    if (time >= w.start - 0.12 && time <= w.end + 0.28)
      gain = Math.min(
        gain,
        time < w.start
          ? 1 - (0.7 * (time - w.start + 0.12)) / 0.12
          : time > w.end
            ? 0.3 + (0.7 * (time - w.end)) / 0.28
            : 0.3,
      );
  return Math.max(0.3, Math.min(1, gain));
}
export function audioPlan(project: Project, start: number, end: number) {
  return project.audioClips.flatMap((clip) => {
    const absolute = clipStart(project, clip),
      from = Math.max(start, absolute),
      to = Math.min(end, absolute + clip.duration);
    if (clip.muted || to <= from) return [];
    const elapsed = from - absolute;
    return [
      {
        clip,
        from,
        to,
        elapsed,
        offset: clipOffset(clip, elapsed),
      },
    ];
  });
}
export function newAudioClip(
  project: Project,
  asset: AudioAsset,
  category: AudioCategory,
  sceneIndex: number,
  localTime = 0,
): AudioClip {
  const scene = project.scenes[sceneIndex],
    music = category === "music",
    start = music ? 0 : clamp(localTime, 0, scene.duration - 0.05);
  return {
    id: uid(),
    assetId: asset.id,
    name: asset.name.slice(0, 100),
    category,
    sceneId: music ? undefined : scene.id,
    start,
    trimStart: 0,
    trimEnd: asset.duration,
    duration: Math.min(
      asset.duration,
      (music ? totalDuration(project) : scene.duration) - start,
    ),
    volume: category === "music" ? 0.35 : 0.85,
    muted: false,
    loop: false,
    fadeIn: 0,
    fadeOut: 0,
  };
}
export function captionText(project: Project, seconds: number) {
  const f = frameAt(project, seconds);
  return project.captions
    .filter(
      (c) =>
        c.sceneId === f.scene.id &&
        f.localTime >= c.start &&
        f.localTime < c.end,
    )
    .map((c) => c.text)
    .join("\n");
}
export function captionsFromText(scene: Scene): Caption[] {
  const text = [scene.narration, scene.dialogue].filter(Boolean).join("\n"),
    words = text.trim().split(/\s+/).filter(Boolean),
    chunks: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length + word.length > 115 && line) {
      chunks.push(line);
      line = "";
    }
    line += (line ? " " : "") + word;
  }
  if (line) chunks.push(line);
  return chunks.slice(0, 100).map((text, i) => ({
    id: uid(),
    sceneId: scene.id,
    start: (i * scene.duration) / chunks.length,
    end: ((i + 1) * scene.duration) / chunks.length,
    text: text.slice(0, 280),
  }));
}
export function srt(
  project: Project,
  range = { start: 0, end: totalDuration(project) },
) {
  const timestamp = (t: number) => {
    const ms = Math.round(t * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return project.captions
    .map((c) => ({
      ...c,
      offset: sceneStart(
        project,
        project.scenes.findIndex((s) => s.id === c.sceneId),
      ),
    }))
    .sort((a, b) => a.offset + a.start - b.offset - b.start)
    .filter(
      (c) => c.offset + c.end > range.start && c.offset + c.start < range.end,
    )
    .map(
      (c, i) =>
        `${i + 1}\n${timestamp(Math.max(0, c.offset + c.start - range.start))} --> ${timestamp(Math.min(range.end, c.offset + c.end) - range.start)}\n${c.text}\n`,
    )
    .join("\n");
}
// Scene-bound media follows scene edits. Sources are retained even after all uses are removed.
export function reconcileProduction(
  project: Project,
  scenes: Scene[],
): Pick<Project, "audioClips" | "captions"> {
  const total = scenes.reduce((n, s) => n + s.duration, 0),
    old = new Map(project.scenes.map((s) => [s.id, s]));
  const audioClips = project.audioClips.flatMap((c) => {
    const scene = c.sceneId
      ? scenes.find((s) => s.id === c.sceneId)
      : undefined;
    if (c.sceneId && !scene) return [];
    const ratio = scene ? scene.duration / old.get(scene.id)!.duration : 1,
      limit = scene?.duration ?? total,
      start = clamp(c.start * ratio, 0, limit - 0.02),
      duration = Math.max(0.01, Math.min(c.duration, limit - start));
    return [
      {
        ...c,
        start,
        duration,
        fadeIn: Math.min(c.fadeIn, duration),
        fadeOut: Math.min(c.fadeOut, duration),
      },
    ];
  });
  const captions = project.captions.flatMap((c) => {
    const s = scenes.find((s) => s.id === c.sceneId);
    if (!s) return [];
    const ratio = s.duration / old.get(s.id)!.duration;
    return [
      {
        ...c,
        start: c.start * ratio,
        end: Math.min(s.duration, c.end * ratio),
      },
    ];
  });
  return { audioClips, captions };
}
export function duplicateSceneMedia(
  project: Project,
  scene: Scene,
  copy: Scene,
) {
  return {
    audioClips: [
      ...project.audioClips,
      ...project.audioClips
        .filter((c) => c.sceneId === scene.id)
        .map((c) => ({ ...clone(c), id: uid(), sceneId: copy.id })),
    ],
    captions: [
      ...project.captions,
      ...project.captions
        .filter((c) => c.sceneId === scene.id)
        .map((c) => ({ ...clone(c), id: uid(), sceneId: copy.id })),
    ],
  };
}
