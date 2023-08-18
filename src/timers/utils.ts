/**
 * Computes the arithmetic mean of a sample.
 *
 * @param sample The sample.
 * @returns The mean.
 */
export function getMean(sample: number[]): number {
  return (sample.reduce((a, b) => a + b, 0) / sample.length) || 0;
}

/**
 * Gets the current timer's minimum resolution.
 *
 * @param measurement The measurement function.
 *
 * @returns The resolution.
 */
export function getResolution(measurement: () => number): number {
  let measured: number;
  let count = 30;
  const sample: number[] = [];

  // Get average smallest measurable time.
  while (count--) {
    measured = measurement();

    // Check for broken timers.
    if (measured > 0) {
      sample.push(measured);
    } else {
      sample.push(Infinity);
      break;
    }
  }

  return getMean(sample);
}
