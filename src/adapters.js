import { autorun, createAtom } from './core.js';

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

  const off = subscribe(value => {result = value}, e => {error = e}, e => {error = e});
  if (off) off();

  if (error) throw error;
  return result;
}

export function toObservable({ subscribe }, options = {}) {
  const {
    name = 'toObservable',
    equals = (a, b) => a === b
  } = options;

  let result, error, subscribed = false;

  function set(e, r) {
    if (e && error === e) return;
    if (!e && equals(result, r)) return;

    [result, error] = [r, e];
    atom.reportChanged();
  }

  function start() {
    const off = subscribe(r => set(null, r), set, set);
    subscribed = true;

    return () => {
      if (off) off();
      subscribed = false;
    }
  }

  const atom = createAtom(start, { name });

  return {
    get() {
      atom.reportObserved();
      if (!subscribed) {
        return get({ subscribe });
      }
      if (error) throw error;
      return result;
    }
  };
}
