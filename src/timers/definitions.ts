/**
 * A timer.
 */
export interface Timer {
  /**
   * Gets the current time.
   */
  ns: () => number;

  /**
   * The resolution of the timer in seconds.
   */
  resolution: number;

  /**
   * The unit of the timer.
   */
  unit: 'ms' | 'us' | 'ns';
}

/**
 * A timer factory.
 */
export interface TimerFactory {
  /**
   * Determines if the timer is supported.
   */
  isSupported(): boolean;

  /**
   * Creates a timer.
   */
  create(): Timer;
}
