/**
 * An object of timing data including cycle, elapsed, period, start, and stop.
 */
export class BenchmarkTimes {
  constructor(
    partial: Partial<BenchmarkTimes> = {},
  ) {
    this.cycle = partial.cycle ?? this.cycle;
    this.elapsed = partial.elapsed ?? this.elapsed;
    this.period = partial.period ?? this.period;
    this.timeStamp = partial.timeStamp ?? this.timeStamp;
  }

  /**
   * The time taken to complete the last cycle (secs).
   */
  public cycle: number = 0;

  /**
   * The time taken to complete the benchmark (secs).
   */
  public elapsed: number = 0;

  /**
   * The time taken to execute the test once (secs).
   */
  public period: number = 0;

  /**
   * A timestamp of when the benchmark started (ms).
   */
  public timeStamp: number = 0;
}
