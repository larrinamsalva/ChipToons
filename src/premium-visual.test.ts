import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Stage } from "./components/Stage";
import { starterProject } from "./demo-starter";
import { parseBackup, validateProject } from "./model";
import { sunnyRig } from "./puppet-model";

describe("Cinematic Storybook visual finish", () => {
  function example() {
    const p = starterProject();
    p.scenes[0].background = "classroom";
    p.characters[0].puppet = sunnyRig();
    return p;
  }

  it("does not silently change existing projects or add external image dependencies", () => {
    const project = example();
    expect(project.visualStyle).toBeUndefined();
    const scene = project.scenes[0];
    const classic = renderToStaticMarkup(createElement(Stage, {
      project, scene, time: 0, labelled: false,
    }));
    expect(classic).toContain('data-visual-style="classic"');
    expect(classic).not.toContain("data-cinematic-workshop-lighting");
    expect(classic).not.toContain('data-puppet-finish="cinematic"');
  });

  it("renders project-wide premium lighting, character shading and eye highlights with the same Stage used by export", () => {
    const project = example();
    project.visualStyle = "storybook-cinematic";
    const scene = project.scenes[0];
    const premium = renderToStaticMarkup(createElement(Stage, {
      project: validateProject(project), scene, time: 1, labelled: false,
    }));
    expect(premium).toContain('data-visual-style="storybook-cinematic"');
    expect(premium).toContain('data-cinematic-workshop-lighting="true"');
    expect(premium).toContain('data-puppet-finish="cinematic"');
    expect(premium).toContain("premium-wall");
    expect(premium).toContain("premium-floor");
    expect(premium).toContain("premium-sunlight");
    expect(premium).toContain('data-eye-highlight="premium"');
    // The premium finish remains pure SVG: video export uses this exact Stage.
    expect(premium).not.toContain("<foreignObject");
    expect(premium).not.toContain("https://");
  });

  it("round-trips the opt-in finish through project backup and rejects unknown presets", () => {
    const project = example();
    project.visualStyle = "storybook-cinematic";
    expect(parseBackup(JSON.stringify(project)).visualStyle).toBe("storybook-cinematic");
    const edited = { ...project, visualStyle: "unsafe-remote-theme" };
    expect(() => validateProject(edited)).toThrow(/invalid or unsupported/);
    const reverted = { ...project, visualStyle: undefined };
    expect(validateProject(reverted).visualStyle).toBeUndefined();
  });
});
