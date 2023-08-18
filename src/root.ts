import { objectTypes } from './constants';
import { freeGlobal } from './environment';

/** Used as a reference to the global object. */
let root = (objectTypes[typeof window] && window) || this;

if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal || freeGlobal.self === freeGlobal)) {
  root = freeGlobal;
}

export {
  root,
};
