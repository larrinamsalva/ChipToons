/** Interval arithmetic only: a voice-lane clip interval may be silent or
 * contain wrong words. Coverage never certifies speech, words or audio files. */
export interface FramefieldTimeWindow {
  start: number;
  end: number;
}
export function framefieldCueTimingCoverage(
  start: number, end: number, windows: readonly FramefieldTimeWindow[],
) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new RangeError("Caption time interval must have a positive duration.");
  const intervals = windows
    .map(window => ({
      start: Math.max(start, window.start),
      end: Math.min(end, window.end),
    }))
    .filter(window => window.end > window.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: FramefieldTimeWindow[] = [];
  for (const window of intervals) {
    const last = merged.at(-1);
    if (last && window.start <= last.end) {
      last.end = Math.max(last.end, window.end);
    } else {
      merged.push({ ...window });
    }
  }
  const gaps: FramefieldTimeWindow[] = [];
  let cursor = start, coveredSeconds = 0;
  for (const window of merged) {
    if (window.start > cursor)
      gaps.push({ start: cursor, end: window.start });
    coveredSeconds += window.end - window.start;
    cursor = window.end;
  }
  if (cursor < end) gaps.push({ start: cursor, end });
  const duration = end - start;
  return {
    coveredSeconds,
    coverageFraction: Math.min(1, Math.max(0, coveredSeconds / duration)),
    gaps,
  };
}
