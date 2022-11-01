import test from 'ava';
import { autorun } from '../src/core.js';
import { toObservable, subscribable } from '../src/adapters.js';
import { box } from '../src/box.js'
import { writable } from 'tinyx';

test('toObservable', t => {
  const w = writable(42);
  const obs = toObservable(w);
  const results = [];

  const off = autorun(() => results.push(obs.get()));
  w.set(55);

  t.deepEqual(results, [42, 55]);
  off();
});

test('subscribable', t => {
  const results = [], errors = [];

  function squareRoot(value) {
    if (value < 0) throw `${value} is negative`;
    return Math.sqrt(value);
  }

  const number = box(4);

  const { subscribe } = subscribable(() => squareRoot(number.get()));
  const off = subscribe(r => results.push(r), e => errors.push(e));

  number.set(-1);
  number.set(9);
  off();

  t.deepEqual(errors, ['-1 is negative']);
  t.deepEqual(results, [2, 3]);
});
