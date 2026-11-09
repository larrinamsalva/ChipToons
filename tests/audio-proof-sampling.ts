/**
 * Pick a genuinely audible 260ms source window close to a movie-part
 * boundary. An original recording may contain a natural musical pause or
 * a quiet encoder tail; treating that silence as missing audio creates a
 * false negative in correlation checks.
 *
 * We still require actual source sound (> minimum signal energy), then
 * independently compare that source against the joined movie PCM at the
 * exact same timestamp with the original strict correlation, delay and
 * volume-ratio assertions.
 */
export function audibleTailSamplePosition(
  source: Float32Array,
  rate: number,
  spanSeconds = 0.26,
  endOffsetSeconds = 0.3,
  scanSeconds = 8,
  minimumEnergy = 1e-5,
): number {
  if (!Number.isFinite(rate) || rate <= 0 ||
      !Number.isFinite(spanSeconds) || spanSeconds <= 0 ||
      !Number.isFinite(endOffsetSeconds) || endOffsetSeconds < spanSeconds ||
      !Number.isFinite(scanSeconds) || scanSeconds < 0)
    throw new Error("Invalid audible-tail sampling settings.");

  const windowSamples = Math.round(spanSeconds * rate);
  const lastStart = source.length - Math.round(endOffsetSeconds * rate);
  if (windowSamples < 1 || lastStart < 0 ||
      lastStart + windowSamples > source.length)
    throw new Error("The recorded source is too short to check its audio tail.");

  const minimumStart = Math.max(0, lastStart - Math.round(scanSeconds * rate));
  const stepSamples = Math.max(1, Math.round(rate * 0.125));
  let loudestEnergy = 0;

  for (let start = lastStart; start >= minimumStart; start -= stepSamples) {
    let energy = 0;
    for (let i = 0; i < windowSamples; i++) {
      const sample = source[start + i];
      energy += sample * sample;
    }
    loudestEnergy = Math.max(loudestEnergy, energy);
    if (energy > minimumEnergy) return start / rate;
  }
  throw new Error(
    `The original recording has no audible 260ms sample in its final ${scanSeconds}s (peak energy ${loudestEnergy.toExponential(3)}).`,
  );
}
