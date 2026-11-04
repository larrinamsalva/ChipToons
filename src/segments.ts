import type { Project } from "./model";
import { sceneStart } from "./timeline";
export const EXPORT_RECORDING_LEAD_SECONDS = 0.15;

export interface SceneRange {
  firstScene: number;
  lastScene: number;
}
export interface ExportSegment extends SceneRange {
  id: string;
  start: number;
  end: number;
  duration: number;
}
export function exportRange(project: Project, range?: SceneRange) {
  const firstScene = range?.firstScene ?? 0,
    lastScene = range?.lastScene ?? project.scenes.length - 1;
  if (
    !Number.isInteger(firstScene) ||
    !Number.isInteger(lastScene) ||
    firstScene < 0 ||
    lastScene < firstScene ||
    lastScene >= project.scenes.length
  )
    throw new Error("Choose a consecutive range of whole scenes.");
  const start = sceneStart(project, firstScene),
    end = sceneStart(project, lastScene) + project.scenes[lastScene].duration;
  return {
    firstScene,
    lastScene,
    start,
    end,
    duration: end - start,
    id: `${project.scenes[firstScene].id}:${project.scenes[lastScene].id}`,
  };
}
export function planSegments(
  project: Project,
  limit: number,
): { segments: ExportSegment[]; oversized: number[] } {
  if (!Number.isFinite(limit) || limit < 2 || limit > 120)
    throw new Error("Choose an export limit between 2 and 120 seconds.");
  const oversized = project.scenes.flatMap((s, i) =>
    s.duration > limit ? [i] : [],
  );
  if (oversized.length) return { segments: [], oversized };
  const segments: ExportSegment[] = [];
  let first = 0,
    duration = 0;
  for (let i = 0; i < project.scenes.length; i++) {
    if (duration + project.scenes[i].duration > limit + 1e-7) {
      segments.push(
        exportRange(project, { firstScene: first, lastScene: i - 1 }),
      );
      first = i;
      duration = 0;
    }
    duration += project.scenes[i].duration;
  }
  segments.push(
    exportRange(project, {
      firstScene: first,
      lastScene: project.scenes.length - 1,
    }),
  );
  return { segments, oversized };
}
export function rangeArtwork(project: Project, range: SceneRange) {
  const ids = new Set<string>();
  for (const scene of project.scenes.slice(
    range.firstScene,
    range.lastScene + 1,
  ))
    for (const e of scene.elements) {
      const id =
        e.assetId ??
        project.characters.find((c) => c.id === e.characterId)?.assetId;
      if (id) ids.add(id);
    }
  return project.assets.filter((a) => ids.has(a.id));
}
