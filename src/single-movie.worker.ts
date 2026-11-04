import {
  AudioSample, AudioSampleSink, AudioSampleSource, BlobSource, canEncodeAudio, EncodedPacketSink,
  EncodedVideoPacketSource, Input, Output, StreamTarget, VideoSampleSink, WEBM, WebMOutputFormat,
} from "mediabunny";
import type { StreamTargetChunk } from "mediabunny";
import { isChromiumWebmRecording, WEBM_METADATA_LIMIT } from "./webm";
import { checkDeliveryAbort, deliveryDigest } from "./delivery-bytes";
import {
  MOVIE_BYTES, MOVIE_OPUS_BITRATE, MOVIE_PART_TOLERANCE, OPUS_SAMPLE_RATE, moviePlanProblem,
} from "./single-movie-plan";
import type { MoviePart, MovieRange, MovieWorkerMessage, MovieWorkerRequest } from "./single-movie-plan";

const RATE = OPUS_SAMPLE_RATE;
const CHANNELS = 2;
const task = new AbortController();
const send = (message: MovieWorkerMessage) => globalThis.postMessage(message);

function timingError() {
  return new Error("This part has a gap or invalid recording timestamps. Re-export it and try again.");
}

async function copyPart(part: MoviePart, startFrames: number, videoSource: EncodedVideoPacketSource,
  audioSource: AudioSampleSource | undefined, progress: (fraction: number) => void) {
  const signal = task.signal;
  const input = new Input({ formats: [WEBM], source: new BlobSource(part.file, { maxCacheSize: 8 * 1024 * 1024 }) });
  try {
    const prefix = new Uint8Array(await part.file.slice(0, WEBM_METADATA_LIMIT).arrayBuffer());
    if (!isChromiumWebmRecording(prefix, part.file.size))
      throw new Error("Use an original VP8 ChipToons export from Chromium. Other WebM writers can use different sound padding.");
    const digest = await deliveryDigest(part.file, signal);
    if (digest.sha256 !== part.sha256) throw new Error("The file changed after it was checked. Choose it again.");

    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    const config = await video?.getDecoderConfig();
    if (!video || !config || await video.getCodec() !== "vp8" ||
        config.codedWidth !== part.media.width || config.codedHeight !== part.media.height ||
        (await input.getTracks()).length !== (audioSource ? 2 : 1))
      throw new Error("The part has an unsupported video track.");
    if (audioSource ? !audio || await audio.getCodec() !== "opus" ||
        await audio.getSampleRate() !== RATE || await audio.getNumberOfChannels() !== CHANNELS : audio)
      throw new Error("The part needs the 48 kHz stereo Opus sound produced by the ChipToons exporter.");

    const packets = new EncodedPacketSink(video).packets(undefined, undefined, { verifyKeyPackets: true });
    const samples = audio ? new AudioSampleSink(audio).samples() : undefined;
    const sourceLength = part.end - part.start;
    const start = startFrames / RATE;
    let audioClock = startFrames;
    let endAudio = 0;
    let endVideo = 0;
    let previous = -1;
    let frames = 0;
    let lastReport = -1;
    let sample: AudioSample | undefined;

    async function silence(until: number) {
      if (!audioSource) return;
      while (audioClock < until) {
        checkDeliveryAbort(signal);
        const length = Math.min(RATE / 50, until - audioClock);
        const pad = new AudioSample({
          format: "f32", numberOfChannels: CHANNELS, sampleRate: RATE,
          data: new Float32Array(length * CHANNELS), timestamp: audioClock / RATE,
        });
        try { await audioSource.add(pad); } finally { pad.close(); }
        audioClock += length;
      }
    }

    try {
      let packet = (await packets.next()).value;
      sample = (await samples?.next())?.value || undefined;
      if (!packet || packet.type !== "key" || packet.timestamp !== 0 ||
          (audioSource && !sample)) throw timingError();
      if (sample) {
        if (sample.timestamp < 0 || sample.timestamp > 0.12) throw timingError();
        await silence(startFrames + Math.round(sample.timestamp * RATE));
      }

      while (packet || sample) {
        checkDeliveryAbort(signal);
        if (packet && (!sample || packet.timestamp <= sample.timestamp)) {
          const { timestamp, duration } = packet;
          if (!Number.isFinite(timestamp) || timestamp <= previous || !Number.isFinite(duration) ||
              duration < 0 || timestamp + duration > sourceLength + MOVIE_PART_TOLERANCE) throw timingError();
          const next = (await packets.next()).value;
          const displayed = next ? duration : Math.max(duration, part.media.duration - timestamp);
          endVideo = timestamp + displayed;
          await videoSource.add(packet.clone({ timestamp: start + timestamp, duration: displayed }), { decoderConfig: config });
          packet = next;
          previous = timestamp;
          frames++;
          if (Math.floor(timestamp) > lastReport) {
            lastReport = Math.floor(timestamp);
            progress(0.7 * Math.min(1, timestamp / sourceLength));
          }
        } else if (sample && audioSource) {
          const expected = (audioClock - startFrames) / RATE;
          if (!Number.isFinite(sample.timestamp) || Math.abs(sample.timestamp - expected) > 0.025 ||
              sample.timestamp > sourceLength + MOVIE_PART_TOLERANCE) throw timingError();
          endAudio = sample.timestamp + sample.duration;
          sample.setTimestamp(audioClock / RATE);
          await audioSource.add(sample);
          audioClock += sample.numberOfFrames;
          sample.close();
          sample = (await samples?.next())?.value || undefined;
        }
      }
    } finally {
      sample?.close();
      await packets.return();
      await samples?.return();
    }

    // Independently decode the incoming video track without retaining decoded frames.
    // This catches malformed payloads which a container parser alone can copy.
    let decoded = 0;
    for await (const picture of new VideoSampleSink(video).samples()) {
      const time = picture.timestamp;
      picture.close();
      checkDeliveryAbort(signal);
      if (++decoded % 30 === 0) progress(0.7 + 0.3 * Math.min(1, time / sourceLength));
    }
    if (decoded !== frames || (audioSource && endAudio < sourceLength - 0.12)) throw timingError();

    // Keep complete original pictures and audio. Recorder lead/tail time remains
    // with its own part. Integer milliseconds give both tracks the same join.
    const localEnd = Math.max(part.media.duration, endVideo, endAudio, (audioClock - startFrames) / RATE);
    if (Math.abs(localEnd - sourceLength) > MOVIE_PART_TOLERANCE) throw timingError();
    const endFrames = startFrames + Math.ceil(localEnd * 1000 - 1e-7) * (RATE / 1000);
    await silence(endFrames);
    return endFrames;
  } finally {
    input.dispose();
  }
}

async function assemble({ parts, directory, name }: MovieWorkerRequest) {
  const problem = moviePlanProblem(parts);
  if (problem) throw new Error(problem);
  if (typeof VideoDecoder === "undefined" ||
      (parts[0].media.audio && (typeof AudioDecoder === "undefined" ||
        !await canEncodeAudio("opus", { sampleRate: RATE, numberOfChannels: CHANNELS, bitrate: MOVIE_OPUS_BITRATE }))))
    throw new Error("This browser cannot decode the parts and encode continuous Opus sound. Try a current desktop Chromium browser.");

  const handle = await directory.getFileHandle(name, { create: true });
  const stream = await handle.createWritable();
  const target = new StreamTarget(new WritableStream<StreamTargetChunk>({
    async write(chunk) {
      checkDeliveryAbort(task.signal);
      if (chunk.position + chunk.data.byteLength > MOVIE_BYTES)
        throw new Error("The movie exceeded the 256 MiB limit. Keep the checked episode ZIP.");
      await stream.write(chunk);
    },
    close: () => stream.close(),
    abort: reason => stream.abort(reason),
  }), { chunked: true, chunkSize: 1024 * 1024 });
  const output = new Output({ format: new WebMOutputFormat(), target });
  const video = new EncodedVideoPacketSource("vp8");
  const audio = parts[0].media.audio ? new AudioSampleSource({ codec: "opus", bitrate: MOVIE_OPUS_BITRATE }) : undefined;
  output.addVideoTrack(video);
  if (audio) output.addAudioTrack(audio);
  try {
    await output.start();
    const ranges: MovieRange[] = [];
    let endFrames = 0;
    for (const [index, part] of parts.entries()) {
      checkDeliveryAbort(task.signal);
      const label = `Assembling and checking part ${index + 1} of ${parts.length}`;
      let lastUpdate = -Infinity;
      const progress = (fraction: number) => {
        const now = performance.now();
        if (now - lastUpdate < 150) return;
        lastUpdate = now;
        send({ type: "progress", progress: { label, fraction: (index + fraction) / parts.length * 0.9 } });
      };
      progress(0);
      const start = endFrames / RATE;
      try {
        endFrames = await copyPart(part, endFrames, video, audio, progress);
      } catch (error) {
        checkDeliveryAbort(task.signal);
        const message = error instanceof Error ? error.message : "This part could not be read.";
        if (error instanceof DOMException && error.name === "QuotaExceededError") throw error;
        throw new Error(`Part ${index + 1}. ${message}`, { cause: error });
      }
      ranges.push({ start, end: endFrames / RATE });
    }
    checkDeliveryAbort(task.signal);
    video.close();
    audio?.close();
    await output.finalize();
    checkDeliveryAbort(task.signal);
    send({ type: "done", ranges });
  } catch (error) {
    await output.cancel().catch(() => {});
    await stream.abort().catch(() => {});
    throw error;
  }
}

globalThis.addEventListener("message", (event: MessageEvent<MovieWorkerRequest | "cancel">) => {
  if (event.data === "cancel") { task.abort(); return; }
  void assemble(event.data).catch(error => {
    const message = error instanceof DOMException && error.name === "QuotaExceededError"
      ? "There isn’t enough local space to finish the movie. Free some space or keep the checked episode ZIP."
      : error instanceof Error ? error.message : "The browser could not assemble the movie.";
    send({ type: "error", message });
  });
});
