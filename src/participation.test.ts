import "fake-indexeddb/auto";
import { episodePackage, restoreProjectFile } from "./episode-package";
import { describe, expect, it } from "vitest";
import { focusIssue, focusWindow } from "./focus-model";
import { intersects, sceneCaptionBand } from "./focus-motion";
import { parseBackup, validateProject } from "./model";
import { participationCards } from "./participation-art";
import { participationExample } from "./participation-examples";
import { participationAt, participationIssue, participationWindow } from "./participation-model";
import { createParticipationLines, newParticipation, participationWarnings } from "./participation-studio";
import { duplicateScript, withScript } from "./script";
import { starterProject } from "./planner";
import { cleanSceneReferences, duplicateAnimatedScene } from "./timeline";

describe("Pause, Think & Try", () => {
  it("validates all four editable examples and preserves old projects", () => {
    for (const name of ["wagon", "seed", "bridge", "tidy"] as const) {
      const project = participationExample(name);
      expect(validateProject(project)).toEqual(project);
      expect(project.scenes[0].participation).toHaveLength(1);
    }
    const legacy = starterProject();
    expect(parseBackup(JSON.stringify(legacy)).scenes.every(scene => !scene.participation)).toBe(true);
  });

  it("samples the question, full thinking interval and exact reveal deterministically", () => {
    const scene = participationExample("wagon").scenes[0], [moment] = scene.participation!;
    const { start, think, reveal, end } = participationWindow(moment);
    expect(reveal - think).toBeCloseTo(3.2);
    expect([end, think, start - 0.01, reveal, start, reveal - 0.001].map(at => participationAt(scene, at)?.phase))
      .toEqual([undefined, "think", undefined, "reveal", "ask", "think"]);
    expect(participationAt(scene, think)).toEqual(participationAt(scene, think));
    const circle = scene.focusGraphics![0];
    expect(focusWindow(scene, circle)).toEqual({ start: reveal, end });
    expect(focusWindow({ ...scene, participation: undefined }, circle).start).toBe(circle.at);
  });

  it("validates two to three choices, explanations, bound references, durations, IDs and overlaps", () => {
    const scene = participationExample("wagon").scenes[0], [moment] = scene.participation!;
    for (const patch of [
      { kind: "unknown" }, { at: -1 }, { askFor: 0.4 }, { thinkFor: 2.99 }, { thinkFor: 10.01 },
      { revealFor: 0 }, { at: scene.duration - 1 }, { question: "  " }, { feedback: "x".repeat(111) },
      { choices: [{ text: "only one" }] }, { choices: Array.from({ length: 4 }, () => ({ text: "choice" })) },
      { choices: [{ text: "x", icon: "unknown" }, { text: "y" }] }, { answer: 4 }, { kind: "feel" },
      { speakerId: "unavailable" }, { speakerId: undefined }, { questionLineId: "missing" }, { answerLineId: moment.questionLineId },
      { stepId: "missing" }, { focusId: "missing" },
    ]) expect(participationIssue([{ ...moment, ...patch }], scene), JSON.stringify(patch)).toBeTruthy();
    expect(participationIssue([moment, { ...moment, id: "distinct", focusId: undefined }], scene)).toContain("overlap");
    expect(participationIssue([moment, { ...moment }], scene)).toBeTruthy();
  });

  it("counts the participation card and linked circle against the existing visible-art limit", () => {
    const scene = participationExample("wagon").scenes[0], [moment] = scene.participation!;
    const circle = scene.focusGraphics![0];
    const { reveal } = participationWindow(moment);
    const others = [1, 2].map(n => ({ ...circle, id: `circle-${n}`, at: reveal, length: 1 }));
    expect(focusIssue([circle, ...others], scene)).toContain("three");
    expect(focusIssue([circle, ...others.slice(1)], scene)).toBeUndefined();
  });

  it("keeps the card clear of both caption positions and presents feelings as open responses", () => {
    const project = participationExample("wagon"), [scene] = project.scenes;
    for (const position of ["top", "bottom"] as const) {
      const band = sceneCaptionBand({ ...project, captionStyle: { ...project.captionStyle, position } }, scene)!;
      for (const time of [2.5, 5.7, 9.5]) {
        const cards = participationCards(participationAt(scene, time)!, band);
        expect(cards.every(card => !intersects(card.box, band))).toBe(true);
      }
    }
    const feeling = participationExample("tidy").scenes[0];
    const card = participationCards(participationAt(feeling, 6)!).flatMap(item => item.lines);
    expect(card[0].text).toBe("One kind possibility");
    expect(card.some(line => /correct|incorrect/i.test(line.text))).toBe(false);
  });

  it("detaches removed links without losing wording, timing or other connections", () => {
    const [scene] = participationExample("wagon").scenes, [original] = scene.participation!;
    const withoutLine = withScript(scene, { ...scene.script!, lines: scene.script!.lines.filter(line => line.id !== original.questionLineId) });
    const withoutCue = cleanSceneReferences({ ...withoutLine, focusGraphics: [], learningSteps: [] }, scene);
    const [result] = withoutCue.participation!;
    expect(result).toMatchObject({ question: original.question, thinkFor: original.thinkFor, answerLineId: original.answerLineId, review: true });
    expect(result.focusId ?? result.stepId ?? result.questionLineId).toBeUndefined();
    expect(participationIssue(withoutCue.participation, withoutCue)).toBeUndefined();
  });

  it("remaps scene-local references on duplication and round-trips saved teaching records", () => {
    const project = participationExample("wagon"), [scene] = project.scenes, [original] = scene.participation!;
    const copy = duplicateScript(duplicateAnimatedScene(scene), [], []);
    const [moment] = copy.participation!;
    expect(moment.id).not.toBe(original.id);
    expect(moment.questionLineId).toBe(copy.script!.lines[1].id);
    expect(moment.answerLineId).toBe(copy.script!.lines[2].id);
    expect(moment.stepId).toBe(copy.learningSteps![2].id);
    expect(moment.focusId).toBe(copy.focusGraphics![0].id);
    expect(moment.focusId).not.toBe(original.focusId);
    expect(moment.speakerId).toBe(original.speakerId);
    expect(validateProject({ ...project, scenes: [...project.scenes, copy] }).scenes.at(-1)).toEqual(copy);
    expect(parseBackup(JSON.stringify(project)).scenes[0].participation).toEqual(scene.participation);
  });

  it("restores participation and its source references from a complete episode package", async () => {
    const original = participationExample("wagon");
    const archive = await episodePackage(original);
    const restored = await restoreProjectFile(new File([archive], "wagon.ctepisode"));
    expect(restored.id).not.toBe(original.id);
    expect(restored.scenes[0].participation).toEqual(original.scenes[0].participation);
    expect(restored.scenes[0].focusGraphics).toEqual(original.scenes[0].focusGraphics);
    expect(restored.scenes[0].script).toEqual(original.scenes[0].script);
  });

  it("creates optional recording slots through Script Director and warns about unassigned audio", () => {
    const project = starterProject(), [scene] = project.scenes;
    const draft = newParticipation(scene, 0);
    const { script, moment } = createParticipationLines(scene, draft);
    const edited = withScript({ ...scene, participation: [moment] }, script);
    expect(script.lines.find(line => line.id === moment.questionLineId)?.takes).toEqual([]);
    expect(participationIssue(edited.participation, edited)).toBeUndefined();
    expect(participationWarnings(project, edited, moment).filter(message => message.includes("no audible recording"))).toHaveLength(2);
  });
});
