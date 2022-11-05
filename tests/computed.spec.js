import test from 'ava';
import { autorun, createAtom, Quarx } from '../src/core.js';
import { box } from '../src/box.js';
import { computed } from '../src/computed.js';

const QuarxMute = fn => (...args) => {
  const original = Quarx.error;
  Quarx.error = () => {};
  const result = fn(...args);
  Quarx.error = original;
  return result;
}

const computedLogged = log => (name, computation) => computed(() => {
  log.push(`computing ${name}`);

  const result = computation();

  log.push(`${name} = ${result}`);
  return result;
}, { name });

test('only recomputing hydrated computed', t => {
  const log = [];
  const calc = computedLogged(log);

  const boxA = box(false, { name: 'boxA' });
  const boxB = box(5, { name: 'boxB' });
  const boxC = box(6, { name: 'boxC' });

  const B = calc('B', () => boxB.get() * 10);
  const C = calc('C', () => boxC.get() * 10);

  const off = autorun(() => {
    log.push(`autorun: ${boxA.get() ? B.get() : C.get()}`);
  });

  boxB.set(7);
  boxC.set(8);

  log.push('===');
  boxA.set(true);

  boxB.set(9);
  boxC.set(10);

  t.snapshot(log);
  off();
});

test('discovering a new dependency path, only recalculating what is needed along it', t => {
  const log = [];
  const calc = computedLogged(log);

  const A = box(0);
  const B = calc('B', () => A.get() ? D.get() : 555);
  const C = calc('C', () => A.get() >= 0 ? 1 : -1);
  const D = calc('D', () => C.get() * 42);

  const off = autorun(() => {
    log.push(`autorun: B = ${B.get()}`);
    log.push(`autorun: D = ${D.get()}`);
  });

  log.push('===');
  A.set(1);

  t.snapshot(log);
  off();
});

test('caches subcomputations', t => {
  const a = box(2, { name: 'boxA' });
  const b = box(3, { name: 'boxB' });

  let aRecomputed, bRecomputed, sumRecomputed;

  const squareA = computed(() => (aRecomputed = true) && a.get() * a.get(), { name: 'squareA' });
  const squareB = computed(() => (bRecomputed = true) && b.get() * b.get(), { name: 'squareB' });
  const sum = computed(() => (sumRecomputed = true) && squareA.get() + squareB.get(), { name: 'sumSquares' });

  autorun(() => sum.get());

  t.true(aRecomputed);
  t.true(bRecomputed);
  t.true(sumRecomputed);

  aRecomputed = bRecomputed = sumRecomputed = false;
  a.set(4);
  t.true(aRecomputed);
  t.false(bRecomputed);
});

test('circular deps with computed', QuarxMute(t => {
  const fa = box(() => 5, { name: 'fa '});
  const fb = box(() => a.get() + 6, { name: 'fb'});

  const a = computed(() => fa.get()(), { name: 'a' });
  const b = computed(() => fb.get()(), { name: 'b' });

  const values = [], errors = [];

  const off = autorun(() => values.push(b.get()), { onError: e => errors.push(e.message) });

  t.deepEqual(values, [11]);
  t.is(errors.length, 0);

  fa.set(() => b.get());

  t.deepEqual(errors, ['[Quarx ERROR]:cycle detected:a:b:a']);

  off();
}));

test('atom is not unobserved if picked up by another computation during the same hydration', t => {
  const logs = [];

  const atom1 = createAtom(() => {
    logs.push('1 observed');
    return () => logs.push('1 unobserved');
  });

  const atom2 = createAtom(() => {
    logs.push('2 observed, no dispose callback');
  });

  const latch = box(true);

  const c1 = computed(() => latch.get() && [atom1, atom2].map(a => a.reportObserved()));
  const c2 = computed(() => !latch.get() && [atom1, atom2].map(a => a.reportObserved()));

  const off = autorun(() => logs.push([c1.get(), c2.get()]));
  latch.set(false);
  off();

  t.deepEqual(logs, [
    '1 observed',
    '2 observed, no dispose callback',
    [[true, true], false],
    [false, [true, true]],
    '1 unobserved',
  ]);
});

test('another circular dependency detection with computed', QuarxMute(t => {
  const latch = box(false, { name: 'latch'});
  const c1 = computed(() => latch.get() && c2.get(), { name: 'c1' });
  const c2 = computed(() => latch.get() && c3.get(), { name: 'c2' });
  const c3 = computed(() => latch.get() && c1.get(), { name: 'c3' });

  let err;

  const off = autorun(() => c1.get(), { onError: e => err = e });
  latch.set(true);

  t.true(err instanceof Error);
  t.is(err.message, '[Quarx ERROR]:cycle detected:c1:c2:c3:c1');

  off();
}));
