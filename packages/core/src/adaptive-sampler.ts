import { getSamplingRate, setSamplingRate, getAndResetSpanCount } from "./span-factory.js";

export interface AdaptiveSamplingOptions {
  /** Target number of spans stored per second. */
  targetSpansPerSecond: number;
  /** Lowest sampling rate allowed (0..1). Defaults to 0.01. */
  minRate?: number;
  /** Highest sampling rate allowed (0..1). Defaults to 1. */
  maxRate?: number;
}

export function startAdaptiveSampler(opts: AdaptiveSamplingOptions): () => void {
  const target = opts.targetSpansPerSecond;
  const minRate = opts.minRate ?? 0.01;
  const maxRate = opts.maxRate ?? 1;

  const id = setInterval(() => {
    const count = getAndResetSpanCount();
    const current = getSamplingRate();

    if (count === 0) {
      // No traffic — gently recover toward maxRate.
      const recovered = Math.min(maxRate, current * 1.1 + 0.01);
      if (recovered !== current) setSamplingRate(recovered);
      return;
    }

    // Estimate raw arrival rate before sampling, then compute the ideal rate
    // needed to hit the target.
    const arrivalRate = count / current;
    const ideal = target / arrivalRate;
    setSamplingRate(Math.max(minRate, Math.min(maxRate, ideal)));
  }, 1000);

  return () => clearInterval(id);
}
