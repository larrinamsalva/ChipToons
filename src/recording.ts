export function recordingMime() {
  return typeof MediaRecorder !== "undefined"
    ? ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      )
    : undefined;
}
export class VoiceRecorder {
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private timeout?: ReturnType<typeof setTimeout>;
  private serial = 0;
  async start(
    onStop: (blob: Blob, seconds: number) => void,
    onError: (error: Error) => void,
  ) {
    this.cancel();
    const token = this.serial,
      mime = recordingMime();
    if (!navigator.mediaDevices?.getUserMedia || !mime)
      throw new Error(
        "Microphone recording is unavailable here. Use HTTPS or upload a WAV/MP3 recording.",
      );
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true },
      video: false,
    });
    if (token !== this.serial) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: 96000,
      });
    } catch (error) {
      this.cancel();
      throw error;
    }
    this.recorder = recorder;
    const chunks: BlobPart[] = [],
      start = performance.now();
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => {
      this.cancel();
      onError(
        new Error(
          "Recording stopped unexpectedly. Please try again or upload a clip.",
        ),
      );
    };
    recorder.onstop = () => {
      clearTimeout(this.timeout);
      stream.getTracks().forEach((t) => t.stop());
      this.stream = undefined;
      this.recorder = undefined;
      if (token === this.serial)
        onStop(
          new Blob(chunks, { type: mime.split(";")[0] }),
          Math.min(60, (performance.now() - start) / 1000),
        );
    };
    try {
      recorder.start(250);
      this.timeout = setTimeout(() => this.stop(), 60000);
    } catch (error) {
      this.cancel();
      throw error;
    }
  }
  stop() {
    clearTimeout(this.timeout);
    if (this.recorder?.state !== "inactive") this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
  }
  cancel() {
    this.serial++;
    clearTimeout(this.timeout);
    if (this.recorder) {
      this.recorder.onstop = null;
      this.recorder.onerror = null;
      if (this.recorder.state !== "inactive") this.recorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.recorder = undefined;
  }
}
