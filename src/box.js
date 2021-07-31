import { createAtom } from './core';

export function box(value, options = {}) {
  const {
    name = 'box',
    equals = (a, b) => a === b
  } = options;

  const atom = createAtom(null, { name });

  return {
    equals(other) { return equals(value, other) },
    set(newValue) {
      if (!equals(newValue, value)) {
        value = newValue;
        atom.reportChanged();
      }
    },
    get() {
      atom.reportObserved(this, value);
      return value;
    }
  };
}
