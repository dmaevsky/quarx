import test from 'node:test';
import assert from 'node:assert/strict';

import { autorun } from '../src/core.js';
import { observableMap } from '../src/map.js';

test('observableMap', () => {
  const map = observableMap(new Map([['foo', 5]]));
  let updates = {};

  const subscriptions = [
    autorun(() => updates['has(foo)'] = map.has('foo')),
    autorun(() => updates['get(foo)'] = map.get('foo')),
    autorun(() => updates['get(bar)'] = map.get('bar')),
    autorun(() => updates['keys']     = [...map.keys()]),
    autorun(() => updates['values']   = [...map.values()]),
    autorun(() => updates['entries']  = [...map.entries()]),
    autorun(() => updates['size']     = map.size),
  ];

  assert.equal(Object.keys(updates).length, 7);

  const actions = [
    [() => map.set('bar', 6), ['get(bar)', 'keys', 'values', 'entries', 'size']],
    [() => map.set('foo', undefined), ['get(foo)', 'values', 'entries']],
    [() => map.delete('foo'), ['has(foo)', 'get(foo)', 'keys', 'values', 'entries', 'size']],
    [() => map.clear(), ['get(bar)', 'keys', 'values', 'entries', 'size']]
  ];

  for (let [action, result] of actions) {
    updates = {};
    action();
    assert.deepEqual(Object.keys(updates).sort(), result.sort());
  }

  subscriptions.forEach(off => off());
});
