import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Stage } from "./components/Stage";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { clone, parseBackup, validateProject } from "./model";

describe("Cinematic Storybook full-body material depth", () => {
  const render = (premium: boolean) => {
    const project = littleFixersFullBodyPilot();
    project.visualStyle = premium ? "storybook-cinematic" : undefined;
    const before = JSON.stringify(project);
    const svg = renderToStaticMarkup(createElement(Stage, {
      project, scene: project.scenes[0], time: 6, labelled: false,
    }));
    expect(JSON.stringify(project)).toBe(before);
    return { svg, project };
  };

  it("leaves the actual classic vector silhouette and all puppet parts unchanged unless enabled", () => {
    const { svg, project } = render(false);
    expect(svg).toContain('data-visual-style="classic"');
    expect(svg).toContain('data-puppet-finish="classic"');
    expect(svg).not.toContain("data-material-depth=");
    expect(svg).not.toContain("data-facial-detail=");
    expect(project.assets).toHaveLength(0);
    const saved = clone(project);
    expect(validateProject(saved)).toEqual(project);
  });

  it("adds real SVG material volumes for clothes, work boots, hair, and facial design", () => {
    const { svg, project } = render(true);
    expect(svg).toContain('data-visual-style="storybook-cinematic"');
    expect(svg).toContain('data-puppet-finish="cinematic"');
    expect(svg).toContain('data-material-depth="workshop-shirt"');
    expect(svg).toContain('data-material-depth="cargo-fabric"');
    expect(svg).toContain('data-material-depth="work-boot"');
    expect(svg).toContain('data-material-depth="tool-belt"');
    expect(svg).toContain('data-material-depth="hair-sheen"');
    expect(svg).toContain('data-facial-detail="nose"');
    expect(svg).toContain('data-eye-highlight="premium"');
    expect(svg).toContain("-material");
    expect(svg).not.toContain("<foreignObject");
    expect(svg).not.toContain("https://");
    expect(parseBackup(JSON.stringify(project)).scenes).toEqual(project.scenes);
  });

  it("the cinematic style cannot rewrite the original rigs, movement, dialogue, or local assets", () => {
    const classic = littleFixersFullBodyPilot();
    const cinema = clone(classic);
    cinema.visualStyle = "storybook-cinematic";
    expect(cinema.characters).toEqual(classic.characters);
    expect(cinema.scenes).toEqual(classic.scenes);
    expect(cinema.audioAssets).toEqual(classic.audioAssets);
    expect(cinema.audioClips).toEqual(classic.audioClips);
    expect(cinema.assets).toEqual(classic.assets);
    expect(validateProject(cinema).visualStyle).toBe("storybook-cinematic");
  });
});
