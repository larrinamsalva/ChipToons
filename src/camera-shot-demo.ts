import type { CameraShot } from "./camera-shots";
import { uid, validateProject } from "./model";
import type { Project, Scene } from "./model";
import { participationExample, WAGON_ANSWER_DELAY } from "./participation-examples";

export const CAMERA_DEMO_TITLE = "The Wobbly Wagon — A Closer Look";

function addShots(project: Project) {
  const [repair, roll] = project.scenes;
  const shine = project.characters.find(character => character.name === "Shine")!.id;
  const helper = project.characters.find(character => character.name === "Helping Hands")!.id;
  const find = (scene: Scene, id: string) => scene.elements.find(item => item.characterId === id)!.id;
  const wagon = (scene: Scene) => scene.elements.find(item => item.prop === "toy-wagon")!.id;
  const shot = (style: CameraShot["style"], start: number, end: number, note: string, patch: Partial<CameraShot> = {}): CameraShot => ({
    id: uid(), style, start, end, note, targets: [], frame: { x: 400, y: 225, zoom: 1 },
    move: 0, follow: false, offset: { x: 0, y: 0 }, placement: "center", overlays: true, ...patch,
  });
  const question = repair.script!.lines[1];
  const reveal = repair.participation![0];
  const change = repair.objectTracks![0].changes[0];
  const wheel = (x: number, y: number) => ({ targets: [wagon(repair)], follow: true,
    frame: { x: 415, y: 360, zoom: 2.65 }, offset: { x, y } });
  const cameraShots = [
    shot("wide", 0, 1.2, "Show the workshop and the wobbling wagon."),
    shot("medium", 1.2, 1.8, "Move closer as Shine notices the wobble.", {
      targets: [find(repair, shine)], frame: { x: 240, y: 260, zoom: 1.55 }, offset: { x: 18, y: -82 },
    }),
    shot("pair", 1.8, 2.4, "Let the friends notice together.", {
      targets: [find(repair, shine), find(repair, helper)], frame: { x: 284, y: 260, zoom: 1.65 }, offset: { x: 0, y: -95 },
    }),
    shot("close", 2.4, 3.5, "Show Shine asking the question.", {
      targets: [find(repair, shine)], frame: { x: 225, y: 255, zoom: 2.35 }, offset: { x: 0, y: -130 }, lineId: question.id,
    }),
    shot("detail", 3.5, 4.45, "Give viewers a closer look while the question finishes.", wheel(61, -6)),
    shot("reaction", 4.45, 7.65, "Hold on Shine while viewers think.", {
      targets: [find(repair, shine)], frame: { x: 225, y: 255, zoom: 2.15 }, offset: { x: 0, y: -120 },
    }),
    shot("detail", 7.65, 9.2, "Show the highlighted loose wheel.", {
      ...wheel(61, -6), cue: { anchor: { kind: "participation", id: reveal.id, moment: "reveal" }, reviewedAt: 7.65 },
    }),
    shot("move", 9.2, 12.25, "Ease back to see the friends and their trusted grown-up.", {
      frame: { x: 375, y: 273, zoom: 1.55 }, move: 1.45,
    }),
    shot("detail", 12.25, 14.7, "Cut to the wheel after the grown-up fixes it.", {
      ...wheel(33, -11), cue: { anchor: { kind: "change", id: change.id }, reviewedAt: 12.25 },
    }),
    shot("wide", 14.7, repair.duration, "Give the helpers space before the test."),
  ];
  return validateProject({ ...project, title: CAMERA_DEMO_TITLE, scenes: [{ ...repair, cameraShots }, {
    ...roll, cameraShots: [
      shot("wide", 0, 0.9, "Show where the wagon will roll."),
      shot("follow", 0.9, 4.8, "Follow the wagon as it rolls smoothly.", {
        targets: [wagon(roll)], frame: { x: 417, y: 365, zoom: 1.8 }, follow: true,
        offset: { x: 0, y: -37 }, move: 0.7,
      }),
      shot("wide", 4.8, roll.duration, "Return to the friends for the closing question."),
    ],
  }] });
}

export const cameraShotDemo = () => addShots(participationExample("wagon"));
export async function voicedCameraShotDemo() {
  const { withWagonVoices } = await import("./wagon-voices");
  return withWagonVoices(cameraShotDemo(), WAGON_ANSWER_DELAY);
}
