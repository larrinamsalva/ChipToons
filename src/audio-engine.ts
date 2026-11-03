import type { Project } from "./model";
import type { Mixer, AudioAsset } from "./media-model";
import {
  audioPlan,
  categoryBus,
  clipGain,
  duckingAt,
  duckingWindows,
} from "./production";
import { decodeAsset } from "./audio-files";

export function mixingGraph(
  context: AudioContext,
  destination: AudioNode,
  mixer: Mixer,
) {
  const master = context.createGain(),
    compressor = context.createDynamicsCompressor();
  master.gain.value = mixer.muted ? 0 : mixer.master;
  compressor.threshold.value = -10;
  compressor.ratio.value = 8;
  master.connect(compressor);
  compressor.connect(destination);
  const buses = {
    voice: context.createGain(),
    music: context.createGain(),
    effects: context.createGain(),
  };
  for (const [name, bus] of Object.entries(buses)) {
    bus.gain.value = mixer[name as keyof typeof buses];
    bus.connect(master);
  }
  return {
    master,
    buses,
    dispose: () => {
      Object.values(buses).forEach((b) => b.disconnect());
      master.disconnect();
      compressor.disconnect();
    },
  };
}
export type MixGraph = ReturnType<typeof mixingGraph>;
export function scheduleAudio(
  context: AudioContext,
  project: Project,
  buffers: Map<string, AudioBuffer>,
  graph: MixGraph,
  start: number,
  end: number,
  when: number,
  nodes: Set<AudioBufferSourceNode>,
) {
  const windows = duckingWindows(project);
  for (const plan of audioPlan(project, start, end)) {
    const clip = plan.clip,
      buffer = buffers.get(clip.assetId);
    if (!buffer)
      throw new Error(
        "An audio source is missing. Your project has not been changed.",
      );
    const source = context.createBufferSource(),
      gain = context.createGain(),
      at = when + plan.from - start,
      length = plan.to - plan.from;
    source.buffer = buffer;
    source.loop = clip.loop;
    source.loopStart = clip.trimStart;
    source.loopEnd = Math.min(buffer.duration, clip.trimEnd);
    source.connect(gain);
    const duck = context.createGain();
    gain.connect(duck);
    duck.connect(graph.buses[categoryBus(clip.category)]);
    duck.gain.setValueAtTime(
      clip.category === "music" ? duckingAt(windows, plan.from) : 1,
      at,
    );
    if (clip.category === "music")
      for (const point of [
        ...new Set(
          windows.flatMap((w) => [
            w.start - 0.12,
            w.start,
            w.end,
            w.end + 0.28,
          ]),
        ),
      ]
        .filter((t) => t > plan.from && t < plan.to)
        .sort((a, b) => a - b))
        duck.gain.linearRampToValueAtTime(
          duckingAt(windows, point),
          at + point - plan.from,
        );
    if (clip.category === "music")
      duck.gain.linearRampToValueAtTime(
        duckingAt(windows, plan.to),
        at + length,
      );
    gain.gain.setValueAtTime(clipGain(clip, plan.elapsed), at);
    const points = [clip.fadeIn, clip.duration - clip.fadeOut, clip.duration];
    if (clip.fadeIn + clip.fadeOut > clip.duration)
      points.push((clip.duration * clip.fadeIn) / (clip.fadeIn + clip.fadeOut));
    for (const p of [...new Set(points)]
      .filter((t) => t > plan.elapsed && t < plan.elapsed + length)
      .sort((a, b) => a - b))
      gain.gain.linearRampToValueAtTime(
        clipGain(clip, p),
        at + p - plan.elapsed,
      );
    gain.gain.linearRampToValueAtTime(
      clipGain(clip, plan.elapsed + length - 1e-6),
      at + length,
    );
    nodes.add(source);
    source.onended = () => {
      nodes.delete(source);
      source.disconnect();
      gain.disconnect();
      duck.disconnect();
    };
    source.start(at, Math.min(plan.offset, buffer.duration - 0.001));
    source.stop(at + length);
  }
}
export class AudioDecodeCache {
  private entries = new Map<
    string,
    {
      data: string;
      duration: number;
      rate: number;
      buffer: AudioBuffer;
      bytes: number;
    }
  >();
  private bytes = 0;
  private serial = 0;
  decodes = 0;
  private pending = new Map<string, Promise<AudioBuffer>>();
  private readonly budget: number;
  constructor(budget = 64 * 1024 * 1024) {
    this.budget = budget;
  }
  async get(context: AudioContext, asset: AudioAsset) {
    const prior = this.entries.get(asset.id);
    if (
      prior &&
      prior.data === (asset.file?.sha256 ?? asset.dataUrl) &&
      prior.duration === asset.duration &&
      prior.rate === context.sampleRate
    ) {
      this.entries.delete(asset.id);
      this.entries.set(asset.id, prior);
      return prior.buffer;
    }
    if (prior) {
      this.bytes -= prior.bytes;
      this.entries.delete(asset.id);
    }
    const pendingKey = `${asset.id}:${asset.file?.sha256 ?? asset.dataUrl}:${context.sampleRate}`;
    const existing = this.pending.get(pendingKey);
    if (existing) return existing;
    const job = (async () => {
      const token = this.serial,
        buffer = await decodeAsset(context, asset),
        bytes = buffer.length * buffer.numberOfChannels * 4;
      this.decodes++;
      if (token === this.serial && bytes <= this.budget) {
        while (this.bytes + bytes > this.budget && this.entries.size) {
          const first = this.entries.keys().next().value!;
          this.bytes -= this.entries.get(first)!.bytes;
          this.entries.delete(first);
        }
        this.entries.set(asset.id, {
          data: asset.file?.sha256 ?? asset.dataUrl,
          duration: asset.duration,
          rate: context.sampleRate,
          buffer,
          bytes,
        });
        this.bytes += bytes;
      }
      return buffer;
    })();
    this.pending.set(pendingKey, job);
    try {
      return await job;
    } finally {
      if (this.pending.get(pendingKey) === job) this.pending.delete(pendingKey);
    }
  }
  clear() {
    this.serial++;
    this.entries.clear();
    this.pending.clear();
    this.bytes = 0;
  }
  stats() {
    return {
      bytes: this.bytes,
      sources: this.entries.size,
      decodes: this.decodes,
    };
  }
}
export async function prepareAudio(
  context: AudioContext,
  project: Project,
  onProgress?: (label: string) => void,
  range = { start: 0, end: project.scenes.reduce((n, s) => n + s.duration, 0) },
  cache?: AudioDecodeCache,
) {
  const ids = new Set(
    audioPlan(project, range.start, range.end).map((p) => p.clip.assetId),
  );
  const estimate = project.audioAssets
    .filter((a) => ids.has(a.id))
    .reduce(
      (n, a) => n + Math.ceil(a.duration * context.sampleRate) * a.channels * 4,
      0,
    );
  if (estimate > 64 * 1024 * 1024)
    throw new Error(
      "This range needs more than 64 MB of decoded audio. Split long originals into shorter sections or reduce overlapping sources; your original files are unchanged.",
    );
  const buffers = new Map<string, AudioBuffer>();
  for (const asset of project.audioAssets.filter((a) => ids.has(a.id))) {
    onProgress?.(`Decoding ${asset.name}…`);
    buffers.set(
      asset.id,
      cache
        ? await cache.get(context, asset)
        : await decodeAsset(context, asset),
    );
  }
  return buffers;
}
// Schedule bounded windows against the same Web Audio clock used by export.
// Future sources are read only when the next window is close, never episode-wide.
export class PreviewAudio {
  private context?: AudioContext;
  private cache = new AudioDecodeCache();
  private nodes = new Set<AudioBufferSourceNode>();
  private graph?: MixGraph;
  private interval: ReturnType<typeof setInterval> | undefined;
  private serial = 0;
  private anchor = 0;
  private origin = 0;
  async start(
    project: Project,
    offset: number,
    rangeStart: number,
    rangeEnd: number,
    loop: boolean,
    onError?: (error: Error) => void,
  ) {
    this.stop();
    const token = this.serial;
    if (typeof AudioContext === "undefined")
      throw new Error(
        "Sound preview needs Web Audio in this browser. Turn Sound off to preview animation, or try a current Chromium browser.",
      );
    const context = (this.context ??= new AudioContext());
    await context.resume();
    let from = offset,
      elapsed = 0,
      pending = false,
      done = false;
    const cancelled = () => {
      if (token !== this.serial)
        throw new DOMException("Preview cancelled", "AbortError");
    };
    const prepare = async () => {
      const to = Math.min(rangeEnd, from + 8),
        buffers = await prepareAudio(
          context,
          project,
          undefined,
          { start: from, end: to },
          this.cache,
        );
      cancelled();
      return { from, to, buffers };
    };
    const first = await prepare();
    cancelled();
    this.graph = mixingGraph(context, context.destination, project.mixer);
    this.anchor = context.currentTime + 0.12;
    this.origin = offset;
    const schedule = (part: Awaited<ReturnType<typeof prepare>>) => {
      if (!this.graph) return;
      const when = this.anchor + elapsed;
      if (when < context.currentTime - 0.02)
        throw new Error(
          "Audio preparation fell behind playback. Pause and retry this scene, or use shorter audio sections.",
        );
      scheduleAudio(
        context,
        project,
        part.buffers,
        this.graph,
        part.from,
        part.to,
        when,
        this.nodes,
      );
      elapsed += part.to - part.from;
      from = part.to;
      if (from >= rangeEnd) {
        if (loop) from = rangeStart;
        else done = true;
      }
    };
    schedule(first);
    this.interval = setInterval(() => {
      if (
        pending ||
        done ||
        token !== this.serial ||
        context.currentTime < this.anchor + elapsed - 5
      )
        return;
      pending = true;
      void prepare()
        .then((part) => {
          cancelled();
          schedule(part);
        })
        .catch((error) => {
          if (token === this.serial) {
            this.stop();
            onError?.(
              error instanceof Error
                ? error
                : new Error("Audio preview was interrupted."),
            );
          }
        })
        .finally(() => {
          pending = false;
        });
    }, 150);
    return () => this.origin + Math.max(0, context.currentTime - this.anchor);
  }
  stats() {
    return this.cache.stats();
  }
  stop() {
    this.serial++;
    clearInterval(this.interval);
    this.interval = undefined;
    for (const n of this.nodes) {
      try {
        n.stop();
        n.disconnect();
      } catch {
        /* Already ended. */
      }
    }
    this.nodes.clear();
    this.graph?.dispose();
    this.graph = undefined;
  }
  dispose() {
    this.stop();
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.cache.clear();
  }
}
