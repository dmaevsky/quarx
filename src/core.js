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
    Quarx.error('[Quarx ERROR]', 'unhandled @ atom dispose', name, e);
  }

  const observers = new Map();
  let dispose, pullUpstream;

  return {
    reportObserved() {
      const { invalidate, link, name: fromName } = Quarx.stack[Quarx.stack.length - 1] || {};

      Quarx.debug('[Quarx]', 'observed', name, fromName);
      if (!invalidate) return false;

      const unobserved = !observers.size;

      // Important to add the new observer before calling onBecomeObserved, because the latter may call reportChanged
      // as is the case with `toObservable` implementation

      if (!observers.has(invalidate)) {
        observers.set(invalidate, {
          unlink() {
            observers.delete(invalidate);
            if (!observers.size && dispose) Quarx.pendingDispose.add(dispose);
          },
          actualize() {
            if (pullUpstream) pullUpstream();
          }
        });
      }

      link(observers.get(invalidate));

      if (unobserved) {
        if (dispose && Quarx.pendingDispose.has(dispose)) {
          Quarx.pendingDispose.delete(dispose);
        }
        else if (onBecomeObserved) {
          const cleanup = onBecomeObserved();
          dispose = tryCatch(() => cleanup && cleanup(), onError);
        }
      }

      if (pullUpstream) pullUpstream();
      return true;
    },

    reportChanged() {
      const { invalidate, actualize, name: fromName } = Quarx.stack[Quarx.stack.length - 1] || {};
      Quarx.debug('[Quarx]', 'changed', name, fromName);

      // Prevent creating self-reference for the running computation
      if (!observers.has(invalidate)) {
        pullUpstream = actualize;
      }

      for (let invalidate of observers.keys()) invalidate();
      hydrate();
    }
  }
}

export function autorun(computation, options = {}) {
  const { name = 'autorun' } = options;
  const pushError = options.onError || function(e) {
    Quarx.error('[Quarx ERROR]', 'unhandled @ computation', name, e);
  }

  const onError = e => {
    // never call the error handler twice in the same hydration
    if (seqNoError === Quarx.sequenceNumber) return;

    seqNoError = Quarx.sequenceNumber;
    pushError(e);
  }

  computation = tryCatch(computation, onError);

  let dependencies = new Set();
  let seqNo = 0, seqNoError = 0, isRunning = false;

  const link = dep => dependencies.add(dep);

  function invalidate() {
    if (isRunning) return;

    Quarx.debug('[Quarx]', 'invalidate', name, seqNo, Quarx.sequenceNumber);

    if (Quarx.cleaningUp) {
      // No invalidations allowed in dispose callbacks
      const args = ['[Quarx ERROR]', 'invalidate at dispose', name];
      Quarx.error(...args);

      return onError(new Error(args.join(':')));
    }
    if (Quarx.hydrating && seqNo === Quarx.sequenceNumber) {
      const args = ['[Quarx ERROR]', 'invalidate hydrated', name, Quarx.stack[Quarx.stack.length - 1].name];
      Quarx.error(...args);

      return onError(new Error(args.join(':')));
    }

    seqNo = 0;
    Quarx.invalidated.add(run);
  }

  function actualize() {
    Quarx.debug('[Quarx]', 'actualize', name, seqNo, Quarx.sequenceNumber);

    if (isRunning) {
      const args = ['[Quarx ERROR]', 'cycle detected', ...Quarx.stack.map(({ name }) => name), name];
      Quarx.error(...args);

      throw new Error(args.join(':'));
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
    Quarx.debug('[Quarx]', 'run', name, Quarx.sequenceNumber);
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
    Quarx.debug('[Quarx]', 'finished', name, Quarx.sequenceNumber);
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
  Quarx.debug('[Quarx]', 'hydration start', Quarx.sequenceNumber);

  Quarx.hydrating = true;
  for (let run of Quarx.invalidated) run();
  Quarx.hydrating = false;

  collectUnobserved();

  Quarx.debug('[Quarx]', 'hydration end', Quarx.sequenceNumber);
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
