//#region Imports

import { template } from 'lodash';
import { Benchmark } from './benchmark';
import { getNextCounter, NOOP, support, uid } from './constants';
import { Deferred } from './deferred';
import { _globalThis } from './environment';
import { timer } from './timers/timers';
import { isStringable } from './utils';

//#endregion

export type CompiledTimer = {
  ns: () => number;
  start: () => number;
  stop: (deferred: Deferred) => number;
}

/**
 * The compiled timer reference.
 */
export let compiledTimer: CompiledTimer = null;

/**
 * Clocks the time taken to execute a test per cycle (secs).
 *
 * @private
 * @returns {number} The time taken.
 */
export function clock(benchmarkOrDeferred: Benchmark | Deferred): number {
  // var options = Benchmark.options,
  // let templateData = {};
  // let timers = [{ 'ns': timer.ns, 'res': max(0.0015, getRes('ms')), 'unit': 'ms' }];

  // Lazy define for hi-res timers.
  // clock = function (clone) {
  let deferred: Deferred;
  let clone: Benchmark;

  if (benchmarkOrDeferred instanceof Deferred) {
    deferred = benchmarkOrDeferred;
    clone = benchmarkOrDeferred.benchmark;
  } else {
    clone = benchmarkOrDeferred;
  }

  let bench = clone._original;
  const stringable = isStringable(bench.fn);
  let count = bench.count = clone.count;
  let decompilable = stringable || (support.decompilation && (clone.setup !== NOOP || clone.teardown !== NOOP));
  let id = bench.id;
  let name = bench.name || (typeof id == 'number' ? '<Test #' + id + '>' : id);
  let result = 0;

  // Init `minTime` if needed.
  clone.minTime = bench.minTime || (bench.minTime = bench.options.minTime = 0);

  // Compile in setup/teardown functions and the test loop.
  // Create a new compiled test, instead of using the cached `bench.compiled`,
  // to avoid potential engine optimizations enabled over the life of the test.
  let funcBody = deferred
    ? 'var d#=this,${fnArg}=d#,m#=d#.benchmark._original,f#=m#.fn,su#=m#.setup,td#=m#.teardown;' +
    // When `deferred.cycles` is `0` then...
    'if(!d#.cycles){' +
    // set `deferred.fn`,
    'd#.fn=function(){var ${fnArg}=d#;if(typeof f#=="function"){try{${fn}\n}catch(e#){f#(d#)}}else{${fn}\n}};' +
    // set `deferred.teardown`,
    'd#.teardown=function(){d#.cycles=0;if(typeof td#=="function"){try{${teardown}\n}catch(e#){td#()}}else{${teardown}\n}};' +
    // execute the benchmark's `setup`,
    'if(typeof su#=="function"){try{${setup}\n}catch(e#){su#()}}else{${setup}\n};' +
    // start timer,
    't#.start(d#);' +
    // and then execute `deferred.fn` and return a dummy object.
    '}d#.fn();return{uid:"${uid}"}'

    : 'var r#,s#,m#=this,f#=m#.fn,i#=m#.count,n#=t#.ns;${setup}\n${begin};' +
    'while(i#--){${fn}\n}${end};${teardown}\nreturn{elapsed:r#,uid:"${uid}"}';

  let compiled = createCompiled(bench, decompilable, !!deferred, funcBody);

  clone.compiled = compiled;
  bench.compiled = compiled;

  const isEmpty = !(bench.templateData.fn || stringable);

  try {
    if (isEmpty) {
      // Firefox may remove dead code from `Function#toString` results.
      // For more information see http://bugzil.la/536085.
      throw new Error('The test "' + name + '" is empty. This may be the result of dead code removal.');
    } else if (!deferred) {
      // Pretest to determine if compiled code exits early, usually by a
      // rogue `return` statement, by checking for a return object with the uid.
      bench.count = 1;

      const isCompilable = decompilable && (compiled.call(bench, _globalThis, compiledTimer) || {}).uid === this.templateData.uid;
      if (!isCompilable)
        compiled = null;

      // compiled = decompilable && (compiled.call(bench, _globalThis, compiledTimer) || {}).uid === this.templateData.uid && compiled;
      bench.count = count;
    }
  } catch (e) {
    compiled = null;
    clone.error = e || new Error(String(e));
    bench.count = count;
  }

  // Fallback when a test exits early or errors during pretest.
  if (!compiled && !deferred && !isEmpty) {
    funcBody = (
        stringable || (decompilable && !clone.error)
          ? 'function f#(){${fn}\n}var r#,s#,m#=this,i#=m#.count'
          : 'var r#,s#,m#=this,f#=m#.fn,i#=m#.count'
      ) +
      ',n#=t#.ns;${setup}\n${begin};m#.f#=f#;while(i#--){m#.f#()}${end};' +
      'delete m#.f#;${teardown}\nreturn{elapsed:r#}';

    compiled = createCompiled(bench, decompilable, !!deferred, funcBody);

    try {
      // Pretest one more time to check for errors.
      bench.count = 1;
      compiled.call(bench, _globalThis, compiledTimer);
      bench.count = count;
      delete clone.error;
    } catch (e) {
      bench.count = count;
      if (!clone.error) {
        clone.error = e || new Error(String(e));
      }
    }
  }
  // If no errors run the full test loop.
  if (!clone.error) {
    compiled = createCompiled(bench, decompilable, !!deferred, funcBody);

    bench.compiled = compiled;
    clone.compiled = compiled;
    // compiled = bench.compiled = clone.compiled = this.createCompiled(bench, decompilable, deferred, funcBody);
    result = compiled.call(deferred || bench, _globalThis, compiledTimer).elapsed;
  }

  return result;
  // };

  /*----------------------------------------------------------------------*/

  // return clock.apply(null, arguments);
}


/**
 * Creates a compiled function from the given function `body`.
 */
function createCompiled(bench: Benchmark, decompilable: boolean, deferred: boolean, body: string): Function {
  const fn = bench.fn;
  const fnArg = deferred ? getFirstArgument(fn) || 'deferred' : '';
  const nextUid = uid + getNextCounter();

  bench.templateData = {
    uid: nextUid,
    setup: decompilable ? getSource(bench.setup) : interpolate(bench, nextUid, 'm#.setup()'),
    fn: decompilable ? getSource(fn) : interpolate(bench, nextUid, 'm#.fn(' + fnArg + ')'),
    fnArg: fnArg,
    teardown: decompilable ? getSource(bench.teardown) : interpolate(bench, nextUid, 'm#.teardown()'),
    begin: interpolate(bench, nextUid, 's#=n#()'),
    end: interpolate(bench, nextUid, 'r#=(n#()-s#)'),
  };

  // _.assign(templateData, {
  //   'setup': decompilable ? getSource(bench.setup) : this.interpolate('m#.setup()'),
  //   'fn': decompilable ? getSource(fn) : this.interpolate('m#.fn(' + fnArg + ')'),
  //   'fnArg': fnArg,
  //   'teardown': decompilable ? getSource(bench.teardown) : this.interpolate('m#.teardown()'),
  // });
  //
  // // Use API of chosen timer.
  // if (timer.unit == 'ns') {
  //   _.assign(templateData, {
  //     'begin': this.interpolate('s#=n#()'),
  //     'end': this.interpolate('r#=n#(s#);r#=r#[0]+(r#[1]/1e9)'),
  //   });
  // } else if (timer.unit == 'us') {
  //   if (timer.ns.stop) {
  //     _.assign(templateData, {
  //       'begin': this.interpolate('s#=n#.start()'),
  //       'end': this.interpolate('r#=n#.microseconds()/1e6'),
  //     });
  //   } else {
  //     _.assign(templateData, {
  //       'begin': this.interpolate('s#=n#()'),
  //       'end': this.interpolate('r#=(n#()-s#)/1e6'),
  //     });
  //   }
  // } else if (timer.ns.now) {
  //   _.assign(templateData, {
  //     'begin': this.interpolate('s#=(+n#.now())'),
  //     'end': this.interpolate('r#=((+n#.now())-s#)/1e3'),
  //   });
  // } else {
  //   _.assign(templateData, {
  //     'begin': this.interpolate('s#=new n#().getTime()'),
  //     'end': this.interpolate('r#=(new n#().getTime()-s#)/1e3'),
  //   });
  // }
  // Define `timer` methods.

  compiledTimer = {
    ns: timer.ns,
    start: Function(
      interpolate(bench, nextUid, 'o#'),
      interpolate(bench, nextUid, 'var n#=this.ns,${begin};o#.elapsed=0;o#.timeStamp=s#'),
    ) as CompiledTimer['start'],
    stop: Function(
      interpolate(bench, nextUid, 'o#'),
      interpolate(bench, nextUid, 'var n#=this.ns,s#=o#.timeStamp,${end};o#.elapsed=r#'),
    ) as CompiledTimer['stop'],
  };

  // Create compiled test.
  const compiled = Function(
    interpolate(bench, nextUid, 'window,t#'),
    'var global = window, clearTimeout = global.clearTimeout, setTimeout = global.setTimeout;\n' + interpolate(bench, nextUid, body),
  );

  return compiled;
}

/**
 * Interpolates a given template string.
 */
function interpolate(bench: Benchmark, uid: string, string: string): string {
  const numberUid = /\d+/.exec(uid)[0];

  // Replaces all occurrences of `#` with a unique number and template tokens with content.
  const text = string.replace(/\#/g, numberUid);

  return template(text)(bench.templateData);
}

/**
 * Gets the name of the first argument from a function's source.
 *
 * @param fn The function.
 * @returns The argument name.
 */
function getFirstArgument(fn: Function | string): string {
  return (/^[\s(]*function[^(]*\(([^\s,)]+)/.exec(fn.toString()) || 0)[1] || '';
}

/**
 * Gets the source code of a function.
 *
 * @param fn The function.
 * @returns The function's source code.
 */
function getSource(fn: Function | string): string {
  const result = fn.toString()
    // Trim string.
    .replace(/^\s+|\s+$/g, '');

  // Detect strings containing only the "use strict" directive.
  return /^(?:\/\*+[\w\W]*?\*\/|\/\/.*?[\n\r\u2028\u2029]|\s)*(["'])use strict\1;?$/.test(result)
    ? ''
    : result;
}
