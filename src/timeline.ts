import { totalDuration } from "./model";
import type { Project, SceneElement } from "./model";

export function frameAt(project: Project, seconds: number) {
  let start = 0;
  const time = Math.max(0, Math.min(seconds, totalDuration(project)));
  for (let index = 0; index < project.scenes.length; index++) {
    const scene = project.scenes[index];
    if (time < start + scene.duration || index === project.scenes.length - 1) {
      return {
        scene,
        index,
        start,
        localTime: Math.min(time - start, scene.duration),
        progress: Math.min(1, (time - start) / scene.duration),
      };
    }
    start += scene.duration;
  }
  throw new Error("A cartoon needs at least one scene.");
}
export function sceneStart(project: Project, index: number) {
  return project.scenes.slice(0, index).reduce((n, s) => n + s.duration, 0);
}
export function motionAt(element: SceneElement, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  let x = element.x;
  let y = element.y;
  let rotation = element.rotation;
  let scale = element.scale;
  let opacity = 1;
  switch (element.motion) {
    case "enter-left":
      x -= (1 - Math.min(1, p * 3)) * 800;
      break;
    case "enter-right":
      x += (1 - Math.min(1, p * 3)) * 800;
      break;
    case "walk":
      x += Math.sin(p * Math.PI * 2) * 95;
      y -= Math.abs(Math.sin(p * Math.PI * 12)) * 5;
      break;
    case "bounce":
      y -= Math.abs(Math.sin(p * Math.PI * 4)) * 35;
      break;
    case "spin":
      rotation += p * 360;
      break;
    case "grow":
      scale *= 0.65 + Math.min(1, p * 2) * 0.35;
      break;
    case "fade":
      opacity = Math.min(1, p * 3);
      break;
  }
  return { x, y, rotation, scale, opacity };
}
