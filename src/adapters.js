import { autorun, createAtom, untrack } from './core.js';

export function subscribable(evaluate, options = {}) {
  return {
    subscribe(subscriber, onError = options.onError) {
      return autorun(() => subscriber(evaluate()), {
        onError,
        name: options.name || 'subscribable'
      });
    }
  };
}

export function get({ subscribe }) {
  let result, error;
  const off = subscribe(value => result = value, e => error = e, e => error = e);
  off();
  if (error) throw error;
  return result;
}

export function toObservable({ subscribe }, options = {}) {
  const {
    name = 'toObservable',
    equals = (a, b) => a === b
  } = options;

  subscribe = untrack(subscribe);

  let result, error;

  function set(e, r) {
    if (e && error === e) return;
    if (!e && equals(result, r)) return;

    [result, error] = [r, e];
    atom.reportChanged();
  }

  const atom = createAtom(() => subscribe(r => set(null, r), set, set), { name });

  return {
    get() {
      if (!atom.reportObserved()) {
        return get({ subscribe });
      }
      if (error) throw error;
      return result;
    }
  };
}
