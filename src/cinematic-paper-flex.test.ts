import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicPaperFlexAt } from "./cinematic-paper-flex";
import { Stage } from "./components/Stage";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { sceneFramesAt } from "./timeline";

function fixture() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const action = scene.interactions![0];
  const book = scene.elements.find(item => item.id === action.objectId)!;
  return { project, scene, action, book };
}

describe("Cinematic held-paper flex", () => {
  it("follows the real held checklist and settles when Helper Jo puts it down", () => {
    const { project, scene, action, book } = fixture();
    const before = JSON.stringify(project);
    const sample = (time: number) => {
      const frame = sceneFramesAt(project, scene, time).get(book.id)!;
      return {
        bend: cinematicPaperFlexAt(project, scene, book, frame, time, false),
        frame,
      };
    };
    expect(sample(4).bend).toBe(0);
    expect(sample(5.4).bend).toBe(0);
    const lifted = sample(7);
    expect(lifted.frame.heldBy).toBe(action.actorId);
    expect(lifted.bend).toBeGreaterThan(0.4);
    expect(lifted.bend).toBeLessThan(0.8);
    const transferring = sample(9.8);
    expect(transferring.frame.heldBy).toBe(action.transfer!.actorId);
    expect(transferring.bend).toBeGreaterThan(lifted.bend);
    const settling = sample(11.9);
    expect(settling.bend).toBeGreaterThan(0);
    expect(settling.bend).toBeLessThan(lifted.bend);
    expect(sample(12).bend).toBe(0);
    expect(sample(13).bend).toBe(0);
    expect(sample(29).bend).toBe(0);
    expect(sample(7)).toEqual(sample(7));
    expect(JSON.stringify(project)).toBe(before);
  });

  it("renders a fold in the genuine Stage SVG only while the original paper prop is held", () => {
    const { project, scene } = fixture();
    const render = (time: number) => renderToStaticMarkup(createElement(Stage, {
      project, scene, time, labelled: false,
    }));
    const pickup = render(7);
    expect(pickup).toContain('data-cinematic-paper-flex="true"');
    expect(pickup).toContain('data-page-flex="0.460"');
    expect(pickup).toContain('data-cinematic-prop-contact="true"');
    expect(render(3)).not.toContain('data-cinematic-paper-flex');
    expect(render(12.5)).not.toContain('data-cinematic-paper-flex');
    project.visualStyle = undefined;
    expect(render(7)).not.toContain('data-cinematic-paper-flex');
  });

  it("does not affect calm editing, non-paper props, painted art or mismatched interactions", () => {
    const { project, scene, book } = fixture();
    const t = 7;
    const frame = sceneFramesAt(project, scene, t).get(book.id)!;
    expect(cinematicPaperFlexAt(project, scene, book, frame, t, true)).toBe(0);
    expect(cinematicPaperFlexAt(project, scene, {
      ...book, prop: "toy",
    }, frame, t, false)).toBe(0);
    expect(cinematicPaperFlexAt(project, scene, {
      ...book, assetId: "photo-book",
    }, frame, t, false)).toBe(0);
    expect(cinematicPaperFlexAt(project, scene, book,
      { ...frame, heldBy: undefined }, t, false)).toBe(0);
    expect(cinematicPaperFlexAt(project, { interactions: undefined },
      book, frame, t, false)).toBe(0);
    expect(cinematicPaperFlexAt(project, scene, book,
      { ...frame, opacity: 0 }, t, false)).toBe(0);
    expect(cinematicPaperFlexAt(project, scene, book, frame,
      Number.NaN, false)).toBe(0);
  });
});
