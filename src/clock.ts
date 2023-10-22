//#region Imports

import { result } from 'lodash';
import { Benchmark } from './benchmark';
import { getNextCounter, NOOP, support, uid } from './constants';
import { Deferred, TemplateData } from './deferred';
import { _globalThis } from './environment';
import { timer } from './timers/timers';
import { isStringable } from './utils';

//#endregion

// TODO: Há um bug na compilação do benchmark linha 12, provavelmente ele não está fazendo inline do código.

export type CompiledTimer = {
  ns: () => number;
  start: () => number;
  stop: (deferred: Deferred) => number;
}

/**
 * The compiled timer reference.
 */
export let compiledTimer: CompiledTimer = null;

export type CompileFuntionBody = (id: string, template: TemplateData) => string;

function compileFuncBodyDeferred(id: string, templateData: TemplateData) {
  return `
  var d${ id } = this;
  var ${ templateData.fnArg } = d${ id };
  var m${ id } = d${ id }.benchmark._original;
  var f${ id } = m${ id }.fn;
  var su${ id } = m${ id }.setup;
  var td${ id } = m${ id }.teardown;

  // When 'deferred.cycles' is '0' then...
  if (!d${ id }.cycles) {
    // set 'deferred.fn',
    d${ id }.fn = function() {
      var ${ templateData.fnArg } = d${ id };
      
      if(typeof f${ id }=="function") {
        try{
          ${ templateData.fn }
        } catch (e${ id }) {
          f${ id }(d${ id })
        }
      } else {
        ${ templateData.fn }
      }
    };

    // set 'deferred.teardown'
    d${ id }.teardown=function() { 
      d${ id }.cycles = 0;
      
      if (typeof td${ id } == "function") {
        try {
          ${ templateData.teardown }
        } catch (e${ id }) {
          td${ id }();
        }
      } else {
        ${ templateData.teardown }
      }
    };
    
    // execute the benchmark's 'setup'
    if (typeof su${ id } == "function") {
      try {
        ${ templateData.setup }
      } catch (e${ id }) {
        su${ id }();
      }
    } else {
      ${ templateData.setup }
    };

    // start timer
    t${ id }.start(d${ id });
  }

  // and then execute 'deferred.fn' and return a dummy object.
  d${ id }.fn();

  return { uid: "${ uid }" }'
  `;
}

function compileFuncBodyNormal(id: string, templateData: TemplateData): string {
  return `
  var r${ id };
  var s${ id };
  var m${ id } = this;
  var f${ id } = m${ id }.fn;
  var i${ id } = m${ id }.count;
  var n${ id } = t${ id }.ns;

  ${ templateData.setup }
  ${ templateData.begin };

  while(i${ id }--) {
    ${ templateData.fn }
  }

  ${ templateData.end };
  ${ templateData.teardown }

  return { elapsed: r${ id }, uid: "${ uid }" }`;
}

function compileFuncBodyFallback(stringable: boolean, decompilable: boolean, clone: Benchmark): CompileFuntionBody {
  return (id: string, templateData: TemplateData) => {
    const startFn = stringable || (decompilable && !clone.error)
      ? `
          function f${ id }() {
            ${ templateData.fn }
          }

          var r${ id };
          var s${ id };
          var m${ id } = this;
          var i${ id } = m${ id }.count
        `
      : `
          var r${ id };
          var s${ id };
          var m${ id } = this;
          var f${ id } = m${ id }.fn;
          var i${ id } = m${ id }.count;
        `;

    return `
      ${ startFn }

      var n${ id } = t${ id }.ns;

      ${ templateData.setup }
      ${ templateData.begin };

      m${ id }.f${ id } = f${ id };

      while (i${ id }--) {
        m${ id }.f${ id }();
      }

      ${ templateData.end };

      delete m${ id }.f${ id };

      ${ templateData.teardown }

      return { elapsed: r${ id } };
    `;
  };
}

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
  let funcBody: CompileFuntionBody = deferred
    ? compileFuncBodyDeferred
    : compileFuncBodyNormal;

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
    funcBody = compileFuncBodyFallback(stringable, decompilable, clone);

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
function createCompiled(bench: Benchmark, decompilable: boolean, deferred: boolean, compileFuncBody: CompileFuntionBody): Function {
  const fn = bench.fn;
  const fnArg = deferred ? getFirstArgument(fn) || 'deferred' : '';
  const nextUid = uid + getNextCounter();
  const numberUid = /\d+/.exec(uid)[0];

  bench.templateData = {
    uid: nextUid,
    setup: decompilable ? getSource(bench.setup) : `m${ numberUid }.setup()`,
    fn: decompilable ? getSource(fn) : `m${ numberUid }.fn(${ fnArg })`,
    fnArg: fnArg,
    teardown: decompilable ? getSource(bench.teardown) : `m${ numberUid }.teardown()`,
    begin: `s${ numberUid } = n${ numberUid }()`,
    end: `r${ numberUid } = (n${ numberUid }() - s${ numberUid })`,
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

  const compiledStartBody = `
    var n${ numberUid } = this.ns;

    ${ bench.templateData.begin };

    o${ numberUid }.elapsed = 0;
    o${ numberUid }.timeStamp = s${ numberUid };
  `;

  const compiledStopBody = `
    var n${ numberUid } = this.ns;
    var s${ numberUid } = o${ numberUid }.timeStamp;

    ${ bench.templateData.end };

    o${ numberUid }.elapsed = r${ numberUid };
  `;

  compiledTimer = {
    ns: timer.ns,
    start: Function(`o${ numberUid }`, compiledStartBody) as CompiledTimer['start'],
    stop: Function(`o${ numberUid }`, compiledStopBody) as CompiledTimer['stop'],
  };

  const compiledBody = `
    var global = window;
    var clearTimeout = global.clearTimeout;
    var setTimeout = global.setTimeout;

    ${ compileFuncBody(numberUid, bench.templateData) }
  `;

  // Create compiled test.
  const compiled = Function(
    `window, t${ numberUid }`,
    compiledBody,
  );

  return compiled;
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
  let fnString = isStringable(fn)
    ? fn.toString()
    // Escape the `{` for Firefox 1.
    : support.decompilation
      ? result(/^[^{]+\{([\s\S]*)\}\s*$/.exec(fn as any), 1) as string
      : fn;

  // Trim string.
  fnString = (fnString as string || '').replace(/^\s+|\s+$/g, '');

  // Detect strings containing only the "use strict" directive.
  return /^(?:\/\*+[\w\W]*?\*\/|\/\/.*?[\n\r\u2028\u2029]|\s)*(["'])use strict\1;?$/.test(fnString)
    ? ''
    : fnString;
}
