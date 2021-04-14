import { createAtom } from './core';

export function box(value, options = {}) {
  const {
    name = 'box',
    equal = (a, b) => a === b
  } = options;

  const atom = createAtom(name);

  return {
    set(newValue) {
      if (!equal(newValue, value)) {
        value = newValue;
        atom.reportChanged();
      }
    },
    get() {
      atom.reportObserved();
      return value;
    }
  };
}