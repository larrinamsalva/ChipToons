import { hasCameraTrack, shotIssue } from "./camera-shots";
import type { CameraShot } from "./camera-shots";
import type { Project, Scene } from "./model";
import { newCameraShot } from "./shot-director";

/** Opt-in full-scene gentle zoom, reusing the normal camera and export pipeline.
 * Existing camera work, original PNGs and saved timelines are never overwritten. */
export function canStartFramefieldCinematicPush(project: Project, scene: Scene) {
  return project.templateId === "frame-sequence-storyboard" &&
    project.scenes.some(candidate => candidate.id === scene.id) &&
    scene.elements.some(element => element.kind === "art" &&
      !!element.frameSequence?.assetIds.length) &&
    !(scene.cameraShots?.length) && !hasCameraTrack(scene) &&
    scene.camera === "wide";
}

export function framefieldGentleCinematicPush(project: Project, scene: Scene): CameraShot {
  if (!canStartFramefieldCinematicPush(project, scene))
    throw new Error("A gentle push-in needs a PNG scene without authored camera shots or tracks.");
  const shot: CameraShot = {
    ...newCameraShot(project, scene, 0),
    style: "move",
    start: 0,
    end: scene.duration,
    move: scene.duration,
    frame: { x: 400, y: 225, zoom: 1.35 },
    targets: [],
    follow: false,
    offset: { x: 0, y: 0 },
    placement: "center",
    note: "Gentle cinematic push-in over the original PNG frames",
  };
  const issue = shotIssue([shot], scene);
  if (issue) throw new Error(issue);
  return shot;
}

/** The same original-PNG eligibility rules as push-in: no overwrite of
 * authored camera work. This view moves toward the selected side while
 * zooming slightly so the picture stays inside the viewport. */
export type FramefieldPanDirection = "left" | "right";

export function framefieldCinematicPanFrame(direction: FramefieldPanDirection) {
  if (direction !== "left" && direction !== "right")
    throw new Error("Choose a left or right cinematic pan.");
  return { x: direction === "left" ? 345 : 455, y: 225, zoom: 1.25 };
}

export function framefieldGentleCinematicPan(
  project: Project, scene: Scene, direction: FramefieldPanDirection,
): CameraShot {
  if (!canStartFramefieldCinematicPush(project, scene))
    throw new Error("A gentle pan needs a PNG scene without authored camera shots or tracks.");
  const shot: CameraShot = {
    ...newCameraShot(project, scene, 0),
    style: "move",
    start: 0,
    end: scene.duration,
    move: scene.duration,
    frame: framefieldCinematicPanFrame(direction),
    targets: [],
    follow: false,
    offset: { x: 0, y: 0 },
    placement: "center",
    note: `Gentle cinematic pan ${direction} with slight zoom over original PNG frames`,
  };
  const issue = shotIssue([shot], scene);
  if (issue) throw new Error(issue);
  return shot;
}

/** Keep start crops inside the original 800×450 picture as zoom varies.
 * The user chooses which artwork area to emphasize before the full reveal. */
export type FramefieldRevealFocus = "left" | "center" | "right";

export function framefieldRevealStartingView(
  zoom: number,
  focus: FramefieldRevealFocus = "center",
) {
  if (!Number.isFinite(zoom) || zoom < 1.15 || zoom > 1.85 ||
      !["left", "center", "right"].includes(focus))
    throw new Error("Choose a valid cinematic reveal focus and zoom.");
  const safeOffset = Math.round((400 - 400 / zoom) * 0.65 * 100) / 100;
  return {
    x: focus === "left" ? 400 - safeOffset :
      focus === "right" ? 400 + safeOffset : 400,
    y: 225,
    zoom,
  };
}

export function framefieldRevealFocusOf(view: { x: number }): FramefieldRevealFocus {
  return view.x < 399 ? "left" : view.x > 401 ? "right" : "center";
}

/** Optional close-to-wide reveal using the same Stage and WebM camera compositor. */
export function framefieldGentleCinematicReveal(project: Project, scene: Scene): CameraShot {
  if (!canStartFramefieldCinematicPush(project, scene))
    throw new Error("A cinematic reveal needs a PNG scene without authored camera shots or tracks.");
  const shot: CameraShot = {
    ...newCameraShot(project, scene, 0),
    style: "move", start: 0, end: scene.duration, move: scene.duration,
    fromFrame: framefieldRevealStartingView(1.45),
    frame: { x: 400, y: 225, zoom: 1 },
    targets: [], follow: false, offset: { x: 0, y: 0 },
    placement: "center",
    note: "Gentle cinematic reveal from a closer view to the full original PNG frame",
  };
  const issue = shotIssue([shot], scene);
  if (issue) throw new Error(issue);
  return shot;
}


/** Look up toward the sky or down toward a workbench over the original
 * numbered PNGs. At 1.25x zoom the camera half-height is 180 pixels;
 * y=190 or y=260 stays safely within the 800x450 source canvas. */
export type FramefieldTiltDirection = "up" | "down";
export function framefieldCinematicTiltFrame(direction: FramefieldTiltDirection) {
  if (direction !== "up" && direction !== "down")
    throw new Error("Choose an up or down cinematic camera tilt.");
  return { x: 400, y: direction === "up" ? 190 : 260, zoom: 1.25 };
}
export function framefieldGentleCinematicTilt(
  project: Project, scene: Scene, direction: FramefieldTiltDirection,
): CameraShot {
  if (!canStartFramefieldCinematicPush(project, scene))
    throw new Error("A gentle tilt needs a PNG scene without authored camera shots or tracks.");
  const shot: CameraShot = {
    ...newCameraShot(project, scene, 0),
    style: "move", start: 0, end: scene.duration, move: scene.duration,
    frame: framefieldCinematicTiltFrame(direction),
    targets: [], follow: false, offset: { x: 0, y: 0 },
    placement: "center",
    note: "Gentle cinematic tilt " + direction + " with slight zoom over original PNG frames",
  };
  const issue = shotIssue([shot], scene);
  if (issue) throw new Error(issue);
  return shot;
}


/** A single continuous, gentle diagonal glide over the source PNG frames.
 * At 1.3x zoom the visible half-width and half-height are ~308x173;
 * offsets of 65/35 leave margin on every side and along the eased path. */
export type FramefieldGlideDirection =
  "up-left" | "up-right" | "down-left" | "down-right";
/** Exactly three tested, canvas-safe positions for all four diagonals. */
export type FramefieldGlideIntensity = "subtle" | "balanced" | "expressive";
export function framefieldGlideIntensityOf(zoom: number): FramefieldGlideIntensity {
  if (zoom < 1.25) return "subtle";
  if (zoom < 1.35) return "balanced";
  return "expressive";
}
export function framefieldCinematicGlideFrame(
  direction: FramefieldGlideDirection,
  intensity: FramefieldGlideIntensity = "balanced",
) {
  if (!["up-left", "up-right", "down-left", "down-right"].includes(direction))
    throw new Error("Choose a valid diagonal cinematic glide direction.");
  const strengths = {
    subtle: { zoom: 1.2, horizontal: 45, vertical: 24 },
    balanced: { zoom: 1.3, horizontal: 65, vertical: 35 },
    expressive: { zoom: 1.4, horizontal: 80, vertical: 45 },
  } as const;
  const amount = strengths[intensity];
  if (!amount) throw new Error("Choose a valid diagonal camera glide intensity.");
  return {
    x: 400 + (direction.endsWith("left") ? -amount.horizontal : amount.horizontal),
    y: 225 + (direction.startsWith("up") ? -amount.vertical : amount.vertical),
    zoom: amount.zoom,
  };
}
export function framefieldGentleCinematicGlide(
  project: Project, scene: Scene, direction: FramefieldGlideDirection,
): CameraShot {
  if (!canStartFramefieldCinematicPush(project, scene))
    throw new Error("A diagonal glide needs a PNG scene without authored camera shots or tracks.");
  const shot: CameraShot = {
    ...newCameraShot(project, scene, 0),
    style: "move", start: 0, end: scene.duration, move: scene.duration,
    frame: framefieldCinematicGlideFrame(direction),
    targets: [], follow: false, offset: { x: 0, y: 0 },
    placement: "center",
    note: "Gentle diagonal cinematic glide " + direction + " with a mild original PNG zoom",
  };
  const issue = shotIssue([shot], scene);
  if (issue) throw new Error(issue);
  return shot;
}
