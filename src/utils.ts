import { filter as lodashFilter, has, isFunction, isString } from 'lodash';
import { Benchmark } from './benchmark';

/**
 * A generic `Array#filter` like method.
 *
 * @param array The array to iterate over.
 * @param callback The function/alias called per iteration.
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
export function filter<T extends Benchmark>(array: T[], callback: ((value: T, index: number, array: T[]) => boolean) | 'successful' | 'fastest' | 'slowest'): T[] {
  if (callback === 'successful') {
    // Callback to exclude those that are errored, unrun, or have hz of Infinity.
    callback = (bench) => {
      return bench.cycles && isFinite(bench.hz) && !bench.error;
    };
  } else if (callback === 'fastest' || callback === 'slowest') {
    // Get successful, sort by period + margin of error, and filter fastest/slowest.
    const result: T[] = filter(array, 'successful').sort((a: T, b: T) => {
      const aStats = a.stats;
      const bStats = b.stats;

      return (aStats.mean + aStats.moe > bStats.mean + bStats.moe ? 1 : -1) * (callback === 'fastest' ? 1 : -1);
    });

    return lodashFilter(result, (bench) => {
      return (result[0] as any).compare(bench) == 0;
    });
  }

  return lodashFilter(array, callback);
}

/**
 * Checks if a value can be safely coerced to a string.
 *
 * @param value The value to check.
 * @returns Returns `true` if the value can be coerced, else `false`.
 */
export function isStringable(value: unknown): boolean {
  return isString(value) || (has(value, 'toString') && isFunction(value.toString));
}
