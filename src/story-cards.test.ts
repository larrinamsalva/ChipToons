import "fake-indexeddb/auto";
import { expect, test } from "vitest";
import { episodePackage, restoreProjectFile } from "./episode-package";
import { sceneCaptionBand } from "./focus-motion";
import { parseBackup, totalDuration, uid, validateProject } from "./model";
import { starterProject } from "./planner";
import { newAudioClip, sceneCaptionText, subtitleCues } from "./production";
import { newEpisode, newSeries, readSeriesBackup, seriesBackup } from "./series";
import { builtInSound } from "./sounds";
import { storyCardDemo } from "./story-card-demo";
import { storyCardFrame, storyCardLayout } from "./story-card-layout";
import { minimumCreditTime, seriesPresentation, storyCardIssue, validPresentation } from "./story-card-model";
import { applyPresentation, defaultCardOptions, episodePresentation, newStoryCard, reviewStoryCard } from "./story-card-studio";
import { duplicateAnimatedScene } from "./timeline";

test("validates bounded titles, credit roles and factual source fields", () => {
  const project = starterProject(), card = newStoryCard(project, "credits");
  card.credits = [{ role: "", name: "Example source", license: "Example license", url: "https://example.org/source" }];
  expect(storyCardIssue(card, 10)).toBeUndefined();
  expect(storyCardIssue({ ...card, title: "x".repeat(141) }, 10)).toBeTruthy();
  expect(storyCardIssue({ ...card, title: "text\x00" }, 10)).toBeTruthy();
  expect(storyCardIssue({ ...card, credits: [{ ...card.credits[0], url: "javascript:alert(1)" }] }, 10)).toBeTruthy();
  expect(storyCardIssue({ ...card, credits: [{ ...card.credits[0], name: "" }] }, 10)).toBeTruthy();
  expect(storyCardIssue({ ...card, kind: "opening" }, 10)).toBeTruthy();
});

test("places an optional card at a reviewed scene boundary and leaves the existing tracks intact", () => {
  const project = starterProject();
  const source = builtInSound("melody");
  project.audioAssets = [source];
  const linked = { ...newAudioClip(project, source, "narration", 1), start: 0.5, duration: 4 };
  const music = { ...newAudioClip(project, source, "music", 0), loop: true, duration: totalDuration(project) };
  project.audioClips = [linked, music];
  const original = { id: uid(), sceneId: project.scenes[1].id, text: "Existing narration.", start: 0.5, end: 2 };
  project.captions = [original];
  const card = newStoryCard(project, "chapter");
  const options = { ...defaultCardOptions(project, "chapter", 0), duration: 4, after: 0 };
  const output = reviewStoryCard(project, card, options);
  expect(output.index).toBe(1);
  expect(output.project.scenes.filter(scene => !scene.storyCard)).toEqual(project.scenes);
  expect(totalDuration(output.project)).toBe(totalDuration(project) + 4);
  expect(output.project.audioClips).toEqual([linked, { ...music, duration: music.duration + 4 }]);
  expect(output.project.captions).toEqual([original]);
  expect(sceneCaptionText(output.project, output.project.scenes[1], 1)).toBe("");
  expect(subtitleCues(output.project, { start: 0, end: totalDuration(output.project) })[0].start)
    .toBe(project.scenes[0].duration + 4.5);
  const shrunk = reviewStoryCard(output.project, card, { ...options, duration: 3 }, output.project.scenes[1].id).project;
  expect(totalDuration(shrunk)).toBe(totalDuration(project) + 3);
  expect(shrunk.scenes[1].id).toBe(output.project.scenes[1].id);
  expect(() => reviewStoryCard({ ...project, audioClips: [{ ...linked, sceneId: undefined,
    start: project.scenes[0].duration - 1 }] }, card, options)).toThrow(/spans this spot/);
});

test("uses stable series links and makes independent episode snapshots", async () => {
  const project = starterProject();
  const series = newSeries();
  series.presentation = { ...seriesPresentation(), ending: "scroll", roles: ["Voices", "A custom role"], sound: "melody" };
  series.episodes = [{ ...newEpisode(1), title: "Same title" }, { ...newEpisode(2), title: "Same title", projectId: project.id }];
  expect(episodePresentation(project, [series])).toMatchObject({ title: "Same title", number: 2 });
  const current = newStoryCard(project, "credits");
  const suggested = applyPresentation(current, series.presentation);
  expect(current.scroll).toBe(false);
  expect(suggested.scroll).toBe(true);
  const first = reviewStoryCard(project, suggested, defaultCardOptions(project, "credits", 0)).project;
  series.presentation.style.ink = "#aa2233";
  expect(first.scenes.at(-1)?.storyCard?.style.ink).toBe("#39243a");
  const restored = await readSeriesBackup(seriesBackup(series));
  expect(restored.presentation).toEqual(series.presentation);
  expect(restored.episodes[1].projectId).toBeUndefined();
  expect(validPresentation({ ...series.presentation, roles: [""] })).toBe(false);
});

test("protects caption space and computes deterministic slow and reduced-motion credit frames", () => {
  const project = starterProject(), scene = project.scenes[0];
  const card = { ...newStoryCard(project, "credits"), scroll: true,
    credits: Array.from({ length: 5 }, () => ({ role: "Story", name: "Example artist", license: "Example license", url: "" })) };
  project.captions = [{ id: uid(), sceneId: scene.id, text: "Listen to the story.", start: 0, end: 2 }];
  for (const position of ["top", "bottom"] as const) {
    project.captionStyle.position = position;
    const band = sceneCaptionBand(project, scene)!;
    const box = storyCardLayout(project, scene, card);
    expect(position === "top" ? box.y > band.y + band.height : box.y + box.height < band.y).toBe(true);
  }
  const duration = minimumCreditTime(card), a = storyCardFrame(card, 1, duration, false, 485, 300);
  const b = storyCardFrame(card, duration - 1, duration, false, 485, 300);
  expect(b.scroll).toBeGreaterThan(a.scroll);
  expect(storyCardFrame(card, duration - 1, duration, false, 485, 300)).toEqual(b);
  expect(storyCardFrame(card, 0, duration, true, 485, 300)).toMatchObject({ opacity: 1, slide: 0 });
  expect(storyCardFrame(card, duration - 1, duration, false, 140, 300).scroll).toBeGreaterThan(0);
  expect(storyCardIssue(card, duration - 1)).toMatch(/Allow at least/);
});

test("duplicates cards, preserves relative order and round trips legacy, JSON and complete episodes", async () => {
  const legacy = parseBackup(JSON.stringify(starterProject()));
  expect(legacy.scenes.every(scene => scene.storyCard === undefined)).toBe(true);
  const project = storyCardDemo();
  const opening = project.scenes[0], copy = duplicateAnimatedScene(opening);
  expect(copy.storyCard).toEqual(opening.storyCard);
  expect(copy.id).not.toBe(opening.id);
  const scenes = [copy, ...project.scenes.slice(1), opening];
  expect(validateProject({ ...project, scenes }).scenes.at(-1)?.id).toBe(opening.id);
  const data = project.scenes.map(scene => scene.storyCard);
  expect(parseBackup(JSON.stringify(project)).scenes.map(scene => scene.storyCard)).toEqual(data);
  const complete = await restoreProjectFile(new File([await episodePackage(project)], "cards.ctepisode"));
  expect(complete.scenes.map(scene => scene.storyCard)).toEqual(data);
  expect(complete.audioClips).toEqual(project.audioClips);
  expect(complete.scenes[0].cameraShots).toEqual(project.scenes[0].cameraShots);
});
