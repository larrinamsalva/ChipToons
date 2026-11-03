// Original fictional story, synthesized offline with FFmpeg's generic Flite voice.
// This is a verification fixture, not a promise of in-app speech generation.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { starterProject } from "../src/planner";
import { uid, validateProject } from "../src/model";
import { CHAPTERS } from "../src/story-model";
import { emptyProduction } from "../src/media-model";
import type { AudioAsset } from "../src/media-model";
import { duplicateAnimatedScene, retimeScene } from "../src/timeline";
import { newAudioClip } from "../src/production";
import { builtInSound } from "../src/sounds";
import { pixel } from "./creator-fixtures";
const digest = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");
const items = [
  "sunflower",
  "bluebell",
  "daisy",
  "tulip",
  "fern",
  "poppy",
  "clover",
  "lily",
  "marigold",
  "rose",
];
const scripts = [
  (item: string) => [
    `Mia and Pip visit the ${item} corner of their garden.`,
    "They leave room for a new friend to join them.",
    "What could you say to help someone feel welcome?",
  ],
  (item: string) => [
    `Pip draws a ${item} on a card for their friend.`,
    "Mia listens carefully to the colors their friend likes.",
    "Our choices can be different, and every voice matters.",
  ],
  (item: string) => [
    `Beside the ${item}, their friend cannot reach a watering can.`,
    "Mia notices a worried face and stops to listen.",
    "How might you ask before offering a little help?",
  ],
  (item: string) => [
    `The friends make a gentle plan near the ${item}.`,
    "They ask their trusted grown up which tools are safe.",
    "Then they take turns and check that everyone agrees.",
  ],
  (item: string) => [
    `Together they water the ${item}, one small cup at a time.`,
    "Pip holds the pot while Mia pours with care.",
    "Their friend smiles, because each helper has a useful job.",
  ],
  (item: string) => [
    `The ${item} looks bright as the friends tidy their space.`,
    "They thank one another for listening and taking turns.",
    "Who could you include in a kind little plan today?",
  ],
];
export function createEpisodeFixture(directory: string) {
  const p = {
    ...starterProject("kindness"),
    ...emptyProduction(),
    mediaVersion: 1 as const,
  };
  p.title = "Mia and Pip's Garden of Welcome";
  p.plannedMinutes = 20;
  const templates = p.scenes;
  p.assets = [
    {
      id: uid(),
      type: "image",
      name: "Original tiny garden artwork",
      mime: "image/png",
      dataUrl: pixel,
    },
  ];
  p.scenes = Array.from({ length: 60 }, (_, i) => {
    const scene = retimeScene(
      duplicateAnimatedScene(templates[i % templates.length]),
      20,
    );
    scene.title = `${i + 1}. ${items[i % 10]} · ${CHAPTERS[Math.floor(i / 10)].label}`;
    scene.chapter = CHAPTERS[Math.floor(i / 10)].id;
    scene.transition = i % 3 === 0 ? "fade" : "cut";
    scene.narration = scripts[Math.floor(i / 10)](items[i % 10]).join(" ");
    scene.dialogue = "";
    return scene;
  });
  const files: {
      key: string;
      sha256: string;
      size: number;
      mime: string;
      bytes: Buffer;
    }[] = [],
    originals = new Map<string, Buffer>(),
    speechWindows: {
      scene: number;
      start: number;
      end: number;
      text: string;
    }[] = [];
  function add(
    name: string,
    bytes: Buffer,
    duration: number,
    rate: number,
  ): AudioAsset {
    const key = uid(),
      hash = digest(bytes),
      asset: AudioAsset = {
        id: uid(),
        name,
        dataUrl: "",
        mime: "audio/wav",
        duration,
        channels: 1,
        sampleRate: rate,
        file: { key, sha256: hash, size: bytes.length },
      };
    files.push({
      key,
      sha256: hash,
      size: bytes.length,
      mime: asset.mime,
      bytes,
    });
    originals.set(asset.id, bytes);
    p.audioAssets.push(asset);
    return asset;
  }
  // Separate measured sentences give truthful captions and intentional answering pauses.
  for (let i = 0; i < 60; i++) {
    const sentences = scripts[Math.floor(i / 10)](items[i % 10]),
      clips: Buffer[] = [];
    let elapsed = 0.6;
    clips.push(Buffer.alloc(Math.round(elapsed * 24000) * 2));
    for (const [j, text] of sentences.entries()) {
      const input = join(directory, `line-${i}-${j}.txt`);
      writeFileSync(input, text);
      const pcm = execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            `flite=textfile='${input}':voice=kal`,
            "-ac",
            "1",
            "-ar",
            "24000",
            "-f",
            "s16le",
            "pipe:1",
          ],
          { maxBuffer: 2 * 1024 * 1024 },
        ),
        duration = pcm.length / 48000;
      speechWindows.push({
        scene: i,
        start: elapsed,
        end: elapsed + duration,
        text,
      });
      p.captions.push({
        id: uid(),
        sceneId: p.scenes[i].id,
        start: elapsed,
        end: elapsed + duration,
        text,
      });
      clips.push(pcm, Buffer.alloc(12000));
      elapsed += duration + 0.25;
    }
    if (elapsed > 19.5)
      throw new Error(
        `Original spoken scene ${i + 1} is too long: ${elapsed}s; do not truncate narration.`,
      );
    const pcm = Buffer.concat([
        ...clips,
        Buffer.alloc(Math.round((20 - elapsed) * 24000) * 2),
      ]),
      wav = execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          "s16le",
          "-ar",
          "24000",
          "-ac",
          "1",
          "-i",
          "pipe:0",
          "-f",
          "wav",
          "pipe:1",
        ],
        { input: pcm, maxBuffer: 2 * 1024 * 1024 },
      ),
      asset = add(
        `Original narration ${i + 1} · ${items[i % 10]}`,
        wav,
        20,
        24000,
      );
    p.audioClips.push({
      ...newAudioClip(p, asset, "narration", i),
      volume: 0.85,
      fadeIn: 0.1,
      fadeOut: 0.2,
    });
  }
  const music = builtInSound("melody"),
    musicAsset = add(
      "Original kindness melody",
      Buffer.from(music.dataUrl.split(",")[1], "base64"),
      music.duration,
      music.sampleRate,
    );
  p.audioClips.push({
    ...newAudioClip(p, musicAsset, "music", 0),
    duration: 1200,
    trimStart: 1,
    trimEnd: 7,
    loop: true,
    volume: 0.18,
    fadeIn: 1,
    fadeOut: 2,
  });
  const effect = builtInSound("reassure"),
    effectAsset = add(
      "Original gentle garden chime",
      Buffer.from(effect.dataUrl.split(",")[1], "base64"),
      effect.duration,
      effect.sampleRate,
    );
  for (let i = 0; i < 60; i += 10) {
    p.audioClips.push({
      ...newAudioClip(p, effectAsset, "effects", i, 18),
      volume: 0.2,
    });
    const input = join(directory, `friend-${i}.txt`),
      line = [
        "Come and join us.",
        "I like your idea.",
        "May I help you?",
        "Let us take turns.",
        "We did it together.",
        "Thank you for listening.",
      ][i / 10];
    writeFileSync(input, line);
    const wav = execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          `flite=textfile='${input}':voice=kal`,
          "-ar",
          "24000",
          "-ac",
          "1",
          "-f",
          "wav",
          "pipe:1",
        ],
        { maxBuffer: 1024 * 1024 },
      ),
      pcm = execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          "pipe:0",
          "-f",
          "s16le",
          "-ar",
          "24000",
          "-ac",
          "1",
          "pipe:1",
        ],
        { input: wav },
      ),
      duration = pcm.length / 48000,
      source = add(
        `Friend's original line ${i / 10 + 1}`,
        wav,
        duration,
        24000,
      ),
      start = 20 - duration - 0.15;
    // These scenes must leave an answering pause rather than overlap the narrator.
    if (speechWindows.filter((w) => w.scene === i).at(-1)!.end > start)
      throw new Error("Dialogue overlaps the narrator");
    p.audioClips.push({
      ...newAudioClip(p, source, "dialogue", i, start),
      characterId: p.characters[1].id,
      volume: 0.9,
    });
    p.captions.push({
      id: uid(),
      sceneId: p.scenes[i].id,
      start,
      end: start + duration,
      text: line,
    });
  }
  p.mixer.duckMusic = true;
  validateProject(p);
  const manifest = Buffer.from(
      JSON.stringify({
        format: "chiptoons-episode",
        version: 1,
        project: p,
        projectHash: digest(JSON.stringify(p)),
        files: files.map((f) => ({
          key: f.key,
          sha256: f.sha256,
          size: f.size,
          mime: f.mime,
        })),
      }),
    ),
    header = Buffer.alloc(16);
  header.write("CTEPKG01");
  header.writeUInt32LE(manifest.length, 8);
  const packageBytes = Buffer.concat([
      header,
      manifest,
      ...files.map((f) => f.bytes),
    ]),
    path = join(directory, "garden-20-minute.ctepisode");
  writeFileSync(path, packageBytes);
  return { project: p, packageBytes, path, originals, speechWindows };
}
export function inspectEpisodePackage(bytes: Buffer) {
  if (bytes.subarray(0, 8).toString() !== "CTEPKG01")
    throw new Error("Missing package header");
  const manifest = JSON.parse(
    bytes.subarray(16, 16 + bytes.readUInt32LE(8)).toString(),
  );
  if (digest(JSON.stringify(manifest.project)) !== manifest.projectHash)
    throw new Error("Storyboard integrity mismatch");
  let offset = 16 + bytes.readUInt32LE(8);
  for (const file of manifest.files) {
    if (digest(bytes.subarray(offset, offset + file.size)) !== file.sha256)
      throw new Error("Original integrity mismatch");
    offset += file.size;
  }
  if (offset !== bytes.length) throw new Error("Unexpected package length");
  return manifest;
}
