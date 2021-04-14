import { createAtom, autorun } from './core';

export function computed(evaluate, options = {}) {
  const {
    name = 'computed',
    equal = (a, b) => a === b
  } = options;

  let result, error;

  const atom = createAtom(name, () => autorun(computation));

  function computation() {
    try {
      const value = evaluate();
      if (!error && equal(result, value)) return;
      result = value;
      error = null;
    }
    catch (e) {
      error = e;
    }
    atom.reportChanged();
  }

  return {
    get: () => {
      if (!atom.reportObserved()) {
        return evaluate();
      };
      if (error) throw error;
      return result;
    }
  };
}
