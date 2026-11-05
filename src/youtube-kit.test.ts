import { describe, expect, it } from "vitest";
import { starterProject } from "./planner";
import { draftEpisodeDetails, episodeDescription, publishingChapters, publishingSubtitles } from "./youtube-kit";
import type { PublishingMovie } from "./youtube-kit";

describe("YouTube preparation", () => {
  it("aligns subtitles and real scene boundaries to measured parts, including recorder lead-ins", () => {
    const project = starterProject();
    project.scenes = project.scenes.slice(0, 3).map((scene, i) => ({
      ...scene, title: ["Opening", "Look at the chair", "Set it aside"][i], duration: 12,
    }));
    project.captions = project.scenes.map((scene, i) => ({
      id: String(i), sceneId: scene.id, start: 0.25, end: 2, text: scene.title,
    }));
    const movie: PublishingMovie = {
      video: new Blob(), width: 800, height: 450, duration: 36.4, burned: false,
      plan: [{ start: 0, end: 12 }, { start: 12, end: 36 }],
      ranges: [{ start: 0, end: 12.2 }, { start: 12.2, end: 36.4 }],
    };
    expect(publishingChapters(project, movie)).toEqual([
      { seconds: 0, title: "Opening" }, { seconds: 12, title: "Look at the chair" },
      { seconds: 24, title: "Set it aside" },
    ]);
    const text = publishingSubtitles(project, movie);
    expect(text).toContain("2\n00:00:12,600 --> 00:00:14,350\nLook at the chair");
    expect(text).toContain("3\n00:00:24,600 --> 00:00:26,350\nSet it aside");
    expect(publishingChapters(project, { ...movie, duration: 32 })).toEqual([]);
  });

  it("drafts from authored metadata and leaves unknown credits and episode numbers empty", () => {
    const project = starterProject();
    const detail = draftEpisodeDetails({
      ...project, title: "The Wobbly Chair", idea: "The host inspects a loose joint.", lesson: "Safe repair",
      scriptOptions: { pace: 120, pause: 1, seriesTitle: "Little Fixers Club" },
    });
    expect(detail).toMatchObject({
      title: "The Wobbly Chair", series: "Little Fixers Club", episode: "", credits: "",
      hashtags: "#LittleFixersClub #Saferepair",
    });
    expect(episodeDescription(detail, "")).toContain("The host inspects a loose joint.");
    expect(episodeDescription(detail, "")).not.toMatch(/Credits|Episode 1|License/);
  });
});
