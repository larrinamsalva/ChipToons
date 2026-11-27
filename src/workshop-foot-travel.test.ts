import { describe, expect, it } from "vitest";
import { starterProject } from "./demo-starter";
import { makeScene } from "./model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopSeat, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";
import { standAfterSeatedGreeting } from "./workshop-sit-wave-stand";
import { workshopMotionSteps } from "./workshop-motion-steps";
import { sceneFramesAt } from "./timeline";
import { puppetTransforms } from "./puppet-model";
import { stagePoint } from "./interaction-motion";
import { possibleFootTravel, workshopFootTravel } from "./workshop-foot-travel";

function fixture() {
  const character = newWorkshopPuppetStarter();
  const project = starterProject();
  project.characters.push(character);
  const original = makeScene([character]);
  original.duration = 10;
  original.elements[0].motion = "still";
  const actorId = original.elements[0].id;
  const { scene, seatId } = addWorkshopSeat(original, original.elements[0], "bench");
  const seated = seatWorkshopAtFurniture(scene, actorId, seatId, character.puppet!);
  const waving = waveWorkshopWhileSeated(seated, actorId, seatId, character.puppet!);
  const finished = standAfterSeatedGreeting(waving, actorId, seatId, character.puppet!);
  project.scenes = [finished];
  return { project, scene: finished, actorId,
    steps: workshopMotionSteps(finished, actorId, character.puppet!), rig: character.puppet! };
}

describe("read-only Stage foot trajectory", () => {
  it("measures the actual parented sole at every saved-step sample without changing the project", () => {
    const { project, scene, actorId, steps, rig } = fixture();
    const original = JSON.stringify(project);
    const right = workshopFootTravel(project, scene, actorId, steps[0], "right")!;
    const left = workshopFootTravel(project, scene, actorId, steps[0], "left")!;
    expect(right.points).toHaveLength(37);
    expect(left.points).toHaveLength(37);
    expect(right.points[0].seconds).toBe(3);
    expect(right.points.at(-1)?.seconds).toBe(4.5);
    const actor = scene.elements.find(item => item.id === actorId)!;
    const foot = rig.parts.find(item => item.role === "rightFoot")!;
    const measured = right.points[18];
    const frame = sceneFramesAt(project, scene, measured.seconds).get(actorId)!;
    const pose = puppetTransforms(rig, frame.joints)[rig.parts.indexOf(foot)];
    const sole = { x: -foot.pivotX,
      y: foot.height / 2 - foot.pivotY + 2 };
    const radians = pose.angle * Math.PI / 180;
    const local = { x: pose.x + sole.x * Math.cos(radians) - sole.y * Math.sin(radians),
      y: pose.y + sole.x * Math.sin(radians) + sole.y * Math.cos(radians) };
    const stage = stagePoint(actor, frame, local);
    expect(measured.x).toBeCloseTo(stage.x, 6);
    expect(measured.y).toBeCloseTo(stage.y, 6);
    expect(JSON.stringify(project)).toBe(original);
  });

  it("rejects fake saved steps and rigs without both separate vector feet", () => {
    const { project, scene, actorId, steps, rig } = fixture();
    expect(workshopFootTravel(project, scene, actorId, {
      ...steps[0], to: { ...steps[0].to, seconds: 4.25 },
    }, "right")).toBeUndefined();
    expect(workshopFootTravel(project, scene, "missing", steps[0], "right")).toBeUndefined();
    expect(workshopFootTravel(project, scene, actorId, steps[0], "other" as "right"))
      .toBeUndefined();
    rig.parts = rig.parts.filter(part => part.role !== "leftFoot");
    expect(workshopFootTravel(project, scene, actorId, steps[0], "right")).toBeUndefined();
  });

  it("prompts review only for lateral near-floor intervals and ranks the actual frame pairs", () => {
    const points = [0, 2, 2.5, 8, 11, 14].map((x, index) => ({
      index, seconds: index / 24, x, y: index === 3 ? 98 : 100, floorGap: 0,
    }));
    expect(possibleFootTravel(points, [true, true, true, false, true, true]))
      .toEqual([{ beforeIndex: 4, afterIndex: 5, seconds: 5 / 24, horizontalPixels: 3 },
        { beforeIndex: 0, afterIndex: 1, seconds: 1 / 24, horizontalPixels: 2 }]);
    expect(possibleFootTravel(points, [false, false, false, false, false, false])).toEqual([]);
  });
});
