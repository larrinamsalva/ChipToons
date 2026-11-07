import { describe, expect, it } from "vitest";
import { starterProject } from "./planner";
import { planSegments } from "./segments";
import { movieDeviceProblem, moviePlanProblem, movieSpaceNeeded, MOVIE_BYTES } from "./single-movie-plan";
import type { MoviePart } from "./single-movie-plan";
import { singleMovieSrt } from "./single-movie";

function part(start: number, end: number): MoviePart {
  return {
    start, end, sha256: String(start % 10).repeat(64),
    file: new File([new Uint8Array(1000)], "part.webm", { type: "video/webm" }),
    media: { codec: "VP8", audio: "Opus", width: 800, height: 450, fps: 15, duration: end - start + 0.16 },
  };
}

describe("single movie planning", () => {
  it("checks contiguous ranges, missing parts, duplicate bytes and unsupported track combinations", () => {
    const first = part(0, 4);
    const second = part(4, 8);
    expect(moviePlanProblem([first, second])).toBe("");
    expect(moviePlanProblem([first])).toMatch(/at least two/);
    expect(moviePlanProblem([second, first])).toMatch(/story order/);
    expect(moviePlanProblem([first, { ...second, start: 4.5 }])).toMatch(/story order/);
    expect(moviePlanProblem([first, { ...second, start: NaN }])).toMatch(/story order/);
    expect(moviePlanProblem([first, { ...second, sha256: first.sha256 }])).toMatch(/once/);
    expect(moviePlanProblem([first, { ...second, media: { ...second.media, codec: "VP9" } }])).toMatch(/same size/);
    expect(moviePlanProblem([first, { ...second, media: { ...second.media, fps: 24 } }])).toMatch(/frame rate/);
    expect(moviePlanProblem([first, { ...second, media: { ...second.media, audio: undefined } }])).toMatch(/matching Opus/);
    expect(moviePlanProblem([first, { ...second, media: { ...second.media, duration: 5 } }])).toMatch(/unusual timing/);
  });

  it("accepts only bounded genuine recorder lead/tail time and reports the offending part", () => {
    const first = part(0, 120);
    const second = { ...part(120, 240), sha256: "f".repeat(64) };
    // 150ms intentional audio lead plus bounded MediaRecorder tail is normal
    // for a genuinely decoded VP8/Opus part; the worker still verifies
    // timestamp continuity and every independently decodable packet.
    const withTail = { ...second, media: { ...second.media, duration: 120.55 } };
    expect(moviePlanProblem([first, withTail])).toBe("");
    const over = { ...withTail, media: { ...withTail.media, duration: 120.61 } };
    expect(moviePlanProblem([first, over])).toMatch(/Part 2 has unusual timing.*120\\.610s.*120\\.000s/);
    expect(moviePlanProblem([first, { ...over, media: { ...over.media, duration: NaN } }]))
      .toMatch(/Part 2 has unusual timing.*invalid duration/);
    const shortened = { ...withTail, media: { ...withTail.media, duration: 119.39 } };
    expect(moviePlanProblem([first, shortened])).toMatch(/Part 2 has unusual timing/);
  });

  it("enforces the byte budget and requires more temporary storage than the source files", () => {
    const parts = [part(0, 4), part(4, 8)];
    expect(movieSpaceNeeded(parts)).toBeGreaterThan(2 * 1000 * 2);
    // The limit applies to the SUM of all source videos, not each file
    // individually. Verify the exact boundary and one byte beyond it.
    const atLimit = { ...parts[0], file: { size: MOVIE_BYTES - parts[1].file.size } as File };
    expect(moviePlanProblem([atLimit, parts[1]])).toBe("");
    const overLimit = { ...parts[0], file: { size: MOVIE_BYTES - parts[1].file.size + 1 } as File };
    expect(moviePlanProblem([overLimit, parts[1]])).toMatch(/512 MiB/);
    // Match the actual recorder's target rates: 2 Mbps VP8 + 128 kbps Opus
    // for twenty minutes exceeds the old 256 MiB cap, but fits the safe
    // desktop 512 MiB staging budget.
    const targetSize = Math.ceil(1200 * (2_000_000 + 128_000) / 8);
    const longParts = Array.from({ length: 10 }, (_, index) => ({
      ...part(index * 120, (index + 1) * 120),
      sha256: index.toString(16).padStart(64, "0"),
      file: { size: Math.ceil(targetSize / 10) } as File,
    }));
    expect(targetSize).toBeGreaterThan(256 * 1024 * 1024);
    expect(moviePlanProblem(longParts)).toBe("");
    expect(movieSpaceNeeded(longParts)).toBeGreaterThan(targetSize * 2);
    expect(movieDeviceProblem(true, 8)).toMatch(/larger screen/);
    expect(movieDeviceProblem(false, 2)).toMatch(/more memory/);
  });

  it("writes one continuously numbered SRT on actual joined timestamps", () => {
    const project = starterProject();
    const { segments } = planSegments(project, Math.max(...project.scenes.map(scene => scene.duration)));
    project.captions = segments.map(({ firstScene }, index) => ({
      id: String(index), sceneId: project.scenes[firstScene].id, start: 0.25, end: 1, text: `Scene cue ${index + 1}`,
    }));
    const ranges = segments.map(({ start, end }, index) => ({ start: start + index * 0.18, end: end + (index + 1) * 0.18 }));
    const subtitles = singleMovieSrt(project, segments, ranges);
    expect(subtitles.startsWith("1\n00:00:00,400 --> 00:00:01,150\nScene cue 1")).toBe(true);
    expect(subtitles.match(/ --> /g)).toHaveLength(segments.length);
    expect(subtitles).toContain(`\n\n${segments.length}\n`);
    expect(subtitles).not.toContain("\n\n1\n");
  });
});
