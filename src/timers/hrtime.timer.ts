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
    let now: [number, number];
    const ns = process.hrtime;

    return {
      ns: () => (now = ns())[0] + (now[1] / 1e9),
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

      let beginHr: [number, number];
      let measuredHr: [number, number];
      let measured: number;
      let begin: number;

      beginHr = ns();
      begin = beginHr[0] + (beginHr[1] / 1e9);

      do {
        measuredHr = ns();
        measured = (measuredHr[0] + (measuredHr[1] / 1e9)) - begin;
      } while (!measured);

      return measured;
    });
  }
}
