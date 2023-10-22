import { assign, each, eq, forOwn, has, isArray, isError, isFunction, isObject, isObjectLike, isString } from 'lodash';
import { BaseEventListener, DefaultEvents } from './base-event-listener';
import { BaseEventOptions } from './base-event-options';
import { BenchmarkStats } from './benchmark-stats';
import { BenchmarkTimes } from './benchmark-times';
import { calledBy, getNextCounter, NOOP, uTable } from './constants';
import { Deferred, TemplateData } from './deferred';
import { Event } from './event';
import { compute, cycle } from './lifecycle';
import { cloneDeep, isPlainObject } from './lodash';
import { Suite } from './suite';
import { timer } from './timers/timers';
import { filter } from './utils';

export type BenchmarkFn = () => (void | Promise<void>);
export type BenchmarkValidOptions = 'async' | 'defer' | 'delay' | 'initCount' | 'maxTime' | 'minSamples' | 'minTime';
export type BenchmarkOptions = Partial<Pick<Benchmark, BenchmarkValidOptions> & BaseEventOptions>;
export type BenchmarkRunOptions = { async: boolean };

/**
 * The Benchmark constructor.
 *
 * Note: The Benchmark constructor exposes a handful of lodash methods to
 * make working with arrays, collections, and objects easier. The lodash
 * methods are:
 * [`each/forEach`](https://lodash.com/docs#forEach), [`forOwn`](https://lodash.com/docs#forOwn),
 * [`has`](https://lodash.com/docs#has), [`indexOf`](https://lodash.com/docs#indexOf),
 * [`map`](https://lodash.com/docs#map), and [`reduce`](https://lodash.com/docs#reduce)
 *
 * @constructor
 * @param {string} name A name to identify the benchmark.
 * @param {Function|string} fn The test to benchmark.
 * @param {Object} [options={}] Options object.
 * @example
 *
 * // basic usage (the `new` operator is optional)
 * var bench = new Benchmark(fn);
 *
 * // or using a name first
 * var bench = new Benchmark('foo', fn);
 *
 * // or with options
 * var bench = new Benchmark('foo', fn, {
 *
 *   // displayed by `Benchmark#toString` if `name` is not available
 *   'id': 'xyz',
 *
 *   // called when the benchmark starts running
 *   'onStart': onStart,
 *
 *   // called after each run cycle
 *   'onCycle': onCycle,
 *
 *   // called when aborted
 *   'onAbort': onAbort,
 *
 *   // called when a test errors
 *   'onError': onError,
 *
 *   // called when reset
 *   'onReset': onReset,
 *
 *   // called when the benchmark completes running
 *   'onComplete': onComplete,
 *
 *   // compiled/called before the test loop
 *   'setup': setup,
 *
 *   // compiled/called after the test loop
 *   'teardown': teardown
 * });
 *
 * // or name and options
 * var bench = new Benchmark('foo', {
 *
 *   // a flag to indicate the benchmark is deferred
 *   'defer': true,
 *
 *   // benchmark test function
 *   'fn': function(deferred) {
 *     // call `Deferred#resolve` when the deferred test is finished
 *     deferred.resolve();
 *   }
 * });
 *
 * // or options only
 * var bench = new Benchmark({
 *
 *   // benchmark name
 *   'name': 'foo',
 *
 *   // benchmark test as a string
 *   'fn': '[1,2,3,4].sort()'
 * });
 *
 * // a test's `this` binding is set to the benchmark instance
 * var bench = new Benchmark('foo', function() {
 *   'My name is '.concat(this.name); // "My name is foo"
 * });
 */
export class Benchmark extends BaseEventListener {

  //#region Constructor

  constructor(options: BenchmarkFn);
  constructor(options: BenchmarkOptions);
  constructor(fn: BenchmarkFn, options: BenchmarkOptions);
  constructor(name: string, options: BenchmarkOptions);
  constructor(name: string, fn: BenchmarkFn, options?: BenchmarkOptions);
  constructor(
    name: string | BenchmarkOptions | BenchmarkFn,
    fn?: BenchmarkOptions | BenchmarkFn,
    options?: BenchmarkOptions,
  ) {
    super();

    // Juggle arguments.
    if (isPlainObject(name) && !isFunction(name)) {
      // 1 argument (options).
      options = name;
    } else if (isFunction(name) && !isPlainObject(fn)) {
      // 2 arguments (fn, options).
      options = fn;
      fn = name;
    } else if (isString(name) && isPlainObject(fn) && !isFunction(fn)) {
      // 2 arguments (name, options).
      this.name = name;
      options = fn;
      fn = null;
    } else if (isString(name) && isFunction(fn)) {
      // 3 arguments (name, fn [, options]).
      this.name = name;
    }

    // setOptions(bench, options);
    this.options = cloneDeep(options) as BenchmarkOptions;

    if (typeof options === 'object') {
      for (const prop of Object.keys(options)) {
        if (prop.startsWith('on')) {
          const eventNames = prop.substring(2).toLowerCase().split(' ') as unknown as Lowercase<DefaultEvents>;

          for (const eventName of eventNames) {
            this.on(eventName, options[prop]);
          }
        } else {
          this[prop] = cloneDeep(options[prop]);
        }
      }
    }

    if (!this.id) {
      this.id = getNextCounter();
    }

    if (!this.fn && isFunction(fn)) {
      this.fn = fn;
      // this.fn == null && ();
    }

    this.stats = new BenchmarkStats(cloneDeep(this.stats));
    this.times = new BenchmarkTimes(cloneDeep(this.times));

    // Resolve time span required to achieve a percent uncertainty of at most 1%.
    // For more information see http://spiff.rit.edu/classes/phys273/uncert/uncert.html.
    if (!this.minTime)
      this.minTime = Math.max(timer.resolution / 2 / 0.01, 0.05);
  }

  //#endregion

  //#region Public Methods

  /**
   * Displayed by `Benchmark#toString` when a `name` is not available
   * (auto-generated if absent).
   */
  public id: number | undefined;

  /**
   * The name of the benchmark.
   */
  public name: string | undefined;

  /**
   * The original options object.
   */
  public options: BenchmarkOptions;

  /**
   * A flag to indicate that benchmark cycles will execute asynchronously
   * by default.
   *
   * @default false
   */
  public async: boolean = false;

  /**
   * A flag to indicate that the benchmark clock is deferred.
   *
   * @default false
   */
  public defer: boolean = false;

  /**
   * The delay between test cycles (secs).
   *
   * @default 0.005
   */
  public delay: number = 0.005;

  /**
   * The default number of times to execute a test on a benchmark's first cycle.
   *
   * @default 1
   */
  public initCount: number = 1;

  /**
   * The maximum time a benchmark is allowed to run before finishing (secs).
   *
   * Note: Cycle delays aren't counted toward the maximum time.
   *
   * @default 5
   */
  public maxTime: number = 5;

  /**
   * The minimum sample size required to perform statistical
   *
   * @default 5
   */
  public minSamples: number = 5;

  /**
   * The time needed to reduce the percent uncertainty of measurement to 1% (secs).
   *
   * @default 0
   */
  public minTime: number = 0;

  /**
   * The number of times a test was executed.
   *
   * @default 0
   */
  public count: number = 0;

  /**
   * The number of cycles performed while benchmarking.
   *
   * @default 0
   */
  public cycles: number = 0;

  /**
   * The number of executions per second.
   *
   * @default 0
   */
  public hz: number = 0;

  /**
   * The compiled test function.
   *
   * @default undefined
   */
  public compiled: Function | undefined;

  /**
   * The error object if the test failed.
   *
   * @default undefined
   */
  public error: Object | undefined;

  /**
   * The test to benchmark.
   *
   * @default undefined
   */
  public fn: BenchmarkFn | string | undefined;

  /**
   * A flag to indicate if the benchmark is aborted.
   *
   * @default false
   */
  public aborted: boolean = false;

  /**
   * A flag to indicate if the benchmark is running.
   *
   * @default false
   */
  public running: boolean = false;

  /**
   * Compiled into the test and executed immediately **before** the test loop.
   *
   * @default {@link NOOP}
   *
   * @example```js
   * // basic usage
   * var bench = Benchmark({
   *   'setup': function() {
   *     var c = this.count,
   *         element = document.getElementById('container');
   *     while (c--) {
   *       element.appendChild(document.createElement('div'));
   *     }
   *   },
   *   'fn': function() {
   *     element.removeChild(element.lastChild);
   *   }
   * });
   *
   * // compiles to something like:
   * var c = this.count,
   *     element = document.getElementById('container');
   * while (c--) {
   *   element.appendChild(document.createElement('div'));
   * }
   * var start = new Date;
   * while (count--) {
   *   element.removeChild(element.lastChild);
   * }
   * var end = new Date - start;
   *
   * // or using strings
   * var bench = Benchmark({
   *   'setup': '\
   *     var a = 0;\n\
   *     (function() {\n\
   *       (function() {\n\
   *         (function() {',
   *   'fn': 'a += 1;',
   *   'teardown': '\
   *          }())\n\
   *        }())\n\
   *      }())'
   * });
   *
   * // compiles to something like:
   * var a = 0;
   * (function() {
   *   (function() {
   *     (function() {
   *       var start = new Date;
   *       while (count--) {
   *         a += 1;
   *       }
   *       var end = new Date - start;
   *     }())
   *   }())
   * }())
   * ```
   */
  public setup: Function | string | undefined = NOOP;

  /**
   * Compiled into the test and executed immediately **after** the test
   *
   * @default {@link NOOP}
   */
  public teardown: Function | string | undefined = NOOP;

  /**
   * An object of stats including mean, margin or error, and standard deviation.
   */
  public stats: BenchmarkStats = new BenchmarkStats();

  /**
   * An object of timing data including cycle, elapsed, period, start, and stop.
   */
  public times: BenchmarkTimes = new BenchmarkTimes();

  /**
   * For clones created within `compute()`.
   */
  public _original: Benchmark | undefined;

  /**
   * The data used to create compiled benchmarks
   */
  public templateData: TemplateData;

  //#endregion

  //#region Private Properties

  /**
   * Internal timer id
   */
  private _timerId: number;

  //#endregion

  //#region Static Methods

  /**
   * Get the static reference for the {@link Deferred} class.
   */
  public static get Deferred(): typeof Deferred {
    return Deferred;
  }

  /**
   * Get the static reference for the {@link Suite} class.
   */
  public static get Suite(): typeof Suite {
    return Suite;
  }

  /**
   * Get the static reference for the {@link Event} class.
   */
  public static get Event(): typeof Event {
    return Event;
  }

  //#endregion

  //#region Public Methods

  /**
   * Determines if a benchmark is faster than another.
   *
   * @param other The benchmark to compare.
   *
   * @returns Returns `-1` if slower, `1` if faster, and `0` if indeterminate.
   */
  public compare(other: Benchmark): number {
    // Exit early if comparing the same benchmark.
    if (this == other) {
      return 0;
    }

    let critical: number;
    let zStat: number;

    const sample1 = this.stats.sample;
    const sample2 = other.stats.sample;
    const size1 = sample1.length;
    const size2 = sample2.length;
    const maxSize = Math.max(size1, size2);
    const minSize = Math.min(size1, size2);
    const u1 = getU(sample1, sample2);
    const u2 = getU(sample2, sample1);
    const u = Math.min(u1, u2);

    function getScore(xA: number, sampleB: number[]): number {
      return sampleB.reduce((total, xB) => {
        return total + (xB > xA ? 0 : xB < xA ? 1 : 0.5);
      }, 0);
    }

    function getU(sampleA: number[], sampleB: number[]) {
      return sampleA.reduce((total, xA) => {
        return total + getScore(xA, sampleB);
      }, 0);
    }

    function getZ(u) {
      return (u - ((size1 * size2) / 2)) / Math.sqrt((size1 * size2 * (size1 + size2 + 1)) / 12);
    }

    // Reject the null hypothesis the two samples come from the
    // same population (i.e. have the same median) if...
    if (size1 + size2 > 30) {
      // ...the z-stat is greater than 1.96 or less than -1.96
      // http://www.statisticslectures.com/topics/mannwhitneyu/
      zStat = getZ(u);
      return Math.abs(zStat) > 1.96 ? (u === u1 ? 1 : -1) : 0;
    }

    // ...the U value is less than or equal the critical U value.
    critical = maxSize < 5 || minSize < 3 ? 0 : uTable[maxSize][minSize - 3];

    return u <= critical ? (u === u1 ? 1 : -1) : 0;
  }

  /**
   * Creates a string of joined array values or object key-value pairs.
   *
   * @param object The object to operate on.
   * @param separator1 The separator used between key-value pairs.
   * @param separator2 The separator used between keys and values.
   *
   * @returns The joined result.
   */
  public join<T>(object: Array<T> | Object, separator1: string = ',', separator2: string = ': '): string {
    const result = [];
    const length = (object = Object(object)).length;
    const arrayLike = length === length >>> 0;

    each(object, function (value, key) {
      result.push(arrayLike ? value : key + separator2 + value);
    });

    return result.join(separator1 || ',');
  }

  /**
   * A generic `Array#filter` like method.
   *
   * @param array The array to iterate over.
   * @param callback The function/alias called per iteration.
   *
   * @returns A new array of values that passed callback filter.
   *
   * @example```js
   * // get odd numbers
   * Benchmark.filter([1, 2, 3, 4, 5], (n) => {
   *   return n % 2;
   * }); // -> [1, 3, 5];
   *
   * // get fastest benchmarks
   * Benchmark.filter(benches, 'fastest');
   *
   * // get slowest benchmarks
   * Benchmark.filter(benches, 'slowest');
   *
   * // get benchmarks that completed without erroring
   * Benchmark.filter(benches, 'successful');
   * ```
   */
  public filter<T extends Benchmark>(array: T[], callback: ((value: T, index: number, array: T[]) => boolean) | 'successful' | 'fastest' | 'slowest'): T[] {
    return filter(array, callback);
  }

  /**
   * Converts a number to a more readable comma-separated string representation.
   *
   * @param number The number to convert.
   *
   * @returns The more readable string representation.
   */
  public formatNumber(number: number | string): string {
    const strNumber = String(number).split('.');

    return strNumber[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',')
      + (strNumber[1] ? '.' + strNumber[1] : '');
  }

  /**
   * Displays relevant benchmark information when coerced to a string.
   *
   * @returns A string representation of the benchmark instance.
   */
  public toString(): string {
    const size = this.stats.sample.length;
    const pm = '\xb1';
    let result = this.name || (isNaN(this.id) ? this.id.toString() : '<Test #' + this.id + '>');

    if (this.error) {
      var errorStr;
      if (!isObject(this.error)) {
        errorStr = String(this.error);
      } else if (!isError(this.error)) {
        errorStr = this.join(this.error);
      } else {
        // Error#name and Error#message properties are non-enumerable.
        errorStr = this.join(
          Object.assign({
            name: this.error.name,
            message: this.error.message,
          }, this.error),
        );
      }
      result += ': ' + errorStr;
    } else {
      result += ' x ' + this.formatNumber(this.hz.toFixed(this.hz < 100 ? 2 : 0));
      result += ' ops/sec ';
      result += pm;
      result += this.stats.rme.toFixed(2);
      result += '% (';
      result += size;
      result += ' run';
      result += (size == 1 ? '' : 's');
      result += ' sampled)';
    }

    return result;
  }

  /**
   * Creates a new benchmark using the same test and options.
   *
   * @param options Options object to overwrite cloned options.
   *
   * @returns The new benchmark instance.
   *
   * @example```js
   * var bizarro = bench.clone({
   *   'name': 'doppelganger'
   * });
   * ```
   */
  public clone(options?: BenchmarkOptions): Benchmark {
    // var bench = this,
    //   result = new bench.constructor(_.assign({}, bench, options));
    const result = new Benchmark(Object.assign({}, this.options, options));

    // Correct the `options` object.
    // result.options = {
    //   ...cloneDeep(this.options) as BenchmarkOptions,
    //   ...cloneDeep(options),
    // };

    // Copy own custom properties.
    forOwn(this, (value, key) => {
      if (!has(result, key)) {
        result[key] = cloneDeep(value);
      }
    });

    return result;
  }

  /**
   * Delay the execution of a function based on the benchmark's `delay` property.
   *
   * @param callback The function to execute.
   */
  public delayFn(callback: Function): void {
    this._timerId = setTimeout(callback, this.delay * 1e3);
  }

  /**
   * Aborts the benchmark without recording times.
   *
   * @returns The benchmark instance.
   */
  public abort(): Benchmark {
    // var event,
    //   bench = this,
    const resetting = calledBy.reset;

    if (this.running) {
      const event = new Event('abort');

      this.emit(event);

      if (!event.cancelled || resetting) {
        // Avoid infinite recursion.
        calledBy.abort = true;

        this.reset();

        calledBy.abort = false;

        // if (support.timeout) {
        clearTimeout(this._timerId);
        this._timerId = undefined;
        // }
        if (!resetting) {
          this.aborted = true;
          this.running = false;
        }
      }
    }

    return this;
  }

  /**
   * Reset properties and abort if running.
   *
   * @returns The benchmark instance.
   */
  public reset(): Benchmark {
    // var bench = this;

    if (this.running && !calledBy.abort) {
      // No worries, `reset()` is called within `abort()`.
      calledBy.reset = true;
      this.abort();
      calledBy.reset = false;

      return this;
    }

    // var event,
    let index = 0;
    const changes = [];
    const queue = [];

    // A non-recursive solution to check if properties have changed.
    // For more information see http://www.jslab.dk/articles/non.recursive.preorder.traversal.part4.
    var data = {
      'destination': this,
      'source': assign({}, cloneDeep(this.constructor.prototype), cloneDeep(this.options)),
    };

    do {
      forOwn(data.source, (value: any, key) => {
        let changed = false;
        let destination = data.destination;
        let currValue = destination[key];

        // Skip pseudo private properties and event listeners.
        if (/^_|^events$|^on[A-Z]/.test(key)) {
          return;
        }
        if (isObjectLike(value)) {
          if (isArray(value)) {
            // Check if an array value has changed to a non-array value.
            if (!isArray(currValue)) {
              changed = true;
              currValue = [];
            }
            // Check if an array has changed its length.
            if (currValue.length != value.length) {
              changed = true;
              currValue = currValue.slice(0, value.length);
              currValue.length = value.length;
            }
          }
          // Check if an object has changed to a non-object value.
          else if (!isObjectLike(currValue)) {
            changed = true;
            currValue = {};
          }
          // Register a changed object.
          if (changed) {
            changes.push({ 'destination': destination, 'key': key, 'value': currValue });
          }
          queue.push({ 'destination': currValue, 'source': value });
        }
        // Register a changed primitive.
        else if (!eq(currValue, value) && value !== undefined) {
          changes.push({ 'destination': destination, 'key': key, 'value': value });
        }
      });
    } while ((data = queue[index++]));

    // If changed emit the `reset` event and if it isn't cancelled reset the benchmark.
    if (changes.length) {
      const event = new Event('reset');

      this.emit(event);

      if (!event.cancelled) {
        each(changes, (data) => {
          data.destination[data.key] = data.value;
        });
      }
    }

    return this;
  }

  /**
   * Runs the benchmark.
   *
   * @memberOf Benchmark
   * @param {Object} [options={}] Options object.
   * @returns {Object} The benchmark instance.
   * @example
   *
   * // basic usage
   * bench.run();
   *
   * // or with options
   * bench.run({ 'async': true });
   */
  public run(options?: BenchmarkRunOptions) {
    // var bench = this,
    const event = new Event('start');

    // Set `running` to `false` so `reset()` won't call `abort()`.
    this.running = false;
    this.reset();
    this.running = true;

    this.count = this.initCount;
    this.times.timeStamp = timer.ns();
    this.emit(event);

    if (!event.cancelled) {
      const cycleAndComputeOptions = {
        async: options?.async ?? this.async,
      };

      // For clones created within `compute()`.
      if (this._original) {
        if (this.defer) {
          new Deferred(this);
        } else {
          cycle(this, cycleAndComputeOptions);
        }
      }
      // For original benchmarks.
      else {
        compute(this, cycleAndComputeOptions);
      }
    }

    return this;
  }

  //#endregion

}
