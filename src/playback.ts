import { clamp } from "./timeline";
export interface PlaybackSnapshot {
  seconds: number;
  playing: boolean;
}
export function advancePlayback(
  time: number,
  delta: number,
  start: number,
  end: number,
  loop: boolean,
) {
  const next = Math.max(start, time + Math.max(0, delta));
  if (next < end) return { seconds: next, playing: true };
  return loop && end > start
    ? { seconds: start + ((next - start) % (end - start)), playing: true }
    : { seconds: end, playing: false };
}
// Only the stage, transport and playhead subscribe. Story forms and thumbnails
// do not rerender on every animation frame. Snapshots are capped at 30 fps.
export class PlaybackClock {
  private snapshot: PlaybackSnapshot = { seconds: 0, playing: false };
  private listeners = new Set<() => void>();
  private handle = 0;
  private last: number | undefined;
  private published = 0;
  private start = 0;
  private end = 60;
  private loop = false;
  private timeSource: (() => number) | undefined;
  setTimeSource(source?: () => number) {
    this.timeSource = source;
    this.last = undefined;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(snapshot: PlaybackSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((fn) => fn());
  }
  configure(start: number, end: number, loop: boolean) {
    this.start = start;
    this.end = end;
    this.loop = loop;
  }
  seek(seconds: number) {
    this.publish({
      ...this.snapshot,
      seconds: clamp(seconds, this.start, this.end),
    });
    this.last = undefined;
  }
  pause() {
    cancelAnimationFrame(this.handle);
    this.last = undefined;
    if (this.snapshot.playing)
      this.publish({ ...this.snapshot, playing: false });
  }
  play() {
    if (this.snapshot.playing) return;
    if (this.snapshot.seconds < this.start || this.snapshot.seconds >= this.end)
      this.seek(this.start);
    this.last = undefined;
    this.published = 0;
    this.publish({ ...this.snapshot, playing: true });
    this.handle = requestAnimationFrame(this.tick);
  }
  private tick = (timestamp: number) => {
    if (!this.snapshot.playing) return;
    if (this.last === undefined) this.last = timestamp;
    if (timestamp - this.published >= 1000 / 30) {
      const next = advancePlayback(
        this.snapshot.seconds,
        this.timeSource
          ? this.timeSource() - this.snapshot.seconds
          : (timestamp - this.last) / 1000,
        this.start,
        this.end,
        this.loop,
      );
      this.last = timestamp;
      this.published = timestamp;
      this.publish(next);
    }
    if (this.snapshot.playing) this.handle = requestAnimationFrame(this.tick);
  };
  dispose() {
    this.pause();
    this.listeners.clear();
  }
}
