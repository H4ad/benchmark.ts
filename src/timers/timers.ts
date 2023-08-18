import { minBy } from 'lodash';
import { DateNowTimerFactory } from './date-now.timer';
import { Timer, TimerFactory } from './definitions';
import { HrtimeTimerFactory } from './hrtime.timer';

export const timerFactories: TimerFactory[] = [
  new HrtimeTimerFactory(),
  new DateNowTimerFactory(),
  // TODO: Add performance.now() timer and considerations about https://developer.mozilla.org/en-US/docs/Web/API/Performance/now#security_requirements
  // TODO: Add --enable-benchmarking timer.
];

export function getHighestResolutionTimer(): Timer {
  const timers = timerFactories
    .filter(factory => factory.isSupported())
    .map(factory => factory.create());

  // Pick timer with highest resolution.
  const timer = minBy(timers, 'resolution');

  // Error if there are no working timers.
  if (timer.resolution == Infinity) {
    throw new Error('Unable to find a working timer.');
  }

  return timer;
}

/**
 * The reference for the best timer available.
 */
export const timer: Timer = getHighestResolutionTimer();
