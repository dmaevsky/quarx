import test from 'node:test';
import assert from 'node:assert/strict';

import { autorun } from '../src/core.js';
import { toObservable, subscribable } from '../src/adapters.js';
import { box } from '../src/box.js'
import { writable } from 'tinyx';

test('toObservable', () => {
  const w = writable(42);
  const obs = toObservable(w);
  const results = [];

  const off = autorun(() => results.push(obs.get()));
  w.set(55);

  assert.deepEqual(results, [42, 55]);
  off();
});

test('subscribable', () => {
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

  assert.deepEqual(errors, ['-1 is negative']);
  assert.deepEqual(results, [2, 3]);
});

test('toObservable when not observed', () => {
  let subsCount = 0;
  const subs = { subscribe: subscriber => subscriber(42 + subsCount++) };

  const obs = toObservable(subs);

  const off = autorun(() => obs.get());

  assert.equal(obs.get(), 42);
  assert.equal(obs.get(), 42);
  off();

  assert.equal(obs.get(), 43);
  assert.equal(obs.get(), 44);
});
