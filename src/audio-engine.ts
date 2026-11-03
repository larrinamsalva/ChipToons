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
  private readonly budget: number;
  constructor(budget = 64 * 1024 * 1024) {
    this.budget = budget;
  }
  async get(context: AudioContext, asset: AudioAsset) {
    const prior = this.entries.get(asset.id);
    if (
      prior &&
      prior.data === asset.dataUrl &&
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
        data: asset.dataUrl,
        duration: asset.duration,
        rate: context.sampleRate,
        buffer,
        bytes,
      });
      this.bytes += bytes;
    }
    return buffer;
  }
  clear() {
    this.serial++;
    this.entries.clear();
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
    ),
    buffers = new Map<string, AudioBuffer>();
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
export class PreviewAudio {
  private context?: AudioContext;
  private buffers = new Map<string, { data: string; buffer: AudioBuffer }>();
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
  ) {
    this.stop();
    const token = this.serial;
    if (typeof AudioContext === "undefined")
      throw new Error(
        "Sound preview needs Web Audio in this browser. Turn Sound off to preview animation, or try a current Chromium browser.",
      );
    const context = (this.context ??= new AudioContext());
    await context.resume();
    const used = new Set(
      project.audioClips.filter((c) => !c.muted).map((c) => c.assetId),
    );
    for (const id of this.buffers.keys())
      if (!used.has(id)) this.buffers.delete(id);
    for (const a of project.audioAssets.filter((a) => used.has(a.id))) {
      if (this.buffers.get(a.id)?.data !== a.dataUrl)
        this.buffers.set(a.id, {
          data: a.dataUrl,
          buffer: await decodeAsset(context, a),
        });
      if (token !== this.serial)
        throw new DOMException("Preview cancelled", "AbortError");
    }
    const buffers = new Map(
      [...this.buffers].map(([id, value]) => [id, value.buffer]),
    );
    this.graph = mixingGraph(context, context.destination, project.mixer);
    this.anchor = context.currentTime + 0.12;
    this.origin = offset;
    scheduleAudio(
      context,
      project,
      buffers,
      this.graph,
      offset,
      rangeEnd,
      this.anchor,
      this.nodes,
    );
    if (loop) {
      let next = this.anchor + rangeEnd - offset;
      const length = rangeEnd - rangeStart;
      this.interval = setInterval(() => {
        if (next < context.currentTime + 1 && this.graph) {
          scheduleAudio(
            context,
            project,
            buffers,
            this.graph,
            rangeStart,
            rangeEnd,
            next,
            this.nodes,
          );
          next += length;
        }
      }, 150);
    }
    return () => this.origin + Math.max(0, context.currentTime - this.anchor);
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
    this.buffers.clear();
  }
}
