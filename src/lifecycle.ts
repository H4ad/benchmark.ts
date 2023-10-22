//#region Imports

import { assign, isArray, isFunction, isString } from 'lodash';
import { EventListener } from './base-event-listener';
import { Benchmark } from './benchmark';
import { clock, compiledTimer } from './clock';
import { divisors, NOOP, support, tTable } from './constants';
import { Deferred } from './deferred';
import { _globalThis } from './environment';
import { Event } from './event';
import { Suite } from './suite';
import { timer } from './timers/timers';
import { getMean } from './timers/utils';

//#endregion

export type CycleOptions = {
  async?: boolean;
}

/**
 * Cycles a benchmark until a run `count` can be established.
 *
 * @param deferredOrBenchmark The cloned benchmark instance.
 * @param options The options object.
 */
export function cycle(deferredOrBenchmark: Deferred | Benchmark, options?: CycleOptions) {
  options || (options = {});

  let deferred: Deferred;
  let clone: Benchmark;

  if (deferredOrBenchmark instanceof Deferred) {
    deferred = deferredOrBenchmark;
    clone = deferredOrBenchmark.benchmark;
  } else {
    clone = deferredOrBenchmark;
  }

  let clocked: number;
  let cycles: number;
  let divisor: number;
  let event: Event;
  let minTime: number;
  let period: number;
  let async = options.async;
  let bench = clone._original;
  let count = clone.count;
  let times = clone.times;

  // console.log('clone.running1', clone.running);
  // Continue, if not aborted between cycles.
  if (clone.running) {
    // `minTime` is set to `Benchmark.options.minTime` in `clock()`.
    cycles = ++clone.cycles;
    clocked = deferred ? deferred.elapsed : clock(clone);
    // console.log('clocked', clocked);
    minTime = clone.minTime;
    // console.log('clone.cycles', cycles);
    // console.log('bench.cycles', bench.cycles);

    if (cycles > bench.cycles) {
      bench.cycles = cycles;
    }
    if (clone.error) {
      event = new Event('error');
      event.message = clone.error;
      clone.emit(event);
      if (!event.cancelled) {
        clone.abort();
      }
    }
  }

  // console.log('clone.running2', clone.running);
  // Continue, if not errored.
  if (clone.running) {
    // Compute the time taken to complete last test cycle.
    bench.times.cycle = times.cycle = clocked;
    // Compute the seconds per operation.
    period = bench.times.period = times.period = clocked / count;
    // Compute the ops per second.
    bench.hz = clone.hz = 1 / period;
    // Avoid working our way up to this next time.
    bench.initCount = clone.initCount = count;
    // Do we need to do another cycle?
    clone.running = clocked < minTime;

    // console.log('clone.running3', clone.running);
    if (clone.running) {
      // Tests may clock at `0` when `initCount` is a small number,
      // to avoid that we set its count to something a bit higher.
      if (!clocked && (divisor = divisors[clone.cycles]) != null) {
        count = Math.floor(4e6 / divisor);
      }
      // Calculate how many more iterations it will take to achieve the `minTime`.
      if (count <= clone.count) {
        count += Math.ceil((minTime - clocked) / period);
      }
      // console.log('count', count);
      clone.running = count != Infinity;
    }
  }
  // Should we exit early?
  event = new Event('cycle');
  clone.emit(event);
  // console.log('event.aborted', event.aborted);
  if (event.aborted) {
    clone.abort();
  }
  // console.log('clone.running4', clone.running);
  // Figure out what to do next.
  if (clone.running) {
    // Start a new cycle.
    clone.count = count;
    if (deferred) {
      clone.compiled.call(deferred, _globalThis, compiledTimer);
    } else if (async) {
      clone.delayFn(() => {
        cycle(clone, options);
      });
    } else {
      cycle(clone);
    }
  } else {
    // Fix TraceMonkey bug associated with clock fallbacks.
    // For more information see http://bugzil.la/509069.
    // if (support.browser) {
    //   runScript(uid + '=1;delete ' + uid);
    // }
    // We're done.
    clone.emit('complete');
  }
}

/**
 * Computes stats on benchmark results.
 *
 * @private
 * @param {Object} bench The benchmark instance.
 * @param {Object} options The options object.
 */
export function compute(bench: Benchmark, options: CycleOptions) {
  options || (options = {});

  let async = options.async;
  let elapsed = 0;
  let initCount = bench.initCount;
  let minSamples = bench.minSamples;
  let queue: Benchmark[] = [];
  let sample = bench.stats.sample;

  /**
   * Adds a clone to the queue.
   */
  function enqueue() {
    queue.push(assign(bench.clone(), {
      '_original': bench,
      'events': {
        'abort': [update],
        'cycle': [update],
        'error': [update],
        'start': [update],
      },
    }));
  }

  /**
   * Updates the clone/original benchmarks to keep their data in sync.
   */
  function update(event: Event) {
    let clone = this;
    const type = event.type;

    if (bench.running) {
      if (type === 'start') {
        // Note: `clone.minTime` prop is inited in `clock()`.
        clone.count = bench.initCount;
      } else {
        if (type === 'error') {
          bench.error = clone.error;
        }
        if (type === 'abort') {
          bench.abort();
          bench.emit('cycle');
        } else {
          event.currentTarget = event.target = bench;
          bench.emit(event);
        }
      }
    } else if (bench.aborted) {
      // Clear abort listeners to avoid triggering bench's abort/cycle again.
      clone.events.abort.length = 0;
      clone.abort();
    }
  }

  /**
   * Determines if more clones should be queued or if cycling should stop.
   */
  function evaluate(event: Event) {
    let critical: number;
    let df: number;
    let mean: number;
    let moe: number;
    let rme: number;
    let sd: number;
    let sem: number;
    let variance: number;
    let clone: Benchmark = event.target;
    // clone = event.target,
    let done = bench.aborted;
    let now = timer.ns();
    let size = sample.push(clone.times.period);
    let maxedOut = size >= minSamples && (elapsed += now - clone.times.timeStamp) > bench.maxTime;
    let times = bench.times;
    let varOf = function (sum, x) { return sum + Math.pow(x - mean, 2); };

    // Exit early for aborted or unclockable tests.
    if (done || clone.hz == Infinity) {
      maxedOut = !(size = sample.length = queue.length = 0);
    }

    if (!done) {
      // Compute the sample mean (estimate of the population mean).
      mean = getMean(sample);
      // Compute the sample variance (estimate of the population variance).
      variance = sample.reduce(varOf, 0) / (size - 1) || 0;
      // Compute the sample standard deviation (estimate of the population standard deviation).
      sd = Math.sqrt(variance);
      // Compute the standard error of the mean (a.k.a. the standard deviation of the sampling distribution of the sample mean).
      sem = sd / Math.sqrt(size);
      // Compute the degrees of freedom.
      df = size - 1;
      // Compute the critical value.
      critical = tTable[Math.round(df) || 1] || tTable.infinity;
      // Compute the margin of error.
      moe = sem * critical;
      // Compute the relative margin of error.
      rme = (moe / mean) * 100 || 0;

      assign(bench.stats, {
        'deviation': sd,
        'mean': mean,
        'moe': moe,
        'rme': rme,
        'sem': sem,
        'variance': variance,
      });

      // Abort the cycle loop when the minimum sample size has been collected
      // and the elapsed time exceeds the maximum time allowed per benchmark.
      // We don't count cycle delays toward the max time because delays may be
      // increased by browsers that clamp timeouts for inactive tabs. For more
      // information see https://developer.mozilla.org/en/window.setTimeout#Inactive_tabs.
      if (maxedOut) {
        // Reset the `initCount` in case the benchmark is rerun.
        bench.initCount = initCount;
        bench.running = false;
        done = true;
        times.elapsed = (now - times.timeStamp) / 1e3;
      }
      if (bench.hz != Infinity) {
        bench.hz = 1 / mean;
        times.cycle = mean * bench.count;
        times.period = mean;
      }
    }
    // If time permits, increase sample size to reduce the margin of error.
    if (queue.length < 2 && !maxedOut) {
      enqueue();
    }
    // Abort the `invoke` cycle when done.
    event.aborted = done;
  }

  // Init queue and begin.
  enqueue();
  invoke(queue, {
    name: 'run',
    args: { async },
    queued: true,
    onCycle: evaluate,
    onComplete: () => {
      bench.emit('complete');
    },
  });
}

type ExtractReturnType<T, K extends keyof T> = T[K] extends (...args: any) => any ? ReturnType<T[K]> : never;

/**
 * Invokes a method on all items in an array.
 *
 * @param benches Array of benchmarks to iterate over.
 * @param name The name of the method to invoke OR options object.
 * @returns A new array of values returned from each method invoked.
 * @example
 *
 * // invoke `reset` on all benchmarks
 * Benchmark.invoke(benches, 'reset');
 *
 * // invoke `emit` with arguments
 * Benchmark.invoke(benches, 'emit', 'complete', listener);
 *
 * // invoke `run(true)`, treat benchmarks as a queue, and register invoke callbacks
 * Benchmark.invoke(benches, {
 *
 *   // invoke the `run` method
 *   'name': 'run',
 *
 *   // pass a single argument
 *   'args': true,
 *
 *   // treat as queue, removing benchmarks from front of `benches` until empty
 *   'queued': true,
 *
 *   // called before any benchmarks have been invoked.
 *   'onStart': onStart,
 *
 *   // called between invoking benchmarks
 *   'onCycle': onCycle,
 *
 *   // called after all benchmarks have been invoked.
 *   'onComplete': onComplete
 * });
 */
export function invoke<T extends Benchmark, K extends keyof T, R extends ExtractReturnType<T, K>>(benches: T[], name?: K | { name: K, [key: string]: any }): R[] {
  let args;
  let bench: T;
  let queued: T[];
  let index: number = -1;
  let eventProps: any = { currentTarget: benches };
  let options: any = { onStart: NOOP, onCycle: NOOP, onComplete: NOOP };
  let result: R[] = benches.slice() as unknown as R[];
  let finalName: K;

  /**
   * Invokes the method of the current object and if synchronous, fetches the next.
   */
  function execute() {
    let listeners: EventListener[];
    let async = isAsync(bench);

    if (async) {
      // Use `getNext` as the first listener.
      bench.on('complete', getNext);
      listeners = bench.events.get('complete') || [];
      listeners.splice(0, 0, listeners.pop());
    }
    // Execute method.
    result[index] = isFunction(bench && bench[finalName]) ? (bench[finalName] as any).apply(bench, args) : undefined;
    // If synchronous return `true` until finished.
    return !async && getNext();
  }

  /**
   * Fetches the next bench or executes `onComplete` callback.
   */
  function getNext(event?: Event) {
    let cycleEvent;
    let last = bench;
    const async = isAsync(last);

    if (async) {
      last.off('complete', getNext);
      last.emit('complete');
    }
    // Emit "cycle" event.
    eventProps.type = 'cycle';
    eventProps.target = last;
    cycleEvent = new Event(eventProps);
    options.onCycle.call(benches, cycleEvent);

    // Choose next benchmark if not exiting early.
    if (!cycleEvent.aborted && raiseIndex() !== false) {
      bench = queued ? benches[0] : result[index];
      if (isAsync(bench)) {
        bench.delayFn(execute);
      } else if (async) {
        // Resume execution if previously asynchronous but now synchronous.
        while (execute()) {}
      } else {
        // Continue synchronous execution.
        return true;
      }
    } else {
      // Emit "complete" event.
      eventProps.type = 'complete';
      options.onComplete.call(benches, new Event(eventProps));
    }
    // When used as a listener `event.aborted = true` will cancel the rest of
    // the "complete" listeners because they were already called above and when
    // used as part of `getNext` the `return false` will exit the execution while-loop.
    if (event) {
      event.aborted = true;
    } else {
      return false;
    }
  }

  /**
   * Checks if invoking `Benchmark#run` with asynchronous cycles.
   */
  function isAsync(object: unknown): boolean {
    // Avoid using `instanceof` here because of IE memory leak issues with host objects.
    var async = args[0] && args[0].async;
    return finalName === 'run' && (object instanceof Benchmark) &&
      ((async == null ? object.options.async : async) && support.timeout || object.defer);
  }

  /**
   * Raises `index` to the next defined index or returns `false`.
   */
  function raiseIndex() {
    index++;

    // If queued remove the previous bench.
    if (queued && index > 0) {
      benches.shift();
    }
    // If we reached the last index then return `false`.
    return (queued ? benches.length : index < result.length)
      ? index
      : (index = false as any);
  }

  // Juggle arguments.
  if (isString(name)) {
    // 2 arguments (array, name).
    args = Array.prototype.slice.call(arguments, 2);
    finalName = name;
  } else {
    // 2 arguments (array, options).
    options = assign(options, name);
    finalName = options.name;
    args = isArray(args = 'args' in options ? options.args : []) ? args : [args];
    queued = options.queued;
  }
  // Start iterating over the array.
  if (raiseIndex() !== false) {
    // Emit "start" event.
    bench = result[index];
    eventProps.type = 'start';
    eventProps.target = bench;
    options.onStart.call(benches, new Event(eventProps));

    // End early if the suite was aborted in an "onStart" listener.
    if (name === 'run' && (benches instanceof Suite) && benches.aborted) {
      // Emit "cycle" event.
      eventProps.type = 'cycle';
      options.onCycle.call(benches, new Event(eventProps));
      // Emit "complete" event.
      eventProps.type = 'complete';
      options.onComplete.call(benches, new Event(eventProps));
    }
    // Start method execution.
    else {
      if (isAsync(bench)) {
        bench.delayFn(execute);
      } else {
        while (execute()) {}
      }
    }
  }

  return result;
}

