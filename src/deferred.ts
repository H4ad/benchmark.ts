import { Benchmark } from './benchmark';
import { clock, compiledTimer } from './clock';
import { NOOP } from './constants';
import { cycle } from './lifecycle';
import { _globalThis } from './environment';

export type TemplateData = {
  uid: string;
  setup: string;
  fn: string;
  fnArg: string;
  teardown: string;
  begin: string;
  end: string;
}

export class Deferred {

  constructor(
    clone: Benchmark,
  ) {
    this.benchmark = clone;

    // /**
    //  * The Deferred constructor.
    //  *
    //  * @constructor
    //  * @memberOf Benchmark
    //  * @param {Object} clone The cloned benchmark instance.
    //  */
    // function Deferred(clone) {
    //   var deferred = this;
    //   if (!(deferred instanceof Deferred)) {
    //     return new Deferred(clone);
    //   }
    //   deferred.benchmark = clone;
    //   clock(deferred);
    // }
    // this.clock(this);
    clock(this);
  }

  //#region Public Properties

  /**
   * The cloned benchmark instance.
   */
  public benchmark: Benchmark | null = null;

  /**
   * The number of deferred cycles performed while benchmarking.
   */
  public cycles: number = 0;

  /**
   * The time taken to complete the deferred benchmark (secs).
   */
  public elapsed: number = 0;

  /**
   * A timestamp of when the deferred benchmark started (ms).
   */
  public timeStamp: number = 0;

  /**
   * The teardown function defined inside the funcBody
   */
  public teardown: () => void = NOOP;

  /**
   * The fn function defined inside the funcBody
   */
  public fn: () => void = NOOP;

  //#endregion

  //#region Public Methods

  /**
   * Handles cycling/completing the deferred benchmark.
   *
   * @memberOf Benchmark.Deferred
   */
  public resolve(): void {
    const deferred = this;
    const clone = this.benchmark;
    const bench = clone._original;

    if (bench.aborted) {
      // cycle() -> clone cycle/complete event -> compute()'s invoked bench.run() cycle/complete.
      deferred.teardown();
      clone.running = false;
      cycle(deferred);
    } else if (++deferred.cycles < clone.count) {
      (clone.compiled as Function).call(deferred, _globalThis, compiledTimer);
    } else {
      compiledTimer.stop(this);
      this.teardown();
      clone.delayFn(() => {
        cycle(deferred);
      });
    }
  }

  //#endregion

}
