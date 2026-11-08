import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoryReelShotNavigation } from "./components/StoryReelShotNavigation";
import { planStoryReel, storyReelFrameAt } from "./studio-story-reel";
import type { NumberedShot, ShotDirection } from "./studio-multishot";

const shots: NumberedShot[] = [
  { prefix: "shot01_frame_", files: [
    new File(["1"], "shot01_frame_0001.png", { type: "image/png" }),
    new File(["2"], "shot01_frame_0002.png", { type: "image/png" }),
  ] },
  { prefix: "shot02_frame_", files: [
    new File(["3"], "shot02_frame_0001.png", { type: "image/png" }),
    new File(["4"], "shot02_frame_0002.png", { type: "image/png" }),
  ] },
];

describe("Story Reel scene navigator", () => {
  it("renders true cut positions, whole-episode time and final-frame holds", () => {
    const direction: ShotDirection[] = [
      { prefix: "shot02_frame_", holdSeconds: 1 },
      { prefix: "shot01_frame_", holdSeconds: 2 },
    ];
    const plan = planStoryReel(shots, 2, direction);
    expect(plan.duration).toBe(7);
    expect(plan.shots.map(s => [s.prefix, s.start, s.duration]))
      .toEqual([["shot02_frame_", 0, 3], ["shot01_frame_", 3, 4]]);
    const atCut = storyReelFrameAt(plan, 3);
    expect(atCut.shotIndex).toBe(1);
    expect(atCut.frameIndex).toBe(0);

    const html = renderToStaticMarkup(createElement(StoryReelShotNavigation, {
      plan, position: 3, activeIndex: atCut.shotIndex, onJump: () => {},
    }));
    expect(html).toContain('aria-label="Storyboard scene markers"');
    expect(html).toContain('aria-label="Jump to shot 1: shot02_frame_ at 0.00 seconds"');
    expect(html).toContain('aria-label="Jump to shot 2: shot01_frame_ at 3.00 seconds"');
    expect(html).toContain("0.00–3.00s");
    expect(html).toContain("3.00–7.00s");
    // The navigator shows the REAL first PNG for each shot, never a
    // generated placeholder, and keeps the jump button's accessible name.
    expect((html.match(/class="studio-reel-shot-thumbnail"/g) ?? [])).toHaveLength(2);
    expect(html).toContain('data-thumbnail-shot="shot02_frame_"');
    expect(html).toContain('data-thumbnail-shot="shot01_frame_"');
    expect(html).toContain('alt="Original first frame of shot02_frame_"');
    expect(html).toContain('alt="Original first frame of shot01_frame_"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("+1s final-frame hold");
    expect(html).toContain("+2s final-frame hold");
    expect((html.match(/aria-current="step"/g) ?? [])).toHaveLength(1);
    expect(html).toContain('width:100.00%');
    expect(html).toContain('width:0.00%');
  });

  it("has accessible disabled controls without changing the portable reel plan", () => {
    const plan = planStoryReel(shots, 4);
    const saved = plan.shots.map(item => [item.prefix, item.start, item.duration]);
    const html = renderToStaticMarkup(createElement(StoryReelShotNavigation, {
      plan, position: 0.5, activeIndex: 0, disabled: true,
      onJump: () => { throw new Error("SSR cannot activate a control"); },
    }));
    expect((html.match(/disabled=""/g) ?? [])).toHaveLength(2);
    expect((html.match(/class="studio-reel-shot-thumbnail"/g) ?? [])).toHaveLength(2);
    expect(html).toContain("0.00–2.00s");
    expect(html).toContain("2.00–4.00s");
    expect(html).not.toContain("final-frame hold");
    expect(plan.shots.map(item => [item.prefix, item.start, item.duration]))
      .toEqual(saved);
    expect(shots[0].files[0].name).toBe("shot01_frame_0001.png");
  });
});
