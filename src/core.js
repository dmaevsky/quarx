const TAG = '@dmaevsky/quarx';
const GLOBAL = typeof window === 'object' ? window :
  typeof global === 'object' ? global : {};

if (GLOBAL[TAG]) {
  console.log(`[Quarx]: WARNING!!! Another instance of Quarx is already initialized.
    This means code duplication and will possibly break in the future!`);
}
else GLOBAL[TAG] = {
  stack: [],
  invalidated: new Set(),
  pendingDispose: new Set(),
  sequenceNumber: 1,
  batchDepth: 0,
  debug: () => {},
  error: console.error
};

export const Quarx = GLOBAL[TAG];

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
    Quarx.error(`[Quarx]: uncaught exception disposing ${name}:`, e);
  }

  const observers = new Map();
  let dispose, actualize;

  return {
    reportObserved() {
      Quarx.debug(`[Quarx]: ${name} observed`);
      const { invalidate, link } = Quarx.stack[Quarx.stack.length - 1] || {};
      if (!invalidate) return false;

      if (!observers.size) {
        if (dispose && Quarx.pendingDispose.has(dispose)) {
          Quarx.pendingDispose.delete(dispose);
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
            if (!observers.size && dispose) Quarx.pendingDispose.add(dispose);
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
      Quarx.debug(`[Quarx]: ${name} changed`);
      ({ actualize } = Quarx.stack[Quarx.stack.length - 1] || {});
      for (let invalidate of observers.keys()) invalidate();

      if (!Quarx.batchDepth) hydrate();
    }
  }
}

export function autorun(computation, options = {}) {
  const { name = 'autorun' } = options;
  const onError = options.onError || function(e) {
    Quarx.error(`[Quarx]: uncaught exception in ${name}:`, e);
  }

  let dependencies = new Set();
  let seqNo = 0, isRunning = false;

  const link = dep => dependencies.add(dep);

  function invalidate() {
    seqNo = 0;
    Quarx.invalidated.add(run);
  }

  function actualize() {
    if (isRunning) {
      const trace = [...Quarx.stack.map(({ name }) => name), name];
      throw new Error(`[Quarx]: Circular dependency detected: ${trace.join(' -> ')}`);
    }
    if (seqNo === Quarx.sequenceNumber) return;
    if (!seqNo) return run();

    Quarx.stack.push({ name });

    for (let dep of dependencies) {
      dep.actualize();
      if (!seqNo) break;
    }

    Quarx.stack.pop();
    if (!seqNo) return run();

    seqNo = Quarx.sequenceNumber;
  }

  function run() {
    Quarx.debug(`[Quarx]: Running ${name}`, Quarx.sequenceNumber);
    isRunning = true;

    const previousDeps = dependencies;
    dependencies = new Set();

    Quarx.stack.push({ link, invalidate, actualize, name });

    tryCatch(computation, onError);

    Quarx.stack.pop();

    // Unsubscribe from previous dependencies which have not been hit
    for (let dep of previousDeps) {
      if (!dependencies.has(dep)) dep.unlink();
    }

    Quarx.invalidated.delete(run);
    seqNo = Quarx.sequenceNumber;
    isRunning = false;
    Quarx.debug(`[Quarx]: Finished ${name}`, Quarx.sequenceNumber);
  }

  function dispose() {
    for (let dep of dependencies) dep.unlink();
    dependencies.clear();
    if (!Quarx.batchDepth) collectUnobserved();
  }

  batch(run);
  return dispose;
}

function collectUnobserved() {
  ++Quarx.batchDepth;
  for (let dispose of Quarx.pendingDispose) dispose();
  --Quarx.batchDepth;

  Quarx.pendingDispose.clear();
}

function hydrate() {
  if (!Quarx.invalidated.size) return;

  ++Quarx.sequenceNumber;
  Quarx.debug(`[Quarx]: Hydration ${Quarx.sequenceNumber}`);

  ++Quarx.batchDepth;
  for (let run of Quarx.invalidated) run();
  --Quarx.batchDepth;

  collectUnobserved();

  Quarx.debug(`[Quarx]: Hydration ${Quarx.sequenceNumber} END`);
}

export function batch(fn) {
  ++Quarx.batchDepth;
  try {
    fn();
  }
  finally {
    --Quarx.batchDepth;
  }
  if (!Quarx.batchDepth) hydrate();
}

export function untracked(fn) {
  Quarx.stack.push({ name: '[untracked]' });
  try {
    return fn();
  }
  finally {
    Quarx.stack.pop();
  }
}
