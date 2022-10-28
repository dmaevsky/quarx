import { createAtom, batch } from './core.js';

export function observableMap(map = new Map(), options = {}) {
  const {
    name = 'observableMap',
    equals = (a, b) => a === b
  } = options;

  const atoms = {
    exists: new Map(),
    value: new Map()
  }

  // These atoms are an optimization: an operation touching all elements would only need to report one of these observed
  const allKeys = createAtom(null, { name: `allKeys(${name})` });
  const allValues = createAtom(null, { name: `allValues(${name})` });

  function reportObserved(key, which) {
    const atom = atoms[which].get(key) || createAtom(
      () => {
        atoms[which].set(key, atom);
        return () => atoms[which].delete(key);
      },
      { name: `${which}(${name}[${JSON.stringify(key)}])` }
    );
    atom.reportObserved();
  }

  const reportChanged = (...atoms) => batch(() => atoms.filter(Boolean).forEach(atom => atom.reportChanged()));

  const forward = (...methods) => Object.fromEntries(methods.map(([name, ...atoms]) => [name, function(...args) {
    atoms.forEach(atom => atom.reportObserved());
    return map[name](...args);
  }]));

  return {
    has(key) {
      reportObserved(key, 'exists');
      return map.has(key);
    },
    get(key) {
      reportObserved(key, 'exists');
      reportObserved(key, 'value');
      return map.get(key);
    },
    set(key, value) {
      const changed = !map.has(key) ?
        [atoms.exists.get(key), allKeys] : !equals(map.get(key), value) ?
        [atoms.value.get(key), allValues] : [];

      map.set(key, value);
      reportChanged(...changed);

      return this;
    },
    delete(key) {
      const deleted = map.delete(key);

      if (deleted) reportChanged(atoms.exists.get(key), allKeys);
      return deleted;
    },
    clear() {
      const keys = [...map.keys()];

      map.clear();
      if (keys.length > 0) reportChanged(...keys.map(key => atoms.exists.get(key)), allKeys);
    },
    get size() {
      allKeys.reportObserved();
      return map.size;
    },
    ...forward(
      ['keys', allKeys],
      ['values', allKeys, allValues],
      ['entries', allKeys, allValues],
      ['forEach', allKeys, allValues],
      [Symbol.iterator, allKeys, allValues]
    )
  };
}
