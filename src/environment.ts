import { objectTypes } from './constants';

declare var require: any;
declare var define: any;
declare var exports: any;
declare var module: any;
declare var global: any;

/** Detect free variable `define`. */
export const freeDefine = typeof define == 'function' && typeof define.amd == 'object' && define.amd && define;

/** Detect free variable `exports`. */
export const freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
export const freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

/** Detect free variable `global` from Node.js or Browserified code and use it as `root`. */
export const freeGlobal = freeExports && freeModule && typeof global == 'object' && global;

/** Detect free variable `require`. */
export const freeRequire = typeof require == 'function' && require;

/** Detect the popular CommonJS extension `module.exports`. */
export const moduleExports = freeModule && freeModule.exports === freeExports && freeExports;

/** Used to detect primitive types. */
export const rePrimitive = /^(?:boolean|number|string|undefined)$/;

const check = function (it) {
  return it && it.Math === Math && it;
};

// extracted from https://github.com/zloirock/core-js/blob/master/packages/core-js/internals/global.js
// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
export const _globalThis =
  check(typeof globalThis == 'object' && globalThis) ||
  check(typeof window == 'object' && window) ||
  check(typeof self == 'object' && self) ||
  check(typeof global == 'object' && global) ||
  (function () { return this; })() || this || Function('return this')();
