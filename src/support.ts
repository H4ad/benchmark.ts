/**
 * Detect if function decompilation is support.
 */
export function decompilationIsSupported(): boolean {
  try {
    // Safari 2.x removes commas in object literals from `Function#toString` results.
    // See http://webk.it/11609 for more details.
    // Firefox 3.6 and Opera 9.25 strip grouping parentheses from `Function#toString` results.
    // See http://bugzil.la/559438 for more details.
    return Function(
      ('return (' + (function (x) { return { 'x': '' + (1 + x) + '', 'y': 0 }; }) + ')')
        // Avoid issues with code added by Istanbul.
        .replace(/__cov__[^;]+;/g, ''),
    )()(0).x === '1';
  } catch (e) {
    return false;
  }
}
