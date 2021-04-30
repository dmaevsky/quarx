# 🜉 Quarx
Simple tiny dependency graph engine, MobX inspired

## Introduction
In less than 200 lines of code and zero dependencies Quarx supports most of MobX core functionality:
- `createAtom`, `autorun` are the low-level core primitives of the Quarx reactive engine
- `computed`, `observable.box` are built on top of those primitives
- all of the above behave the same way as their MobX equivalents

Unlike MobX, Quarx does not support circular computations even if they might eventually settle. This deliberate design decision allowed for dramatic algorithm simplification while circular calculation graphs do little to promote code clarity.

Another difference with MobX, and the primary reason Quarx saw the light of day is that Quarx **always** runs the computation immediately and synchronously when `autorun` is called, while MobX always delays the execution of nested reactions until the parent reaction exits.

With greedy execution, one can create new observed atoms on the fly (from within a reaction), paired with an `autorun` that should synchronously hydrate the atom at creation. This is by the way exactly how `computed` is implemented in Quarx.

## Usage example
```js
import { autorun, computed, observable, batch } from 'quarx';

const a = observable.box(1);
const b = observable.box(2);
const a_plus_b = computed(() => a.get() + b.get());

console.log('Initial calculation');
autorun(() => console.log(`a + b = ${a_plus_b.get()}`));

console.log('First update');
batch(() => {
  a.set(5);
  b.set(6);
});

console.log('Second update');
batch(() => {
  a.set(4);
  b.set(7);
});

// *** Prints ***
// Initial calculation
// a + b = 3
// First update
// a + b = 11
// Second update
```

## Low-level concepts
There are 2 core primitive abstractions in Quarx: *computations* and *atoms*.

A *computation* is simply a thunk - a parameterless function. Computations are linked together into a DAG (directed acyclical graph) using *atoms*: simple interfaces created using the low-level `createAtom` API function:
- A computation that calls `atom.reportObserved()` becomes the atom's *downstream observer*
- A computation that calls `atom.reportChanged()` becomes the atom's *upstream dependency*
- When `atom.reportChanged()` is called, all atom's downstream observers are scheduled for re-calculation
- When `atom.reportObserved()` is called, it first makes sure that all computations in the atom's upstream sub-graph are up to date before returning control
- `autorun(computation)` creates a computation, immediately executes it, and subsequently re-runs it each time any of the atoms reported observed during the last execution change

During a single synchronous re-actualization (*hydration*) run of the DAG each computation would be executed at most once.

```typescript
  type Disposer = () => void;

  interface Atom {
    reportObserved: () => boolean;
    reportChanged: () => void;
  }

  export function createAtom(name?: string, onBecomeObserved?: () => Disposer | void): Atom;
  export function autorun(computation: () => void): Disposer;

  export function batch(changes: () => void): void;
```
#### NOTE
If passed, the `onBecomeObserved` will be called the first time the atom becomes observed by a downstream computation. If it returns a function, this latter will be called when all the observers unsubscribe from the atom.

`autorun` returns a *disposer* which will unsubscribe the computation from all its currently observed atoms. This makes it a perfect candidate to return from `onBecomeObserved`: this will propagate the subscription removal through the whole upstream subgraph, and it is precisely the way `computed` is implemented in Quarx.

`atom.reportObserved()` returns a `true` if called from within a computation (and hence would be *hydrated*), and `false` otherwise.

`batch(changes)` delays hydration until the `changes` thunk returns

## Basic observables
Using the primitives defined in the previous section one can construct observables of arbitrarily complex behavior.
`observable.box` and `computed` are two classical basic building blocks of a dependency graph.

```typescript
  export interface ObservableOptions<T> {
    name?: string;
    equals?: (a: T, b: T) => boolean;
  }

  export namespace observable {
    export function box<T>(value: T, options?: ObservableOptions<T>): Box<T>;
  }

  export function computed<T>(computation: () => T, options?: ObservableOptions<T>): Observable<T>;
```
Please refer to the [API reference](https://github.com/dmaevsky/quarx/blob/master/index.d.ts) for more detail.

*Box* observables are the upstream leaves of the computations DAG. `aBox.get()` reports the box observed to the calling computation, and `aBox.set(value)` will report it changed if the `value` is different from the current one in the sense of the `equals` option (`===` by default). A *Box* in Quarx is never trying to make its content deeply observable like MobX. It represents a *single* observable value.

*Computed* observables are the intermediate nodes of the DAG representing the *reactive derivations*. `aComputed.get()` returns the result of the computation. If the computation threw an error, the `computed` will store it and re-throw on `get()`. Only if the computation result is different from the previously computed one in the sense of the `equals` option (`===` by default), the change will be reported downstream.

Computed observables are lazy: if they don't have any observers they will unsubscribe from all their upstream dependencies.

All the observables' and atoms' names are for debug purposes only: they do not affect the execution logic.

## Goals and non-goals
The goal for Quarx is to remain a *dry essence* of a dependency graph engine. As simple and tiny as it is, it will replace MobX in production at [ellx.io](https://ellx.io) shortly.

Out of the box, Quarx is not designed to be a state management solution. However, it can be used in combination with [Tinyx](https://github.com/dmaevsky/tinyx) or even Redux. Just put the root store into a single `observable.box`, and derive the rest of the state reactively with a network of `computed` selectors.

**On a side note...**

Converting an Observable to a Svelte store is a one-liner:
```js
const fromObservable = obs => ({ subscribe: subscriber => autorun(() => subscriber(obs.get())) });
```
