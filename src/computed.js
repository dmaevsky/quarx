import { subscribable, toObservable } from './adapters.js';

export function computed(evaluate, options = {}) {
  const {
    name = 'computed',
    equals = (a, b) => a === b
  } = options;

  const subs = subscribable(evaluate, { name });
  return toObservable(subs, { name: 'result:' + name, equals });
}
