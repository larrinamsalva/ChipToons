import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryDirections } from "./components/CategoryDirections";

describe("in-place beginner directions", () => {
  it.each(["start", "story", "world", "art", "puppet", "picture", "animation", "script", "voice", "mouth", "camera", "sound", "interaction", "transform", "focus", "participation", "cards", "series", "export", "recovery", "preview"] as const)("renders a closed three-step guide and next action for %s", category => {
    const html = renderToStaticMarkup(createElement(CategoryDirections, { category }));
    expect(html).toContain('<details class="category-directions">');
    expect(html).toContain("<summary>How to use:");
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain("<strong>Next:</strong>");
    expect(html).not.toContain("<button");
  });
});
