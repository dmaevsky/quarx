import { createAtom, autorun } from './core.js';

export function computed(evaluate, options = {}) {
  const {
    name = 'computed',
    equals = (a, b) => a === b
  } = options;

  let result, error;

  function set(e, r) {
    if (e && error === e) return;
    if (!e && equals(result, r)) return;

    [result, error] = [r, e];
    atom.reportChanged();
  }

  const atom = createAtom(
    () => autorun(() => set(null, evaluate()), { name, onError: set }),
    { name: 'result:' + name }
  );

  return {
    get() {
      if (!atom.reportObserved()) {
        return evaluate();
      };
      if (error) throw error;
      return result;
    }
  };
}
