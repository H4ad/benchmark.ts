import { Timer, TimerFactory } from './definitions';
import { getResolution } from './utils';

declare var process: { hrtime?: () => [number, number] } | undefined;

/**
 * The timer that uses {@link process.hrtime}.
 */
export class HrtimeTimerFactory implements TimerFactory {
  /**
   * Detect Node.js's nanosecond resolution timer available in Node.js >= 0.8.
   */
  public isSupported(): boolean {
    return typeof process !== 'undefined' && typeof process.hrtime === 'function';
  }

  public create(): Timer {
    return {
      ns: () => {
        let now: [number, number];

        return (now = process.hrtime())[0] + (now[1] / 1e9);
      },
      unit: 'ns',
      resolution: this.getResolution(),
    };
  }

  /**
   * @reference {@link getResolution}
   */
  private getResolution(): number {
    return getResolution(() => {
      const ns = process.hrtime;

      let measured: any;
      let begin: any;

      begin = (begin = ns())[0] + (begin[1] / 1e9);

      while (!(measured = ((measured = ns())[0] + (measured[1] / 1e9)) - begin)) {}

      return measured;
    });
  }
}
