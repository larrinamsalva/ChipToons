import { FOCUS_STYLES } from "./focus-model";
import type { FocusGraphic } from "./focus-model";
import { newFocusGraphic } from "./focus-studio";
import { validateProject } from "./model";
import type { Project, Scene } from "./model";
import type { TransformExample } from "./transform-model";

const colors = FOCUS_STYLES.contrast;

function graphic(scene: Scene, at: number, end: number, patch: Partial<FocusGraphic>): FocusGraphic {
  return { ...newFocusGraphic(scene, at), at, length: end - at, style: "contrast",
    ink: colors.ink, paper: colors.paper, fadeIn: 0.14, fadeOut: 0.14, ...patch };
}
function screen(x: number, y: number) { return { kind: "screen" as const, x, y }; }
function detail(scene: Scene, prop: string, dx: number, dy: number) {
  const object = scene.elements.find(item => item.prop === prop)!;
  return { kind: "object" as const, id: object.id, x: object.x, y: object.y, dx, dy };
}

export function visualTeachingExample(project: Project, example: TransformExample) {
  const first = project.scenes[0];
  let graphics: FocusGraphic[];
  if (example === "wagon") {
    const repair = first.objectTracks![0].changes[0];
    const inspect = first.learningSteps![1];
    const loose = detail(first, "toy-wagon", 61, -6);
    const fixed = detail(first, "toy-wagon", 33, -11);
    graphics = [
      graphic(first, 1.3, 4.4, { kind: "circle", target: loose, size: 42, reveal: true, ink: "#0b6e9c" }),
      graphic(first, 1.8, 4.4, { kind: "number", number: 1, size: 42, text: "Look at the wheel", target: screen(106, 54),
        cue: { kind: "step", id: inspect.id }, stepSource: { id: inspect.id, text: inspect.text, at: 1.8 } }),
      graphic(first, 5.2, 8.8, { kind: "arrow", target: loose, size: 56, reveal: true, ink: "#0b6e9c" }),
      graphic(first, 7.1, 9.1, { kind: "card", text: "Ask a grown-up to help", target: screen(390, 55) }),
      graphic(first, 9.25, 11.6, { kind: "circle", target: fixed, size: 38, ink: "#0b6e9c",
        cue: { kind: "change", id: repair.id } }),
      graphic(first, 9.65, 12.3, { kind: "label", text: "The wheel is attached!", target: screen(430, 55) }),
    ];
  } else if (example === "seed") {
    const states = first.objectTracks![0].changes;
    graphics = [
      graphic(first, 0.3, 3.12, { kind: "label", text: "Seed planted", target: screen(425, 57) }),
      graphic(first, 3.25, 6.55, { kind: "label", text: "Days later: a little sprout", target: screen(425, 57),
        cue: { kind: "change", id: states[0].id } }),
      graphic(first, 6.7, 9.85, { kind: "label", text: "Weeks later: a flower", target: screen(425, 57),
        cue: { kind: "change", id: states[1].id } }),
    ];
  } else if (example === "bridge") {
    graphics = [
      graphic(first, 0.6, 3.8, { kind: "arrow", target: detail(first, "paper-bridge", -43, -37), size: 65, text: "Fold here" }),
      graphic(first, 5, 8.2, { kind: "circle", target: detail(first, "toy", 0, -45), size: 56, reveal: true }),
      graphic(first, 5.2, 8.3, { kind: "label", text: "Test with a light toy", target: screen(417, 61) }),
    ];
  } else {
    graphics = [
      graphic(first, 0.4, 3.8, { kind: "number", number: 1, size: 46, text: "Pick up loose papers", target: screen(98, 60) }),
      graphic(first, 4.15, 8.4, { kind: "number", number: 2, size: 46, text: "Make room for everyone", target: screen(98, 60) }),
    ];
  }
  const scenes = [{ ...first, focusGraphics: graphics }, ...project.scenes.slice(1)];
  if (example === "wagon") {
    const next = scenes[1];
    scenes[1] = { ...next, focusGraphics: [
      graphic(next, 0.35, 3.8, { kind: "label", text: "Now let's test it!", target: screen(415, 60) }),
      graphic(next, 1, 4.4, { kind: "circle", target: detail(next, "toy-wagon", 33, -11), size: 40, ink: "#0b6e9c" }),
    ] };
  }
  return validateProject({ ...project, title: `${project.title} · Visual lesson`, scenes });
}
