import test from 'node:test';
import assert from 'node:assert/strict';

import snapshot from 'usnap';

snapshot.setup(import.meta.url);

import { autorun, createAtom } from '../src/core.js';
import { box } from '../src/box.js';
import { computed } from '../src/computed.js';

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

  snapshot(log, t.name);
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

  snapshot(log, t.name);
  off();
});

test('caches subcomputations', () => {
  const a = box(2, { name: 'boxA' });
  const b = box(3, { name: 'boxB' });

  let aRecomputed, bRecomputed, sumRecomputed;

  const squareA = computed(() => (aRecomputed = true) && a.get() * a.get(), { name: 'squareA' });
  const squareB = computed(() => (bRecomputed = true) && b.get() * b.get(), { name: 'squareB' });
  const sum = computed(() => (sumRecomputed = true) && squareA.get() + squareB.get(), { name: 'sumSquares' });

  autorun(() => sum.get());

  assert(aRecomputed);
  assert(bRecomputed);
  assert(sumRecomputed);

  aRecomputed = bRecomputed = sumRecomputed = false;
  a.set(4);
  assert(aRecomputed);
  assert(!bRecomputed);
});

test('circular deps with computed', () => {
  const fa = box(() => 5, { name: 'fa '});
  const fb = box(() => a.get() + 6, { name: 'fb'});

  const a = computed(() => fa.get()(), { name: 'a' });
  const b = computed(() => fb.get()(), { name: 'b' });

  const values = [], errors = [];

  const off = autorun(() => values.push(b.get()), { onError: e => errors.push(e.message) });

  assert.deepEqual(values, [11]);
  assert.equal(errors.length, 0);

  fa.set(() => b.get());

  assert.deepEqual(errors, ['[Quarx ERROR]:cycle detected:a:b:a']);

  off();
});

test('atom is not unobserved if picked up by another computation during the same hydration', () => {
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

  assert.deepEqual(logs, [
    '1 observed',
    '2 observed, no dispose callback',
    [[true, true], false],
    [false, [true, true]],
    '1 unobserved',
  ]);
});

test('another circular dependency detection with computed', () => {
  const latch = box(false, { name: 'latch'});
  const c1 = computed(() => latch.get() && c2.get(), { name: 'c1' });
  const c2 = computed(() => latch.get() && c3.get(), { name: 'c2' });
  const c3 = computed(() => latch.get() && c1.get(), { name: 'c3' });

  let err;

  const off = autorun(() => c1.get(), { onError: e => err = e });
  latch.set(true);

  assert(err instanceof Error);
  assert.equal(err.message, '[Quarx ERROR]:cycle detected:c1:c2:c3:c1');

  off();
});
