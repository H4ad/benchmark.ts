import { Event, isEvent } from './event';

export type DefaultEvents = 'Start' | 'Cycle' | 'Abort' | 'Error' | 'Reset' | 'Complete';
export type EventListener = (...args: any[]) => any;

export abstract class BaseEventListener {
  public events: Map<string, EventListener[]> = new Map();

  /**
   * Registers a listener for the specified event type(s).
   *
   * @param types The event type.
   * @param listener The function to register.
   *
   * @example```js
   * // register a listener for an event type
   * instance.on('cycle', listener);
   *
   * // register a listener for multiple event types
   * instance.on('start cycle', listener);
   * ```
   */
  public on(types: string, listener: EventListener) {
    // var object = this,
    //   events = object.events || (object.events = {});
    for (const type of types.split(' ')) {
      const listeners = this.events.get(type) || [];
      listeners.push(listener);
      this.events.set(type, listeners);
    }
    // _.each(type.split(' '), function(type) {
    //   (_.has(events, type)
    //       ? events[type]
    //       : (events[type] = [])
    //   ).push(listener);
    // });
    return this;
  }

  /**
   * Unregisters a listener for the specified event type(s),
   * or unregisters all listeners for the specified event type(s),
   * or unregisters all listeners for all event types.
   *
   * @memberOf Benchmark, Benchmark.Suite
   * @param types The event type.
   * @param listener The function to unregister.
   *
   * @example```js
   * // unregister a listener for an event type
   * instance.off('cycle', listener);
   *
   * // unregister a listener for multiple event types
   * instance.off('start cycle', listener);
   *
   * // unregister all listeners for an event type
   * instance.off('cycle');
   *
   * // unregister all listeners for multiple event types
   * instance.off('start cycle complete');
   *
   * // unregister all listeners for all event types
   * instance.off();
   * ```
   */
  public off(types?: string, listener?: EventListener) {
    if (!this.events.size) {
      return this;
    }

    if (!types) {
      this.events.clear();
      return this;
    }

    for (const type of types.split(' ')) {
      if (!listener) {
        this.events.delete(type);
        continue;
      }

      const listeners = this.events.get(type) || [];
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    //   var object = this,
    //     events = object.events;
    //
    //   if (!events) {
    //     return object;
    //   }
    //   _.each(type ? type.split(' ') : events, function(listeners, type) {
    //     var index;
    //     if (typeof listeners == 'string') {
    //       type = listeners;
    //       listeners = _.has(events, type) && events[type];
    //     }
    //     if (listeners) {
    //       if (listener) {
    //         index = _.indexOf(listeners, listener);
    //         if (index > -1) {
    //           listeners.splice(index, 1);
    //         }
    //       } else {
    //         listeners.length = 0;
    //       }
    //     }
    //   });
    //   return object;
    return this;
  }

  /**
   * Returns an array of event listeners for a given type that can be manipulated
   * to add or remove listeners.
   *
   * @param type The event type.
   */
  public listeners(type: string): EventListener[] {
    return this.events.get(type) || [];
    // var object = this,
    //   events = object.events || (object.events = {});
    //
    // return _.has(events, type) ? events[type] : (events[type] = []);
  }

  /**
   * Executes all registered listeners of the specified event type.
   *
   * @param type The event type or object.
   * @param args Arguments to invoke the listener with.
   * @returns Returns the return value of the last listener executed.
   */
  public emit<TResult = unknown>(type: string | Object, ...args: any[]): TResult {
    // var listeners,
    //   object = this,
    //   event = Event(type),
    //   events = object.events,
    //   args = (arguments[0] = event, arguments);
    const event = isEvent(type) ? type : new Event(type);

    args.unshift(event);

    if (!event.currentTarget)
      event.currentTarget = this;
    if (!event.target)
      event.target = this;
    // event.currentTarget || (event.currentTarget = this);
    // event.target || (event.target = object);
    // delete event.result;
    event.result = undefined;

    if (this.events.size > 0 && this.events.has(event.type)) {
      for (const listener of this.events.get(event.type).slice() || []) {
        event.result = listener.apply(this, args);

        if (event.result === false) {
          event.cancelled = true;
        }

        if (event.aborted) {
          break;
        }
      }
    }

    return event.result as TResult;

    // if (events && (listeners = _.has(events, event.type) && events[event.type])) {
    //   _.each(listeners.slice(), function(listener) {
    //     if ((event.result = listener.apply(object, args)) === false) {
    //       event.cancelled = true;
    //     }
    //     return !event.aborted;
    //   });
    // }
    // return event.result;
  }
}
