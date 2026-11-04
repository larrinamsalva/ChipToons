import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_IDEA, planStory } from "./planner";
import { planSegments } from "./segments";
import { deliveryDigest } from "./delivery-bytes";
import { readStoredZip, storedZip } from "./delivery-zip";
import {
  checkEpisodePackage, exportReceipts, inspectDeliveryFile, makeEpisodeZip, partProblem,
  prepareDelivery, rememberExportReceipt, reviewDelivery, srtToVtt, suggestPart,
} from "./episode-delivery";
import type { DeliveryFile, ExportReceipt } from "./episode-delivery";
import { readWebmTracks } from "./webm";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const project = planStory({ ...DEFAULT_IDEA, idea: "Friends make room to help." });
  project.scenes = project.scenes.slice(0, 2);
  project.scenes[0].duration = 2;
  project.scenes[1].duration = 3;
  return { project, plan: planSegments(project, 3).segments };
}
const text = (value: string) => Array.from(new TextEncoder().encode(value));
function ebml(id: number[], data: number[]) {
  const size = data.length < 127 ? [0x80 | data.length] : [0x40 | (data.length >> 8), data.length & 255];
  return [...id, ...size, ...data];
}
function webm(audio = true, codec = "V_VP8") {
  const header = ebml([0x1a, 0x45, 0xdf, 0xa3], ebml([0x42, 0x82], text("webm")));
  const picture = ebml([0xae], [
    ...ebml([0x83], [1]), ...ebml([0x86], text(codec)),
    ...ebml([0xe0], [...ebml([0xb0], [3, 32]), ...ebml([0xba], [1, 194])]),
  ]);
  const sound = ebml([0xae], [...ebml([0x83], [2]), ...ebml([0x86], text("A_OPUS"))]);
  return new Uint8Array([...header, ...ebml([0x18, 0x53, 0x80, 0x67], [
    ...ebml([0x16, 0x54, 0xae, 0x6b], [...picture, ...(audio ? sound : [])]),
    ...ebml([0x1f, 0x43, 0xb6, 0x75], new Array<number>(1050).fill(0)),
  ])]);
}
async function file(name: string, duration: number, audio = true, suffix = 0) {
  const bytes = webm(audio);
  bytes[bytes.length - 1] = suffix;
  return inspectDeliveryFile(new File([bytes], name), [],
    async () => ({ width: 800, height: 450, duration }), new AbortController().signal);
}

async function complete() {
  const { project, plan } = fixture();
  const files = await Promise.all([file("first.webm", 2), file("second.webm", 3, true, 1)]);
  const assignments = { 0: files[0].sha256, 1: files[1].sha256 };
  const signal = new AbortController().signal;
  const delivery = await prepareDelivery(project, plan, files, assignments, true, ["A subtitle", ""], signal);
  return { project, plan, files, assignments, signal, delivery };
}

describe("episode delivery verification", () => {
  it("keeps authoritative scene order and refuses missing, duplicate, mismatched and extra parts", async () => {
    const { plan } = fixture();
    expect(plan.map(part => [part.firstScene, part.lastScene, part.start, part.end])).toEqual([[0, 0, 0, 2], [1, 1, 2, 5]]);
    const first = await file("my-cartoon-part-01-scenes-1-1.webm", 2);
    const second = await file("my-cartoon-part-02-scenes-2-2 (1).webm", 3, true, 1);
    expect(suggestPart(first, plan)).toBe(0);
    expect(suggestPart(second, plan)).toBe(1);
    expect(suggestPart({ ...first, file: new File([], "part-02-scenes-1-1.webm") }, plan)).toBeUndefined();
    const missing = reviewDelivery(plan, [first], { 0: first.sha256 }, true);
    expect(missing.ready).toBe(false);
    expect(missing.rows[1].issue).toBe("Missing video part");
    expect(reviewDelivery(plan, [first], { 0: first.sha256, 1: first.sha256 }, true).duplicate).toBe(true);
    expect(reviewDelivery(plan, [second, first], { 0: first.sha256, 1: second.sha256 }, true).ready).toBe(true);
    const extra = await file("extra.webm", 3, true, 2);
    expect(reviewDelivery(plan, [first, second, extra], { 0: first.sha256, 1: second.sha256 }, true).extras).toEqual([extra]);
    const incompatible: DeliveryFile = { ...second, media: { ...second.media, codec: "VP9" } };
    expect(reviewDelivery(plan, [first, incompatible], { 0: first.sha256, 1: second.sha256 }, true).compatibility).toBe(true);
    expect(partProblem({ ...second, media: { ...second.media, duration: 5 } }, plan[1], true)).toMatch(/Duration mismatch/);
    expect(partProblem(await file("silent.webm", 3, false), plan[1], true)).toMatch(/audio track is missing/);
  });

  it("recognizes a matching export receipt and survives storage being unavailable", async () => {
    const { project, plan } = fixture();
    const source = await file("renamed.webm", 2);
    const proof: ExportReceipt = { first: 0, last: 0, start: 0, end: 2, size: source.file.size, sha256: source.sha256,
      fps: 15, width: 800, height: 450, audio: true, captions: true };
    const stored = new Map();
    vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key),
      setItem: (key: string, value: string) => stored.set(key, value) });
    rememberExportReceipt(project, proof);
    expect(exportReceipts(project)).toEqual([proof]);
    expect(exportReceipts({ ...project, updatedAt: "Different revision" })).toEqual([]);
    const result = await inspectDeliveryFile(source.file, exportReceipts(project),
      async () => ({ width: 800, height: 450, duration: 2 }), new AbortController().signal);
    expect(result.media).toMatchObject({ fps: 15, fpsSource: "export-setting" });
    expect(suggestPart(result, plan)).toBe(0);
    expect(partProblem(result, plan[1], true)).toMatch(/different scene range/);
    vi.stubGlobal("localStorage", { getItem: () => { throw new DOMException("Unavailable"); },
      setItem: () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); } });
    expect(() => rememberExportReceipt(project, proof)).not.toThrow();
    expect(exportReceipts(project)).toEqual([]);
  });

  it("reads supported WebM track metadata and rejects truncated and unsupported containers", () => {
    const valid = webm();
    expect(readWebmTracks(valid, valid.length)).toEqual({ codec: "VP8", width: 800, height: 450, audio: "Opus" });
    expect(readWebmTracks(valid.subarray(0, 128), valid.length)).toMatchObject({ codec: "VP8" });
    expect(() => readWebmTracks(valid.subarray(0, 25), 25)).toThrow();
    const unsupported = webm(false, "V_AV1");
    expect(() => readWebmTracks(unsupported, unsupported.length)).toThrow(/VP8 or VP9/);
    expect(() => readWebmTracks(new Uint8Array(1200), 1200)).toThrow();
  });

  it("creates a valid STORE archive with the exact original bytes, manifest, and subtitles", async () => {
    const { files, signal, delivery } = await complete();
    const zip = makeEpisodeZip(delivery, 8 * 1024 * 1024);
    const checked = await checkEpisodePackage(zip, 8 * 1024 * 1024, signal);
    expect(checked.manifest).toEqual(delivery.manifest);
    expect(await checked.parts[0].subtitle?.text()).toBe("A subtitle");
    expect(new Uint8Array(await checked.parts[1].video.arrayBuffer())).toEqual(new Uint8Array(await files[1].file.arrayBuffer()));
    const exact = createHash("sha256").update(Buffer.from(await files[0].file.arrayBuffer())).digest("hex");
    expect(checked.manifest.parts[0].video.sha256).toBe(exact);
    expect([...await readStoredZip(zip, 100000, signal)].map(([name]) => name)).toEqual([
      "README.txt", "part-01-scenes-1-1.webm", "part-01-scenes-1-1.srt", "part-02-scenes-2-2.webm", "part-order.json",
    ]);
    expect(srtToVtt("1\n00:00:00,250 --> 00:00:01,600\n<b>Hello & welcome</b>\n")).toContain(
      "00:00:00.250 --> 00:00:01.600\n&lt;b&gt;Hello &amp; welcome&lt;/b&gt;",
    );
  });

  it("rejects incorrect ZIP structure, changed bytes, missing files and a reordered manifest", async () => {
    const { delivery, signal } = await complete();
    const maximum = 100000;
    const zip = makeEpisodeZip(delivery, maximum);
    const corrupt = new Uint8Array(await zip.arrayBuffer());
    corrupt[30 + "README.txt".length] ^= 1;
    await expect(checkEpisodePackage(new Blob([corrupt]), maximum, signal)).rejects.toThrow(/Checksum failed/);
    await expect(checkEpisodePackage(zip.slice(0, zip.size - 6), maximum, signal)).rejects.toThrow(/ZIP/);
    const missing = storedZip(delivery.entries.filter(item => !item.name.endsWith("2-2.webm")), maximum);
    await expect(checkEpisodePackage(missing, maximum, signal)).rejects.toThrow(/missing or unexpected/);
    const reversed = new Blob([JSON.stringify({ ...delivery.manifest, parts: [...delivery.manifest.parts].reverse() })]);
    const reordered = storedZip([...delivery.entries.slice(0, -1),
      { name: "part-order.json", blob: reversed, ...(await deliveryDigest(reversed)) }], maximum);
    await expect(checkEpisodePackage(reordered, maximum, signal)).rejects.toThrow(/out of order/);
    expect(() => storedZip([{ name: "../movie.webm", blob: reversed, crc32: 0 }], maximum)).toThrow();
  });

  it("enforces memory limits and cancels during checksum work without returning a partial delivery", async () => {
    const { project, plan, files, assignments, signal, delivery } = await complete();
    expect(() => makeEpisodeZip(delivery, 500)).toThrow(/exceeds/);
    const zip = makeEpisodeZip(delivery, 100000);
    await expect(checkEpisodePackage(zip, 500, signal)).rejects.toThrow(/larger/);
    const abort = new AbortController();
    await expect(prepareDelivery(project, plan, files, assignments, true, [], abort.signal, () => abort.abort()))
      .rejects.toHaveProperty("name", "AbortError");
    const checking = new AbortController();
    await expect(checkEpisodePackage(zip, 100000, checking.signal, () => checking.abort()))
      .rejects.toHaveProperty("name", "AbortError");
    expect(reviewDelivery(plan, files, assignments, true).ready).toBe(true);
  });
});
