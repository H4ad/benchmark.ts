/**
 * An object of stats including mean, margin or error, and standard deviation.
 */
export class BenchmarkStats {

  constructor(
    partial: Partial<BenchmarkStats> = {},
  ) {
    this.moe = partial.moe ?? this.moe;
    this.rme = partial.rme ?? this.rme;
    this.sem = partial.sem ?? this.sem;
    this.deviation = partial.deviation ?? this.deviation;
    this.mean = partial.mean ?? this.mean;
    this.sample = partial.sample ?? this.sample;
    this.variance = partial.variance ?? this.variance;
  }

  /**
   * The margin of error.
   */
  public moe: number = 0;

  /**
   * The relative margin of error (expressed as a percentage of the mean).
   */
  public rme: number = 0;

  /**
   * The standard error of the mean.
   */
  public sem: number = 0;

  /**
   * The sample standard deviation.
   */
  public deviation: number = 0;

  /**
   * The sample arithmetic mean (secs).
   */
  public mean: number = 0;

  /**
   * The array of sampled periods.
   */
  public sample: number[] = [];

  /**
   * The sample variance.
   */
  public variance: number = 0;
}
