const stack = [];

const invalidated = new Set();
const pendingDispose = new Set();
let sequenceNumber = 0;
let batchDepth = 0;

function tryCatch(fn, onError) {
  try {
    fn();
  }
  catch (e) {
    onError(e);
  }
}

export function createAtom(onBecomeObserved, options = {}) {
  const { name = 'atom' } = options;
  const onError = options.onError || function(e) {
    console.error(`[Quarx]: uncaught exception disposing ${name}:`, e);
  }

  const observers = new Map();
  let dispose, actualize;

  return {
    reportObserved() {
      // console.debug(`${name} observed`);
      const { invalidate, link } = stack[stack.length - 1] || {};
      if (!invalidate) return false;

      if (!observers.size) {
        if (dispose && pendingDispose.has(dispose)) {
          pendingDispose.delete(dispose);
        }
        else if (onBecomeObserved) {
          const cleanup = onBecomeObserved();
          dispose = () => cleanup && tryCatch(cleanup, onError);
        }
      }

      if (!observers.has(invalidate)) {
        observers.set(invalidate, {
          unlink() {
            observers.delete(invalidate);
            if (!observers.size && dispose) pendingDispose.add(dispose);
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

export function autorun(computation, options = {}) {
  const { name = 'autorun' } = options;
  const onError = options.onError || function(e) {
    console.error(`[Quarx]: uncaught exception in ${name}:`, e);
  }

  let dependencies = new Set();
  let seqNo = 0, isRunning = false;

  const link = dep => dependencies.add(dep);

  function invalidate() {
    seqNo = 0;
    invalidated.add(run);
  }

  function actualize() {
    if (isRunning) {
      throw new Error(`[Quarx]: Circular dependency detected in ${name}`);
    }
    if (seqNo === sequenceNumber) return;
    if (!seqNo) return run();

    for (let dep of dependencies) {
      dep.actualize();
      if (!seqNo) return run();
    }
    seqNo = sequenceNumber;
  }

  function run() {
    isRunning = true;

    const previousDeps = dependencies;
    dependencies = new Set();

    stack.push({ link, invalidate, actualize });

    tryCatch(computation, onError);

    stack.pop();

    // Unsubscribe from previous dependencies which have not been hit
    for (let dep of previousDeps) {
      if (!dependencies.has(dep)) dep.unlink();
    }

    invalidated.delete(run);
    seqNo = sequenceNumber;
    isRunning = false;
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
  ++batchDepth;
  for (let dispose of pendingDispose) dispose();
  --batchDepth;

  pendingDispose.clear();
}

function hydrate() {
  ++sequenceNumber;
  // console.debug(`Hydration ${sequenceNumber}`);

  ++batchDepth;
  for (let run of invalidated) run();
  --batchDepth;

  collectUnobserved();

  // console.debug(`Hydration ${sequenceNumber} END`);
}

export function batch(fn) {
  ++batchDepth;
  try {
    fn();
  }
  finally {
    --batchDepth;
  }
  if (!batchDepth) hydrate();
}

export function untracked(fn) {
  stack.push(null);
  try {
    return fn();
  }
  finally {
    stack.pop();
  }
}
