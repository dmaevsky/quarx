import test from 'node:test';
import assert from 'node:assert/strict';

import { autorun, batch, untracked, createAtom } from '../src/core.js';
import { box } from '../src/box.js';

test('autorun stops running after disposed', () => {
  const a = box(1);
  const values = [];

  const dispose = autorun(() => values.push(a.get()));

  a.set(2);
  a.set(2);
  dispose();
  a.set(3);
  a.set(4);

  assert.deepEqual(values, [1, 2]);
});

test('batched updates', () => {
  const a = box(1);
  const b = box(2);
  const values = [];

  const dispose = autorun(() => values.push(a.get() + b.get()));

  batch(() => {
    a.set(5);
    b.set(6);
  });

  assert.deepEqual(values, [3, 11]);
  dispose();
});

test('untracked', () => {
  const a = box(1);
  const b = box(2);
  const values = [];

  const dispose = autorun(() => values.push(untracked(() => a.get()) + b.get()));

  a.set(5);
  b.set(6);

  assert.deepEqual(values, [3, 11]);
  dispose();
});

test('never create self dependencies', () => {
  const a = box(1);
  const values = [];

  const dispose = autorun(() => {
    values.push(a.get());
    a.set(a.get() + 1);
  }, { name: 'set_a' });

  a.set(66);

  assert.deepEqual(values, [1, 66]);
  assert.equal(a.get(), 67);
  dispose();
});

test('never create self dependencies, with additional invalidation', () => {
  const a = box(1);
  const b = box(50);

  const dispose = autorun(() => {
    a.set(a.get() + b.get());
  }, { name: 'set_a' });

  assert.equal(a.get(), 51);
  b.set(9);
  assert.equal(a.get(), 60);

  dispose();
});

test('detect circular dependencies', () => {
  const a = box(1, { name: 'a' });
  const b = box(1, { name: 'b' });

  const errors = [];
  const onError = e => errors.push(e.message);

  const dispose1 = autorun(() => a.set(b.get() + 1), { name: 'set_a', onError });
  const dispose2 = autorun(() => b.set(a.get() + 1), { name: 'set_b', onError });

  assert.deepEqual(errors, [
    '[Quarx ERROR]:cycle detected:set_a:set_b:set_a'
  ]);
  dispose1();
  dispose2();
});

test('detect circular dependencies appearing after the first invalidation', () => {
  const latch = box(false, { name: 'latch' });
  const a = box(1, { name: 'a' });
  const b = box(1, { name: 'b' });
  const c = box(1, { name: 'c' });

  const errors = [];
  const onError = e => errors.push(e.message);

  const dispose1 = autorun(() => latch.get() && a.set(b.get() + 1), { name: 'set_a', onError });
  const dispose2 = autorun(() => latch.get() && b.set(c.get() + 1), { name: 'set_b', onError });
  const dispose3 = autorun(() => latch.get() && c.set(a.get() + 1), { name: 'set_c', onError });

  assert.equal(errors.length, 0);
  latch.set(true);

  assert.deepEqual(errors, [
    '[Quarx ERROR]:invalidate hydrated:set_a',
    '[Quarx ERROR]:invalidate hydrated:set_b'
  ]);
  dispose1();
  dispose2();
  dispose3();
});

test('first computation run invalidation', () => {
  const b = box(5);
  const values = [];

  const dispose1 = autorun(() => values.push(b.get()));
  const dispose2 = autorun(() => b.set(6));

  assert.deepEqual(values, [5, 6]);
  dispose1();
  dispose2();
});

test('greedy cleanup when disposing an autorun from another', () => {
  let a = 5;
  const off1 = autorun(() => {
    createAtom(() => () => a = 42).reportObserved();
  });

  const off2 = autorun(() => {
    off1();
    assert.equal(a, 42);
  });

  off2();
});

test('when a computation disposes itself the unobserved handlers are only called once', () => {
  const b = box(false);
  const logs = [];

  const a = createAtom(() => () => logs.push('unobserved'));

  const off = autorun(() => {
    a.reportObserved();
    if (b.get()) off();
  });

  assert.equal(logs.length, 0);

  b.set(true);
  assert.deepEqual(logs, ['unobserved']);
});
