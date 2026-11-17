import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { starterProject } from "./demo-starter";
import { makeScene } from "./model";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { addWorkshopSeat, seatWorkshopAtFurniture } from "./workshop-seating-stage";
import { waveWorkshopWhileSeated } from "./workshop-seated-wave";
import { standAfterSeatedGreeting } from "./workshop-sit-wave-stand";
import { workshopSeatingReviewMoments } from "./workshop-seating-review";
import { WorkshopPoseCompare } from "./components/WorkshopPoseCompare";
import { Stage } from "./components/Stage";

function fixture(kind: "chair" | "bench" = "chair") {
  const hero = newWorkshopPuppetStarter();
  const project = starterProject();
  project.characters = [...project.characters, hero];
  const scene = makeScene([hero]);
  scene.duration = 10;
  scene.elements[0].motion = "still";
  const actorId = scene.elements[0].id;
  const furniture = addWorkshopSeat(scene, scene.elements[0], kind);
  const seated = seatWorkshopAtFurniture(furniture.scene, actorId, furniture.seatId, hero.puppet!);
  const waved = waveWorkshopWhileSeated(seated, actorId, furniture.seatId, hero.puppet!);
  const complete = standAfterSeatedGreeting(waved, actorId, furniture.seatId, hero.puppet!);
  project.scenes = [complete];
  return { project, scene: complete, actorId, seatId: furniture.seatId };
}

describe("PR #161 side-by-side genuine Stage review", () => {
  it("uses the same actual scene renderer for real sitting and greeting keyframes", () => {
    const { project, scene, actorId } = fixture();
    const saved = JSON.stringify(project);
    const moments = workshopSeatingReviewMoments(scene, actorId);
    expect(moments.map(m => m.seconds)).toEqual([3, 4.5, 8.5, 10]);
    const sit = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: moments[0].seconds, labelled: false,
    }));
    const wave = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: moments[1].seconds, labelled: false,
    }));
    expect(sit).toContain('viewBox="0 0 800 450"');
    expect(wave).toContain('viewBox="0 0 800 450"');
    expect(sit).toContain('data-puppet-part="rightArm"');
    expect(wave).toContain('data-puppet-part="rightArm"');
    expect(sit).not.toBe(wave);
    expect(JSON.stringify(project)).toBe(saved);
  });

  it("offers comparison only with at least two real review points, without changing project", () => {
    const { project, scene, actorId } = fixture("bench");
    const original = JSON.stringify(project);
    const markup = renderToStaticMarkup(createElement(WorkshopPoseCompare, {
      project, scene, actorId,
    }));
    expect(markup).toContain("Compare Two Poses Side by Side");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('class="workshop-pose-comparison-frame"');
    expect(JSON.stringify(project)).toBe(original);
    const missing = renderToStaticMarkup(createElement(WorkshopPoseCompare, {
      project, scene, actorId: "not-here",
    }));
    expect(missing).toBe("");
    const seatedOnly = {
      ...scene, elements: scene.elements.map(element => element.id === actorId
        ? {
          ...element,
          animation: {
            ...element.animation!,
            keyframes: element.animation!.keyframes.slice(0, 13),
          },
        } : element),
    };
    expect(renderToStaticMarkup(createElement(WorkshopPoseCompare, {
      project, scene: seatedOnly, actorId,
    }))).toBe("");
    expect(JSON.stringify(project)).toBe(original);
  });
});
