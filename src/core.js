const stack = [];

const invalidated = new Set();
const pendingDispose = new Set();
let sequenceNumber = 0;
let batchDepth = 0;

const noop = () => {};

export function createAtom(name, onBecomeObserved) {
  const observers = new Map();
  let onBecomeUnobserved, actualize;

  return {
    reportObserved() {
      // console.debug(`${name} observed`);
      const { invalidate, link } = stack[stack.length - 1] || {};
      if (!invalidate) return false;

      if (!observers.size) {
        if (onBecomeUnobserved && pendingDispose.has(onBecomeUnobserved)) {
          pendingDispose.delete(onBecomeUnobserved);
        }
        else onBecomeUnobserved = onBecomeObserved && onBecomeObserved() || noop;
      }

      if (!observers.has(invalidate)) {
        observers.set(invalidate, {
          unlink() {
            observers.delete(invalidate);
            if (!observers.size) pendingDispose.add(onBecomeUnobserved);
          },
          actualize() {
            if (actualize) actualize();
          }
        });
      }

      link(observers.get(invalidate));

      if (actualize) actualize();
      return true;
    },

    reportChanged() {
      // console.debug(`${name} changed`);
      ({ actualize } = stack[stack.length - 1] || {});
      for (let invalidate of observers.keys()) invalidate();

      if (!batchDepth) hydrate();
    }
  }
}

export function autorun(computation) {
  let dependencies = new Set();
  let seqNo = 0;

  const link = dep => dependencies.add(dep);

  function invalidate() {
    if (stack.length && seqNo === sequenceNumber) {
      throw new Error('Circular dependency detected');
    }
    seqNo = 0;
    invalidated.add(run);
  }

  function actualize() {
    if (seqNo === sequenceNumber) return;
    if (!seqNo) return run();

    for (let dep of dependencies) {
      dep.actualize();
      if (!seqNo) return run();
    }
    seqNo = sequenceNumber;
  }

  function run() {
    const previousDeps = dependencies;
    dependencies = new Set();

    stack.push({ link, invalidate, actualize });
    computation();
    stack.pop();

    // Unsubscribe from previous dependencies which have not been hit
    for (let dep of previousDeps) {
      if (!dependencies.has(dep)) dep.unlink();
    }

    seqNo = sequenceNumber;
    invalidated.delete(run);
  }

  function dispose() {
    for (let dep of dependencies) dep.unlink();
    dependencies.clear();
    if (!batchDepth) collectUnobserved();
  }

  run();
  return dispose;
}

function collectUnobserved() {
  for (let dispose of pendingDispose) dispose();
  pendingDispose.clear();
}

function hydrate() {
  ++sequenceNumber;
  // console.debug(`Hydration ${sequenceNumber}`);

  ++batchDepth;

  for (let run of invalidated) run();
  collectUnobserved();

  --batchDepth;
  // console.debug(`Hydration ${sequenceNumber} END`);
}

export function batch(t) {
  ++batchDepth;
  t();
  if (--batchDepth === 0) hydrate();
}
