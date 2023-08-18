import { cloneDeepWith, isArray, isPlainObject as lodaslIsPlainObject, partial } from 'lodash';

/**
 * A specialized version of `_.cloneDeep` which only clones arrays and plain
 * objects assigning all other values by reference.
 *
 * @internal
 * @param value The value to clone.
 * @returns The cloned value.
 */
export const cloneDeep = partial(cloneDeepWith, undefined, (value: unknown) => {
  // Only clone primitives, arrays, and plain objects.
  if (!isArray(value) && !lodaslIsPlainObject(value)) {
    return value;
  }
});

/**
 * @reference {@link isPlainObject} from lodash
 */
export const isPlainObject = (value: unknown): value is object => {
  return lodaslIsPlainObject(value);
};
