const TAG = '@dmaevsky/quarx';

if (globalThis[TAG]) {
  console.log(`[Quarx]: WARNING!!! Found multiple Quarx instances:
    ${globalThis[TAG].importStack}
    ${new Error().stack.replace(/^.*/, '(2)')}
  This means code duplication and will possibly break in the future!`);
}
else globalThis[TAG] = {
  importStack: new Error().stack.replace(/^.*/, '(1)'),
  stack: [],
  invalidated: new Set(),
  pendingDispose: new Set(),
  sequenceNumber: 1,
  batchDepth: 0,
  hydrating: false,
  cleaningUp: false,
  debug: () => {},
  error: console.error
};

export const Quarx = globalThis[TAG];

const tryCatch = (fn, onError) => (...args) => {
  try {
    return fn(...args);
  }
  catch (e) {
    return onError(e);
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
          dispose = cleanup && tryCatch(cleanup, onError);
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

      hydrate();
    }
  }
}

export function autorun(computation, options = {}) {
  const { name = 'autorun' } = options;
  const onError = options.onError || function(e) {
    Quarx.error(`[Quarx]: uncaught exception in ${name}:`, e);
  }

  computation = tryCatch(computation, onError);

  let dependencies = new Set();
  let seqNo = 0, isRunning = false;

  const link = dep => dependencies.add(dep);

  function invalidate() {
    if (Quarx.cleaningUp) {
      // No invalidations allowed in dispose callbacks
      return Quarx.error(`[Quarx]: prevent invalidating ${name} while running the dispose queue`);
    }
    if (Quarx.hydrating && seqNo === Quarx.sequenceNumber) {
      // Invalidating a freshly hydrated computation == cycle, but cannot throw here yet, because we don't have the stack to report
      return Quarx.error(`[Quarx]: prevent invalidating ${name}: cycle detected`);
    }

    seqNo = 0;
    Quarx.invalidated.add(run);
  }

  function actualize() {
    if (isRunning) {
      const trace = [...Quarx.stack.map(({ name }) => name), name];
      const message = `[Quarx]: Circular dependency detected: ${trace.join(' -> ')}`;
      Quarx.debug(message);
      throw new Error(message);
    }
    if (seqNo === Quarx.sequenceNumber) return;
    if (!seqNo) return run();

    Quarx.stack.push({ name });

    try {
      for (let dep of dependencies) {
        dep.actualize();
        if (!seqNo) break;
      }
    }
    finally {
      Quarx.stack.pop();
    }

    if (!seqNo) return run();

    seqNo = Quarx.sequenceNumber;
  }

  function run() {
    Quarx.debug(`[Quarx]: Running ${name}`, Quarx.sequenceNumber);
    isRunning = true;

    const previousDeps = dependencies;
    dependencies = new Set();

    Quarx.stack.push({ link, invalidate, actualize, name });

    computation();

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

  function off() {
    for (let dep of dependencies) dep.unlink();
    dependencies.clear();
    collectUnobserved();
  }

  batch(run);
  return off;
}

function collectUnobserved() {
  if (Quarx.hydrating || Quarx.cleaningUp) return;

  Quarx.cleaningUp = true;
  for (let dispose of Quarx.pendingDispose) dispose();
  Quarx.cleaningUp = false;

  Quarx.pendingDispose.clear();
}

function hydrate() {
  if (Quarx.hydrating || Quarx.cleaningUp || Quarx.batchDepth || !Quarx.invalidated.size) return;

  ++Quarx.sequenceNumber;
  Quarx.debug(`[Quarx]: Hydration ${Quarx.sequenceNumber}`);

  Quarx.hydrating = true;
  for (let run of Quarx.invalidated) run();
  Quarx.hydrating = false;

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
  hydrate();
}

export const untrack = fn => (...args) => {
  Quarx.stack.push({ name: '[untracked]' });
  try {
    return fn(...args);
  }
  finally {
    Quarx.stack.pop();
  }
}

export const untracked = thunk => untrack(thunk)();
