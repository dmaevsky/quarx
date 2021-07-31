import { Quarx } from './core';

export function memoizeOne(fn) {
  let previousInputs = new Map();
  let previousResult = undefined;
  return {
    get: function () {
      let cacheHit = previousInputs.size > 0;
      // console.debug(`[Quarx.memoize]: Start: Checking cache. ${previousInputs.size} boxed values`);
      for (const [box, value] of previousInputs.entries()) {
        if (!box.equals(value)) {
          cacheHit = false;
          break;
        }
      }

      if (cacheHit) {
        // console.debug(`[Quarx.memoize]: End: Cache hit. Returning `, previousResult);
        for (const [box, value] of previousInputs.entries()) {
          Quarx.observedMapStack.forEach(frame => frame.set(box, value));
        }
        return previousResult;
      }

      // console.debug(`[Quarx.memoize]: Cache miss. Executing...`);
      previousInputs = new Map();
      Quarx.observedMapStack.push(previousInputs);
      previousResult = fn();
      Quarx.observedMapStack.pop();

      // console.debug(`[Quarx.memoize]: End: Returning`, previousResult);
      return previousResult;
    }
  }
}
