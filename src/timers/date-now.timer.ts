import { Timer, TimerFactory } from './definitions';
import { getResolution } from './utils';

export class DateNowTimerFactory implements TimerFactory {
  public isSupported(): boolean {
    return typeof Date !== 'undefined' && typeof Date.now === 'function';
  }

  public create(): Timer {
    return {
      ns: () => Date.now() / 1e3,
      unit: 'ms',
      resolution: this.getResolution(),
    };
  }

  /**
   * @reference {@link getResolution}
   */
  private getResolution(): number {
    return Math.max(
      0.0015,
      getResolution(() => {
        const ns = Date.now;

        let measured: number;

        const begin = ns();

        do {
          measured = ns() - begin;
        } while (!measured);

        return measured / 1e3;
      }),
    );
  }
}
