const test = require('ava');
const { autorun, observable, batch, untracked } = require('../dist/index');

test('autorun stops running after disposed', t => {
  const a = observable.box(1);
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
  const a = observable.box(1);
  const b = observable.box(2);
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
  const a = observable.box(1);
  const b = observable.box(2);
  const values = [];

  const dispose = autorun(() => values.push(untracked(() => a.get()) + b.get()));

  a.set(5);
  b.set(6);

  t.deepEqual(values, [3, 11]);
  dispose();
});

test('detect self dependency', t => {
  const a = observable.box(1);
  let err;
  const onError = e => err = e.message;

  const dispose = autorun(() => {
    a.set(a.get() + 1);
  }, { name: 'set_a', onError });

  t.is(err, '[Quarx]: Circular dependency detected: set_a -> set_a -> set_a');
  dispose();
});

test('detect circular dependencies', t => {
  const a = observable.box(1);
  const b = observable.box(1);

  let err;
  const onError = e => err = e.message;

  const dispose1 = autorun(() => a.set(b.get() + 1), { name: 'set_a', onError });
  const dispose2 = autorun(() => b.set(a.get() + 1), { name: 'set_b', onError });

  t.is(err, '[Quarx]: Circular dependency detected: set_b -> set_a -> set_b');
  dispose1();
  dispose2();
});
