import test from 'ava';
import { autorun, batch, untracked, createAtom } from '../src/core.js';
import { box } from '../src/box.js';

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

test('computation invalidating itself is not considered circular unless it is later invalidated by something else', t => {
  // Not sure this is the correct behavior, but it is in line with the logic that
  // when a computation finishes calculating it is considered "actualized"
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

test('detect self dependency', t => {
  const a = box(1);
  const b = box(55);
  let err;
  const onError = e => err = e.message;

  const dispose = autorun(() => {
    a.set(a.get() + b.get());
  }, { name: 'set_a', onError });

  b.set(66);

  t.is(err, '[Quarx]: Circular dependency detected: set_a -> set_a');
  dispose();
});

test('detect circular dependencies', t => {
  const a = box(1);
  const b = box(1);

  let err;
  const onError = e => err = e.message;

  const dispose1 = autorun(() => a.set(b.get() + 1), { name: 'set_a', onError });
  const dispose2 = autorun(() => b.set(a.get() + 1), { name: 'set_b', onError });

  t.is(err, '[Quarx]: Circular dependency detected: set_a -> set_b -> set_a');
  dispose1();
  dispose2();
});

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
