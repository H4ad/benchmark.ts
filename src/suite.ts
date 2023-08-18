import { forOwn, get, has, isFunction } from 'lodash';
import { BaseEventListener, DefaultEvents } from './base-event-listener';
import { BaseEventOptions } from './base-event-options';
import { Benchmark, BenchmarkFn, BenchmarkOptions } from './benchmark';
import { calledBy } from './constants';
import { Event } from './event';
import { invoke } from './lifecycle';
import { cloneDeep } from './lodash';
import { filter } from './utils';

export type SuiteOptions = BaseEventOptions;

/**
 * The Suite constructor.
 *
 * Note: Each Suite instance has a handful of wrapped lodash methods to
 * make working with Suites easier. The wrapped lodash methods are:
 * [`each/forEach`](https://lodash.com/docs#forEach), [`indexOf`](https://lodash.com/docs#indexOf),
 * [`map`](https://lodash.com/docs#map), and [`reduce`](https://lodash.com/docs#reduce)
 *
 * @constructor
 * @memberOf Benchmark
 * @param {string} name A name to identify the suite.
 * @param {Object} [options={}] Options object.
 * @example
 *
 * // basic usage (the `new` operator is optional)
 * var suite = new Benchmark.Suite;
 *
 * // or using a name first
 * var suite = new Benchmark.Suite('foo');
 *
 * // or with options
 * var suite = new Benchmark.Suite('foo', {
 *
 *   // called when the suite starts running
 *   'onStart': onStart,
 *
 *   // called between running benchmarks
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
 *   // called when the suite completes running
 *   'onComplete': onComplete
 * });
 */
export class Suite extends BaseEventListener {

  //#region Constructor

  constructor();
  constructor(name: string);
  constructor(options?: SuiteOptions);
  constructor(name: string, options: SuiteOptions);

  constructor(name?: string | SuiteOptions, options?: SuiteOptions) {
    super();

    if (typeof name === 'object') {
      options = name;
      this.name = undefined;
    } else
      this.name = name;

    this.options = cloneDeep(options) as SuiteOptions;

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

    // var suite = this;
    //
    // // Allow instance creation without the `new` operator.
    // if (!(suite instanceof Suite)) {
    //   return new Suite(name, options);
    // }
    // // Juggle arguments.
    // if (_.isPlainObject(name)) {
    //   // 1 argument (options).
    //   options = name;
    // } else {
    //   // 2 arguments (name [, options]).
    //   suite.name = name;
    // }
    // setOptions(suite, options);
  }

  //#endregion

  //#region Public Properties

  /**
   * The name of the suite.
   */
  public name: string | undefined;

  /**
   * The number of benchmarks in the suite.
   */
  public get length(): number {
    return this.benchmarks.length;
  };

  /**
   * A flag to indicate if the suite is aborted.
   */
  public aborted: boolean = false;

  /**
   * A flag to indicate if the suite is running.
   */
  public running: boolean = false;

  /**
   * The default options for this suite
   */
  public options?: SuiteOptions;

  //#endregion

  //#region Protected Properties

  /**
   * The array of benchmarks in the suite.
   */
  protected benchmarks: Benchmark[] = [];

  //#endregion

  //#region Utility Methods

  /**
   * Adds a benchmark to this suite.
   *
   * @param benchs The benchmark.
   */
  public push(...benchs: Benchmark[]): this {
    this.benchmarks.push(...benchs);

    return this;
  }

  /**
   * The pop() method removes the last element from an array and returns that element.
   * This method changes the length of the array.
   */
  public pop(): Benchmark | undefined {
    return this.benchmarks.pop();
  }

  /**
   * Sorts an array in place.
   * This method mutates the array and returns a reference to the same array.
   *
   * @param compareFn Function used to determine the order of the elements. It is expected to return
   * a negative value if the first argument is less than the second argument, zero if they're equal, and a positive
   * value otherwise. If omitted, the elements are sorted in ascending, ASCII character order.- b)
   * ```
   */
  public sort(compareFn?: Parameters<Array<Benchmark>['sort']>[0]): Benchmark[] {
    return this.benchmarks.sort(compareFn);
  }

  /**
   * Returns a copy of a section of an array.
   * For both start and end, a negative index can be used to indicate an offset from the end of the array.
   * For example, -2 refers to the second to last element of the array.
   *
   * @param start The beginning index of the specified portion of the array.
   * If start is undefined, then the slice begins at index 0.
   * @param end The end index of the specified portion of the array. This is exclusive of the element at the index 'end'.
   * If end is undefined, then the slice extends to the end of the array.
   */
  public slice(start?: number, end?: number): Benchmark[] {
    return this.benchmarks.slice(start, end);
  }

  /**
   * Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.
   *
   * @param start The zero-based location in the array from which to start removing elements.
   * @param deleteCount The number of elements to remove.
   * @returns An array containing the elements that were deleted.
   */
  public splice(start: number, deleteCount?: number): Benchmark[] {
    return this.benchmarks.splice(start, deleteCount);
  }

  /**
   * Removes the first element from an array and returns it.
   * If the array is empty, undefined is returned and the array is not modified.
   */
  public shift(): Benchmark | undefined {
    return this.benchmarks.shift();
  }

  /**
   * Inserts new elements at the start of an array, and returns the new length of the array.
   *
   * @param items Elements to insert at the start of the array.
   */
  public unshift(...items: Benchmark[]): number {
    return this.benchmarks.unshift(...items);
  }

  /**
   * Reverses the elements in an array in place.
   * This method mutates the array and returns a reference to the same array.
   */
  public reverse(): Benchmark[] {
    return this.benchmarks.reverse();
  }

  /**
   * Adds all the elements of an array into a string, separated by the specified separator string.
   *
   * @param separator A string used to separate one element of the array from the next in the resulting string. If omitted, the array elements are separated with a comma.
   */
  public join(separator?: string): string {
    return this.benchmarks.join(separator);
  }
  //
  // /**
  //  * An `Array#filter` like method.
  //  *
  //  * @param callback The function/alias called per iteration.
  //  *
  //  * @returns A new suite of benchmarks that passed callback filter.
  //  */
  // public filterSuite(callback: ((value: Benchmark, index: number, array: Benchmark[]) => boolean)): Suite {
  //   // var suite = this,
  //   //   result = new suite.constructor(suite.options);
  //   const result = new Suite(this.options);
  //
  //   // result.push.apply(result, filter(suite, callback));
  //   result.push(...filter(this.benchmarks, callback));
  //
  //   return result;
  // }

  //#endregion

  //#region Public Methods

  /**
   * Adds a test to the benchmark suite.
   *
   * @param fn The test to benchmark.
   *
   * @returns The suite instance.
   *
   * @example```js
   * // basic usage
   * suite.add(fn);
   *```
   */
  public add(fn: BenchmarkFn);

  /**
   * Adds a test to the benchmark suite.
   *
   * @param options Options object.
   *
   * @returns The suite instance.
   *
   * @example```js
   * // options only
   * suite.add({
   *   'name': 'foo',
   *   'fn': fn,
   *   'onCycle': onCycle,
   *   'onComplete': onComplete
   * });
   */
  public add(options: BenchmarkOptions);

  /**
   * Adds a test to the benchmark suite.
   *
   * @param name A name to identify the benchmark.
   * @param fn The test to benchmark.
   *
   * @returns The suite instance.
   * @example```js
   * //using a name first
   * suite.add('foo', fn);
   * ```
   */
  public add(name: string, fn: BenchmarkFn);

  /**
   * Adds a test to the benchmark suite.
   *
   * @param name A name to identify the benchmark.
   * @param options Options object.
   *
   * @returns The suite instance.
   *
   * @example```
   * // name and options
   * suite.add('foo', {
   *   'fn': fn,
   *   'onCycle': onCycle,
   *   'onComplete': onComplete
   * });
   * ```
   */
  public add(name: string, options: BenchmarkOptions);

  /**
   * Adds a test to the benchmark suite.
   *
   * @param name A name to identify the benchmark.
   * @param fn The test to benchmark.
   * @param options Options object.
   *
   * @returns The suite instance.
   *
   * @example```js
   * // name, fn and options
   * suite.add('foo', fn, {
   *   'onCycle': onCycle,
   *   'onComplete': onComplete
   * });
   */
  public add(name: string, fn: BenchmarkFn, options: BenchmarkOptions);

  public add(name: string | BenchmarkFn | BenchmarkOptions, fn?: BenchmarkFn | BenchmarkOptions, options?: BenchmarkOptions) {
    const bench = new Benchmark(name as any, fn as any, options);
    const event = new Event({ 'type': 'add', 'target': bench });

    this.emit(event);

    if (!event.cancelled) {
      this.push(bench);
    }

    return this;
  }

  /**
   * Creates a new suite with cloned benchmarks.
   *
   * @param options Options object to overwrite cloned options.
   *
   * @returns The new suite instance.
   */
  public clone(options?: SuiteOptions): Suite {
    const result = new Suite(Object.assign({}, this.options, options));

    // Copy own properties.
    // for (const [key, value] of Object.entries(this)) {
    //   if (!result.hasOwnProperty(key)) {
    //     result[key] = isFunction(get(value, 'clone'))
    //       ? value.clone()
    //       : cloneDeep(value);
    //   }
    // }
    forOwn(this, (value, key) => {
      if (!has(result, key)) {
        result[key] = isFunction(get(value, 'clone'))
          ? (value as Benchmark).clone()
          : cloneDeep(value);
      }
    });

    return result;
  }

  /**
   * Aborts all benchmarks in the suite.
   *
   * @name abort
   * @memberOf Benchmark.Suite
   * @returns The suite instance.
   */
  public abort(): this {
    const resetting = calledBy.resetSuite;

    if (this.running) {
      const event = new Event('abort');

      this.emit(event);

      if (!event.cancelled || resetting) {
        // Avoid infinite recursion.
        calledBy.abortSuite = true;

        this.reset();

        calledBy.abortSuite = false;

        if (!resetting) {
          this.aborted = true;

          invoke(this.benchmarks, 'abort');
        }
      }
    }

    return this;
  }

  /**
   * Resets all benchmarks in the suite.
   *
   * @returns The suite instance.
   */
  public reset(): this {
    // var event,
    //   suite = this,
    const aborting = calledBy.abortSuite;

    if (this.running && !aborting) {
      // No worries, `resetSuite()` is called within `abortSuite()`.
      calledBy.resetSuite = true;
      this.abort();
      calledBy.resetSuite = false;
    }

    // Reset if the state has changed.
    else if (this.aborted || this.running) {
      const event = new Event('reset');
      this.emit(event);

      if (!event.cancelled) {
        this.aborted = false;
        this.running = false;

        if (!aborting) {
          invoke(this.benchmarks, 'reset');
        }
      }

      return this;
    }
  }

  /**
   * Runs the suite.
   *
   * @name run
   * @memberOf Benchmark.Suite
   * @param {Object} [options={}] Options object.
   * @returns The suite instance.
   * @example
   *
   * // basic usage
   * suite.run();
   *
   * // or with options
   * suite.run({ 'async': true, 'queued': true });
   */
  public run(options: any): this {
    this.reset();
    this.running = true;

    options || (options = {});

    invoke(this.benchmarks, {
      name: 'run',
      args: options,
      queued: options.queued,
      onStart: (event) => {
        this.emit('start', event);
      },
      onCycle: (event) => {
        const bench = event.target;

        if (bench.error) {
          this.emit({ 'type': 'error', 'target': bench });
        }

        this.emit('cycle', event);
        event.aborted = this.aborted;
      },
      onComplete: (event) => {
        this.running = false;
        this.emit('complete', event);
      },
    });

    return this;
  }

  //#endregion
}
