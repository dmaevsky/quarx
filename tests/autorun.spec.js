const test = require('ava');
const { autorun, observable, batch } = require('../dist/index');

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

  autorun(() => values.push(a.get() + b.get()));

  batch(() => {
    a.set(5);
    b.set(6);
  });

  t.deepEqual(values, [3, 11]);
});

test('detect self dependency', t => {
  const a = observable.box(1);

  t.throws(() => {
    autorun(() => {
      a.set(a.get() + 1);
    });
  }, { instanceOf: Error, message: 'Self-dependency detected' });
});

test('detect circular dependencies', t => {
  const a = observable.box(1);
  const b = observable.box(1);

  t.throws(() => {
    autorun(() => a.set(b.get() + 1));
    autorun(() => b.set(a.get() + 1));
  }, { instanceOf: Error, message: 'Circular dependency detected' });
});
