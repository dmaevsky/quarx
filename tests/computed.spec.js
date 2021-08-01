const test = require('ava');
const { autorun, observable, computed } = require('../dist/index');

const computedLogged = log => (name, computation) => computed(() => {
  log.push(`computing ${name}`);

  const result = computation();

  log.push(`${name} = ${result}`);
  return result;
}, { name });

test('only recomputing hydrated computed', t => {
  const log = [];
  const calc = computedLogged(log);

  const boxA = observable.box(false, { name: 'boxA' });
  const boxB = observable.box(5, { name: 'boxB' });
  const boxC = observable.box(6, { name: 'boxC' });

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

  const A = observable.box(0);
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
  const a = observable.box(2, { name: 'boxA' });
  const b = observable.box(3, { name: 'boxB' });

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
