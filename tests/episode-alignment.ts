// Independent decoded-waveform measurement used only by media verification.
export function alignment(
  reference: Buffer,
  movie: Buffer,
  sceneOffset: number,
) {
  const sampleStart = 8000,
    count = 16000;
  function score(lag: number, stride: number) {
    const start = Math.round(sceneOffset * 8000) + sampleStart + lag;
    if (start < 0 || (Math.ceil(start) + count + 1) * 4 > movie.length)
      return -1;
    let dot = 0,
      a2 = 0,
      b2 = 0;
    const whole = Math.floor(start),
      fraction = start - whole;
    for (let j = 0; j < count; j += stride) {
      const a = reference.readFloatLE((sampleStart + j) * 4),
        left = movie.readFloatLE((whole + j) * 4),
        b = left + fraction * (movie.readFloatLE((whole + j + 1) * 4) - left);
      dot += a * b;
      a2 += a * a;
      b2 += b * b;
    }
    return dot / Math.sqrt(a2 * b2 || 1);
  }
  let lag = 0,
    correlation = -1;
  for (let candidate = -800; candidate <= 4800; candidate += 1) {
    const value = score(candidate, 4);
    if (value > correlation) {
      lag = candidate;
      correlation = value;
    }
  }
  const coarseCorrelation = correlation,
    coarse = lag;
  // A millisecond grid can miss speech phase. Search every sample, then refine
  // to 1/4 sample, using
  // every decoded sample, without lowering the signal or timing assertions.
  for (let candidate = coarse - 1; candidate <= coarse + 1; candidate += 0.25) {
    const value = score(candidate, 1);
    if (value > correlation) {
      lag = candidate;
      correlation = value;
    }
  }
  return { correlation, delay: lag / 8000, coarseCorrelation };
}
