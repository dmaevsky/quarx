import test from 'ava';
import { autorun, batch, untracked, createAtom, Quarx } from '../src/core.js';
import { box } from '../src/box.js';

const QuarxMute = fn => (...args) => {
  const original = Quarx.error;
  Quarx.error = () => {};
  const result = fn(...args);
  Quarx.error = original;
  return result;
}

test('autorun stops running after disposed', t => {
  const a = box(1);
  const values = [];

  const dispose = autorun(() => values.push(a.get()));

  a.set(2);
  a.set(2);
  dispose();
  a.set(3);
  a.set(4);

  t.deepEqual(values, [1, 2]);
});

test('batched updates', t => {
  const a = box(1);
  const b = box(2);
  const values = [];

  const dispose = autorun(() => values.push(a.get() + b.get()));

  batch(() => {
    a.set(5);
    b.set(6);
  });

  t.deepEqual(values, [3, 11]);
  dispose();
});

test('untracked', t => {
  const a = box(1);
  const b = box(2);
  const values = [];

  const dispose = autorun(() => values.push(untracked(() => a.get()) + b.get()));

  a.set(5);
  b.set(6);

  t.deepEqual(values, [3, 11]);
  dispose();
});

test('never create self dependencies', t => {
  const a = box(1);
  const values = [];

  const dispose = autorun(() => {
    values.push(a.get());
    a.set(a.get() + 1);
  }, { name: 'set_a' });

  a.set(66);

  t.deepEqual(values, [1, 66]);
  t.is(a.get(), 67);
  dispose();
});

test('never create self dependencies, with additional invalidation', t => {
  const a = box(1);
  const b = box(50);

  const dispose = autorun(() => {
    a.set(a.get() + b.get());
  }, { name: 'set_a' });

  t.is(a.get(), 51);
  b.set(9);
  t.is(a.get(), 60);

  dispose();
});

test('detect circular dependencies', QuarxMute(t => {
  const a = box(1, { name: 'a' });
  const b = box(1, { name: 'b' });

  const errors = [];
  const onError = e => errors.push(e.message);

  const dispose1 = autorun(() => a.set(b.get() + 1), { name: 'set_a', onError });
  const dispose2 = autorun(() => b.set(a.get() + 1), { name: 'set_b', onError });

  t.deepEqual(errors, [
    '[Quarx ERROR]:cycle detected:set_a:set_b:set_a'
  ]);
  dispose1();
  dispose2();
}));

test('detect circular dependencies appearing after the first invalidation', QuarxMute(t => {
  const latch = box(false, { name: 'latch' });
  const a = box(1, { name: 'a' });
  const b = box(1, { name: 'b' });
  const c = box(1, { name: 'c' });

  const errors = [];
  const onError = e => errors.push(e.message);

  const dispose1 = autorun(() => latch.get() && a.set(b.get() + 1), { name: 'set_a', onError });
  const dispose2 = autorun(() => latch.get() && b.set(c.get() + 1), { name: 'set_b', onError });
  const dispose3 = autorun(() => latch.get() && c.set(a.get() + 1), { name: 'set_c', onError });

  t.is(errors.length, 0);
  latch.set(true);

  t.deepEqual(errors, [
    '[Quarx ERROR]:invalidate hydrated:set_a:set_b',
    '[Quarx ERROR]:invalidate hydrated:set_b:set_c'
  ]);
  dispose1();
  dispose2();
  dispose3();
}));

test('first computation run invalidation', t => {
  const b = box(5);
  const values = [];

  const dispose1 = autorun(() => values.push(b.get()));
  const dispose2 = autorun(() => b.set(6));

  t.deepEqual(values, [5, 6]);
  dispose1();
  dispose2();
});

test('greedy cleanup when disposing an autorun from another', t => {
  let a = 5;
  const off1 = autorun(() => {
    createAtom(() => () => a = 42).reportObserved();
  });

  const off2 = autorun(() => {
    off1();
    t.is(a, 42);
  });

  off2();
});
