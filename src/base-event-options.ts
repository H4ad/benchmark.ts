//#region Imports

import { EventListener } from './base-event-listener';

//#endregion

/**
 * The options to represent the events that can be listened.
 */
export interface BaseEventOptions {
  /**
   * An event listener called when the benchmark is aborted.
   */
  onAbort: EventListener | undefined;

  /**
   * An event listener called when the benchmark completes running.
   */
  onComplete: EventListener | undefined;

  /**
   * An event listener called after each run cycle.
   */
  onCycle: EventListener | undefined;

  /**
   * An event listener called when a test errors.
   */
  onError: EventListener | undefined;

  /**
   * An event listener called when the benchmark is reset.
   */
  onReset: EventListener | undefined;

  /**
   * An event listener called when the benchmark starts running.
   */
  onStart: EventListener | undefined;
}
