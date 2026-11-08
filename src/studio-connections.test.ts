import { describe, expect, it } from "vitest";
import { CREATIVE_STUDIOS, connectionLabel } from "./studio-connections";

describe("external creative studio catalog", () => {
  it("keeps unique, HTTPS-only vetted targets", () => {
    expect(new Set(CREATIVE_STUDIOS.map((item) => item.id)).size).toBe(CREATIVE_STUDIOS.length);
    for (const studio of CREATIVE_STUDIOS) {
      const url = new URL(studio.url);
      expect(url.protocol).toBe("https:");
      expect(["github.com", "michaelwave369.github.io"]).toContain(url.hostname);
      expect(studio.description.length).toBeGreaterThan(5);
      expect(studio.instructions.length).toBeGreaterThan(15);
    }
  });

  it("only offers image start for known, manual image sources", () => {
    const imageStudios = CREATIVE_STUDIOS.filter((studio) => studio.canStartFromImage);
    expect(imageStudios.map((studio) => studio.id)).toEqual(["framefield", "auralith"]);
    expect(imageStudios.every((studio) => studio.state === "manual-image")).toBe(true);
    expect(CREATIVE_STUDIOS.filter((studio) => studio.state === "planned")
      .every((studio) => !studio.canStartFromImage)).toBe(true);
  });

  it("does not describe planned connections as active integrations", () => {
    expect(connectionLabel("planned")).toBe("Not connected yet");
    expect(connectionLabel("manual-video")).toContain("Manual");
    expect(connectionLabel("manual-image")).toContain("Manual");
  });
});
